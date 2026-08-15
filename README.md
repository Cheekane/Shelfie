# Shelfie

Photograph a bookshelf, get back a reviewed, confirmed list of books added to your personal library.

The pipeline: a local object-detection model finds book spines in the photo, a hosted vision-language model reads the title/author off each spine, a fuzzy matcher scores each read against a catalog, and anything the matcher isn't confident about goes to a human review screen before it's saved.

## Architecture

```
mobile/                      Expo Router app (React Native)
  app/(tabs)/
    index.tsx                 Dashboard: two summary cards (Library, Needs Review)
    shelfie.tsx                Capture/pick a photo, POST to /api/scan/
    library.tsx                 Confirmed books, paginated + infinite scroll
    review.tsx                   Pending detections: confirm/correct/discard
  components/                  PendingBookCard, LibraryBookCard, EmptyState, Header, Section
  lib/api.ts                   Typed fetch client, single source of truth for API_BASE_URL
  types/api.ts                 TypeScript types mirroring the backend's serializers

backend/                     Django + Django REST Framework
  library/
    models.py                  LibraryBook (confirmed), PendingDetection (needs review)
    catalog.py                  Loads catalog.csv into memory once per process, no DB table
    detection.py                 YOLOv8n wrapper -- local object detection, CPU
    vlm.py                        Gemini wrapper -- reads title/author off each spine crop
    matching.py                   Normalization + fuzzy scoring + confidence thresholds
    views.py, serializers.py, urls.py
  tests/test_matching.py        17 tests covering the matcher's messy-catalog cases
```

**Why no catalog database table.** `catalog.csv` is static and ships in the repo -- it never changes at runtime, so modeling it as a DB table would need a migration and an import step for no product benefit. `catalog.py` loads it into memory once per process and caches it. `LibraryBook.catalog_id` is a plain string reference to a CSV row's `id` column, not a real foreign key, since the catalog isn't a table.

**Why `PendingDetection` stores almost nothing derived.** A row existing in this table *is* the "needs review" signal -- there's no status field. Confirming a detection copies it into `LibraryBook` and deletes the row; discarding just deletes the row. Match info (candidates, confidence) isn't stored either -- `matching.py` is cheap and deterministic, so it's recomputed live from `ocr_title`/`ocr_author` every time a pending row is fetched, rather than risking a stale cached score.

## Setup

