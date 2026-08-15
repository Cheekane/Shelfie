from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

# library/catalog.py -> library/ -> backend/ -> repo root -> catalog.csv
CATALOG_PATH = Path(__file__).resolve().parent.parent.parent / "catalog.csv"


@dataclass(frozen=True)
class CatalogEntry:
    catalog_id: str
    title: str
    author: str
    alt_titles: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class TitleVariant:
    # One searchable (catalog_id, title-string) pair -- an entry with N
    # alt_titles produces N+1 of these, so the matcher can find a book
    # by any known title, not just its primary one.
    catalog_id: str
    title_text: str


_entries: dict[str, CatalogEntry] | None = None
_variants: list[TitleVariant] | None = None


def _load() -> None:
    global _entries, _variants
    entries: dict[str, CatalogEntry] = {}
    variants: list[TitleVariant] = []

    with open(CATALOG_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            alt_titles = tuple(t.strip() for t in row["alt_titles"].split(";") if t.strip())
            entry = CatalogEntry(
                catalog_id=row["id"],
                title=row["title"].strip(),
                author=row["author"].strip(),
                alt_titles=alt_titles,
            )
            entries[entry.catalog_id] = entry
            variants.append(TitleVariant(entry.catalog_id, entry.title))
            for alt in alt_titles:
                variants.append(TitleVariant(entry.catalog_id, alt))

    _entries = entries
    _variants = variants


def get_entries() -> dict[str, CatalogEntry]:
    if _entries is None:
        _load()
    return _entries  # type: ignore[return-value]


def get_title_variants() -> list[TitleVariant]:
    if _variants is None:
        _load()
    return _variants  # type: ignore[return-value]
