#!/bin/sh
set -e

echo "==> [Noir Backend] Initializing container..."

# Wait for PostgreSQL database if PSQL_HOST or DATABASE_URL is configured
if [ -n "$PSQL_HOST" ] || [ -n "$DATABASE_URL" ]; then
    echo "==> [Noir Backend] Checking database connectivity..."
    python << 'END'
import socket
import time
import os
import sys
import urllib.parse

db_url = os.environ.get('DATABASE_URL')
host = os.environ.get('PSQL_HOST')
port = int(os.environ.get('PSQL_PORT', 5432))

if not host and db_url:
    try:
        parsed = urllib.parse.urlparse(db_url)
        host = parsed.hostname
        port = parsed.port or 5432
    except Exception:
        pass

if host:
    timeout = 30
    start = time.time()
    while True:
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f"==> [Noir Backend] Database {host}:{port} is ready!")
                sys.exit(0)
        except (socket.timeout, ConnectionRefusedError, socket.gaierror, OSError) as e:
            if time.time() - start > timeout:
                print(f"==> [Noir Backend] Warning: DB wait timeout after {timeout}s ({e}), proceeding anyway...")
                break
            time.sleep(1)
END
fi

# Run database migrations (enabled by default, can disable with RUN_MIGRATIONS=false)
if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
    echo "==> [Noir Backend] Running database migrations..."
    python manage.py migrate --noinput || echo "==> [Noir Backend] Warning: Migration encountered an issue, check logs."
fi

# Collect static files (enabled by default, can disable with COLLECT_STATIC=false)
if [ "${COLLECT_STATIC:-true}" != "false" ]; then
    echo "==> [Noir Backend] Collecting static files..."
    python manage.py collectstatic --noinput || true
fi

# Support dynamic PORT (e.g. AWS App Runner or custom port override)
if [ "$1" = "daphne" ]; then
    PORT_TO_USE="${PORT:-8000}"
    echo "==> [Noir Backend] Starting Daphne ASGI server on 0.0.0.0:${PORT_TO_USE}..."
    exec daphne -b 0.0.0.0 -p "${PORT_TO_USE}" backend.asgi:application
fi

echo "==> [Noir Backend] Starting server: $@"
exec "$@"
