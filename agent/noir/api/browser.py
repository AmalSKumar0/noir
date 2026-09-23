import html
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from noir.api.client import ApiClient


def _get_success_html(username: str) -> str:
    escaped_user = html.escape(username)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Noir CLI - Authenticated</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background-color: #08080a;
            color: #f5f5f4;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
        }}
        .card {{
            background: linear-gradient(180deg, rgba(30, 27, 46, 0.7) 0%, rgba(18, 16, 28, 0.85) 100%);
            border: 1px solid rgba(139, 92, 246, 0.25);
            border-radius: 20px;
            padding: 48px 40px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(139, 92, 246, 0.1);
            backdrop-filter: blur(12px);
        }}
        .logo {{
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -1.5px;
            margin-bottom: 24px;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 2px;
        }}
        .logo span {{ color: #8b5cf6; }}
        .icon-circle {{
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.12);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #10b981;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 32px;
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
        }}
        h1 {{
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }}
        p {{
            font-size: 14px;
            color: #a1a1aa;
            line-height: 1.6;
            margin-bottom: 24px;
        }}
        .user-tag {{
            display: inline-block;
            background: rgba(139, 92, 246, 0.12);
            border: 1px solid rgba(139, 92, 246, 0.3);
            color: #c4b5fd;
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
        }}
        .footer-note {{
            font-size: 12px;
            color: #71717a;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 20px;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">NO<span>IR_</span></div>
        <div class="icon-circle">✓</div>
        <h1>Authentication Successful</h1>
        <div class="user-tag">{escaped_user}</div>
        <p>Your Noir developer session has been established. You can now close this browser tab and return to your terminal.</p>
        <div class="footer-note">Credentials stored locally</div>
    </div>
</body>
</html>"""


def _get_error_html(error_message: str) -> str:
    escaped_err = html.escape(error_message)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Noir CLI - Authentication Failed</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background-color: #08080a;
            color: #f5f5f4;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
        }}
        .card {{
            background: linear-gradient(180deg, rgba(30, 27, 46, 0.7) 0%, rgba(18, 16, 28, 0.85) 100%);
            border: 1px solid rgba(239, 68, 68, 0.25);
            border-radius: 20px;
            padding: 48px 40px;
            max-width: 440px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(239, 68, 68, 0.1);
            backdrop-filter: blur(12px);
        }}
        .logo {{
            font-size: 26px;
            font-weight: 900;
            letter-spacing: -1.5px;
            margin-bottom: 24px;
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 2px;
        }}
        .logo span {{ color: #ef4444; }}
        .icon-circle {{
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 32px;
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
        }}
        h1 {{
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }}
        p {{
            font-size: 14px;
            color: #a1a1aa;
            line-height: 1.6;
            margin-bottom: 24px;
        }}
        .footer-note {{
            font-size: 12px;
            color: #71717a;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: 20px;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">NO<span>IR_</span></div>
        <div class="icon-circle">✕</div>
        <h1>Authentication Failed</h1>
        <p>{escaped_err}</p>
        <div class="footer-note">Please return to your terminal and try again</div>
    </div>
</body>
</html>"""


class AuthHTTPServer(HTTPServer):
    allow_reuse_address = True
    timeout = 1.0


class CallbackHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress noisy console HTTP access logs in CLI
        pass

    def do_GET(self):
        parsed = urlparse(self.path)

        # Ignore favicon and secondary static requests without stopping server
        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        if not parsed.path.startswith("/auth/callback"):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        params = parse_qs(parsed.query)
        oauth_err = params.get("error", [None])[0]
        code = params.get("authcode", [None])[0]

        if oauth_err:
            self.server.error = f"OAuth provider error: {oauth_err}"
            html_content = _get_error_html(f"Authorization rejected: {oauth_err}")
            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html_content.encode("utf-8"))
            self.wfile.flush()
            return

        if not code:
            self.server.error = "Missing authorization code (authcode) in callback."
            html_content = _get_error_html("No authorization code was received.")
            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html_content.encode("utf-8"))
            self.wfile.flush()
            return

        try:
            api = ApiClient()
            data = api.obtain_tokens(code)
            self.server.auth_data = data

            user = (data or {}).get("user", {})
            user_label = user.get("username") or user.get("email") or "Developer"

            html_content = _get_success_html(user_label)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html_content.encode("utf-8"))
            self.wfile.flush()
        except Exception as e:
            self.server.error = str(e)
            html_content = _get_error_html(f"Token exchange failed: {e}")
            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html_content.encode("utf-8"))
            self.wfile.flush()


class Server:
    def __init__(self, host: str = "127.0.0.1", port: int = 53145):
        self.host = host
        self.port = port
        self.auth_data = None
        self.error = None
        self.server = AuthHTTPServer((self.host, self.port), CallbackHandler)
        self.server.auth_data = None
        self.server.error = None

    def start(self, timeout: int = 120) -> dict | None:
        """Listens for the OAuth callback until tokens are obtained, error occurs, or timeout."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            self.server.handle_request()
            if self.server.auth_data is not None:
                self.auth_data = self.server.auth_data
                return self.auth_data
            if self.server.error is not None:
                self.error = self.server.error
                return None
        self.error = f"Timed out waiting for browser authentication ({timeout}s)."
        return None

    def end(self):
        if self.server:
            try:
                self.server.server_close()
            except Exception:
                pass
            self.server = None