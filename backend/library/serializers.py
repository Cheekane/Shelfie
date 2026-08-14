from rest_framework import serializers

from .models import LibraryBook


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
