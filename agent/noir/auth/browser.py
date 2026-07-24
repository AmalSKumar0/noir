from http.server import HTTPServer

class Server:
    
    def __init__(self):
        self.server = HTTPServer(
            ("127.0.0.1", 53145),
            CallbackHandler,
        )

    def end(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server = None
    