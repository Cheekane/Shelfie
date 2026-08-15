from __future__ import annotations

import base64
import io
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, TypedDict

from google import genai
from PIL import Image

MODEL_NAME: str = "gemini-3.6-flash"
MAX_CROPS_PER_CALL: int = 12
TIMEOUT_SECONDS: int = 20

# Gemini 3.6 Flash paid-tier pricing (ai.google.dev/gemini-api/docs/pricing),
INPUT_PRICE_PER_1M_TOKENS: float = 0.75
OUTPUT_PRICE_PER_1M_TOKENS: float = 3.75

PROMPT_TEXT: str = (
    "You are reading book spines cropped from a bookshelf photo, given in "
    "index order (0, 1, 2, ...). For each image, read the title and author "
    "printed on the spine. If a spine is not legible - blurry, obscured, "
    "cut off, or you are not confident - set legible to false and leave "
    "title/author as empty strings rather than guessing. Note that there "
    "can be images that aren't actually books/spines. There can also be "
    "other text on the spine other than the title and author."
)

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "reads": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "title": {"type": "string"},
                    "author": {"type": "string"},
                    "legible": {"type": "boolean"},
                },
                "required": ["index", "title", "author", "legible"],
            },
        },
    },
    "required": ["reads"],
}


class Read(TypedDict):
    read_status: str  # "ok" | "failed"
    title: str
    author: str


class ReadMeta(TypedDict):
    vlm_latency_ms: int
    vlm_calls: int
    estimated_cost_usd: float
    warnings: list[str]


_thread_local = threading.local()


def get_client() -> genai.Client:
    # One client per worker thread, not a shared global -- interactions.create()
    # calls running concurrently on a single shared genai.Client() race on its
    # underlying httpx connection (one thread's call closes it mid-flight for
    # the others), surfacing as "Cannot send a request, as the client has
    # been closed." Cheap to construct, so per-thread is the simple fix.
    client = getattr(_thread_local, "client", None)
    if client is None:
        client = genai.Client()
        _thread_local.client = client
    return client


def _encode_jpeg(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _empty_read() -> Read:
    return {"read_status": "failed", "title": "", "author": ""}


def _call_gemini(crops: list[Image.Image]) -> tuple[list[Read], int, float, list[str]]:
    """One Interactions API call for up to MAX_CROPS_PER_CALL crops.

    Always returns a result for every crop, in order -- a failure here
    is data (read_status="failed" per crop), never an exception raised
    past this function.
    """
    warnings: list[str] = []
    results: list[Read] = [_empty_read() for _ in crops]

    input_items: list[dict[str, str]] = [{"type": "text", "text": PROMPT_TEXT}]
    for crop in crops:
        input_items.append({
            "type": "image",
            "mime_type": "image/jpeg",
            "data": _encode_jpeg(crop),
        })

    t0: float = time.monotonic()
    try:
        interaction = get_client().interactions.create(
            model=MODEL_NAME,
            input=input_items,
            generation_config={"thinking_level": "minimal"},
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": RESPONSE_SCHEMA,
            },
            timeout=TIMEOUT_SECONDS,
        )
    except Exception as exc:  # noqa: BLE001 - any failure mode here is "the call failed"
        latency_ms = int((time.monotonic() - t0) * 1000)
        warnings.append(f"VLM call failed ({type(exc).__name__}); {len(crops)} spine(s) unread.")
        return results, latency_ms, 0.0, warnings

    latency_ms: int = int((time.monotonic() - t0) * 1000)

    usage = interaction.usage
    cost: float = 0.0
    if usage is not None:
        cost = (
            (usage.total_input_tokens or 0) / 1_000_000 * INPUT_PRICE_PER_1M_TOKENS
            + (usage.total_output_tokens or 0) / 1_000_000 * OUTPUT_PRICE_PER_1M_TOKENS
        )

    try:
        parsed: dict[str, Any] = json.loads(interaction.output_text)
        reads: list[dict[str, Any]] = parsed["reads"]
        if not isinstance(reads, list):
            raise ValueError("'reads' was not a list")
    except Exception as exc:  # noqa: BLE001 - malformed model output is expected, not exceptional
        warnings.append(f"Malformed VLM JSON ({type(exc).__name__}); {len(crops)} spine(s) unread.")
        return results, latency_ms, cost, warnings

    for item in reads:
        try:
            idx: int = item["index"]
            if not (0 <= idx < len(crops)):
                continue
            if item.get("legible") and item.get("title"):
                results[idx] = {
                    "read_status": "ok",
                    "title": item["title"],
                    "author": item.get("author", ""),
                }
            # else: leave as the default failed/empty read -- an explicit
            # "not legible" is not a crash, just a per-book failure state.
        except Exception:  # noqa: BLE001 - one bad element must not sink the rest
            continue

    return results, latency_ms, cost, warnings


def read_spines(crops: list[Image.Image]) -> tuple[list[Read], ReadMeta]:
    """Read title/author off each spine crop, in order.

    Returns (reads, meta). reads[i] corresponds to crops[i] and is
    always present even on total failure (read_status="failed").
    """
    if not crops:
        return [], {"vlm_latency_ms": 0, "vlm_calls": 0, "estimated_cost_usd": 0.0, "warnings": []}

    chunks: list[list[Image.Image]] = [
        crops[start : start + MAX_CROPS_PER_CALL] for start in range(0, len(crops), MAX_CROPS_PER_CALL)
    ]

    # Chunks are independent network calls, so run them concurrently instead
    # of summing their latency -- a busy shelf with e.g. 4 chunks otherwise
    # takes 4x as long as it needs to.
    t0: float = time.monotonic()
    with ThreadPoolExecutor(max_workers=len(chunks)) as pool:
        chunk_results = list(pool.map(_call_gemini, chunks))
    wall_latency_ms: int = int((time.monotonic() - t0) * 1000)

    all_reads: list[Read] = []
    total_cost: float = 0.0
    all_warnings: list[str] = []
    for reads, _latency_ms, cost, warnings in chunk_results:
        all_reads.extend(reads)
        total_cost += cost
        all_warnings.extend(warnings)

    meta: ReadMeta = {
        "vlm_latency_ms": wall_latency_ms,
        "vlm_calls": len(chunks),
        "estimated_cost_usd": round(total_cost, 6),
        "warnings": all_warnings,
    }
    return all_reads, meta