Requires Python 3.12+ (pinned for ML library compatibility), [uv](https://docs.astral.sh/uv/), Node 20+, and a phone with Expo Go (or an iOS/Android simulator).

### Backend

```bash
cd backend
uv sync
cp .env.example .env        # then fill in GEMINI_API_KEY
uv run python manage.py migrate
uv run python manage.py runserver 0.0.0.0:8000
```

Binding to `0.0.0.0` (not the default `127.0.0.1`) matters for testing on a physical phone -- `0.0.0.0` tells Django to accept connections on every network interface, not just the loopback one a phone can't reach.

Get a free-tier Gemini API key at [ai.google.dev](https://ai.google.dev). The YOLOv8n weights (`backend/library/weights/yolov8n.pt`, ~6MB) are committed to the repo, so no separate model download step is needed.

### Mobile

```bash
cd mobile
npm install
cp .env.example .env        # then set EXPO_PUBLIC_API_URL to your computer's LAN IP
npx expo start
```

`EXPO_PUBLIC_API_URL` needs your computer's actual LAN IP (e.g. `http://10.0.0.171:8000`), not `localhost` -- on a physical phone, `localhost` resolves to the phone itself, not your computer. Find your Mac's LAN IP with `ipconfig getifaddr en0`. iOS Simulator can use `localhost` directly since it shares the host's network stack; Android Emulator needs `http://10.0.2.2:8000`.

Scan the QR code Expo prints with Expo Go, or press `i`/`a` for a simulator.

### Tests

```bash
cd backend
uv run python manage.py test
```

## How matching works

`matching.py` is deliberately not "AI" in the ML sense -- it's heuristic fuzzy string matching (`rapidfuzz`), contrasted with the two real trained models in the pipeline (YOLO for detection, Gemini for reading). The design leans toward false negatives over false positives: an uncertain match should go to human review, not get silently saved as if it were certain.

1. **Normalize.** Titles: strip diacritics (NFKD decomposition), lowercase, strip a leading "the/a/an," strip punctuation. Authors: detect and reverse `"Lastname, Firstname"` form, strip periods from initials.
2. **Candidate generation (real blocking, not brute force).** The catalog is flattened into `(catalog_id, title_variant)` pairs -- every entry in a book's `alt_titles` becomes its own searchable row, so a US/UK title variant is matchable without extra logic. `rapidfuzz.process.extract` scans the OCR'd title against every variant and returns the top ~24 hits, deduplicated back down to each book's single best-scoring variant, giving 8 shortlisted candidates.
3. **Composite score on the shortlist only.** `0.7 * title_similarity + 0.3 * author_similarity` (using `WRatio` for titles, `token_sort_ratio` for authors), plus a small bonus when one title is a substring of the other (the omnibus vs. individual-volume case). With no author read at all, title similarity alone gets weighted at 0.85 instead -- an honest limitation, not a fake fix: string similarity genuinely cannot resolve "J.K." vs. "Joanne."
4. **Ambiguity forces review.** If the top two candidates' scores land within 0.05 of each other, the result is forced to `"review"` even if the top score alone would clear the auto-add bar, and both candidates are surfaced. This is what handles two different catalog entries sharing a title.
5. **Thresholds** (heuristic starting points, not derived from a labeled dataset -- stated plainly, not dressed up): `>= 0.87` auto-adds, `0.60-0.87` goes to review, `< 0.60` is unmatched.

17 tests in `backend/tests/test_matching.py` cover: accent stripping, leading-article stripping, `Lastname, Firstname` reordering, initials punctuation, exact match, US/UK title variants via `alt_titles`, transliterated/accented authors, two editions of the same book forcing review instead of guessing, shared titles disambiguated by author, shared titles *without* an author forcing review, omnibus vs. individual volume, no-author confidence penalty, and pure garbage input resolving to unmatched rather than a false positive.

## Local detection + VLM reading

**Detection (`detection.py`):** YOLOv8n via `ultralytics`, pretrained on COCO, filtered to class 73 (`book`), CPU inference. Confidence threshold (`0.2`) and crop padding were tuned empirically against real bookshelf photos, not guessed -- COCO's `book` boxes can be coarse (a cluster of spines rather than one clean box each), which is a known limitation of using a general-purpose COCO model rather than something trained specifically on book spines.

**VLM reading (`vlm.py`):** Google's Gemini Interactions API (`gemini-3.6-flash`), `thinking_level: "minimal"` (thinking is pure latency/cost overhead for a read-the-text task, no product value), structured JSON output via a response schema instead of prompting for JSON and hoping. Spine crops are batched up to 12 per call rather than one call per spine, to amortize the fixed per-call overhead. Batches for one photo run **concurrently** via a thread pool rather than sequentially -- a photo with enough spines to need 4 batches was taking ~41 seconds run sequentially (roughly the sum of each call's latency), which is exactly the kind of scaling problem that turns into a client timeout on a real network. Running the batches concurrently instead cut that to the latency of the slowest single batch, around 8-19 seconds depending on server load, for the same photo.

That parallelization surfaced a real bug worth documenting: `google.genai.Client()` is not safe to share across threads. Concurrent calls on one shared client raced on its underlying `httpx` connection -- one thread finishing first would silently close the connection out from under the others still in flight, surfacing as `RuntimeError: Cannot send a request, as the client has been closed.` Fixed by giving each worker thread its own client (`threading.local()`) instead of one shared global.

Every element of a VLM response is parsed defensively (per-book `try/except`, not one big one) so one malformed element can't sink the rest of a batch. A batch that fails entirely (timeout, network error, malformed JSON) marks every spine in it `read_status="failed"` rather than raising -- those still become `PendingDetection` rows, since a failed read is still something a human needs to decide about (type it in manually, or discard it), and it doesn't need to block review of the rest of the photo.

## Latency & cost

Measured against a real 41-spine bookshelf photo (`backend/test_photos/bookshelf.jpg`):

| Stage | Latency |
|---|---|
| Local detection (YOLOv8n, CPU) | ~0.6s |
| VLM reads, 4 batches, sequential (before the fix above) | ~41s |
| VLM reads, 4 batches, concurrent (current) | ~8-19s |
| Estimated VLM cost for this photo | ~$0.04 (~$0.001/book) |

VLM cost is computed from the Interactions API's real reported token usage (`usage.total_input_tokens` / `total_output_tokens`) against Gemini 3.6 Flash's published per-token pricing, not estimated -- every `/api/scan/` response includes this in its `meta` block so the number above isn't a one-off measurement, it's what the app reports for every scan.

## Known limitations

- **YOLO's COCO `book` class isn't spine-specific.** It can produce coarse boxes on a dense, tightly-packed shelf. A model fine-tuned on book spines specifically would do better; out of scope for the time available here.
- **Author matching can't resolve initials vs. full names** ("J.K." vs. "Joanne") from string similarity alone -- title-weighting is the honest mitigation, not a fix.
- **Confidence thresholds are heuristic**, tuned by eye against test photos and the deliberately-messy catalog, not fit against a labeled dataset.
- **A failed VLM batch loses every spine in that batch** (up to 12), not just one -- the tradeoff for batching calls instead of doing one call per spine. Mitigated by keeping batches small and having every result still land as a reviewable (if failed) pending row rather than silently vanishing.
- **Phone-to-backend networking is real LAN networking**, not a same-machine shortcut -- Wi-Fi quality between the two devices directly affects reliability, same as any client/server setup on a local network.

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
