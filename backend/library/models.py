from django.db import models


# A Model is a Python class that describes one row of a database table.
# Each attribute below (title, author, ...) becomes one column. Django's
# ORM (object-relational mapper) is what translates this class into
# real SQL behind the scenes -- see https://docs.djangoproject.com/en/6.1/topics/db/models/
class LibraryBook(models.Model):
    # CharField = a short text column. max_length is required (Django
    # needs it to build the actual SQL column), not a soft suggestion.
    title = models.CharField(max_length=300)
    author = models.CharField(max_length=300)

    # catalog_id links back to a row in catalog.csv (by its "id" column)
    # -- but catalog.csv isn't a database table (it's static reference
    # data loaded from a file, built later), so this is just a plain
    # string, not a real foreign key. null=True means "this column is
    # allowed to store NULL in the database" -- needed because a manual
    # entry or an unmatched book won't have a catalog match at all.
    catalog_id = models.CharField(max_length=50, null=True, blank=True)

    # What the vision model actually read off the spine, kept around so
    # we (and you, debugging) can compare "what we read" against "what
    # the user confirmed" in the title/author fields above. blank=True
    # means this field is allowed to be an empty string "" -- different
    # from null=True (allowed to be NULL). Text fields conventionally
    # use blank=True instead of null=True: an empty string and NULL
    # would otherwise be two different ways to represent "nothing."
    ocr_title = models.CharField(max_length=300, blank=True)
    ocr_author = models.CharField(max_length=300, blank=True)

    # FloatField = a decimal number column. null=True since a manual
    # entry (never matched against anything) has no confidence score
    # to store at all.
    match_confidence = models.FloatField(null=True, blank=True)

    # choices restricts this field to one of a fixed set of values --
    # Django enforces this in forms/the admin site (not at the raw
    # database level). Each tuple is (value stored in the database,
    # human-readable label). This records *how* a book got added:
    # matched automatically, confirmed/corrected by the user during
    # review, or entered manually with no match at all.
    MATCH_STATUS_CHOICES = [
        ("auto", "auto"),
        ("reviewed_confirmed", "reviewed_confirmed"),
        ("reviewed_corrected", "reviewed_corrected"),
        ("manual", "manual"),
    ]
    match_status_at_add = models.CharField(max_length=20, choices=MATCH_STATUS_CHOICES)

    # DateTimeField = a timestamp column. auto_now_add=True means
    # Django sets this automatically to "now" the moment a row is
    # created, and never touches it again on later saves -- you never
    # set this field yourself.
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        # Just controls how a LibraryBook prints/displays -- e.g. in
        # the admin site's list view. Doesn't affect the database at all.
        return f"{self.title} by {self.author}"
