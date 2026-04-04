"""
GitHub OAuth Device Flow client (`backend/app/sync/github_oauth.py`).

Implements the three-step Device Flow protocol for GitHub authentication:
1. Start device authorization (get user_code + verification_uri)
2. Poll for access token (user enters code on github.com)
3. Verify token + fetch user info / repos

This module is platform-independent logic — any client (web, desktop, mobile)
can implement the same protocol against the same GitHub OAuth App.

Uses only stdlib (urllib.request) to avoid adding dependencies.
"""

import asyncio
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)

GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE = "https://api.github.com"


def _post_form(url: str, data: dict[str, str]) -> dict[str, Any]:
    """POST x-www-form-urlencoded, return parsed JSON."""
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _get_json(url: str, token: str) -> dict[str, Any]:
    """GET with Bearer auth, return parsed JSON."""
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ── Step 1: Start Device Flow ──────────────────────────────────────────────


def _start_device_flow_sync(client_id: str) -> dict[str, Any]:
    """Request a device code from GitHub."""
    return _post_form(GITHUB_DEVICE_CODE_URL, {
        "client_id": client_id,
        "scope": "repo",
    })


async def start_device_flow(client_id: str) -> dict[str, Any]:
    """
    Async wrapper. Returns dict with keys:
    device_code, user_code, verification_uri, expires_in, interval
    """
    return await asyncio.to_thread(_start_device_flow_sync, client_id)


# ── Step 2: Poll for Access Token ──────────────────────────────────────────


def _poll_for_token_sync(client_id: str, device_code: str) -> dict[str, Any]:
    """
    Single poll attempt. Returns one of:
    - {"status": "pending"}
    - {"status": "complete", "access_token": "..."}
    - {"status": "slow_down", "interval": N}
    - {"status": "expired"}
    - {"status": "denied"}
    """
    resp = _post_form(GITHUB_ACCESS_TOKEN_URL, {
        "client_id": client_id,
        "device_code": device_code,
        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
    })

    if "access_token" in resp:
        return {"status": "complete", "access_token": resp["access_token"]}

    error = resp.get("error", "")
    if error == "authorization_pending":
        return {"status": "pending"}
    if error == "slow_down":
        return {"status": "slow_down", "interval": resp.get("interval", 10)}
    if error == "expired_token":
        return {"status": "expired"}
    if error == "access_denied":
        return {"status": "denied"}

    # Unexpected response
    logger.warning("Unexpected device flow poll response: %s", resp)
    return {"status": "pending"}


async def poll_for_token(client_id: str, device_code: str) -> dict[str, Any]:
    """Async wrapper for a single poll attempt."""
    return await asyncio.to_thread(_poll_for_token_sync, client_id, device_code)


# ── Step 3: User Info & Repos ──────────────────────────────────────────────


def _get_user_sync(token: str) -> dict[str, Any]:
    """Fetch authenticated GitHub user."""
    data = _get_json(f"{GITHUB_API_BASE}/user", token)
    return {
        "username": data["login"],
        "avatar_url": data.get("avatar_url", ""),
    }


async def get_authenticated_user(token: str) -> dict[str, Any]:
    """Returns {"username": "...", "avatar_url": "..."}."""
    return await asyncio.to_thread(_get_user_sync, token)


def _list_repos_sync(token: str, page: int = 1, per_page: int = 30) -> list[dict[str, Any]]:
    """List repos the authenticated user can push to."""
    url = (
        f"{GITHUB_API_BASE}/user/repos"
        f"?sort=updated&affiliation=owner,collaborator"
        f"&per_page={per_page}&page={page}"
    )
    data = _get_json(url, token)
    return [
        {
            "full_name": r["full_name"],
            "clone_url": r["clone_url"],
            "private": r["private"],
        }
        for r in data
        if r.get("permissions", {}).get("push", False)
    ]


async def list_user_repos(token: str, page: int = 1, per_page: int = 30) -> list[dict[str, Any]]:
    """Async wrapper."""
    return await asyncio.to_thread(_list_repos_sync, token, page, per_page)
