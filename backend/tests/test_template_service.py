"""
Template service tests

Tests verify:
1. Template loading from JSON files
2. Bet creation from templates
3. Contract bug fix: timer_duration → points_value parameter mismatch
4. Template validation

Tests marked with @pytest.mark.unit for selective execution.
"""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock, mock_open
import json
from services.template_service import load_template, create_bets_from_template
from models.event_template import EventTemplate
from models.bet import Bet, BetStatus


@pytest.fixture
def sample_template_data():
    """Sample template data matching actual template structure"""
    return {
        "template_id": "test-event",
        "event_name": "Test Event 2026",
        "description": "Test event description",
        "bets": [
            {
                "question": "Who will win Best Picture?",
                "options": ["Movie A", "Movie B", "Movie C"],
                "timerDuration": 60,
                "pointsValue": 100,
                "trigger": {
                    "type": "keyword",
                    "keywords": ["best picture", "envelope please"],
                    "fuzzy_match": True,
                },
            },
            {
                "question": "Who will win Best Director?",
                "options": ["Director A", "Director B", "Director C"],
                "timerDuration": 45,
                "pointsValue": 150,
                "trigger": {
                    "type": "keyword",
                    "keywords": ["best director", "and the oscar goes"],
                    "fuzzy_match": True,
                },
            },
        ],
    }


@pytest.fixture
def mock_event_template():
    """Mock EventTemplate object"""
    return EventTemplate(
        template_id="test-event",
        event_name="Test Event 2026",
        description="Test event description",
        bets=[
            {
                "question": "Who will win Best Picture?",
                "options": ["Movie A", "Movie B", "Movie C"],
                "timerDuration": 60,
                "pointsValue": 100,
            },
            {
                "question": "Who will win Best Director?",
                "options": ["Director A", "Director B", "Director C"],
                "timerDuration": 45,
                "pointsValue": 150,
            },
        ],
    )


# ============================================================================
# Template Loading Tests
# ============================================================================


@pytest.mark.unit
def test_load_template_success(sample_template_data):
    """Test successful template loading from JSON file"""
    mock_file_content = json.dumps(sample_template_data)

    with patch("pathlib.Path.exists", return_value=True), \
         patch("builtins.open", mock_open(read_data=mock_file_content)):

        template = load_template("test-event")

        assert template is not None
        assert template.template_id == "test-event"
        assert template.event_name == "Test Event 2026"
        assert len(template.bets) == 2


@pytest.mark.unit
def test_load_template_not_found():
    """Test loading non-existent template returns None"""
    with patch("pathlib.Path.exists", return_value=False):
        template = load_template("non-existent-template")
        assert template is None


@pytest.mark.unit
def test_load_template_invalid_json():
    """Test loading template with invalid JSON handles error"""
    with patch("pathlib.Path.exists", return_value=True), \
         patch("builtins.open", mock_open(read_data="invalid json {")):

        with pytest.raises(json.JSONDecodeError):
            load_template("invalid-template")


# ============================================================================
# Bet Creation from Template Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_bets_from_template_success(mock_event_template):
    """Test successful bet creation from template"""
    mock_bet1 = Bet(
        bet_id="bet1",
        room_code="AAAA",
        question="Who will win Best Picture?",
        options=["Movie A", "Movie B", "Movie C"],
        status=BetStatus.PENDING,
        points_value=100,
    )

    mock_bet2 = Bet(
        bet_id="bet2",
        room_code="AAAA",
        question="Who will win Best Director?",
        options=["Director A", "Director B", "Director C"],
        status=BetStatus.PENDING,
        points_value=150,
    )

    with patch("services.template_service.load_template", return_value=mock_event_template), \
         patch("services.bet_service.create_bet") as mock_create_bet:

        # Mock create_bet to return different bets
        mock_create_bet.side_effect = [mock_bet1, mock_bet2]

        bets = await create_bets_from_template("AAAA", "test-event")

        assert len(bets) == 2
        assert mock_create_bet.call_count == 2

        # Verify first call - should use pointsValue, NOT timerDuration
        first_call = mock_create_bet.call_args_list[0]
        assert first_call[1]["room_code"] == "AAAA"
        assert first_call[1]["question"] == "Who will win Best Picture?"
        assert first_call[1]["options"] == ["Movie A", "Movie B", "Movie C"]
        assert first_call[1]["points_value"] == 100  # Should use pointsValue!

        # Verify second call
        second_call = mock_create_bet.call_args_list[1]
        assert second_call[1]["points_value"] == 150


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_bets_from_template_not_found():
    """Test creating bets from non-existent template raises error"""
    with patch("services.template_service.load_template", return_value=None):
        with pytest.raises(ValueError, match="Template not found"):
            await create_bets_from_template("AAAA", "non-existent")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_bets_from_template_empty():
    """Test creating bets from template with no bets"""
    empty_template = EventTemplate(
        template_id="empty-event",
        event_name="Empty Event",
        description="No bets",
        bets=[],
    )

    with patch("services.template_service.load_template", return_value=empty_template):
        bets = await create_bets_from_template("AAAA", "empty-event")
        assert len(bets) == 0


