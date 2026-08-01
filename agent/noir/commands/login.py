import typer
from rich.prompt import Prompt

from noir.api.client import ApiClient
from noir.auth.storage import save_token
from noir.api.browser import Server
app = typer.Typer()


@app.callback(invoke_without_command=True)
def login(ctx: typer.Context):
    if ctx.invoked_subcommand:
        return
    email = ""
    while '@' not in email and '.' not in email:
        email = Prompt.ask("Email")
        if '@' not in email and '.' not in email:
            typer.echo("Invalid email address. Please try again.")
    
    password = ""
    while not password:
        password = Prompt.ask("Password", password=True)
        if not password:
            typer.echo("Password cannot be empty. Please try again.")
        if len(password) < 6:
            typer.echo("Password must be at least 6 characters long. Please try again.")
            password = ""

    client = ApiClient()

    try:
        tokens = client.login(email, password)
        save_refresh_token(tokens["refresh"])
        typer.echo("Login successful!")
    except Exception as e:
        typer.echo(f"Invalid credentials")

@app.command()
def github():
    client = ApiClient()
    tokens = client.github_login()
    try:
        typer.echo("Opening browser for GitHub login...")
        s = Server()
        s.start()
    except Exception as e:
        typer.echo(f"Error occurred: {e}")
        return
    typer.echo("Login successful!")

@app.command()
def google():
    client = ApiClient()
    tokens = client.google_login()
    try:
        typer.echo("Opening browser for Google login...")
        s = Server()
        s.start()
    except Exception as e:
        typer.echo(f"Error occurred: {e}")
        return
    typer.echo("Login successful!")


    
