import typer
from rich.prompt import Prompt

from noir.api.client import ApiClient
from noir.auth.storage import save_token
from noir.api.browser import Server
from noir.utils.CommandDisplay import CommandDisplay
app = typer.Typer()


@app.callback(invoke_without_command=True)
def whoami():
    text = CommandDisplay()
    client = ApiClient()
    data = client.send_request_to_backend(url="/accounts/me/",method="GET")
    text.print_whoami(data)

