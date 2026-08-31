import typer

from noir.commands.connect import connect as run_connect
from noir.commands.disconnect import disconnect as run_disconnect

app = typer.Typer(
    help="Connect or disconnect from the Noir backend."
)


@app.command(
    help="Connect to a project on the Noir backend."
)
def connect(
    project_id: str = typer.Argument(..., help="The ID or Connection Code of the project to connect to."),
    path: str = typer.Option(".", help="Project directory path to profile with Lynx scanner.")
):
    run_connect(code=project_id, path=path)


@app.command(
    help="Disconnect from the Noir backend."
)
def disconnect():
    run_disconnect()