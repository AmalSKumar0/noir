import typer

import noir.commands.init as init
import noir.commands.project as project
import noir.commands.login as login

app = typer.Typer(
    help="Noir CLI - AI-powered reliability engineering agent.",
    no_args_is_help=True,
)

app.add_typer(init.app, name="init")
app.add_typer(project.app, name="project")
app.add_typer(login.app, name="login")


if __name__ == "__main__":
    app()