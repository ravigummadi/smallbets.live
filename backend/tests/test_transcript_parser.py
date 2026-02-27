"""Tests for transcript_parser.py - Pure function tests

Tests for text normalization, fuzzy matching, pattern matching, and winner extraction.
"""

import pytest
from transcript_parser import (
    normalize_text,
    fuzzy_match_score,
    match_trigger_patterns,
    extract_winner_from_text,
    extract_winner_with_patterns,
    should_open_bet,
    parse_transcript_entry,
)


class TestNormalizeText:
    """Test text normalization"""

    def test_normalize_converts_to_lowercase(self):
        assert normalize_text("HELLO WORLD") == "hello world"

    def test_normalize_removes_punctuation(self):
        assert normalize_text("Hello, World!") == "hello world"

    def test_normalize_strips_whitespace(self):
        assert normalize_text("  hello  world  ") == "hello world"

    def test_normalize_removes_extra_spaces(self):
        assert normalize_text("hello    world") == "hello world"


class TestFuzzyMatchScore:
    """Test fuzzy matching score calculation"""

    def test_exact_match_returns_1(self):
        score = fuzzy_match_score("album of the year", "album of the year")
        assert score == 1.0

    def test_exact_substring_match_returns_1(self):
        score = fuzzy_match_score("And the Album of the Year goes to...", "album of the year")
        assert score == 1.0

    def test_case_insensitive_match(self):
        score = fuzzy_match_score("ALBUM OF THE YEAR", "album of the year")
        assert score == 1.0

    def test_partial_match_has_lower_score(self):
        score = fuzzy_match_score("album of year", "album of the year")
        assert 0.5 < score < 1.0

    def test_all_words_present_boosts_score(self):
        # All words present but in different order should have high score
        score = fuzzy_match_score("the year of the album", "album of the year")
        assert score > 0.7

    def test_no_match_returns_low_score(self):
        score = fuzzy_match_score("completely different text", "album of the year")
        assert score < 0.3


class TestMatchTriggerPatterns:
    """Test pattern matching with confidence scores"""

    def test_exact_pattern_match(self):
        patterns = ["album of the year", "next category"]
        text = "And now, the album of the year!"

        matched, confidence, pattern = match_trigger_patterns(text, patterns)

        assert matched is True
        assert confidence == 1.0
        assert pattern == "album of the year"

    def test_regex_pattern_match(self):
        patterns = ["next.*category", "and the winner"]
        text = "Next up is the category for best picture"

        matched, confidence, pattern = match_trigger_patterns(text, patterns)

        assert matched is True
        assert confidence == 1.0

    def test_fuzzy_match_above_threshold(self):
        patterns = ["album of the year"]
        text = "album of year"  # Missing "the"

        matched, confidence, pattern = match_trigger_patterns(text, patterns, threshold=0.7)

        assert matched is True
        assert confidence > 0.7

    def test_fuzzy_match_below_threshold(self):
        patterns = ["album of the year"]
        text = "completely different text"

        matched, confidence, pattern = match_trigger_patterns(text, patterns, threshold=0.7)

        assert matched is False

    def test_empty_patterns_returns_false(self):
        matched, confidence, pattern = match_trigger_patterns("any text", [], threshold=0.7)

        assert matched is False
        assert confidence == 0.0
        assert pattern is None

    def test_returns_best_matching_pattern(self):
        patterns = ["album", "album of the year", "year"]
        text = "album of the year"

        matched, confidence, pattern = match_trigger_patterns(text, patterns)

        assert matched is True
        assert confidence == 1.0
        assert pattern == "album of the year"  # Most specific match


class TestExtractWinnerFromText:
    """Test winner extraction from announcement text"""

    def test_extract_exact_winner_name(self):
        text = "And the winner is... Beyoncé!"
        options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]

        winner, confidence = extract_winner_from_text(text, options, threshold=0.7)

        assert winner == "Beyoncé"
        assert confidence > 0.8

    def test_extract_winner_from_complex_option(self):
        text = "The Grammy goes to Cowboy Carter!"
        options = [
            "The Tortured Poets Department - Taylor Swift",
            "Cowboy Carter - Beyoncé",
            "Hit Me Hard and Soft - Billie Eilish"
        ]

        winner, confidence = extract_winner_from_text(text, options, threshold=0.7)

        assert winner == "Cowboy Carter - Beyoncé"
        assert confidence > 0.7

    def test_extract_winner_by_artist_name(self):
        text = "Congratulations to Taylor Swift for The Tortured Poets Department!"
        options = [
            "The Tortured Poets Department - Taylor Swift",
            "Cowboy Carter - Beyoncé",
            "Hit Me Hard and Soft - Billie Eilish"
        ]

        winner, confidence = extract_winner_from_text(text, options, threshold=0.7)

        assert winner == "The Tortured Poets Department - Taylor Swift"
        assert confidence > 0.7

    def test_no_match_returns_none(self):
        text = "The winner will be announced later"
        options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]

        winner, confidence = extract_winner_from_text(text, options, threshold=0.7)

        assert winner is None
        assert confidence < 0.7

    def test_empty_options_returns_none(self):
        text = "And the winner is Beyoncé!"

        winner, confidence = extract_winner_from_text(text, [], threshold=0.7)

        assert winner is None
        assert confidence == 0.0

    def test_case_insensitive_matching(self):
        text = "AND THE WINNER IS BEYONCÉ!"
        options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]

        winner, confidence = extract_winner_from_text(text, options, threshold=0.7)

        assert winner == "Beyoncé"


