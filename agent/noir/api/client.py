import httpx
import os
import typer
import webbrowser
import json

from dotenv import load_dotenv
from noir.auth.storage import save_token,get_access_token,get_refresh_token,has_tokens

load_dotenv()


class ApiClient:

    def __init__(self):
        raw_url = os.getenv("API_KEY") or os.getenv("NOIR_API_URL") or "http://127.0.0.1:8000"
        clean_url = raw_url.rstrip('/')
        if clean_url.endswith('/api'):
            clean_url = clean_url[:-4]
        self.base_host = clean_url
        self.base_url = clean_url
        self.client = httpx.Client()

    def _url(self, path: str) -> str:
        clean_path = path.lstrip('/')
        if clean_path.startswith('api/'):
            return f"{self.base_host}/{clean_path}"
        return f"{self.base_host}/api/{clean_path}"
        
    def _headers(self):
        return {
            "Authorization": f"Bearer {get_access_token()}",
            "Content-Type": "application/json",
        }

    def login(self, email: str, password: str):
        response = self.client.post(
            self._url("/accounts/login/"),
            json={
                "email": email,
                "password": password,
            },
        )

        response.raise_for_status()

        return response.json()
    
    def github_login(self):
        try:
            webbrowser.open(self._url("/accounts/github/login/?client=cli"))
        except Exception as e:
            typer.echo(f"Error occurred while opening GitHub login page: {e}")
            raise e
    
    def google_login(self):
        try:
            webbrowser.open(self._url("/accounts/google/login/?client=cli"))
        except Exception as e:
            typer.echo(f"Error occurred while opening Google login page: {e}")
            raise e

    def obtain_tokens(self, code: str):
        try:
            response = self.client.post(
                self._url("/accounts/common-auth/callback/"),
                json={
                    'code': code
                }
            )
            response.raise_for_status()
            save_token(response.json())
        except Exception as e:
            typer.echo(f"Error occurred while obtaining tokens: {e}")
            raise e
    
    def send_request_to_backend(self, url: str, method: str, data: dict | None = None, retry=True):
        if not has_tokens():
            typer.echo('User data not found. Please run "noir login".')
            raise typer.Exit(1)
            
        full_url = self._url(url)
        try:
            match method.upper():
                case "GET":
                    response = self.client.get(full_url, headers=self._headers())
                case "DELETE":
                    response = self.client.delete(full_url, headers=self._headers())
                case "POST":
                    response = self.client.post(full_url, json=data, headers=self._headers())
                case "PUT":
                    response = self.client.put(full_url, json=data, headers=self._headers())
                case "PATCH":
                    response = self.client.patch(full_url, json=data, headers=self._headers())
                case _:
                    raise ValueError(f"Unsupported HTTP method: {method}")
            response.raise_for_status()

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                try:
                    refresh_resp = self.client.post(
                        self._url("/accounts/token/refresh/"),
                        json={"refresh": get_refresh_token()}
                    )
                    refresh_resp.raise_for_status()
                    save_token(refresh_resp.json())
                    if retry:
                        return self.send_request_to_backend(url, method, data, False)
                except Exception:
                    typer.echo("Session expired. Please run 'noir login'.")
                    raise
            raise

        return response.json()



        
        


