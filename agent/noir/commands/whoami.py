import typer
from rich import print

from noir.api.client import ApiClient
from noir.auth.storage import has_tokens
from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(help="Display current authenticated Noir user identity.")


@app.callback(invoke_without_command=True)
def whoami():
    text = CommandDisplay()
    text.print_banner()

    if not has_tokens():
        print("[red]Error: Authentication credentials not found. Run 'noir login' to authenticate.[/red]")
        raise typer.Exit(1)

    client = ApiClient()
    try:
        data = client.send_request_to_backend(url="/accounts/me/", method="GET")
        text.print_whoami(data)
    except Exception as e:
        print(f"[red]Failed to retrieve user identity: {e}[/red]")
        raise typer.Exit(1)
