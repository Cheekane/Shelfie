from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

# library/catalog.py -> library/ -> backend/ -> repo root -> catalog.csv
CATALOG_PATH = Path(__file__).resolve().parent.parent.parent / "catalog.csv"


@dataclass(frozen=True)
class CatalogEntry:
    # One real book -- one per row in catalog.csv. alt_titles is just
    # the raw "other titles" column, plain strings, nothing derived yet.
    catalog_id: str
    title: str
    author: str
    alt_titles: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class TitleVariant:
    # One searchable (catalog_id, title-string) pair. Every book
    # produces at least one of these (its primary title) plus one more
    # per alt_title -- so the matcher can search across every known
    # title for a book, not just entry.title.
    catalog_id: str
    title_text: str


# Loaded once, then cached here -- None means "not loaded yet."
_entries: dict[str, CatalogEntry] | None = None
_variants: list[TitleVariant] | None = None


def _load() -> None:
    global _entries, _variants
    entries: dict[str, CatalogEntry] = {}
    variants: list[TitleVariant] = []

    with open(CATALOG_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # "A;B" -> ["A", "B"]. The `if t.strip()` matters for rows
            # with NO alt_titles: "".split(";") is [""], not [] -- this
            # filters that stray empty string back out to an empty tuple.
            alt_titles = tuple(t.strip() for t in row["alt_titles"].split(";") if t.strip())

            entry = CatalogEntry(
                catalog_id=row["id"],
                title=row["title"].strip(),
                author=row["author"].strip(),
                alt_titles=alt_titles,
            )
            entries[entry.catalog_id] = entry

            # Flatten: one variant for the primary title, plus one per
            # alt_title, all tagged with the same catalog_id so a
            # search hit on any of them traces back to this one book.
            variants.append(TitleVariant(entry.catalog_id, entry.title))
            for alt in alt_titles:
                variants.append(TitleVariant(entry.catalog_id, alt))

    _entries = entries
    _variants = variants


def get_entries() -> dict[str, CatalogEntry]:
    # Load on first call only; every call after this just returns the
    # already-parsed dict -- no repeated disk reads.
    if _entries is None:
        _load()
    return _entries  # type: ignore[return-value]


def get_title_variants() -> list[TitleVariant]:
    if _variants is None:
        _load()
    return _variants  # type: ignore[return-value]
