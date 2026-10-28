from django.core.management.base import BaseCommand
import subprocess
import sys
from pathlib import Path


class Command(BaseCommand):
    help = "Seeds comprehensive, presentation-ready demo data for Noir (Projects, Chaos Experiments, Telemetry, Companies, Teams, and Test Runs)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Clean existing demo faults and notifications before reseeding.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("=== Starting Noir Demo Data Seeder ==="))
        
        # Import seeder functions
        try:
            import seed_production_demo
        except ImportError:
            # If not in path, try backend dir
            backend_dir = Path(__file__).resolve().parent.parent.parent.parent
            if str(backend_dir) not in sys.path:
                sys.path.insert(0, str(backend_dir))
            import seed_production_demo

        seed_production_demo.main()
        self.stdout.write(self.style.SUCCESS("=== Noir Demo Data Seeding Completed Successfully ==="))
