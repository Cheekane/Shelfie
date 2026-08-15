import base64
import io
import logging
from typing import Any

from PIL import Image
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from . import detection, matching, vlm
from .models import LibraryBook
from .serializers import LibraryBookSerializer

logger: logging.Logger = logging.getLogger(__name__)

# Real phone photos can be 3000px+ on a side. Downscaling before local
# detection keeps YOLO inference fast and keeps VLM image-token cost
# bounded, without meaningfully hurting spine legibility -- the crops
# sent on to the VLM are sub-regions anyway.
MAX_PHOTO_DIMENSION: int = 1600


def _downscale(image: Image.Image) -> Image.Image:
    width: int
    height: int
    width, height = image.size
    longest: int = max(width, height)
    if longest <= MAX_PHOTO_DIMENSION:
        return image
    scale: float = MAX_PHOTO_DIMENSION / longest
    return image.resize((int(width * scale), int(height * scale)))


def _encode_data_uri(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG", quality=80)
    encoded: str = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


def _serialize_match(match: matching.MatchResult) -> dict[str, Any]:
    return {
        "status": match.status,
        "catalog_id": match.catalog_id,
        "confidence": round(match.confidence, 3),
        "candidates": [
            {
                "catalog_id": c.catalog_id,
                "title": c.title,
                "author": c.author,
                "confidence": round(c.confidence, 3),
            }
            for c in match.candidates
        ],
    }


@api_view(["POST"])
def scan_photo(request: Request) -> Response:
    upload = request.FILES.get("image")
    if upload is None:
        return Response({"error": "Missing 'image' file in request."}, status=400)

    try:
        image: Image.Image = Image.open(upload)
        image.load()  # force-read now so a truncated/corrupt upload fails here, not later
    except Exception:
        return Response({"error": "Could not read uploaded file as an image."}, status=400)

    try:
        image = _downscale(image)
        spines, local_model_latency_ms = detection.detect_spines(image)

        warnings: list[str] = []
        if not spines:
            warnings.append("No book spines detected in this photo.")
            return Response({
                "detections": [],
                "meta": {
                    "num_spines_detected": 0,
                    "local_model_latency_ms": local_model_latency_ms,
                    "vlm_latency_ms": 0,
                    "vlm_calls": 0,
                    "estimated_cost_usd": 0.0,
                    "warnings": warnings,
                },
            })

        crops: list[Image.Image] = [s["crop"] for s in spines]
        reads, vlm_meta = vlm.read_spines(crops)
        warnings.extend(vlm_meta["warnings"])

        detections: list[dict[str, Any]] = []
        for idx, (spine, read) in enumerate(zip(spines, reads)):
            match_payload: dict[str, Any] | None = None
            if read["read_status"] == "ok":
                match_result = matching.match_book(read["title"], read["author"])
                match_payload = _serialize_match(match_result)

            detections.append({
                "detection_id": idx,
                "bbox": spine["bbox"],
                "crop_thumbnail": _encode_data_uri(spine["crop"]),
                "read_status": read["read_status"],
                "ocr": {"title": read["title"], "author": read["author"]},
                "match": match_payload,
            })

        return Response({
            "detections": detections,
            "meta": {
                "num_spines_detected": len(spines),
                "local_model_latency_ms": local_model_latency_ms,
                "vlm_latency_ms": vlm_meta["vlm_latency_ms"],
                "vlm_calls": vlm_meta["vlm_calls"],
                "estimated_cost_usd": vlm_meta["estimated_cost_usd"],
                "warnings": warnings,
            },
        })
    except Exception:
        # Last-resort catch-all for genuine bugs -- everything expected
        # (timeouts, malformed JSON, zero detections) is already handled
        # above as data, not an exception.
        logger.exception("Unhandled error while scanning photo")
        return Response({"error": "Something went wrong processing this photo."}, status=500)


@api_view(["GET", "POST"])
def library_collection(request: Request) -> Response:
    if request.method == "GET":
        # queries all library books
        books = LibraryBook.objects.all()
        # serializes then sends the data
        return Response({"books": LibraryBookSerializer(books, many=True).data})

    # POST: confirm a batch of books into the library.
    serializer = LibraryBookSerializer(data=request.data.get("books", []), many=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"books": serializer.data}, status=201)
