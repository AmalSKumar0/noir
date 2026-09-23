import typer
import webbrowser
from rich import print
from rich.prompt import Prompt

from noir.api.client import ApiClient
from noir.auth.storage import save_token, has_tokens
from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(help="Authenticate Noir developer session.")


def _handle_oauth_login(provider: str, display_name: str):
    """Executes browser-based OAuth authentication flow for Noir CLI."""
    text = CommandDisplay()
    text.print_banner()

    if has_tokens():
        print(f"[yellow]Notice: Already authenticated. Re-authenticating with {display_name} will replace current session.[/yellow]\n")

    client = ApiClient()
    oauth_url = client.get_oauth_url(provider)

    from noir.api.browser import Server

    try:
        server = Server()
    except OSError as e:
        print(f"[bold red]✖ Error: Port 53145 is already in use ({e}).[/bold red]")
        print("[yellow]Please make sure no other Noir authentication listener is running and try again.[/yellow]\n")
        raise typer.Exit(1)

    print(f"[cyan]Initiating {display_name} OAuth authentication...[/cyan]")
    print("[dim]If browser does not open automatically, visit:[/dim]")
    print(f"[underline cyan]{oauth_url}[/underline cyan]\n")

    try:
        webbrowser.open(oauth_url)
    except Exception:
        pass

    print("[dim]Waiting for authentication callback on http://127.0.0.1:53145/auth/callback (press Ctrl+C to cancel)...[/dim]")

    try:
        auth_data = server.start(timeout=120)
    except KeyboardInterrupt:
        print("\n[yellow]Authentication cancelled by user.[/yellow]\n")
        server.end()
        raise typer.Exit(130)
    finally:
        server.end()

    if auth_data:
        user_info = auth_data.get("user") or {}
        username = user_info.get("username") or user_info.get("email") or "Developer"
        print(f"\n[bold green]✔ Authenticated successfully via {display_name} as '{username}'! Credentials stored securely.[/bold green]\n")
    else:
        err = getattr(server, "error", None) or "Timed out waiting for authentication callback."
        print(f"\n[bold red]✖ Authentication failed: {err}[/bold red]\n")
        raise typer.Exit(1)


@app.callback(invoke_without_command=True)
def login(ctx: typer.Context):
    if ctx.invoked_subcommand:
        return

    text = CommandDisplay()
    text.print_banner()

    if has_tokens():
        print("[yellow]Notice: Already authenticated. Re-authenticating will replace current session.[/yellow]\n")

    email = ""
    while '@' not in email or '.' not in email:
        email = Prompt.ask("[cyan]Enter Email[/cyan]")
        if '@' not in email or '.' not in email:
            print("[red]Invalid email format. Please enter a valid email address.[/red]")

    password = ""
    while not password:
        password = Prompt.ask("[cyan]Enter Password[/cyan]", password=True)
        if not password:
            print("[red]Password cannot be empty.[/red]")
        elif len(password) < 6:
            print("[red]Password must be at least 6 characters.[/red]")
            password = ""

    client = ApiClient()

    try:
        tokens = client.login(email, password)
        save_token(tokens)
        print("\n[bold green]✔ Authenticated successfully! Credentials stored securely.[/bold green]\n")
    except Exception as e:
        print(f"\n[bold red]✖ Authentication failed: Invalid email or password ({e})[/bold red]\n")
        raise typer.Exit(1)


@app.command(name="github", help="Authenticate with GitHub OAuth.")
def login_github():
    """Authenticate Noir developer session via GitHub OAuth."""
    _handle_oauth_login("github", "GitHub")


@app.command(name="google", help="Authenticate with Google OAuth.")
def login_google():
    """Authenticate Noir developer session via Google OAuth."""
    _handle_oauth_login("google", "Google")
