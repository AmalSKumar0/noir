LANGUAGE_EXTENSIONS = {
    "python": [".py", ".pyw"],
    "javascript": [".js", ".mjs", ".cjs", ".jsx"],
    "typescript": [".ts", ".tsx", ".mts", ".cts"],
    "php": [".php", ".phtml"],
    "java": [".java"],
    "kotlin": [".kt", ".kts"],
    "c": [".c", ".h"],
    "c++": [".cpp", ".cc", ".cxx", ".hpp", ".hh", ".hxx"],
    "c#": [".cs"],
    "go": [".go"],
    "rust": [".rs"],
    "swift": [".swift"],
    "dart": [".dart"],
    "ruby": [".rb"],
    "sql": [".sql"],
    "html": [".html", ".htm"],
    "css": [".css", ".scss", ".sass"],
    "vue": [".vue"],
    "svelte": [".svelte"],
    "xml": [".xml"],
    "yaml": [".yaml", ".yml"],
    "json": [".json"],
    "toml": [".toml"],
    "dockerfile": ["Dockerfile"],
    "makefile": ["Makefile"],
    "terraform": [".tf", ".tfvars"],
}

EXTENSION_TO_LANGUAGE = {
    ext: language
    for language, extensions in LANGUAGE_EXTENSIONS.items()
    for ext in extensions
}

FILES_TO_TECHNOLOGY = {
    "frameworks": {
        # Python
        "manage.py": "django",
        "wsgi.py": "django",
        "asgi.py": "django",
        "settings.py": "django",
        "urls.py": "django",
        "apps.py": "django",
        "models.py": "django",
        "views.py": "django",
        "admin.py": "django",
        "main.py": "fastapi",
        "app.py": "flask",
        "run.py": "flask",

        # Laravel
        "artisan": "laravel",
        "routes/web.php": "laravel",
        "routes/api.php": "laravel",

        # React / Next / Vue / Angular / Svelte
        "vite.config.js": "react",
        "vite.config.ts": "react",
        "index.jsx": "react",
        "index.tsx": "react",
        "App.jsx": "react",
        "App.tsx": "react",
        "next.config.js": "nextjs",
        "next.config.mjs": "nextjs",
        "next.config.ts": "nextjs",
        "vue.config.js": "vue",
        "App.vue": "vue",
        "angular.json": "angular",
        "app.component.ts": "angular",
        "svelte.config.js": "svelte",
        "App.svelte": "svelte",
        "nest-cli.json": "nestjs",
        "app.module.ts": "nestjs",
        "nuxt.config.ts": "nuxt",
        "nuxt.config.js": "nuxt",
        "remix.config.js": "remix",
        "remix.config.ts": "remix",
        "astro.config.mjs": "astro",
        "astro.config.ts": "astro",

        # Spring / ASP.NET / Rails / Flutter
        "pom.xml": "spring",
        "build.gradle": "spring",
        "Program.cs": "aspnet",
        "Startup.cs": "aspnet",
        "Gemfile": "rails",
        "pubspec.yaml": "flutter",
    },

    "libraries": {
        "serializers.py": "django_rest_framework",
        "routers.py": "django_rest_framework",
    },

    "runtimes": {
        "index.js": "nodejs",
        "index.ts": "nodejs",
        "server.js": "nodejs",
        "server.ts": "nodejs",
    },

    "tools": {
        "Dockerfile": "docker",
        "docker-compose.yml": "docker",
        "docker-compose.yaml": "docker",
        "Chart.yaml": "helm",
        "values.yaml": "helm",
        "main.tf": "terraform",
        ".gitignore": "git",
        "electron.js": "electron",
        "tauri.conf.json": "tauri",
    },

    "package_managers": {
        "package.json": "npm",
        "package-lock.json": "npm",
        "bun.lock": "bun",
        "composer.json": "composer",
        "poetry.lock": "poetry",
        "Pipfile": "pipenv",
        "uv.lock": "uv",
    },

    "configuration": {
        "pyproject.toml": "python",
        "requirements.txt": "python",
        ".env.example": "environment",
        "application.properties": "spring",
        "application.yml": "spring",
    },
}

IGNORE = {
    ".git",
    "node_modules",
    "docs",
    "document",
    "__pycache__",
    ".venv",
    "venv",
    ".env",
    "lynx_temp",
}

