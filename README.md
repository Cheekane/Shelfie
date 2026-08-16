# Shelfie

Photograph a bookshelf, get back a reviewed, confirmed list of books added to your personal library.

The pipeline is made up by a local object-detection model finds book spines in the photo, a hosted vision-language model reads the title/author off each spine, a fuzzy matcher scores each read against a catalog, and anything the matcher isn't confident about goes to a human review screen before it's saved.

## Architecture

```
mobile/                      Expo Router app (React Native)
  app/(tabs)/
    index.tsx                   Contains two summary cards (Library, Needs Review)
    shelfie.tsx                 Take/pick a photo, POST to /api/scan/
  library.tsx                   Confirmed books, paginated + infinite scroll
    review.tsx                  Pending detections: confirm/correct/discard
  components/                   PendingBookCard, LibraryBookCard, EmptyState, Header, Section
  lib/api.ts                    Typed fetch client, single source of truth for API_BASE_URL
  types/api.ts                  TypeScript types mirroring the backend's serializers

backend/                     Django + Django REST Framework
  library/
    models.py                   LibraryBook (confirmed), PendingDetection (needs review)
    catalog.py                  Loads catalog.csv into memory once per process, no DB table
    detection.py                YOLOv8n wrapper - local object detection, uses CPU
    vlm.py                      Gemini wrapper - reads title/author off each spine crop
    matching.py                 Normalization + fuzzy scoring + confidence thresholds
    views.py, serializers.py, urls.py
  tests/test_matching.py        22 tests covering the matcher's messy-catalog cases
```

**Why `PendingDetection` stores almost nothing derived.** A row existing in this table *is* the "needs review" signal. Confirming a detection copies it into `LibraryBook` and deletes the row and discarding deletes the row. Match info (candidates, confidence) isn't stored either, since `matching.py` is cheap and deterministic, so it's recomputed live from `ocr_title`/`ocr_author` every time a pending row is fetched, rather than risking a stale cached score.

## Setup

