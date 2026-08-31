import typer
from rich import print
from rich.prompt import Prompt

from noir.api.client import ApiClient
from noir.auth.storage import save_token, has_tokens
from noir.utils.CommandDisplay import CommandDisplay

app = typer.Typer(help="Authenticate Noir developer session.")


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
