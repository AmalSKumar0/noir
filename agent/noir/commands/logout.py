import typer
from rich import print

from noir.api.client import ApiClient
from noir.auth.storage import delete_token, get_refresh_token, has_tokens
from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(help="Logout and clear stored Noir authentication tokens.")


@app.callback(invoke_without_command=True)
def logout():
    text = CommandDisplay()
    text.print_banner()

    if not has_tokens():
        print("[yellow]No active authentication session found.[/yellow]")
        return

    client = ApiClient()
    try:
        refresh_token = get_refresh_token()
        if refresh_token:
            client.send_request_to_backend(
                url="/accounts/logout/",
                method="POST",
                data={"refresh": refresh_token}
            )
    except Exception:
        pass
    finally:
        delete_token()
        print("[bold green]✔ Logged out successfully. Local authentication credentials cleared.[/bold green]\n")
