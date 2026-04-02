"""Tests for the FastAPI server endpoints."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from server import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint(client):
    """Health endpoint returns 200."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["agent"] == "pricepilot"


def test_chat_requires_message(client):
    """Chat endpoint rejects empty messages."""
    resp = client.post("/api/chat", json={"session_id": "test", "message": ""})
    assert resp.status_code == 400


def test_chat_requires_session_id(client):
    """Chat endpoint rejects missing session_id."""
    resp = client.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 400
