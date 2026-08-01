import typer
from noir.api.client import ApiClient
from noir.auth.storage import save_token,delete_token,get_access_token,get_refresh_token
from noir.api.browser import Server
app = typer.Typer()



@app.callback(invoke_without_command=True)
def logout():
    client = ApiClient()
    try:
        jsonData = {
            "refresh":get_refresh_token()
            }
        data = client.send_request_to_backend(url="/accounts/logout/",method="POST",data=jsonData)
        typer.echo("Logged Out Successfuly")
        delete_token()
    except Exception as e:
        typer.echo(f"error {e}")
    
    