STACK_EVIDENCE = {
    # Strong — 30
    "requirements.txt": 30,
    "pyproject.toml": 30,
    "Pipfile": 30,
    "package.json": 30,
    "composer.json": 30,
    "pom.xml": 30,
    "build.gradle": 30,
    "Cargo.toml": 30,
    "go.mod": 30,
    "Gemfile": 30,
    "pubspec.yaml": 30,
    "*.csproj": 30,

    # Medium — 20
    "setup.py": 20,
    "setup.cfg": 20,
    "manage.py": 20,
    "artisan": 20,
    "next.config.js": 20,
    "next.config.mjs": 20,
    "next.config.ts": 20,
    "vite.config.js": 20,
    "vite.config.ts": 20,
    "angular.json": 20,
    "vue.config.js": 20,
    "svelte.config.js": 20,
    "nest-cli.json": 20,
    "Dockerfile": 20,
    "docker-compose.yml": 20,
    "docker-compose.yaml": 20,
    "*.tf": 20,

    # Weak — 10
    "settings.py": 10,
    "wsgi.py": 10,
    "asgi.py": 10,
    "application.properties": 10,
    "application.yml": 10,
    "config.ru": 10,
    "Rakefile": 10,

    # Very weak — 5
    "urls.py": 5,
    "models.py": 5,
    "views.py": 5,
    "serializers.py": 5,
    "routers.py": 5,
    "App.jsx": 5,
    "App.tsx": 5,
    "App.vue": 5,
    "index.jsx": 5,
    "index.tsx": 5,
    "main.py": 5,
    "main.ts": 5,
    "app.py": 5,
    "server.js": 5,
    "server.ts": 5,
    "app.module.ts": 5,
    "Program.cs": 5,
    "Startup.cs": 5,

    # Lock files — 3
    "uv.lock": 3,
    "poetry.lock": 3,
    "Pipfile.lock": 3,
    "package-lock.json": 3,
    "yarn.lock": 3,
    "pnpm-lock.yaml": 3,
    "bun.lock": 3,
    "composer.lock": 3,
    "Cargo.lock": 3,
    "go.sum": 3,
    "Gemfile.lock": 3,
    "pubspec.lock": 3,

    # Generic language evidence — 1
    "*.py": 1,
    "*.js": 1,
    "*.jsx": 1,
    "*.ts": 1,
    "*.tsx": 1,
    "*.java": 1,
    "*.kt": 1,
    "*.go": 1,
    "*.rs": 1,
    "*.rb": 1,
    "*.php": 1,
    "*.cs": 1,
    "*.cpp": 1,
    "*.c": 1,
    "*.swift": 1,
    "*.dart": 1,
}

DEPENDENCY_KEYWORDS = {
    # Python
    "django": "django",
    "djangorestframework": "django_rest_framework",
    "fastapi": "fastapi",
    "flask": "flask",
    "celery": "celery",
    "uvicorn": "uvicorn",
    "gunicorn": "gunicorn",
    "sqlalchemy": "sqlalchemy",
    "pydantic": "pydantic",
    "redis": "redis",
    "psycopg": "postgresql",
    "psycopg2": "postgresql",
    "mysqlclient": "mysql",
    "pymysql": "mysql",
    "pymongo": "mongodb",

    # JavaScript / TypeScript
    "react": "react",
    "react-dom": "react",
    "next": "nextjs",
    "vue": "vue",
    "nuxt": "nuxt",
    "angular": "angular",
    "@angular/core": "angular",
    "svelte": "svelte",
    "@sveltejs/kit": "sveltekit",
    "express": "express",
    "@nestjs/core": "nestjs",
    "vite": "vite",
    "webpack": "webpack",
    "parcel": "parcel",
    "astro": "astro",
    "@remix-run": "remix",
    "electron": "electron",
    "react-native": "react_native",
    "expo": "expo",
    "tailwindcss": "tailwindcss",
    "axios": "axios",
    "socket.io": "socketio",

    # PHP
    "laravel/framework": "laravel",
    "symfony/framework-bundle": "symfony",
    "slim/slim": "slim",
    "guzzlehttp/guzzle": "guzzle",

    # Java / Kotlin
    "org.springframework": "spring",
    "spring-boot": "springboot",
    "spring-boot-starter-web": "springboot",
    "spring-boot-starter-data-jpa": "spring_data_jpa",
    "hibernate": "hibernate",
    "io.quarkus": "quarkus",
    "io.micronaut": "micronaut",

    # Ruby
    "rails": "rails",
    "sinatra": "sinatra",
    "devise": "devise",

    # Rust
    "axum": "axum",
    "actix-web": "actix",
    "rocket": "rocket",
    "tokio": "tokio",
    "serde": "serde",

    # Go
    "gin-gonic/gin": "gin",
    "labstack/echo": "echo",
    "gofiber/fiber": "fiber",
    "gorilla/mux": "gorilla",
    "gorm.io/gorm": "gorm",

    # .NET
    "Microsoft.AspNetCore": "aspnet",
    "Microsoft.EntityFrameworkCore": "entity_framework",
    "Newtonsoft.Json": "json_dotnet",

    # Flutter / Dart
    "flutter": "flutter",
    "cupertino_icons": "flutter",
    "provider": "provider",
    "bloc": "bloc",
    "flutter_bloc": "flutter_bloc",
    "riverpod": "riverpod",

    # Databases
    "mongodb": "mongodb",
    "mongoose": "mongodb",
    "sequelize": "sequelize",
    "prisma": "prisma",
    "typeorm": "typeorm",
    "drizzle-orm": "drizzle",
    "knex": "knex",
    "mysql": "mysql",
    "postgres": "postgresql",
    "postgresql": "postgresql",
    "sqlite": "sqlite",

    # Infrastructure
    "docker": "docker",
    "terraform": "terraform",
    "kubernetes": "kubernetes",
}
