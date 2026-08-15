from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from rapidfuzz import fuzz, process

from . import catalog

AUTO_THRESHOLD = 0.87
REVIEW_THRESHOLD = 0.60
TIE_EPSILON = 0.05  # candidates within this of each other are "too close to call"

TITLE_WEIGHT = 0.7
AUTHOR_WEIGHT = 0.3
NO_AUTHOR_TITLE_WEIGHT = 0.85  # can't disambiguate on author if none was read
SUBSTRING_BONUS = 0.05

_LEADING_ARTICLE_RE = re.compile(r"^(the|a|an)\s+")
_PUNCTUATION_RE = re.compile(r"[^\w\s]")
_WHITESPACE_RE = re.compile(r"\s+")
_LASTNAME_FIRST_RE = re.compile(r"^\s*([^,]+),\s*(.+)\s*$")


def _strip_diacritics(s: str) -> str:
    # "é" is decomposed into "e" + a separate combining-accent
    # character; dropping every combining character is what actually
    # turns "García" into "Garcia".
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def normalize_title(title: str) -> str:
    s = _strip_diacritics(title).lower()
    s = _PUNCTUATION_RE.sub(" ", s)
    s = _WHITESPACE_RE.sub(" ", s).strip()
    s = _LEADING_ARTICLE_RE.sub("", s)
    return s


def normalize_author(author: str) -> str:
    s = author.strip()
    m = _LASTNAME_FIRST_RE.match(s)
    if m:
        s = f"{m.group(2)} {m.group(1)}"  # "Orwell, George" -> "George Orwell"
    s = _strip_diacritics(s).lower()
    s = _PUNCTUATION_RE.sub(" ", s)
    s = _WHITESPACE_RE.sub(" ", s).strip()
    return s


@dataclass(frozen=True)
class Candidate:
    catalog_id: str
    title: str
    author: str
    confidence: float


@dataclass(frozen=True)
class MatchResult:
    status: str  # "auto" | "review" | "unmatched"
    catalog_id: str | None
    confidence: float
    candidates: list[Candidate]


def _title_similarity(norm_ocr_title: str, entry: catalog.CatalogEntry) -> float:
    # Check every title this book is known by (primary + alt_titles),
    # take whichever one scores best.
    variants = [entry.title, *entry.alt_titles]
    return max(fuzz.WRatio(norm_ocr_title, normalize_title(v)) / 100 for v in variants)


def _has_substring_relationship(norm_ocr_title: str, entry: catalog.CatalogEntry) -> bool:
    norm_entry_title = normalize_title(entry.title)
    if len(norm_ocr_title) < 4:
        return False
    return norm_ocr_title in norm_entry_title or norm_entry_title in norm_ocr_title


def _score_candidate(ocr_title: str, ocr_author: str | None, entry: catalog.CatalogEntry) -> float:
    norm_ocr_title = normalize_title(ocr_title)
    title_sim = _title_similarity(norm_ocr_title, entry)
    bonus = SUBSTRING_BONUS if _has_substring_relationship(norm_ocr_title, entry) else 0.0

    if not ocr_author:
        composite = title_sim * NO_AUTHOR_TITLE_WEIGHT + bonus
    else:
        author_sim = fuzz.token_sort_ratio(normalize_author(ocr_author), normalize_author(entry.author)) / 100
        composite = TITLE_WEIGHT * title_sim + AUTHOR_WEIGHT * author_sim + bonus

    return min(composite, 1.0)


def _generate_candidate_ids(ocr_title: str, limit: int = 8) -> list[str]:
    # variant (flattened, across the whole catalog) to cheaply narrow
    # 123 books down to a handful of plausible candidates.
    norm_ocr_title = normalize_title(ocr_title)
    variants = catalog.get_title_variants()
    choices = [normalize_title(v.title_text) for v in variants]

    # fuzzy search scans the OCR title against all the catalog titles
    # then returns limit (8) * 3 = 24 matches
    matches = process.extract(norm_ocr_title, choices, scorer=fuzz.WRatio, limit=limit * 3)

    # A book can win via more than one of its variants - keep only its
    # best-scoring hit before ranking, so it doesn't appear twice.
    best_score_by_id: dict[str, float] = {}
    for _, score, idx in matches:
        cid = variants[idx].catalog_id
        if score > best_score_by_id.get(cid, -1):
            best_score_by_id[cid] = score

    ranked = sorted(best_score_by_id, key=best_score_by_id.get, reverse=True)
    return ranked[:limit]


def match_book(ocr_title: str, ocr_author: str | None = None) -> MatchResult:
    if not ocr_title or not ocr_title.strip():
        return MatchResult(status="unmatched", catalog_id=None, confidence=0.0, candidates=[])

    entries = catalog.get_entries()
    candidate_ids = _generate_candidate_ids(ocr_title)

    # precisely score just the shortlist (title + author both).
    scored = [
        Candidate(
            catalog_id=cid,
            title=entries[cid].title,
            author=entries[cid].author,
            confidence=_score_candidate(ocr_title, ocr_author, entries[cid]),
        )
        for cid in candidate_ids
    ]
    scored.sort(key=lambda c: c.confidence, reverse=True)

    if not scored or scored[0].confidence < REVIEW_THRESHOLD:
        return MatchResult(status="unmatched", catalog_id=None, confidence=0.0, candidates=scored[:3])

    top = scored[0]
    is_ambiguous = len(scored) > 1 and (top.confidence - scored[1].confidence) < TIE_EPSILON

    if top.confidence >= AUTO_THRESHOLD and not is_ambiguous:
        return MatchResult(status="auto", catalog_id=top.catalog_id, confidence=top.confidence, candidates=[top])

    # below the auto bar or two candidates are too close to call need human review
    return MatchResult(status="review", catalog_id=top.catalog_id, confidence=top.confidence, candidates=scored[:3])
