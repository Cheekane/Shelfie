from __future__ import annotations

from pathlib import Path
from typing import TypedDict
import time

from PIL import Image
from ultralytics import YOLO
from ultralytics.engine.results import Boxes, Results

WEIGHTS_PATH: Path = Path(__file__).resolve().parent / "weights" / "yolov8n.pt"
BOOK_CLASS_ID: int = 73  # COCO class index for "book"
CONFIDENCE_THRESHOLD: float = 0.2
CROP_PADDING_RATIO: float = 0.01  # margin


class Detection(TypedDict):
    bbox: list[float]
    crop: Image.Image


_model: YOLO | None = None


def get_model() -> YOLO:
    # Load once per process, not once per request -- the whole point of
    # this cache is the same idea as catalog.py's _load()/get_entries().
    global _model
    if _model is None:
        _model = YOLO(str(WEIGHTS_PATH))
    return _model


def detect_spines(image: Image.Image) -> tuple[list[Detection], int]:
    """Find book-shaped boxes in a shelf photo.

    Returns (detections, latency_ms). CPU-only, no network calls --
    this is the "local model" half of the pipeline.
    """
    model: YOLO = get_model()

    t0: float = time.monotonic()
    # model.predict() is typed to return several possible shapes depending
    # on its arguments (stream=True gives an Iterator, etc.) -- with the
    # arguments we actually pass, it's always list[Results].
    results: list[Results] = model.predict(
        source=image,
        classes=[BOOK_CLASS_ID],
        conf=CONFIDENCE_THRESHOLD,
        device="cpu",
        verbose=False,
    )
    latency_ms: int = int((time.monotonic() - t0) * 1000)

    width: int
    height: int
    width, height = image.size

    detections: list[Detection] = []
    box: Boxes
    for box in results[0].boxes:
        x1: float
        y1: float
        x2: float
        y2: float
        x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])

        pad_x: float = (x2 - x1) * CROP_PADDING_RATIO
        pad_y: float = (y2 - y1) * CROP_PADDING_RATIO
        crop_box: tuple[float, float, float, float] = (
            max(0, x1 - pad_x),
            max(0, y1 - pad_y),
            min(width, x2 + pad_x),
            min(height, y2 + pad_y),
        )
        detections.append({
            "bbox": [x1, y1, x2, y2],
            "crop": image.crop(crop_box),
        })

    return detections, latency_ms
