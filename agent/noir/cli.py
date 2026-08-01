import typer

import noir.commands.init as init
import noir.commands.project as project
import noir.commands.login as login
import noir.commands.whoami as whoami
import noir.commands.logout as logout

app = typer.Typer(
    help="Noir CLI - AI-powered reliability engineering agent.",
    no_args_is_help=True,
)

app.add_typer(init.app, name="init")
app.add_typer(project.app, name="project")
app.add_typer(login.app, name="login")
app.add_typer(whoami.app, name="whoami")
app.add_typer(logout.app, name="logout")


if __name__ == "__main__":
    app()