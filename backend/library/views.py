import io
import logging

from django.core.files.base import ContentFile
from django.shortcuts import get_object_or_404
from PIL import Image
from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from . import detection, matching, vlm
from .models import LibraryBook, PendingDetection
from .serializers import LibraryBookSerializer, PendingDetectionSerializer

logger: logging.Logger = logging.getLogger(__name__)

# Real phone photos can be 3000px+ on a side. Downscaling before local
# detection keeps YOLO inference fast and keeps VLM image-token cost
# bounded, without meaningfully hurting spine legibility - the crops
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


def _crop_to_content_file(image: Image.Image) -> ContentFile:
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG", quality=85)
    return ContentFile(buf.getvalue(), name="crop.jpg")


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

        # Every detection becomes a PendingDetection, whether it read
        # successfully or not - a failed read still needs a human
        # decision (manually enter it, or discard it), and persisting it
        # means that decision can happen now or after reopening the app.
        pending: list[PendingDetection] = []
        for spine, read in zip(spines, reads):
            pending.append(PendingDetection.objects.create(
                crop_image=_crop_to_content_file(spine["crop"]),
                read_status=read["read_status"],
                ocr_title=read["title"],
                ocr_author=read["author"],
            ))

        return Response({
            "detections": PendingDetectionSerializer(pending, many=True, context={"request": request}).data,
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


@api_view(["GET"])
def pending_collection(request: Request) -> Response:
    pending = PendingDetection.objects.all().order_by("created_at")
    return Response({
        "detections": PendingDetectionSerializer(pending, many=True, context={"request": request}).data,
    })


@api_view(["DELETE", "POST"])
def pending_detail(request: Request, pending_id: int) -> Response:
    pending = get_object_or_404(PendingDetection, id=pending_id)

    if request.method == "DELETE":
        # Discard: no status to track, the row just stops existing.
        pending.crop_image.delete(save=False)
        pending.delete()
        return Response(status=204)

    # POST: confirm -- request body is the user's final decision (title/
    # author/etc, possibly hand-corrected). Creates the real LibraryBook,
    # then this pending row's job is done.
    serializer = LibraryBookSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    book = serializer.save()

    pending.crop_image.delete(save=False)
    pending.delete()

    return Response(LibraryBookSerializer(book).data, status=201)


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
