"""
Tests for RateLimiter class

Verifies rate limiting enforcement, window expiration,
and boundary conditions.
"""

import time
import pytest
from unittest.mock import patch

from main import RateLimiter


class TestRateLimiter:
    """Test the in-memory RateLimiter"""

    def test_allows_requests_under_limit(self):
        limiter = RateLimiter(max_requests=5, window_seconds=60)

        for _ in range(5):
            assert limiter.is_allowed("192.168.1.1") is True

    def test_blocks_requests_over_limit(self):
        limiter = RateLimiter(max_requests=3, window_seconds=60)

        for _ in range(3):
            assert limiter.is_allowed("192.168.1.1") is True

        assert limiter.is_allowed("192.168.1.1") is False

    def test_different_ips_are_independent(self):
        limiter = RateLimiter(max_requests=2, window_seconds=60)

        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is False

        # Different IP should still be allowed
        assert limiter.is_allowed("10.0.0.1") is True
        assert limiter.is_allowed("10.0.0.1") is True
        assert limiter.is_allowed("10.0.0.1") is False

    @patch("main.time.time")
    def test_window_expiration_allows_new_requests(self, mock_time):
        limiter = RateLimiter(max_requests=2, window_seconds=60)

        # First window at t=0
        mock_time.return_value = 1000.0
        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is False

        # Advance past window
        mock_time.return_value = 1061.0
        assert limiter.is_allowed("192.168.1.1") is True

    @patch("main.time.time")
    def test_partial_window_expiration(self, mock_time):
        """Old requests expire but recent ones remain"""
        limiter = RateLimiter(max_requests=3, window_seconds=60)

        # t=0: first request
        mock_time.return_value = 1000.0
        assert limiter.is_allowed("192.168.1.1") is True

        # t=30: second request
        mock_time.return_value = 1030.0
        assert limiter.is_allowed("192.168.1.1") is True

        # t=50: third request
        mock_time.return_value = 1050.0
        assert limiter.is_allowed("192.168.1.1") is True

        # t=50: at limit
        assert limiter.is_allowed("192.168.1.1") is False

        # t=61: first request expired, second and third still valid
        mock_time.return_value = 1061.0
        assert limiter.is_allowed("192.168.1.1") is True
        # Now at limit again (2nd from t=30, 3rd from t=50, new from t=61)
        assert limiter.is_allowed("192.168.1.1") is False

    def test_single_request_limit(self):
        limiter = RateLimiter(max_requests=1, window_seconds=60)

        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is False

    def test_default_limits(self):
        """Default is 10 requests per 60 seconds"""
        limiter = RateLimiter()
        assert limiter.max_requests == 10
        assert limiter.window_seconds == 60

    @patch("main.time.time")
    def test_exact_boundary_not_expired(self, mock_time):
        """Request exactly at window boundary should still count"""
        limiter = RateLimiter(max_requests=1, window_seconds=60)

        mock_time.return_value = 1000.0
        assert limiter.is_allowed("192.168.1.1") is True

        # Exactly at boundary (60s later), the old entry is NOT expired
        # because condition is `t > window_start` which means t > (1060 - 60) = t > 1000
        # Entry at 1000.0 is NOT > 1000.0, so it should be cleaned
        mock_time.return_value = 1060.0
        assert limiter.is_allowed("192.168.1.1") is True

    def test_empty_ip_string(self):
        limiter = RateLimiter(max_requests=2, window_seconds=60)
        assert limiter.is_allowed("") is True
        assert limiter.is_allowed("") is True
        assert limiter.is_allowed("") is False

    @patch("main.time.time")
    def test_burst_at_boundary(self, mock_time):
        """All requests arriving at same timestamp"""
        limiter = RateLimiter(max_requests=3, window_seconds=60)

        mock_time.return_value = 1000.0
        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is True
        assert limiter.is_allowed("192.168.1.1") is False
