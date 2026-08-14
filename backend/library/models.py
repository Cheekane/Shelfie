from django.db import models


class LibraryBook(models.Model):
    title = models.CharField(max_length=300)
    author = models.CharField(max_length=300)

    # Soft reference to a catalog.csv row -- not a real ForeignKey since
    # the catalog isn't a database table. Null for manual/unmatched entries.
    catalog_id = models.CharField(max_length=50, null=True, blank=True)

    # Raw VLM read, kept for comparison against the confirmed title/author above.
    ocr_title = models.CharField(max_length=300, blank=True)
    ocr_author = models.CharField(max_length=300, blank=True)

    match_confidence = models.FloatField(null=True, blank=True)

    MATCH_STATUS_CHOICES = [
        ("auto", "auto"),
        ("reviewed_confirmed", "reviewed_confirmed"),
        ("reviewed_corrected", "reviewed_corrected"),
        ("manual", "manual"),
    ]
    match_status_at_add = models.CharField(max_length=20, choices=MATCH_STATUS_CHOICES)

    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} by {self.author}"
