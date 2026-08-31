import typer

import noir.commands.connect as connect
import noir.commands.disconnect as disconnect
import noir.commands.status as status
import noir.commands.test as test
import noir.commands.analyze as analyze
import noir.commands.sync as sync
import noir.commands.doctor as doctor
import noir.commands.config as config
import noir.commands.run as run
import noir.commands.project as project
import noir.commands.login as login
import noir.commands.whoami as whoami
import noir.commands.logout as logout

app = typer.Typer(
    help="Noir CLI - AI-powered reliability engineering agent.",
    no_args_is_help=True,
)

app.add_typer(connect.app, name="connect")
app.add_typer(connect.app, name="init")
app.add_typer(disconnect.app, name="disconnect")
app.add_typer(status.app, name="status")
app.add_typer(test.app, name="test")
app.add_typer(analyze.app, name="analyze")
app.add_typer(sync.app, name="sync")
app.add_typer(doctor.app, name="doctor")
app.add_typer(config.app, name="config")
app.add_typer(run.app, name="run")
app.add_typer(project.app, name="project")
app.add_typer(login.app, name="login")
app.add_typer(whoami.app, name="whoami")
app.add_typer(logout.app, name="logout")


if __name__ == "__main__":
    app()