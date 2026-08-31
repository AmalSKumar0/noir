import json
import shutil
from pathlib import Path

IGNORED_DIRS = {
    "venv", ".venv", "env", ".env", "node_modules", ".git", ".noir",
    "dist", "build", "__pycache__", ".pytest_cache", ".next", "vendor",
    "target", ".gradle", "bin", "obj", ".idea", ".vscode"
}


def is_ignored(path: Path) -> bool:
    for part in path.parts:
        if part in IGNORED_DIRS:
            return True
    return False


def resolve_test_command(test_cmd: str, root: Path = Path(".")) -> str:
    """
    Resolves test_cmd to an executable command by checking local virtualenvs (.venv, venv, env)
    and providing smart fallbacks if a binary (such as pytest) is missing.
    """
    parts = test_cmd.strip().split()
    if not parts:
        return test_cmd

    binary = parts[0]
    args = parts[1:]
    venvs = ["venv", ".venv", "env", ".env"]

    venv_binary = None
    for venv_name in venvs:
        candidate = root / venv_name / "bin" / binary
        if candidate.exists() and candidate.is_file():
            venv_binary = str(candidate)
            break

    if venv_binary:
        rest = " ".join(args)
        return f"{venv_binary} {rest}".strip()

    if shutil.which(binary) is not None:
        return test_cmd

    venv_python = None
    for venv_name in venvs:
        candidate = root / venv_name / "bin" / "python"
        if candidate.exists() and candidate.is_file():
            venv_python = str(candidate)
            break

    python_exec = venv_python or (shutil.which("python3") or shutil.which("python") or "python")

    if binary == "pytest":
        if (root / "manage.py").exists():
            return f"{python_exec} manage.py test"
        else:
            return f"{python_exec} -m unittest discover"

    if binary in ["python", "python3"]:
        rest = " ".join(args)
        return f"{python_exec} {rest}".strip()

    return test_cmd


