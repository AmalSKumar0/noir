import httpx


class ApiClient:
    def __init__(self):
        self.client = httpx.Client(
            base_url="http://127.0.0.1:8000/api"
        )

    def login(self, email: str, password: str):
        response = self.client.post(
            "/accounts/login/",
            json={
                "email": email,
                "password": password,
            },
        )

        response.raise_for_status()

        return response.json()