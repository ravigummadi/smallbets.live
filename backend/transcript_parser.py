"""Transcript parser - Winner extraction and keyword matching

FUNCTIONAL CORE: Pure functions for transcript analysis
- No I/O operations
- Deterministic text processing
- Fuzzy matching with confidence scoring
"""

import re
from typing import Optional, List, Tuple
from difflib import SequenceMatcher


def normalize_text(text: str) -> str:
    """Normalize text for matching

    Pure function - string transformation only

    Args:
        text: Raw text to normalize

    Returns:
        Normalized text (lowercase, stripped, spaces normalized)
    """
    # Convert to lowercase
    text = text.lower()

    # Remove extra whitespace
    text = ' '.join(text.split())

    # Remove common punctuation
    text = re.sub(r'[.,!?;:\'"()]', '', text)

    return text.strip()


def fuzzy_match_score(text: str, pattern: str) -> float:
    """Calculate fuzzy match score between text and pattern

    Pure function - string comparison only

    Args:
        text: Text to search in
        pattern: Pattern to search for

    Returns:
        Similarity score between 0.0 and 1.0
    """
    text_normalized = normalize_text(text)
    pattern_normalized = normalize_text(pattern)

    # Exact match
    if pattern_normalized in text_normalized:
        return 1.0

    # Calculate sequence similarity
    similarity = SequenceMatcher(None, text_normalized, pattern_normalized).ratio()

    # Boost score if all pattern words are in text
    pattern_words = set(pattern_normalized.split())
    text_words = set(text_normalized.split())

    if pattern_words.issubset(text_words):
        # All words present, boost similarity
        similarity = min(1.0, similarity + 0.3)

    return similarity


def match_trigger_patterns(
    text: str,
    patterns: List[str],
    threshold: float = 0.7
) -> Tuple[bool, float, Optional[str]]:
    """Check if text matches any trigger patterns

    Pure function - text matching only

    Args:
        text: Text to check
        patterns: List of regex patterns to match against
        threshold: Minimum confidence score (0.0 - 1.0)

    Returns:
        Tuple of (matched, confidence, matched_pattern)
        Returns the most specific (longest) matching pattern
    """
    if not patterns:
        return False, 0.0, None

    text_normalized = normalize_text(text)

    # Sort patterns by length (descending) to prioritize more specific patterns
    sorted_patterns = sorted(patterns, key=len, reverse=True)

    best_score = 0.0
    best_pattern = None

    for pattern in sorted_patterns:
        # Try regex match first
        try:
            if re.search(pattern, text_normalized, re.IGNORECASE):
                # Found exact regex match - return immediately
                # Since patterns are sorted by length, this is the most specific match
                return True, 1.0, pattern
        except re.error:
            # Invalid regex, fall back to fuzzy match
            pass

        # Fuzzy match as fallback
        score = fuzzy_match_score(text, pattern)
        if score > best_score:
            best_score = score
            best_pattern = pattern

    matched = best_score >= threshold
    return matched, best_score, best_pattern if matched else None


def extract_winner_from_text(
    text: str,
    options: List[str],
    threshold: float = 0.7
) -> Tuple[Optional[str], float]:
    """Extract winning option from announcement text

    Pure function - text analysis only

    Args:
        text: Announcement text (e.g., "And the winner is... Beyoncé!")
        options: List of possible options to match
        threshold: Minimum confidence score

    Returns:
        Tuple of (winning_option, confidence_score)
        Returns (None, 0.0) if no confident match found

    Examples:
        >>> extract_winner_from_text(
        ...     "And the Grammy goes to... Beyoncé for Cowboy Carter!",
        ...     ["Taylor Swift", "Beyoncé", "Billie Eilish"],
        ...     threshold=0.7
        ... )
        ("Beyoncé", 0.95)
    """
    if not options:
        return None, 0.0

    text_normalized = normalize_text(text)
    best_option = None
    best_score = 0.0

    for option in options:
        # Extract just the key part of option (before " - ")
        # e.g., "Cowboy Carter - Beyoncé" -> ["Cowboy Carter", "Beyoncé"]
        option_parts = [part.strip() for part in option.split('-')]

        # Check each part for a match
        for part in option_parts:
            score = fuzzy_match_score(text, part)

            if score > best_score:
                best_score = score
                best_option = option

    if best_score >= threshold:
        return best_option, best_score

    return None, best_score


