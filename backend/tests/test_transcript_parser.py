"""Tests for transcript_parser.py - Pure function tests

Tests for text normalization, fuzzy matching, pattern matching, winner extraction,
numeric range matching, and contextual pattern generation.
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
    is_numeric_range_options,
    parse_range_option,
    extract_score_number_from_text,
    match_number_to_range_option,
    generate_resolve_patterns_from_question,
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


class TestIsNumericRangeOptions:
    """Test detection of numeric range options"""

    def test_simple_ranges(self):
        assert is_numeric_range_options(["0-20", "21-40", "41-60", "61+"]) is True

    def test_ranges_with_units(self):
        assert is_numeric_range_options(["0-20 runs", "21-40 runs", "41-60 runs"]) is True

    def test_text_options_not_ranges(self):
        assert is_numeric_range_options(["Taylor Swift", "Beyoncé", "Billie Eilish"]) is False

    def test_mixed_options_majority_ranges(self):
        # 3 out of 4 are ranges
        assert is_numeric_range_options(["0-20", "21-40", "41-60", "Duck"]) is True

    def test_under_over_patterns(self):
        assert is_numeric_range_options(["Under 20", "20-40", "Over 40"]) is True

    def test_too_few_options(self):
        assert is_numeric_range_options(["0-20"]) is False

    def test_yes_no_not_ranges(self):
        assert is_numeric_range_options(["Yes", "No"]) is False


class TestParseRangeOption:
    """Test parsing of range option strings"""

    def test_simple_range(self):
        assert parse_range_option("41-60") == (41.0, 60.0)

    def test_range_with_spaces(self):
        assert parse_range_option(" 41 - 60 ") == (41.0, 60.0)

    def test_plus_range(self):
        import math
        min_val, max_val = parse_range_option("61+")
        assert min_val == 61.0
        assert max_val == math.inf

    def test_range_with_unit(self):
        assert parse_range_option("41-60 runs") == (41.0, 60.0)

    def test_under_pattern(self):
        assert parse_range_option("Under 20") == (0.0, 19.0)

    def test_over_pattern(self):
        import math
        min_val, max_val = parse_range_option("Over 100")
        assert min_val == 101.0
        assert max_val == math.inf

    def test_unparseable_text(self):
        assert parse_range_option("Taylor Swift") == (None, None)

    def test_zero_range(self):
        assert parse_range_option("0-10") == (0.0, 10.0)


class TestExtractScoreNumber:
    """Test score number extraction from transcript text"""

    def test_runs_pattern(self):
        assert extract_score_number_from_text("Rohit sharma got out for 45 runs") == 45.0

    def test_scored_pattern(self):
        assert extract_score_number_from_text("He scored 78 in the innings") == 78.0

    def test_goals_pattern(self):
        assert extract_score_number_from_text("Messi scored 2 goals tonight") == 2.0

    def test_points_pattern(self):
        assert extract_score_number_from_text("LeBron finished with 35 points") == 35.0

    def test_for_pattern(self):
        assert extract_score_number_from_text("Kohli out for 12") == 12.0

    def test_no_numbers(self):
        assert extract_score_number_from_text("No score mentioned here") is None

    def test_multiple_numbers_prefers_contextual(self):
        # Should pick 45 (near "runs") over 3 (near "over")
        result = extract_score_number_from_text("In the 3rd over, got out for 45 runs")
        assert result == 45.0

    def test_made_pattern(self):
        assert extract_score_number_from_text("He made 67 before getting out") == 67.0


class TestMatchNumberToRange:
    """Test matching a number to a range option"""

    def test_matches_correct_range(self):
        options = ["0-20", "21-40", "41-60", "61+"]
        assert match_number_to_range_option(45, options) == "41-60"

    def test_matches_lower_bound(self):
        options = ["0-20", "21-40", "41-60"]
        assert match_number_to_range_option(21, options) == "21-40"

    def test_matches_upper_bound(self):
        options = ["0-20", "21-40", "41-60"]
        assert match_number_to_range_option(60, options) == "41-60"

    def test_matches_plus_range(self):
        options = ["0-20", "21-40", "41-60", "61+"]
        assert match_number_to_range_option(150, options) == "61+"

    def test_matches_zero(self):
        options = ["0-20", "21-40", "41-60"]
        assert match_number_to_range_option(0, options) == "0-20"

    def test_no_match_returns_none(self):
        options = ["10-20", "21-40"]
        assert match_number_to_range_option(5, options) is None


class TestGenerateResolvePatterns:
    """Test contextual resolve pattern generation from bet questions"""

    def test_extracts_player_name(self):
        patterns = generate_resolve_patterns_from_question("How much does Rohit sharma score?")
        assert len(patterns) > 0
        # Should contain a pattern that matches "rohit sharma"
        assert any("rohit" in p and "sharma" in p for p in patterns)

    def test_empty_for_generic_question(self):
        patterns = generate_resolve_patterns_from_question("Who will win?")
        # "win" is a stop word, "who" is a stop word - no useful content
        assert len(patterns) == 0

    def test_extracts_multi_word_name(self):
        patterns = generate_resolve_patterns_from_question("How many sixes will Virat Kohli hit?")
        assert any("virat" in p and "kohli" in p for p in patterns)

    def test_individual_words_as_fallback(self):
        patterns = generate_resolve_patterns_from_question("How much does Rohit sharma score?")
        # Should have individual word patterns too
        assert "rohit" in patterns
        assert "sharma" in patterns


class TestExtractWinnerNumericRanges:
    """Test winner extraction for numeric range bets (the cricket score fix)"""

    def test_cricket_score_resolves_to_correct_range(self):
        """The exact bug scenario: 'got out for 45 runs' should match '41-60'"""
        text = "Rohit sharma got out for 45 runs"
        options = ["0-20", "21-40", "41-60", "61+"]

        winner, confidence = extract_winner_from_text(text, options)

        assert winner == "41-60"
        assert confidence == 1.0

    def test_low_score_matches_first_range(self):
        text = "He was out for just 5 runs"
        options = ["0-20", "21-40", "41-60", "61+"]

        winner, confidence = extract_winner_from_text(text, options)

        assert winner == "0-20"
        assert confidence == 1.0

    def test_high_score_matches_plus_range(self):
        text = "Kohli scored a brilliant 95 runs"
        options = ["0-20", "21-40", "41-60", "61+"]

        winner, confidence = extract_winner_from_text(text, options)

        assert winner == "61+"
        assert confidence == 1.0

    def test_text_options_still_work(self):
        """Existing fuzzy matching should still work for text options"""
        text = "And the winner is Beyoncé!"
        options = ["Taylor Swift", "Beyoncé", "Billie Eilish"]

        winner, confidence = extract_winner_from_text(text, options)

        assert winner == "Beyoncé"
        assert confidence > 0.7

    def test_range_options_with_units(self):
        text = "He made 30 runs before getting out"
        options = ["0-20 runs", "21-40 runs", "41-60 runs", "61+ runs"]

        winner, confidence = extract_winner_from_text(text, options)

        assert winner == "21-40 runs"
        assert confidence == 1.0


class TestEndToEndCricketResolution:
    """End-to-end test for cricket bet resolution via extract_winner_with_patterns"""

    def test_cricket_bet_resolves_with_generated_patterns(self):
        """Simulates the full flow: question-derived patterns + numeric range extraction"""
        text = "Rohit sharma got out for 45 runs"
        options = ["0-20", "21-40", "41-60", "61+"]
        # These are the patterns that would be generated from
        # "How much does Rohit sharma score?"
        resolve_patterns = generate_resolve_patterns_from_question(
            "How much does Rohit sharma score?"
        )

        winner, confidence, is_resolution = extract_winner_with_patterns(
            text, options, resolve_patterns, threshold=0.85
        )

        assert is_resolution is True
        assert winner == "41-60"
        assert confidence > 0.8

    def test_unrelated_transcript_does_not_resolve(self):
        """Transcript about a different player should not resolve the bet"""
        text = "Kohli hit a six off the last ball"
        options = ["0-20", "21-40", "41-60", "61+"]
        resolve_patterns = generate_resolve_patterns_from_question(
            "How much does Rohit sharma score?"
        )

        winner, confidence, is_resolution = extract_winner_with_patterns(
            text, options, resolve_patterns, threshold=0.85
        )

        assert is_resolution is False
        assert winner is None
