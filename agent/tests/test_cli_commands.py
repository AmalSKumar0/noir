import json
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from typer.testing import CliRunner

from noir.cli import app

runner = CliRunner()


class TestCliCommands:
    def setup_method(self):
        self.temp_dir = Path(tempfile.mkdtemp())

    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_whoami_unauthenticated_fails(self):
        with patch("noir.commands.whoami.has_tokens", return_value=False):
            result = runner.invoke(app, ["whoami"])
            assert result.exit_code != 0
            assert "Authentication credentials not found" in result.output

    def test_whoami_authenticated_succeeds(self):
        mock_user = {
            "name": "tester_dev",
            "username": "tester_dev",
            "email": "dev@noir.ai",
            "role": "developer",
            "first_name": "Test",
            "last_name": "Dev",
        }
        with patch("noir.commands.whoami.has_tokens", return_value=True), \
             patch("noir.commands.whoami.ApiClient.send_request_to_backend", return_value=mock_user):
            result = runner.invoke(app, ["whoami"])
            assert result.exit_code == 0
            assert "tester_dev" in result.output or "dev@noir.ai" in result.output

    def test_status_disconnected_workspace(self, monkeypatch):
        monkeypatch.chdir(self.temp_dir)
        result = runner.invoke(app, ["status"])
        assert result.exit_code == 0
        assert "Not Connected" in result.output

    def test_status_connected_workspace(self, monkeypatch):
        monkeypatch.chdir(self.temp_dir)
        noir_dir = self.temp_dir / ".noir"
        noir_dir.mkdir()
        (noir_dir / "config.json").write_text(json.dumps({
            "project_id": "NR-PROJ-999",
            "backend": "http://127.0.0.1:8000/"
        }))
        (noir_dir / "project.json").write_text(json.dumps({
            "title": "Chaos Microservice",
            "profile": {
                "framework": {"name": "Django", "language": "Python"},
                "runtime_version": "3.14",
                "operating_system": "Linux"
            }
        }))

        result = runner.invoke(app, ["status"])
        assert result.exit_code == 0
        assert "NR-PROJ-999" in result.output
        assert "Chaos Microservice" in result.output

    def test_fault_list_command(self):
        result = runner.invoke(app, ["fault", "list"])
        assert result.exit_code == 0
        assert "cpu_stress" in result.output
        assert "network_delay" in result.output
        assert "Container" in result.output
        assert "Restart" in result.output
        assert "memory_stress" in result.output

    def test_doctor_command(self):
        result = runner.invoke(app, ["doctor"])
        assert result.exit_code == 0
        assert "System Diagnostics" in result.output or "Python" in result.output
