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
        self.client = httpx.Client(
            base_url=os.getenv("API_KEY")
        )
        
    def _headers(self):
        return {
            "Authorization": f"Bearer {get_access_token()}",
            "Content-Type": "application/json",
        }

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
    
    def github_login(self):
        try:
            webbrowser.open(f"{self.client.base_url}accounts/github/login/?client=cli")
        except Exception as e:
            typer.echo(f"Error occurred while opening GitHub login page: {e}")
            raise e
    
    def google_login(self):
        try:
            webbrowser.open(f"{self.client.base_url}accounts/google/login/?client=cli")
        except Exception as e:
            typer.echo(f"Error occurred while opening GitHub login page: {e}")
            raise e

    def obtain_tokens(self, code: str):
        try:
            response = self.client.post(
                "/accounts/common-auth/callback/",
                json={
                    'code':code
                }
            )
            response.raise_for_status()
            save_token(response.json())
        except Exception as e:
            typer.echo(f"Error occurred while obtaining tokens: {e}")
            raise e
    
    def send_request_to_backend(self,url: str,method: str,data: dict | None = None,retry=True):
        if not has_tokens():
            typer.echo('User data Not found try "noir login"')
            exit()
            

        try:

            
            match method:
                case "GET":
                    response = self.client.get(url,headers=self._headers())
                case "DELETE":
                    response = self.client.delete(url,headers=self._headers())
                case "POST":
                    response = self.client.post(url,json=data,headers=self._headers())
                case "PUT":
                    response = self.client.put(url,json=data,headers=self._headers())
                case "PATCH":
                    response = self.client.patch(url,json=data,headers=self._headers())
                case _:
                    raise ValueError(f"Unsupported HTTP method: {method}")
            response.raise_for_status()


        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                error = e.response.json()
                if error.get("code") == "token_not_valid":
                    try:
                        response = self.client.post(
                            "/accounts/token/refresh/",
                            json={
                                "refresh":get_refresh_token()
                            }
                        )
                        response.raise_for_status()
                    except httpx.HTTPStatusError:
                        typer.echo("Session expired. Please run 'noir login'.")
                        raise
                    save_token(response.json())
                    if retry:
                        return self.send_request_to_backend(url,method,data,False)
                    raise RuntimeError("Authentication failed after refreshing token.")
                else:
                    raise 
            else:
                raise 

        return response.json()



        
        