Requires Python 3.12+ (pinned for ML library compatibility), [uv](https://docs.astral.sh/uv/), Node 20+, and a phone with Expo Go (or an iOS/Android simulator).

### Backend

```bash
cd backend
uv sync
cp .env.example .env                              # then fill in GEMINI_API_KEY
uv run python manage.py migrate
uv run python manage.py runserver 0.0.0.0:8000    # start the backend server
```

Binding to `0.0.0.0` (not the default `127.0.0.1`) matters for testing on a physical phone -- `0.0.0.0` tells Django to accept connections on every network interface, not just the loopback one a phone can't reach.

Get a free-tier Gemini API key at [ai.google.dev](https://ai.google.dev). The YOLOv8n weights (`backend/library/weights/yolov8n.pt`, ~6MB) are committed to the repo, so no separate model download step is needed.

### Mobile

```bash
cd mobile                   # go to the mobile (frontend directory)
npm install                 # install required dependencies
cp .env.example .env        # then set EXPO_PUBLIC_API_URL to your computer's LAN IP
npx expo start              # start the mobile frontend
```

`EXPO_PUBLIC_API_URL` needs your computer's actual LAN IP (e.g. `http://10.0.0.171:8000`), not `localhost` on a physical phone, `localhost` resolves to the phone itself, not your computer. Find your Mac's LAN IP with `ipconfig getifaddr en0`. iOS Simulator can use `localhost` directly since it shares the host's network stack; Android Emulator needs `http://10.0.2.2:8000`.

Scan the QR code Expo prints with Expo Go, or press `i`/`a` for a simulator.

### Tests

```bash
cd backend                        # go the backend directory
uv run python manage.py test      # test
```

## Building the catalog

There are 123 entries in `catalog.csv`, weighted toward books people actually own (Harry Potter, Tolkien, classics, popular contemporary fiction), not obscure titles nothing would match against. Deliberately messy, not clean, on purpose:

- Two editions of the same book as separate rows (`c001`/`c002`, both "The Hobbit").
- A US/UK title difference via `alt_titles` (`c007`, "...Philosopher's Stone" / "...Sorcerer's Stone").
- Two genuinely different books sharing a title (`c021`/`c022`, "The Alchemist" by Coelho vs. Michael Scott).
- An omnibus alongside its individual volumes (`c006` "The Lord of the Rings" containing `c003`/`c004`/`c005`).
- Titles that are substrings of each other (`c018`/`c019`/`c020`, "Dune" / "Dune Messiah" / "Children of Dune").
- Author names in multiple forms: `Lastname, Firstname` (`c028`, "Orwell, George"), initials (`c003`, "J.R.R. Tolkien"), transliteration (`c026`, "Dostoyevsky, Fyodor" vs. the more common "Fyodor Dostoevsky"), accents (`c023`, "García Márquez").

## How matching works

`matching.py` uses heuristic fuzzy string matching (`rapidfuzz`), with the two real trained models in the pipeline (YOLO for detection, Gemini for reading). The design leans toward false negatives over false positives. An uncertain match should go to human review instead of being marked as certain.

1. **Normalize.** Titles are strip diacritics, lowercase, strip a leading "the/a/an," strip punctuation. Author names are detected and reversed `"Lastname, Firstname"`, strip periods from initials.
2. **Candidate generation.** The catalog is flattened into `(catalog_id, title_variant)` pairs, every entry in a book's `alt_titles` becomes its own searchable row, so a US/UK title variant is matchable without extra logic. `rapidfuzz.process.extract` scans the OCR'd title against every variant and returns the top ~24 hits, deduplicated back down to each book's single best-scoring variant, giving 8 shortlisted candidates.
3. **Composite score.** `0.7 * title_similarity + 0.3 * author_similarity` (using `WRatio` for titles, `token_sort_ratio` for authors), plus a small bonus when one title is a substring of the other. If no author was read, the title similarity alone gets weighted at 0.85 instead, not a fake fix.
4. **Ambiguity forces review.** If the top two candidates' scores land within 0.05 of each other, the result is forced to `"review"` even if the top score alone would clear the auto-add bar, and both candidates are considered. This is what handles two different catalog entries sharing a title.
5. **Thresholds** (heuristic starting points, not derived from a labeled dataset): `>= 0.87` auto-adds, `0.60-0.87` goes to review, `< 0.60` is unmatched.

22 tests in `backend/tests/test_matching.py` cover: accent stripping, article/initials normalization, exact match, US/UK title variants, transliterated/accented authors, editions and shared titles forcing review, omnibus vs. individual volume, no-author matching, author aliases, OCR typos, and garbage input. Two more document known limitations rather than correctness: reordered titles still match (word-order-insensitive), and an unreadable title with a known author stays unmatched (no author-only fallback).

## Local detection

**Detection (`detection.py`):** YOLOv8n via `ultralytics`, pretrained on COCO, filtered to class 73 (`book`), CPU inference. Confidence threshold (`0.2`) and crop padding were tuned empirically against real bookshelf photos. COCO's `book` boxes can be coarse (a cluster of spines rather than one clean box each), which is a known limitation of using a general-purpose COCO model rather than something trained specifically on book spines.

## VLM reading

**VLM reading (`vlm.py`):** Google's Gemini Interactions API (`gemini-3.6-flash`), `thinking_level: "minimal"` (thinking is unnecessary for just reading the image text), structured JSON output with a response schema. Spine crops are batched up to 12 per call rather than one call per spine or one call for all spines. Batches for one photo run **concurrently** using a thread pool rather than sequentially. A photo with enough spines to need 4 batches was taking around 41 seconds to run sequentially. Running the batches concurrently instead brought the latency to the slowest batch, around 8-19 seconds depending on server load, for the same photo.

That parallelization brought a real bug worth noting: `google.genai.Client()` is not safe to share across threads. Concurrent calls on one shared client raced on its underlying `httpx` connection. If one thread finished first, it would silently close the connection from the others even if they were still running. This was fixed by giving each worker thread its own local client (`threading.local()`) instead of using a single shared global client.

Every element of a VLM response is parsed (per-book `try/except`, not one big one) so one broken element doesn't stop the rest of the batch. A batch that fails entirely marks every spine in it `read_status="failed"`. They still become `PendingDetection` rows, since a failed read is still something a human needs to decide about and it doesn't need to block review of the rest of the photo.

## Latency & cost

Measured against a real 41-spine bookshelf photo (`backend/test_photos/bookshelf.jpg`):

| Stage | Latency |
|---|---|
| Local detection (YOLOv8n, CPU) | ~0.6s |
| VLM reads, 4 batches, sequential (before the fix above) | ~41s |
| VLM reads, 4 batches, concurrent (current) | ~8-19s |
| Estimated VLM cost for this photo | ~$0.04 (~$0.001/book) |

VLM cost is computed from the API's real reported token usage (`usage.total_input_tokens` / `total_output_tokens`) against Gemini 3.6 Flash's published per-token pricing. Every `/api/scan/` response includes this in its `meta` block so the number above.

### Cost at scale

(~$0.000963/book, ~41 books/photo):

| Books scanned | Photos | Estimated VLM cost |
|---|---|---|
| 1,000 | 24 | ~$0.96 |
| 100,000 | 2,439 | ~$96.31 |
| 1,000,000 | 24,390 | ~$963.10 |

## Known limitations

- **The app only recognizes books already in `catalog.csv`.** Matching is dependent on if the catalog has the information of a book. A book that isn't one of the catalog's entries will always resolve to `"unmatched"` because there is no external lookup or RAG system. The fallback is the review screen's manual title/author entry (saved with `match_status_at_add: "manual"`, `catalog_id: null`).
- **YOLO's COCO `book` class isn't trained specifically on book spines.** It can produce coarse detection boxes on a packed shelf. A model fine-tuned on book spines specifically would obviously do better, but this is out of scope for the time available here.
- **Author matching can't resolve initials vs. full names** Different designs can have different aliases for the author name ("J.K." vs. "Joanne"). So, title-weighting is important, but clearly not a fix.
- **Confidence thresholds are heuristic.** The confidence thresholds were manually tuned from short trial and error. So, it's highly likely that the thresholds aren't optimally tuned.
- **A failed VLM batch loses every spine in that batch.** This is the tradeoff for efficient processing. It's mitigated by keeping batch sizes small.

## What I'd do with another day

- Add an author-only matching fallback for when the title is unreadable but the author isn't. Right now that case just returns unmatched with nothing to work with, discarding real information.
- Tighten the word-order-insensitivity gap in title matching so two different books with swapped-word titles don't get conflated (see `test_reordered_title_words_still_matches_known_limitation`).
- Fine-tune or swap in a model trained on book spines specifically, instead of general-purpose COCO `book`, which produces coarse boxes on a packed shelf.
- Tune confidence thresholds against a real labeled dataset instead of by eye against test photos.
- Add a task queue and rate-limit-aware batching for the VLM calls, needed before this could handle real volume (came up directly in the cost-at-scale numbers above).
- Add the "one word changed, different book" test case (e.g. two similar but distinct titles) properly, with catalog rows built for it, instead of skipping it for time.

## API reference

All endpoints are under `/api/`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/scan/` | Upload a photo (`image` field). Runs detection + VLM + matching, creates a `PendingDetection` per spine found. Always returns 200 with a `meta` block (latency, cost, warnings) even on partial failure. |
| `GET` | `/pending/?page=&page_size=` | Paginated list of pending detections, each with a live-recomputed `match`. |
| `POST` | `/pending/<id>/` | Confirm a pending detection -- body is the final title/author/catalog_id (possibly hand-corrected). Creates a `LibraryBook`, deletes the pending row. |
| `DELETE` | `/pending/<id>/` | Discard a pending detection -- deletes the row, nothing saved. |
| `GET` | `/library/?page=&page_size=` | Paginated list of confirmed books, newest first. |
| `POST` | `/library/` | Batch-confirm an array of books directly. |

`page_size` defaults to 20, capped at 50.
