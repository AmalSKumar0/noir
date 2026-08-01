from http.server import HTTPServer
from noir.auth.storage import save_token
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler
from noir.api.client import ApiClient

class CallbackHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        code = params.get("authcode", [None])[0]
        try:
            api = ApiClient()
            api.obtain_tokens(code)
        except Exception as e:
            raise e


        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Authentication successful.")


class Server:
    
    def __init__(self):
        self.server = HTTPServer(
            ("127.0.0.1", 53145),
            CallbackHandler,
        )
    
    def start(self):
        self.server.handle_request()


    def end(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server = None
    
    