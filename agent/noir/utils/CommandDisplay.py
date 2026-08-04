from pathlib import Path
from rich.console import Console


class CommandDisplay:
    def __init__(self):
        self.console = Console()
        self.color = "cyan"
        self.banner = Path(__file__).parent.parent / "texts" / "banner.txt"
        self.whoami = Path(__file__).parent.parent / "texts" / "whoami.txt"
        self.init = Path(__file__).parent.parent / "texts" / "init.txt"

    def print_banner(self):
        with self.banner.open("r", encoding="utf-8") as f:
            self.console.print(f"[{self.color}]{f.read()}[/{self.color}]")

    def print_whoami(self, data: dict):
        # self.print_banner()
        text = self.whoami.read_text(encoding="utf-8")

        text = text.format(
            username=data["name"],
            email=data["email"]
        )

        self.console.print(text)
    
    

