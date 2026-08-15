from typing import Any

from rest_framework import serializers

from . import matching
from .models import LibraryBook, PendingDetection


class LibraryBookSerializer(serializers.ModelSerializer):
    class Meta:
        model = LibraryBook
        fields = [
            "id",
            "title",
            "author",
            "catalog_id",
            "ocr_title",
            "ocr_author",
            "match_confidence",
            "match_status_at_add",
            "added_at",
        ]
        read_only_fields = ["id", "added_at"]


class PendingDetectionSerializer(serializers.ModelSerializer):
    # Not a model field -- computed fresh on every request via matching.py,
    # rather than stored and risking it going stale (see models.py).
    match = serializers.SerializerMethodField()

    class Meta:
        model = PendingDetection
        fields = ["id", "crop_image", "read_status", "ocr_title", "ocr_author", "created_at", "match"]
        read_only_fields = fields

    def get_match(self, obj: PendingDetection) -> dict[str, Any] | None:
        if obj.read_status != "ok":
            return None
        return matching.serialize_match(matching.match_book(obj.ocr_title, obj.ocr_author))
