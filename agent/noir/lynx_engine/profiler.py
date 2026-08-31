import os
import sys
import platform
import subprocess
from pathlib import Path
from noir.lynx_engine.evidence_collector import scan
from noir.lynx_engine.scoring_engine import scoreingEngine
from noir.lynx_engine.identification_engine import IdentificationEngine

FRAMEWORK_DISPLAY_NAMES = {
    "django": "Django",
    "fastapi": "FastAPI",
    "flask": "Flask",
    "react": "React",
    "nextjs": "Next.js",
    "vue": "Vue",
    "nuxt": "Nuxt",
    "angular": "Angular",
    "svelte": "Svelte",
    "nestjs": "NestJS",
    "express": "Express",
    "laravel": "Laravel",
    "springboot": "Spring Boot",
    "spring": "Spring",
    "rails": "Ruby on Rails",
    "aspnet": "ASP.NET",
    "flutter": "Flutter",
}

LANGUAGE_DISPLAY_NAMES = {
    "python": "Python",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "php": "PHP",
    "java": "Java",
    "kotlin": "Kotlin",
    "go": "Go",
    "rust": "Rust",
    "c#": "C#",
    "c++": "C++",
    "c": "C",
    "ruby": "Ruby",
    "html": "HTML",
    "css": "CSS",
}


def get_runtime_version(language: str) -> str:
    lang_lower = language.lower()
    if "python" in lang_lower:
        return sys.version.split()[0]
    elif "javascript" in lang_lower or "typescript" in lang_lower or "node" in lang_lower:
        try:
            return subprocess.check_output(["node", "-v"], text=True).strip()
        except Exception:
            return "v20.10.0"
    elif "go" in lang_lower:
        try:
            return subprocess.check_output(["go", "version"], text=True).strip().split()[2]
        except Exception:
            return "1.22.0"
    elif "rust" in lang_lower:
        try:
            return subprocess.check_output(["rustc", "--version"], text=True).strip().split()[1]
        except Exception:
            return "1.76.0"
    return sys.version.split()[0]


def profile_project(target_dir: str | Path = ".") -> dict:
    """
    Scans the specified directory using Lynx engine and produces project profile payload.
    """
    target = Path(target_dir).resolve()
    evidence = scan(target)
    score = scoreingEngine(evidence)
    engine = IdentificationEngine(score)
    result = engine.identify()

    # Determine Framework
    frameworks = result.get("frameworks", {})
    if frameworks:
        top_fw = max(frameworks, key=frameworks.get)
        framework_name = FRAMEWORK_DISPLAY_NAMES.get(top_fw.lower(), top_fw.capitalize())
    else:
        framework_name = "Generic"

    # Determine Language
    languages = result.get("language", {})
    primary_langs = languages.get("primary", [])
    secondary_langs = languages.get("secondary", [])
    supporting_langs = languages.get("supporting", [])

    if primary_langs:
        raw_lang = primary_langs[0]
    elif secondary_langs:
        raw_lang = secondary_langs[0]
    elif supporting_langs:
        raw_lang = supporting_langs[0]
    else:
        raw_lang = "python"

    language = LANGUAGE_DISPLAY_NAMES.get(raw_lang.lower(), raw_lang.capitalize())

    # Determine Package Manager
    pkg_managers = result.get("package_managers", {})
    if pkg_managers:
        pkg_manager = max(pkg_managers, key=pkg_managers.get)
    else:
        if (target / "uv.lock").exists():
            pkg_manager = "uv"
        elif (target / "package-lock.json").exists():
            pkg_manager = "npm"
        elif (target / "yarn.lock").exists():
            pkg_manager = "yarn"
        elif (target / "pnpm-lock.yaml").exists():
            pkg_manager = "pnpm"
        elif (target / "poetry.lock").exists():
            pkg_manager = "poetry"
        elif (target / "Pipfile.lock").exists() or (target / "requirements.txt").exists():
            pkg_manager = "pip"
        elif (target / "Cargo.lock").exists():
            pkg_manager = "cargo"
        else:
            pkg_manager = "npm" if language in ["JavaScript", "TypeScript"] else "pip"

    # Operating System
    system_name = platform.system()
    if system_name == "Linux":
        try:
            import distro
            os_name = f"{distro.name()} ({platform.machine()})"
        except Exception:
            os_name = f"Linux ({platform.machine()})"
    elif system_name == "Darwin":
        os_name = f"macOS {platform.mac_ver()[0]}"
    else:
        os_name = f"{system_name} {platform.release()}"

    runtime_version = get_runtime_version(language)

    return {
        "framework_name": framework_name,
        "language": language,
        "runtime_version": runtime_version,
        "package_manager": pkg_manager,
        "operating_system": os_name,
        "raw_results": result
    }
