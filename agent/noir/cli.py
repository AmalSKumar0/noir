import typer

import noir.commands.init as init
import noir.commands.connect as connect

app = typer.Typer(
    help="Noir CLI - AI-powered reliability engineering agent.",
    no_args_is_help=True,
)

app.add_typer(init.app, name="init")
app.add_typer(init.app, name="connect")


if __name__ == "__main__":
    app()