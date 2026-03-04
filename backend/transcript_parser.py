"""Transcript parser - Winner extraction and keyword matching

FUNCTIONAL CORE: Pure functions for transcript analysis
- No I/O operations
- Deterministic text processing
- Fuzzy matching with confidence scoring
- Numeric range extraction for score-based bets
"""

import re
from typing import Optional, List, Tuple
from difflib import SequenceMatcher
import math

# Pre-compiled regex for numeric range detection (used in hot path)
_NUMERIC_RANGE_RE = re.compile(
    r'^\s*\d+\s*[-–]\s*\d+\s*(?:runs?|pts|points|goals?|wickets?)?\s*$'
    r'|^\s*\d+\s*\+\s*(?:runs?|pts|points|goals?|wickets?)?\s*$'
    r'|^\s*(?:under|below|less than|<)\s*\d+\s*$'
    r'|^\s*(?:over|above|more than|>)\s*\d+\s*$',
    re.IGNORECASE
)


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


def is_numeric_range_options(options: List[str]) -> bool:
    """Check if bet options are numeric ranges like '0-20', '41-60', '61+'.

    Pure function - string analysis only

    Args:
        options: List of bet options

    Returns:
        True if at least half the options are numeric ranges
    """
    if len(options) < 2:
        return False

    matches = sum(1 for opt in options if _NUMERIC_RANGE_RE.match(opt.strip()))
    return matches >= len(options) / 2


def parse_range_option(option: str) -> Tuple[Optional[float], Optional[float]]:
    """Parse a range option string into (min, max) bounds.

    Pure function - string parsing only

    Args:
        option: Range string like '41-60', '61+', 'Under 20'

    Returns:
        Tuple of (min_val, max_val). None means not parseable.
        math.inf used for unbounded upper limit.
    """
    option = option.strip()

    # Remove unit suffixes
    option = re.sub(
        r'\s*(?:runs?|pts|points|goals?|wickets?)\s*$', '', option, flags=re.IGNORECASE
    ).strip()

    # Pattern: "41-60" or "41–60"
    match = re.match(r'^(\d+)\s*[-–]\s*(\d+)$', option)
    if match:
        return float(match.group(1)), float(match.group(2))

    # Pattern: "61+"
    match = re.match(r'^(\d+)\s*\+$', option)
    if match:
        return float(match.group(1)), math.inf

    # Pattern: "Under 20", "Less than 20", "< 20", "Below 20"
    match = re.match(r'^(?:under|below|less than|<)\s*(\d+)$', option, re.IGNORECASE)
    if match:
        return 0.0, float(match.group(1)) - 1

    # Pattern: "Over 100", "More than 100", "> 100", "Above 100"
    match = re.match(r'^(?:over|above|more than|>)\s*(\d+)$', option, re.IGNORECASE)
    if match:
        return float(match.group(1)) + 1, math.inf

    return None, None


def extract_score_number_from_text(text: str) -> Optional[float]:
    """Extract the most likely score/result number from text.

    Pure function - regex extraction only

    Looks for numbers near result-indicating words like 'runs', 'scored', etc.
    Falls back to extracting all numbers if no contextual match found.

    Args:
        text: Transcript text (e.g., 'Rohit sharma got out for 45 runs')

    Returns:
        The most likely score number, or None if not found
    """
    text_lower = text.lower()

    # Patterns for score numbers (number near result words)
    score_patterns = [
        r'(\d+)\s*(?:runs?|pts|points|goals?|wickets?)',
        r'(?:scored?|made|got|hit)\s+(\d+)',
        r'(?:for|at|on)\s+(\d+)\s*(?:runs?)?',
    ]

    for pattern in score_patterns:
        match = re.search(pattern, text_lower)
        if match:
            return float(match.group(1))

    # Fallback: return the largest number in the text (heuristic)
    all_numbers = [float(n) for n in re.findall(r'\b(\d+)\b', text_lower)]
    if all_numbers:
        return max(all_numbers)

    return None


def match_number_to_range_option(number: float, options: List[str]) -> Optional[str]:
    """Find which range option contains the given number.

    Pure function - numeric comparison only

    Args:
        number: The number to match
        options: List of range option strings

    Returns:
        The matching option string, or None
    """
    for option in options:
        min_val, max_val = parse_range_option(option)
        if min_val is not None and max_val is not None:
            if min_val <= number <= max_val:
                return option
    return None


def generate_resolve_patterns_from_question(question: str) -> List[str]:
    """Generate resolve patterns by extracting key subjects from bet question.

    Pure function - string analysis only

    Extracts content words (removing question/stop words) and builds
    regex patterns to match transcripts about the same subject.

    Args:
        question: Bet question (e.g., 'How much does Rohit sharma score?')

    Returns:
        List of regex patterns (e.g., ['rohit.*sharma'])
    """
    stop_words = {
        "who", "what", "how", "much", "many", "does", "will", "is", "are",
        "the", "a", "an", "in", "on", "at", "to", "for", "of", "with",
        "do", "can", "be", "this", "that", "it", "and", "or", "but",
        "score", "scores", "scored", "win", "wins", "get", "gets",
        "make", "makes", "total", "first", "last", "next", "today",
        "tonight", "match", "game",
    }

    text = normalize_text(question)
    words = text.split()
    content_words = [w for w in words if w not in stop_words and len(w) > 1]

    if not content_words:
        return []

    # Cap at 4 content words to avoid ReDoS with chained .* patterns
    content_words = content_words[:4]

    patterns = []

    # Multi-word subject pattern (e.g., "rohit.*sharma")
    # Use non-greedy .*? to reduce backtracking risk
    if len(content_words) >= 2:
        patterns.append(".*?".join(re.escape(w) for w in content_words))

    # Individual content words as fallback patterns
    for word in content_words:
        if len(word) >= 3:
            patterns.append(re.escape(word))

    return patterns


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

    Supports two extraction strategies:
    1. Numeric range matching: For options like '0-20', '41-60', '61+'
       extracts numbers from text and maps to the correct range
    2. Fuzzy text matching: For text options like player/team names

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

        >>> extract_winner_from_text(
        ...     "Rohit sharma got out for 45 runs",
        ...     ["0-20", "21-40", "41-60", "61+"],
        ...     threshold=0.7
        ... )
        ("41-60", 1.0)
    """
    if not options:
        return None, 0.0

    # Strategy 1: Numeric range matching
    if is_numeric_range_options(options):
        score_number = extract_score_number_from_text(text)
        if score_number is not None:
            winner = match_number_to_range_option(score_number, options)
            if winner:
                return winner, 1.0

    # Strategy 2: Fuzzy text matching
    best_option = None
    best_score = 0.0

    for option in options:
        # Extract just the key part of option (before " - ")
        # e.g., "Cowboy Carter - Beyoncé" -> ["Cowboy Carter", "Beyoncé"]
        # But don't split numeric ranges like "41-60"
        if _NUMERIC_RANGE_RE.match(option.strip()):
            option_parts = [option]
        else:
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
