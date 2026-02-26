"""
Tests for CORS & Security Configuration (Phase 5 / Section 4.4)

Tests verify:
- Development/Testing: localhost origins are allowed
- Production: only production domains are allowed
- Wildcard origins and unknown domains are rejected
- Environment variable ALLOWED_ORIGINS is respected
- Proper CORS headers on preflight and actual requests

Test approach: Use FastAPI TestClient to verify CORS behaviour.
The tests examine response headers on preflight (OPTIONS) and
actual requests to confirm correct Access-Control-* headers.
"""

import os
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_app_with_origins(allowed_origins: list[str]):
    """Create a fresh FastAPI app with specific CORS origins.

    This simulates what the production app should do: read ALLOWED_ORIGINS
    from environment and configure CORS middleware accordingly.
    """
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    @app.get("/api/rooms/TEST")
    async def get_room():
        return {"code": "TEST", "status": "waiting"}

    @app.post("/api/rooms")
    async def create_room():
        return {"room_code": "ABCD"}

    return app


def _make_app_from_env():
    """Create a FastAPI app that reads ALLOWED_ORIGINS from env.

    This tests the recommended production pattern:
    ALLOWED_ORIGINS=https://smallbets.live,https://www.smallbets.live
    """
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health():
        return {"status": "ok"}

    return app


# ---------------------------------------------------------------------------
# 4.4.1 Development/Testing origins
# ---------------------------------------------------------------------------

