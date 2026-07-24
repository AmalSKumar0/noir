import typer
from rich.prompt import Prompt

from noir.api.client import ApiClient
from noir.auth.storage import save_refresh_token

app = typer.Typer()


@app.command()
def login():
    email = Prompt.ask("Email")
    password = Prompt.ask("Password", password=True)

    client = ApiClient()

    tokens = client.login(email, password)

    save_refresh_token(tokens["refresh"])

    typer.echo("Login successful!")