# ============================================================================
# Contract Bug Fix Tests (CRITICAL)
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_template_service_uses_points_value_not_timer_duration():
    """
    CRITICAL BUG FIX TEST: template_service.py line 73

    Current bug: Passes timer_duration to create_bet()
    Expected: Should pass points_value (or pointsValue from template)

    The create_bet() function signature expects:
        create_bet(room_code, question, options, points_value)

    But template_service line 73 currently calls:
        create_bet(..., timer_duration=bet_config.get("timerDuration", 60))

    This test verifies the fix.
    """
    template = EventTemplate(
        template_id="test-event",
        event_name="Test Event",
        description="Test",
        bets=[
            {
                "question": "Test Question?",
                "options": ["A", "B"],
                "timerDuration": 60,  # This should NOT be passed to create_bet
                "pointsValue": 200,  # This SHOULD be passed to create_bet
            }
        ],
    )

    with patch("services.template_service.load_template", return_value=template), \
         patch("services.bet_service.create_bet") as mock_create_bet:

        mock_bet = Bet(
            bet_id="bet1",
            room_code="AAAA",
            question="Test Question?",
            options=["A", "B"],
            status=BetStatus.PENDING,
            points_value=200,
        )
        mock_create_bet.return_value = mock_bet

        await create_bets_from_template("AAAA", "test-event")

        # Verify create_bet was called with points_value, not timer_duration
        mock_create_bet.assert_called_once_with(
            room_code="AAAA",
            question="Test Question?",
            options=["A", "B"],
            points_value=200,  # Should use pointsValue!
        )

        # Verify timer_duration was NOT in the call
        call_kwargs = mock_create_bet.call_args[1]
        assert "timer_duration" not in call_kwargs
        assert "timerDuration" not in call_kwargs


@pytest.mark.unit
@pytest.mark.asyncio
async def test_template_service_default_points_value():
    """Test default points_value when not specified in template"""
    template = EventTemplate(
        template_id="test-event",
        event_name="Test Event",
        description="Test",
        bets=[
            {
                "question": "Test Question?",
                "options": ["A", "B"],
                # No pointsValue specified
            }
        ],
    )

    with patch("services.template_service.load_template", return_value=template), \
         patch("services.bet_service.create_bet") as mock_create_bet:

        mock_bet = Bet(
            bet_id="bet1",
            room_code="AAAA",
            question="Test Question?",
            options=["A", "B"],
            status=BetStatus.PENDING,
            points_value=100,  # Default
        )
        mock_create_bet.return_value = mock_bet

        await create_bets_from_template("AAAA", "test-event")

        # Should use default of 100 points when not specified
        call_kwargs = mock_create_bet.call_args[1]
        assert call_kwargs["points_value"] == 100


# ============================================================================
# Real Template File Validation Tests
# ============================================================================


@pytest.mark.unit
def test_validate_grammys_template():
    """Test loading and validating grammys-2026.json template"""
    # Get actual templates directory
    backend_dir = Path(__file__).parent.parent
    templates_dir = backend_dir.parent / "templates"
    grammys_path = templates_dir / "grammys-2026.json"

    if not grammys_path.exists():
        pytest.skip("grammys-2026.json template not found")

    with open(grammys_path, 'r') as f:
        data = json.load(f)

    # Validate structure
    assert "template_id" in data
    assert "event_name" in data
    assert "bets" in data
    assert isinstance(data["bets"], list)

    # Validate each bet has required fields
    for bet in data["bets"]:
        assert "question" in bet
        assert "options" in bet
        assert isinstance(bet["options"], list)
        assert len(bet["options"]) >= 2

        # Should have pointsValue, not timer_duration
        assert "pointsValue" in bet or "points_value" in bet


@pytest.mark.unit
def test_validate_oscars_template():
    """Test loading and validating oscars-2026.json template"""
    backend_dir = Path(__file__).parent.parent
    templates_dir = backend_dir.parent / "templates"
    oscars_path = templates_dir / "oscars-2026.json"

    if not oscars_path.exists():
        pytest.skip("oscars-2026.json template not found")

    with open(oscars_path, 'r') as f:
        data = json.load(f)

    assert "template_id" in data
    assert "bets" in data

    for bet in data["bets"]:
        assert "question" in bet
        assert "options" in bet


@pytest.mark.unit
def test_validate_superbowl_template():
    """Test loading and validating superbowl-lix.json template"""
    backend_dir = Path(__file__).parent.parent
    templates_dir = backend_dir.parent / "templates"
    superbowl_path = templates_dir / "superbowl-lix.json"

    if not superbowl_path.exists():
        pytest.skip("superbowl-lix.json template not found")

    with open(superbowl_path, 'r') as f:
        data = json.load(f)

    assert "template_id" in data
    assert "bets" in data

    for bet in data["bets"]:
        assert "question" in bet
        assert "options" in bet


# ============================================================================
# Error Handling Tests
# ============================================================================


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_bets_from_template_handles_creation_failure():
    """Test handling of bet creation failure during template loading"""
    template = EventTemplate(
        template_id="test-event",
        event_name="Test Event",
        description="Test",
        bets=[
            {
                "question": "Test Question?",
                "options": ["A", "B"],
                "pointsValue": 100,
            }
        ],
    )

    with patch("services.template_service.load_template", return_value=template), \
         patch("services.bet_service.create_bet") as mock_create_bet:

        # Simulate bet creation failure
        mock_create_bet.side_effect = ValueError("Invalid bet parameters")

        with pytest.raises(ValueError, match="Invalid bet parameters"):
            await create_bets_from_template("AAAA", "test-event")