def find_test_files(root: Path = Path(".")) -> tuple[bool, str | None, str | None, str | None]:
    """
    Scans the workspace for test files based on tech stack.
    Returns: (has_tests: bool, host_test_command: str | None, container_test_command: str | None, tech_name: str | None)
    """
    # 0. Check custom configuration in .noir/config.yaml or .noir/config.json
    noir_dir = root / ".noir"
    if noir_dir.exists():
        cfg_yaml = noir_dir / "config.yaml"
        if cfg_yaml.exists():
            try:
                for line in cfg_yaml.read_text(encoding="utf-8").splitlines():
                    if line.startswith("test_command:") or line.startswith("test_runner:"):
                        cmd = line.split(":", 1)[1].strip()
                        if cmd:
                            resolved_host_cmd = resolve_test_command(cmd, root)
                            container_cmd = "python manage.py test" if (root / "manage.py").exists() and cmd == "pytest" else cmd
                            return True, resolved_host_cmd, container_cmd, "Custom Configuration"
            except Exception:
                pass

        cfg_json = noir_dir / "config.json"
        if cfg_json.exists():
            try:
                data = json.loads(cfg_json.read_text(encoding="utf-8"))
                cmd = data.get("test_command") or data.get("test_runner")
                if cmd:
                    resolved_host_cmd = resolve_test_command(cmd, root)
                    container_cmd = "python manage.py test" if (root / "manage.py").exists() and cmd == "pytest" else cmd
                    return True, resolved_host_cmd, container_cmd, "Custom Configuration"
            except Exception:
                pass

    py_files = []
    py_test_files = []
    js_ts_test_files = []
    go_test_files = []
    rust_test_files = []
    java_test_files = []
    php_test_files = []
    ruby_test_files = []

    package_json = root / "package.json"
    go_mod = root / "go.mod"
    cargo_toml = root / "Cargo.toml"
    pom_xml = root / "pom.xml"
    build_gradle = root / "build.gradle"
    build_gradle_kts = root / "build.gradle.kts"
    artisan = root / "artisan"
    phpunit_xml = root / "phpunit.xml"

    # Scan project workspace recursively (skipping virtualenvs and ignored folders)
    for path in root.rglob("*"):
        if is_ignored(path):
            continue

        if path.is_file():
            filename = path.name.lower()
            rel_parts = [p.lower() for p in path.parts]

            # Python check
            if path.suffix == ".py":
                py_files.append(path)
                if filename == "tests.py" or filename.startswith("test_") or filename.endswith("_test.py"):
                    py_test_files.append(path)
                elif "tests" in rel_parts or "test" in rel_parts:
                    py_test_files.append(path)

            # JS / TS check
            elif path.suffix in [".js", ".ts", ".jsx", ".tsx"]:
                if (
                    ".test." in filename
                    or ".spec." in filename
                    or "__tests__" in rel_parts
                    or "tests" in rel_parts
                    or "test" in rel_parts
                ):
                    js_ts_test_files.append(path)

            # Go check
            elif path.suffix == ".go":
                if filename.endswith("_test.go"):
                    go_test_files.append(path)

            # Rust check
            elif path.suffix == ".rs":
                if "tests" in rel_parts or filename.endswith("_test.rs"):
                    rust_test_files.append(path)
                else:
                    try:
                        if "#[test]" in path.read_text(encoding="utf-8", errors="ignore"):
                            rust_test_files.append(path)
                    except Exception:
                        pass

            # Java / Kotlin check
            elif path.suffix in [".java", ".kt"]:
                if "src/test" in str(path).lower() or filename.endswith("test.java") or filename.endswith("test.kt"):
                    java_test_files.append(path)

            # PHP check
            elif path.suffix == ".php":
                if "tests" in rel_parts or filename.endswith("test.php"):
                    php_test_files.append(path)

            # Ruby check
            elif path.suffix == ".rb":
                if "spec" in rel_parts or "test" in rel_parts or filename.endswith("_spec.rb") or filename.endswith("_test.rb"):
                    ruby_test_files.append(path)

    # 1. Python Stack
    if py_test_files:
        has_manage_py = (root / "manage.py").exists()
        if has_manage_py:
            host_cmd = resolve_test_command("python manage.py test", root)
            return True, host_cmd, "python manage.py test", "Python (Django)"
        if (root / "pytest.ini").exists() or (root / "pyproject.toml").exists():
            host_cmd = resolve_test_command("pytest", root)
            return True, host_cmd, "pytest", "Python (pytest)"
        host_cmd = resolve_test_command("pytest", root)
        return True, host_cmd, "python -m unittest discover", "Python"

    # 2. Node.js / JS / TS Stack
    if js_ts_test_files:
        host_cmd = resolve_test_command("npm test", root)
        return True, host_cmd, "npm test", "Node.js / JS / TS"

    if package_json.exists():
        try:
            pkg_data = json.loads(package_json.read_text(encoding="utf-8"))
            test_script = pkg_data.get("scripts", {}).get("test", "")
            if test_script and "no test specified" not in test_script.lower():
                host_cmd = resolve_test_command("npm test", root)
                return True, host_cmd, "npm test", "Node.js (package.json script)"
        except Exception:
            pass

    # 3. Go Stack
    if go_test_files or (go_mod.exists() and len(go_test_files) > 0):
        host_cmd = resolve_test_command("go test ./...", root)
        return True, host_cmd, "go test ./...", "Go"

    # 4. Rust Stack
    if rust_test_files or (cargo_toml.exists() and (root / "tests").exists()):
        host_cmd = resolve_test_command("cargo test", root)
        return True, host_cmd, "cargo test", "Rust"

    # 5. Java / Kotlin Stack
    if java_test_files:
        if (root / "mvnw").exists():
            host_cmd = resolve_test_command("./mvnw test", root)
            return True, host_cmd, "./mvnw test", "Java (Maven Wrapper)"
        elif pom_xml.exists():
            host_cmd = resolve_test_command("mvn test", root)
            return True, host_cmd, "mvn test", "Java (Maven)"
        elif (root / "gradlew").exists():
            host_cmd = resolve_test_command("./gradlew test", root)
            return True, host_cmd, "./gradlew test", "Java/Kotlin (Gradle Wrapper)"
        elif build_gradle.exists() or build_gradle_kts.exists():
            host_cmd = resolve_test_command("gradle test", root)
            return True, host_cmd, "gradle test", "Java/Kotlin (Gradle)"
        host_cmd = resolve_test_command("mvn test", root)
        return True, host_cmd, "mvn test", "Java"

    # 6. PHP / Laravel Stack
    if php_test_files or phpunit_xml.exists():
        if artisan.exists():
            host_cmd = resolve_test_command("php artisan test", root)
            return True, host_cmd, "php artisan test", "PHP (Laravel)"
        host_cmd = resolve_test_command("vendor/bin/phpunit", root)
        return True, host_cmd, "vendor/bin/phpunit", "PHP (PHPUnit)"

    # 7. Ruby / Rails Stack
    if ruby_test_files:
        if (root / "spec").exists():
            host_cmd = resolve_test_command("bundle exec rspec", root)
            return True, host_cmd, "bundle exec rspec", "Ruby (RSpec)"
        host_cmd = resolve_test_command("rake test", root)
        return True, host_cmd, "rake test", "Ruby"

    # 8. Check for pytest.ini or tests directory standalone
    if (root / "pytest.ini").exists():
        host_cmd = resolve_test_command("pytest", root)
        return True, host_cmd, "pytest", "Python (pytest.ini)"

    return False, None, None, None
