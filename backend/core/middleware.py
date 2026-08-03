import time

class RequestTimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.perf_counter()

        response = self.get_response(request)

        elapsed = (time.perf_counter() - start) * 1000

        print(
            f"{request.method:<6}"
            f"{request.path:<35}"
            f"{response.status_code:<4}"
            f"{elapsed:>7.2f} ms"
        )

        return response