class TestExtractWinnerWithPatterns:
    """Test winner extraction combined with resolution pattern matching"""

    def test_extract_winner_when_resolution_pattern_matches(self):
        text = "And the Grammy goes to... Beyoncé for Cowboy Carter!"
        options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]
        resolve_patterns = ["grammy goes to", "and the winner is"]

        winner, confidence, is_resolution = extract_winner_with_patterns(
            text, options, resolve_patterns, threshold=0.85
        )

        assert is_resolution is True
        assert winner == "Beyoncé"
        assert confidence > 0.8

    def test_no_winner_when_pattern_doesnt_match(self):
        text = "Next up is Beyoncé performing live!"
        options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]
        resolve_patterns = ["grammy goes to", "and the winner is"]

        winner, confidence, is_resolution = extract_winner_with_patterns(
            text, options, resolve_patterns, threshold=0.85
        )

        assert is_resolution is False
        assert winner is None

    def test_no_winner_when_name_not_in_options(self):
        text = "And the Grammy goes to... Drake!"
        options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]
        resolve_patterns = ["grammy goes to", "and the winner is"]

        winner, confidence, is_resolution = extract_winner_with_patterns(
            text, options, resolve_patterns, threshold=0.85
        )

        assert is_resolution is True
        # Winner should be None because Drake is not in options
        # (or might match with low confidence)
        assert winner is None or confidence < 0.85


class TestShouldOpenBet:
    """Test bet opening trigger logic"""

    def test_should_open_when_pattern_matches(self):
        text = "And now for the album of the year category!"
        patterns = ["album of the year", "next category"]

        should_open, confidence = should_open_bet(text, patterns, threshold=0.7)

        assert should_open is True
        assert confidence > 0.8

    def test_should_not_open_when_no_match(self):
        text = "Here's a performance by Taylor Swift"
        patterns = ["album of the year", "next category"]

        should_open, confidence = should_open_bet(text, patterns, threshold=0.7)

        assert should_open is False


class TestParseTranscriptEntry:
    """Test comprehensive transcript parsing"""

    def test_parse_returns_open_bet_action(self):
        text = "Next category: Album of the Year"
        bet_question = "Who wins Album of the Year?"
        bet_options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]
        open_patterns = ["album of the year", "next category"]
        resolve_patterns = ["grammy goes to", "winner is"]

        result = parse_transcript_entry(
            text, bet_question, bet_options, open_patterns, resolve_patterns
        )

        assert result["action"] == "open_bet"
        assert result["confidence"] > 0.7
        assert result["winner"] is None

    def test_parse_returns_resolve_bet_action(self):
        text = "And the Grammy goes to... Beyoncé!"
        bet_question = "Who wins Album of the Year?"
        bet_options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]
        open_patterns = ["album of the year", "next category"]
        resolve_patterns = ["grammy goes to", "winner is"]

        result = parse_transcript_entry(
            text, bet_question, bet_options, open_patterns, resolve_patterns
        )

        assert result["action"] == "resolve_bet"
        assert result["confidence"] > 0.8
        assert result["winner"] == "Beyoncé"

    def test_parse_returns_ignore_when_no_match(self):
        text = "Thank you all for joining us tonight!"
        bet_question = "Who wins Album of the Year?"
        bet_options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]
        open_patterns = ["album of the year", "next category"]
        resolve_patterns = ["grammy goes to", "winner is"]

        result = parse_transcript_entry(
            text, bet_question, bet_options, open_patterns, resolve_patterns
        )

        assert result["action"] == "ignore"
        assert result["winner"] is None

    def test_open_takes_priority_over_resolve(self):
        """If text matches both open and resolve patterns, open should take priority"""
        text = "Next category is Album of the Year and the winner is announced!"
        bet_question = "Who wins Album of the Year?"
        bet_options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]
        open_patterns = ["next category", "album of the year"]
        resolve_patterns = ["winner is"]

        result = parse_transcript_entry(
            text, bet_question, bet_options, open_patterns, resolve_patterns
        )

        # Open should take precedence
        assert result["action"] == "open_bet"
