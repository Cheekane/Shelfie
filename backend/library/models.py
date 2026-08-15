from datetime import datetime

from django.db import models


class LibraryBook(models.Model):
    title: str = models.CharField(max_length=300)
    author: str = models.CharField(max_length=300)

    # Soft reference to a catalog.csv row -- not a real ForeignKey since
    # the catalog isn't a database table. Null for manual/unmatched entries.
    catalog_id: str | None = models.CharField(max_length=50, null=True, blank=True)

    # Raw VLM read, kept for comparison against the confirmed title/author above.
    ocr_title: str = models.CharField(max_length=300, blank=True)
    ocr_author: str = models.CharField(max_length=300, blank=True)

    match_confidence: float | None = models.FloatField(null=True, blank=True)

    MATCH_STATUS_CHOICES = [
        ("auto", "auto"),
        ("reviewed_confirmed", "reviewed_confirmed"),
        ("reviewed_corrected", "reviewed_corrected"),
        ("manual", "manual"),
    ]
    match_status_at_add: str = models.CharField(max_length=20, choices=MATCH_STATUS_CHOICES)

    added_at: datetime = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.title} by {self.author}"


class PendingDetection(models.Model):
    # A row existing here IS the "needs review" signal -- no status field.
    # Confirming copies it into LibraryBook and deletes this row; discarding
    # just deletes this row. Match info (candidates, confidence) isn't
    # stored either -- matching.py is cheap and deterministic, so it's
    # recomputed live from ocr_title/ocr_author whenever this is fetched,
    # rather than risking a stale cached result.
    crop_image = models.ImageField(upload_to="pending_crops/")
    READ_STATUS_CHOICES = [
        ("ok", "ok"),
        ("failed", "failed"),
    ]
    read_status: str = models.CharField(max_length=10, choices=READ_STATUS_CHOICES)
    ocr_title: str = models.CharField(max_length=300, blank=True)
    ocr_author: str = models.CharField(max_length=300, blank=True)
    created_at: datetime = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"pending: {self.ocr_title or '(unread)'}"
