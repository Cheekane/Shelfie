"""Tests for the matcher, each tied to a specific messiness case the
catalog was deliberately built to contain (see catalog.csv). These run
against the real catalog.csv, not a mock -- the whole point is that
these specific rows are genuinely hard to match, and a fixture would
hide that.
"""

from django.test import SimpleTestCase

from library.matching import match_book, normalize_author, normalize_title


class NormalizationTests(SimpleTestCase):
    def test_strips_accents(self) -> None:
        self.assertEqual(normalize_title("Café"), "cafe")

    def test_strips_leading_article(self) -> None:
        self.assertEqual(normalize_title("The Hobbit"), "hobbit")

    def test_author_lastname_first_is_reordered(self) -> None:
        self.assertEqual(normalize_author("Orwell, George"), normalize_author("George Orwell"))

    def test_author_initials_punctuation_ignored(self) -> None:
        self.assertEqual(normalize_author("J.R.R. Tolkien"), normalize_author("J R R Tolkien"))


class MatchingTests(SimpleTestCase):
    def test_exact_match_auto_adds(self) -> None:
        result = match_book("Circe", "Madeline Miller")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c121")

    def test_us_uk_title_variant_matches_via_alt_titles(self) -> None:
        # catalog stores "Harry Potter and the Philosopher's Stone" with
        # "...Sorcerer's Stone" as an alt_title (US/UK edition case).
        result = match_book("Harry Potter and the Sorcerer's Stone", "J.K. Rowling")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c007")

    def test_author_lastname_first_form_still_matches(self) -> None:
        # catalog stores this author as "Orwell, George".
        result = match_book("Animal Farm", "George Orwell")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c028")

    def test_transliterated_author_still_matches(self) -> None:
        # catalog stores "Dostoyevsky, Fyodor"; OCR reads the more common
        # English transliteration "Fyodor Dostoevsky".
        result = match_book("The Brothers Karamazov", "Fyodor Dostoevsky")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c026")

    def test_accented_author_matches_unaccented_read(self) -> None:
        result = match_book("One Hundred Years of Solitude", "Gabriel Garcia Marquez")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c023")

    def test_two_editions_of_same_book_force_review_not_a_guess(self) -> None:
        # c001 and c002 are deliberately identical (title, author) --
        # two editions of The Hobbit as separate catalog rows. The
        # matcher can't tell them apart, and correctly doesn't pretend
        # to: it must route to review rather than silently picking one.
        result = match_book("The Hobbit", "JRR Tolkien")
        self.assertEqual(result.status, "review")
        candidate_ids = {c.catalog_id for c in result.candidates[:2]}
        self.assertEqual(candidate_ids, {"c001", "c002"})

    def test_shared_title_disambiguated_by_author(self) -> None:
        # "The Alchemist" exists twice in the catalog as two genuinely
        # different books (Coelho vs. Michael Scott). A correct author
        # read must resolve to the right one, not just "a" match.
        coelho = match_book("The Alchemist", "Paulo Coelho")
        self.assertEqual(coelho.status, "auto")
        self.assertEqual(coelho.catalog_id, "c021")

        scott = match_book("The Alchemist", "Michael Scott")
        self.assertEqual(scott.status, "auto")
        self.assertEqual(scott.catalog_id, "c022")

    def test_shared_title_without_author_forces_review(self) -> None:
        # Same shared-title pair, but with no author read at all --
        # nothing to disambiguate on, so both must surface for review
        # rather than the matcher guessing which "Alchemist" it is.
        result = match_book("The Alchemist")
        self.assertEqual(result.status, "review")
        candidate_ids = {c.catalog_id for c in result.candidates[:2]}
        self.assertEqual(candidate_ids, {"c021", "c022"})

    def test_omnibus_does_not_shadow_individual_volume(self) -> None:
        # "The Lord of the Rings" (c006) is an omnibus of c003/c004/c005.
        # A precise individual-volume title should win outright, not get
        # dragged into ambiguity by the omnibus entry.
        result = match_book("The Fellowship of the Ring", "J.R.R. Tolkien")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c003")

    def test_substring_title_family_forces_review(self) -> None:
        # "Dune" is a literal substring of "Dune Messiah" and "Children
        # of Dune", and all three share the same author -- author can't
        # disambiguate here. The matcher should conservatively route to
        # review rather than risk auto-adding the wrong book in the
        # series, even though the top candidate is the correct one.
        result = match_book("Dune", "Frank Herbert")
        self.assertEqual(result.status, "review")
        self.assertEqual(result.catalog_id, "c018")

    def test_no_author_read_applies_a_confidence_penalty(self) -> None:
        with_author = match_book("Circe", "Madeline Miller")
        without_author = match_book("Circe", None)
        self.assertGreater(with_author.confidence, without_author.confidence)

    def test_garbage_input_is_unmatched_not_a_false_positive(self) -> None:
        result = match_book("asdkjhasdkjh garbage nonsense", "nobody")
        self.assertEqual(result.status, "unmatched")
        self.assertIsNone(result.catalog_id)

    def test_empty_title_is_unmatched(self) -> None:
        result = match_book("", "Someone")
        self.assertEqual(result.status, "unmatched")

    def test_missing_author_still_auto_matches_a_unique_title(self) -> None:
        # No author read at all, but the title alone is unique in the
        # catalog -- NO_AUTHOR_TITLE_WEIGHT (0.85) plus the substring
        # bonus is still enough to clear the auto-add bar on its own.
        result = match_book("Circe", None)
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c121")

    def test_author_initials_vs_full_first_name_still_matches_unique_title(self) -> None:
        # "J.K." vs "Joanne" is a real gap -- author similarity against
        # the catalog's stored "J.K. Rowling" is only ~0.72 here, not a
        # clean match. But for a unique title, TITLE_WEIGHT (0.7) plus
        # the substring bonus carries the match through anyway. This is
        # the title-weighting mitigation working as designed, not proof
        # the initials-vs-full-name limitation doesn't exist.
        result = match_book("Harry Potter and the Philosopher's Stone", "Joanne Rowling")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c007")

    def test_single_character_ocr_typo_still_matches(self) -> None:
        # "Graet" for "Great" -- WRatio absorbs a small character-level
        # misread without trouble.
        result = match_book("The Graet Gatsby", "F. Scott Fitzgerald")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c036")

    def test_reordered_title_words_still_matches_known_limitation(self) -> None:
        # WRatio is largely word-order-insensitive: a title with its
        # words swapped still matches confidently. Documented here as a
        # known limitation, not a fix -- two genuinely different books
        # whose titles happen to be word-order swaps of each other
        # would be conflated the same way.
        result = match_book("Farm Animal", "George Orwell")
        self.assertEqual(result.status, "auto")
        self.assertEqual(result.catalog_id, "c028")

    def test_unreadable_title_with_known_author_is_unmatched_known_limitation(self) -> None:
        # Candidate generation is entirely title-driven
        # (_generate_candidate_ids only ever searches by title) -- there
        # is no author-only fallback path. A known author with an
        # unreadable title currently yields nothing to work with, not
        # even a suggestion. Documented here as a known limitation, not
        # a fix.
        result = match_book("", "George Orwell")
        self.assertEqual(result.status, "unmatched")
        self.assertIsNone(result.catalog_id)
        self.assertEqual(result.candidates, [])
