import unittest
import tempfile
import shutil
from pathlib import Path

from noir.utils.docker_detector import (
    parse_compose_services,
    parse_dockerfiles,
    discover_project_containers,
    format_containers_table,
    _extract_ports,
)


class TestDockerDetector(unittest.TestCase):
    def setUp(self):
        self.temp_dir = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_extract_ports(self):
        ports_list = ["8000:8000", "5432:5432"]
        self.assertEqual(_extract_ports(ports_list), ["8000:8000", "5432:5432"])

        ports_dict = {
            "80/tcp": [{"HostPort": "8080"}],
            "443/tcp": None
        }
        extracted = _extract_ports(ports_dict)
        self.assertIn("8080->80/tcp", extracted)
        self.assertIn("443/tcp", extracted)

    def test_parse_compose_services(self):
        compose_content = """services:
  web:
    image: python:3.11-slim
    ports:
      - "8000:8000"
    container_name: custom-web-app
  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
  worker:
    build: .
"""
        compose_file = self.temp_dir / "docker-compose.yml"
        compose_file.write_text(compose_content, encoding="utf-8")

        services = parse_compose_services(self.temp_dir)
        self.assertEqual(len(services), 3)

        web = next((s for s in services if s["service"] == "web"), None)
        self.assertIsNotNone(web)
        self.assertEqual(web["image"], "python:3.11-slim")
        self.assertEqual(web["name"], "custom-web-app")
        self.assertEqual(web["status"], "defined")
        self.assertIn("8000:8000", web["ports"])

        worker = next((s for s in services if s["service"] == "worker"), None)
        self.assertIsNotNone(worker)
        self.assertEqual(worker["image"], "worker:local-build")

    def test_parse_dockerfiles(self):
        df = self.temp_dir / "Dockerfile"
        df.write_text("FROM node:20\nCMD ['npm', 'start']\n", encoding="utf-8")

        dockerfiles = parse_dockerfiles(self.temp_dir)
        self.assertEqual(len(dockerfiles), 1)
        self.assertEqual(dockerfiles[0]["service"], "app")
        self.assertEqual(dockerfiles[0]["source"], "dockerfile")

    def test_discover_project_containers_compose(self):
        compose_content = """services:
  api:
    image: node:20-alpine
    ports:
      - "3000:3000"
"""
        (self.temp_dir / "compose.yaml").write_text(compose_content, encoding="utf-8")

        containers = discover_project_containers(self.temp_dir, project_code="NR-TEST1234")
        self.assertTrue(len(containers) >= 1)
        api = next((c for c in containers if c.get("service") == "api"), None)
        self.assertIsNotNone(api)
        self.assertEqual(api["image"], "node:20-alpine")

    def test_format_containers_table(self):
        sample_containers = [
            {
                "id": "abc12345",
                "name": "noir-web-1",
                "service": "web",
                "status": "running",
                "image": "python:3.11",
                "ports": ["8000:8000"],
            },
            {
                "id": "-",
                "name": "noir-db",
                "service": "db",
                "status": "defined",
                "image": "postgres:16",
                "ports": ["5432:5432"],
            }
        ]
        table = format_containers_table(sample_containers)
        self.assertEqual(table.title, "[bold green]Docker Containers & Microservices[/bold green]")
        self.assertEqual(len(table.rows), 2)


if __name__ == "__main__":
    unittest.main()
