"""Dev tool, not part of the app itself: run detect_spines() against a
real photo and save visual proof of what it found -- the full photo
with every box drawn on it, plus each individual crop as its own file.

Usage: uv run python scripts/debug_detection.py path/to/photo.jpg
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from library.detection import detect_spines  # noqa: E402

OUTPUT_DIR = Path(__file__).resolve().parent / "debug_output"


def main(photo_path: str) -> None:
    image: Image.Image = Image.open(photo_path).convert("RGB")
    detections, latency_ms = detect_spines(image)

    print(f"latency_ms: {latency_ms}")
    print(f"detections: {len(detections)}")

    OUTPUT_DIR.mkdir(exist_ok=True)

    annotated: Image.Image = image.copy()
    draw = ImageDraw.Draw(annotated)
    for i, detection in enumerate(detections):
        x1, y1, x2, y2 = detection["bbox"]
        draw.rectangle((x1, y1, x2, y2), outline="red", width=4)
        draw.text((x1 + 4, y1 + 4), str(i), fill="red")

        crop_path = OUTPUT_DIR / f"crop_{i}.jpg"
        detection["crop"].save(crop_path)
        print(f"  [{i}] bbox={[round(v) for v in detection['bbox']]} -> {crop_path}")

    annotated_path = OUTPUT_DIR / "annotated.jpg"
    annotated.save(annotated_path)
    print(f"\nfull photo with boxes drawn on it: {annotated_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: uv run python scripts/debug_detection.py path/to/photo.jpg")
        sys.exit(1)
    main(sys.argv[1])