class TestDevCorsConfig:
    """CORS configuration for development/testing environments."""

    @pytest.fixture
    def dev_client(self):
        app = _make_app_with_origins([
            "http://localhost:5173",
            "http://localhost:3000",
        ])
        return TestClient(app)

    def test_vite_dev_server_origin_allowed(self, dev_client):
        """Requests from Vite dev server (port 5173) should be allowed."""
        response = dev_client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

    def test_react_dev_server_origin_allowed(self, dev_client):
        """Requests from CRA dev server (port 3000) should be allowed."""
        response = dev_client.get(
            "/api/health",
            headers={"Origin": "http://localhost:3000"},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_unknown_localhost_port_rejected(self, dev_client):
        """Requests from unknown localhost port should be rejected."""
        response = dev_client.get(
            "/api/health",
            headers={"Origin": "http://localhost:9999"},
        )
        # CORS middleware does NOT block the request (that's browser's job),
        # but it should NOT include the Access-Control-Allow-Origin header
        assert response.headers.get("access-control-allow-origin") is None

    def test_external_origin_rejected(self, dev_client):
        """Requests from external origins should be rejected."""
        response = dev_client.get(
            "/api/health",
            headers={"Origin": "https://evil.example.com"},
        )
        assert response.headers.get("access-control-allow-origin") is None

    def test_preflight_request_includes_cors_headers(self, dev_client):
        """Preflight (OPTIONS) requests should return proper CORS headers."""
        response = dev_client.options(
            "/api/rooms",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type,X-Host-Id",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert "POST" in response.headers.get("access-control-allow-methods", "")

    def test_preflight_with_rejected_origin(self, dev_client):
        """Preflight from rejected origin should not include allow headers."""
        response = dev_client.options(
            "/api/rooms",
            headers={
                "Origin": "https://attacker.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.headers.get("access-control-allow-origin") is None

    def test_credentials_header_present(self, dev_client):
        """Access-Control-Allow-Credentials should be true for allowed origins."""
        response = dev_client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert response.headers.get("access-control-allow-credentials") == "true"


# ---------------------------------------------------------------------------
# 4.4.2 Production origins
# ---------------------------------------------------------------------------

class TestProductionCorsConfig:
    """CORS configuration for production environment."""

    @pytest.fixture
    def prod_client(self):
        app = _make_app_with_origins([
            "https://smallbets.live",
            "https://www.smallbets.live",
        ])
        return TestClient(app)

    def test_production_domain_allowed(self, prod_client):
        """Requests from production domain should be allowed."""
        response = prod_client.get(
            "/api/health",
            headers={"Origin": "https://smallbets.live"},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://smallbets.live"

    def test_www_production_domain_allowed(self, prod_client):
        """Requests from www subdomain should be allowed."""
        response = prod_client.get(
            "/api/health",
            headers={"Origin": "https://www.smallbets.live"},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://www.smallbets.live"

    def test_http_production_domain_rejected(self, prod_client):
        """HTTP (non-HTTPS) production domain should be rejected."""
        response = prod_client.get(
            "/api/health",
            headers={"Origin": "http://smallbets.live"},
        )
        assert response.headers.get("access-control-allow-origin") is None

    def test_subdomain_not_in_allowlist_rejected(self, prod_client):
        """Unknown subdomains should be rejected."""
        response = prod_client.get(
            "/api/health",
            headers={"Origin": "https://api.smallbets.live"},
        )
        assert response.headers.get("access-control-allow-origin") is None

    def test_localhost_rejected_in_production(self, prod_client):
        """Localhost should be rejected in production config."""
        response = prod_client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert response.headers.get("access-control-allow-origin") is None

    def test_wildcard_origin_rejected(self, prod_client):
        """Wildcard origin should be rejected."""
        response = prod_client.get(
            "/api/health",
            headers={"Origin": "*"},
        )
        assert response.headers.get("access-control-allow-origin") is None

    def test_production_preflight_with_custom_headers(self, prod_client):
        """Preflight with custom headers (X-Host-Id, X-User-Id) should work."""
        response = prod_client.options(
            "/api/rooms/TEST",
            headers={
                "Origin": "https://smallbets.live",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Content-Type,X-Host-Id,X-User-Id",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://smallbets.live"


# ---------------------------------------------------------------------------
# 4.4.3 Environment variable ALLOWED_ORIGINS
# ---------------------------------------------------------------------------

class TestAllowedOriginsEnvVar:
    """CORS configuration via ALLOWED_ORIGINS environment variable."""

    def test_env_var_parsed_correctly(self):
        """ALLOWED_ORIGINS env var should be split by commas."""
        with patch.dict(os.environ, {
            "ALLOWED_ORIGINS": "https://smallbets.live,https://www.smallbets.live"
        }):
            app = _make_app_from_env()
            client = TestClient(app)

            response = client.get(
                "/api/health",
                headers={"Origin": "https://smallbets.live"},
            )
            assert response.headers.get("access-control-allow-origin") == "https://smallbets.live"

    def test_env_var_with_spaces_parsed_correctly(self):
        """Spaces around origins in env var should be trimmed."""
        with patch.dict(os.environ, {
            "ALLOWED_ORIGINS": " https://smallbets.live , https://www.smallbets.live "
        }):
            app = _make_app_from_env()
            client = TestClient(app)

            response = client.get(
                "/api/health",
                headers={"Origin": "https://smallbets.live"},
            )
            assert response.headers.get("access-control-allow-origin") == "https://smallbets.live"

    def test_empty_env_var_falls_back_to_wildcard(self):
        """Empty ALLOWED_ORIGINS should fall back to wildcard (dev mode)."""
        with patch.dict(os.environ, {"ALLOWED_ORIGINS": ""}):
            app = _make_app_from_env()
            client = TestClient(app)

            response = client.get(
                "/api/health",
                headers={"Origin": "https://any-domain.com"},
            )
            # Wildcard allows all origins
            assert response.headers.get("access-control-allow-origin") == "*"

    def test_missing_env_var_falls_back_to_wildcard(self):
        """Missing ALLOWED_ORIGINS env var should fall back to wildcard."""
        env = os.environ.copy()
        env.pop("ALLOWED_ORIGINS", None)

        with patch.dict(os.environ, env, clear=True):
            app = _make_app_from_env()
            client = TestClient(app)

            response = client.get(
                "/api/health",
                headers={"Origin": "https://any-domain.com"},
            )
            assert response.headers.get("access-control-allow-origin") == "*"

    def test_single_origin_in_env_var(self):
        """Single origin (no comma) in ALLOWED_ORIGINS should work."""
        with patch.dict(os.environ, {
            "ALLOWED_ORIGINS": "https://smallbets.live"
        }):
            app = _make_app_from_env()
            client = TestClient(app)

            response = client.get(
                "/api/health",
                headers={"Origin": "https://smallbets.live"},
            )
            assert response.headers.get("access-control-allow-origin") == "https://smallbets.live"

            # Other origins should be rejected
            response2 = client.get(
                "/api/health",
                headers={"Origin": "https://other-domain.com"},
            )
            assert response2.headers.get("access-control-allow-origin") is None


# ---------------------------------------------------------------------------
# 4.4.4 Current app wildcard config (documents existing behaviour)
# ---------------------------------------------------------------------------

class TestCurrentWildcardConfig:
    """Tests documenting the current wildcard CORS configuration.

    These tests verify the current (insecure) wildcard setup and serve
    as documentation that this needs to be fixed for production.
    """

    @pytest.fixture
    def wildcard_client(self):
        app = _make_app_with_origins(["*"])
        return TestClient(app)

    def test_wildcard_allows_any_origin(self, wildcard_client):
        """Current wildcard config allows any origin – NOT safe for production."""
        response = wildcard_client.get(
            "/api/health",
            headers={"Origin": "https://evil.example.com"},
        )
        # Wildcard allows everything
        assert response.headers.get("access-control-allow-origin") == "*"

    def test_wildcard_allows_localhost(self, wildcard_client):
        """Wildcard allows localhost – acceptable for development only."""
        response = wildcard_client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert response.headers.get("access-control-allow-origin") == "*"

    def test_no_origin_header_still_returns_response(self, wildcard_client):
        """Requests without Origin header should still work."""
        response = wildcard_client.get("/api/health")
        assert response.status_code == 200