def extract_winner_with_patterns(
    text: str,
    options: List[str],
    resolve_patterns: List[str],
    threshold: float = 0.85
) -> Tuple[Optional[str], float, bool]:
    """Extract winner after checking if text matches resolution patterns

    Pure function - combines pattern matching with winner extraction

    Args:
        text: Announcement text
        options: List of possible winning options
        resolve_patterns: Patterns that indicate a winner announcement
        threshold: Minimum confidence for winner extraction

    Returns:
        Tuple of (winner, confidence, is_resolution_text)
        - winner: Matched option or None
        - confidence: Match confidence (0.0 - 1.0)
        - is_resolution_text: True if text matches resolution patterns
    """
    # Check if this is a resolution announcement
    is_resolution, pattern_confidence, _ = match_trigger_patterns(
        text, resolve_patterns, threshold=0.6
    )

    if not is_resolution:
        return None, 0.0, False

    # Extract winner from text
    winner, winner_confidence = extract_winner_from_text(text, options, threshold)

    # Combine confidences (resolution pattern + winner extraction)
    combined_confidence = (pattern_confidence + winner_confidence) / 2

    return winner, combined_confidence, True


def should_open_bet(
    text: str,
    open_patterns: List[str],
    threshold: float = 0.7
) -> Tuple[bool, float]:
    """Determine if text should trigger bet opening

    Pure function - pattern matching only

    Args:
        text: Transcript text
        open_patterns: Patterns that indicate bet should open
        threshold: Minimum confidence

    Returns:
        Tuple of (should_open, confidence)
    """
    matched, confidence, _ = match_trigger_patterns(text, open_patterns, threshold)
    return matched, confidence


def calculate_confidence_score(
    pattern_match: float,
    winner_match: float,
    context_bonus: float = 0.0
) -> float:
    """Calculate overall confidence score

    Pure function - score calculation only

    Args:
        pattern_match: Pattern match confidence (0.0 - 1.0)
        winner_match: Winner extraction confidence (0.0 - 1.0)
        context_bonus: Additional context bonus (0.0 - 0.2)

    Returns:
        Combined confidence score (0.0 - 1.0)
    """
    # Weighted average (pattern slightly more important)
    base_score = (pattern_match * 0.6 + winner_match * 0.4)

    # Add context bonus
    final_score = min(1.0, base_score + context_bonus)

    return final_score


def parse_transcript_entry(
    text: str,
    bet_question: str,
    bet_options: List[str],
    open_patterns: List[str],
    resolve_patterns: List[str],
    open_threshold: float = 0.7,
    resolve_threshold: float = 0.85
) -> dict:
    """Parse a transcript entry and determine actions

    Pure function - comprehensive transcript analysis

    Args:
        text: Transcript text to analyze
        bet_question: Current bet question (for context)
        bet_options: Current bet options
        open_patterns: Patterns to trigger bet opening
        resolve_patterns: Patterns to trigger bet resolution
        open_threshold: Confidence threshold for opening
        resolve_threshold: Confidence threshold for resolution

    Returns:
        Dictionary with:
        - action: "open_bet" | "resolve_bet" | "ignore"
        - confidence: confidence score
        - winner: winning option (if action is "resolve_bet")
        - details: additional information
    """
    result = {
        "action": "ignore",
        "confidence": 0.0,
        "winner": None,
        "details": {}
    }

    # Check for bet opening trigger
    should_open, open_confidence = should_open_bet(
        text, open_patterns, open_threshold
    )

    if should_open:
        result["action"] = "open_bet"
        result["confidence"] = open_confidence
        result["details"] = {
            "trigger_type": "open",
            "matched_patterns": open_patterns,
        }
        return result

    # Check for bet resolution
    winner, winner_confidence, is_resolution = extract_winner_with_patterns(
        text, bet_options, resolve_patterns, resolve_threshold
    )

    if is_resolution and winner:
        result["action"] = "resolve_bet"
        result["confidence"] = winner_confidence
        result["winner"] = winner
        result["details"] = {
            "trigger_type": "resolve",
            "matched_patterns": resolve_patterns,
        }
        return result

    # No action triggered
    result["details"] = {
        "open_confidence": open_confidence,
        "winner_confidence": winner_confidence if is_resolution else 0.0,
    }

    return result
