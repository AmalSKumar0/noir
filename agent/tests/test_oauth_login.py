import threading
import time
import httpx
import pytest
from unittest.mock import patch, MagicMock
from typer.testing import CliRunner

from noir.api.client import ApiClient
from noir.api.browser import Server, _get_success_html, _get_error_html
from noir.cli import app

runner = CliRunner()


def test_oauth_urls():
    client = ApiClient()
    github_url = client.get_oauth_url("github")
    google_url = client.get_oauth_url("google")

    assert "/api/accounts/github/login/?client=cli" in github_url
    assert "/api/accounts/google/login/?client=cli" in google_url


def test_html_templates():
    success_html = _get_success_html("octocat")
    assert "octocat" in success_html
    assert "Authentication Successful" in success_html
    assert "NO<span>IR_</span>" in success_html

    error_html = _get_error_html("Access denied by provider")
    assert "Authentication Failed" in error_html
    assert "Access denied by provider" in error_html


def test_browser_server_success_flow():
    server = Server(port=53145)

    mock_auth_response = {
        "access": "test-access-token",
        "refresh": "test-refresh-token",
        "user": {
            "username": "oauth_user",
            "email": "oauth@test.com",
            "role": "developer"
        }
    }

    result_holder = {}

    def run_server():
        result_holder["data"] = server.start(timeout=5)

    th = threading.Thread(target=run_server, daemon=True)
    th.start()
    time.sleep(0.3)

    try:
        # First test that /favicon.ico is ignored without terminating server
        fav_res = httpx.get("http://127.0.0.1:53145/favicon.ico")
        assert fav_res.status_code == 204

        # Now test callback with authcode
        with patch.object(ApiClient, "obtain_tokens", return_value=mock_auth_response):
            cb_res = httpx.get("http://127.0.0.1:53145/auth/callback?authcode=sample_exchange_code")
            assert cb_res.status_code == 200
            assert "Authentication Successful" in cb_res.text
            assert "oauth_user" in cb_res.text

        th.join(timeout=3)
        assert result_holder.get("data") == mock_auth_response
    finally:
        server.end()


def test_browser_server_oauth_error_flow():
    server = Server(port=53145)
    result_holder = {}

    def run_server():
        result_holder["data"] = server.start(timeout=5)

    th = threading.Thread(target=run_server, daemon=True)
    th.start()
    time.sleep(0.3)

    try:
        cb_res = httpx.get("http://127.0.0.1:53145/auth/callback?error=access_denied")
        assert cb_res.status_code == 400
        assert "Authentication Failed" in cb_res.text
        assert "access_denied" in cb_res.text

        th.join(timeout=3)
        assert result_holder.get("data") is None
        assert "access_denied" in server.error
    finally:
        server.end()


@patch("webbrowser.open")
@patch("noir.api.browser.Server.start")
@patch("noir.commands.login.has_tokens", return_value=False)
def test_noir_login_github_cli(mock_has_tokens, mock_server_start, mock_browser):
    mock_server_start.return_value = {
        "access": "fake-acc",
        "refresh": "fake-ref",
        "user": {"username": "cli_github_user", "email": "gh@noir.ai"}
    }

    result = runner.invoke(app, ["login", "github"])
    assert result.exit_code == 0
    assert "Initiating GitHub OAuth authentication" in result.stdout
    assert "Authenticated successfully via GitHub as 'cli_github_user'" in result.stdout


@patch("webbrowser.open")
@patch("noir.api.browser.Server.start")
@patch("noir.commands.login.has_tokens", return_value=False)
def test_noir_login_google_cli(mock_has_tokens, mock_server_start, mock_browser):
    mock_server_start.return_value = {
        "access": "fake-acc",
        "refresh": "fake-ref",
        "user": {"username": "cli_google_user", "email": "google@noir.ai"}
    }

    result = runner.invoke(app, ["login", "google"])
    assert result.exit_code == 0
    assert "Initiating Google OAuth authentication" in result.stdout
    assert "Authenticated successfully via Google as 'cli_google_user'" in result.stdout
