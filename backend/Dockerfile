# ==========================================
# Noir Backend Dockerfile
# Optimized for AWS (ECS, App Runner, EC2)
# ==========================================

FROM python:3.12-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered logging for CloudWatch
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=backend.settings \
    PORT=8000

WORKDIR /app

# Install system runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install build dependencies, build wheels/packages, then clean up
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project source code
COPY . /app/

# Ensure entrypoint has execution permissions
RUN chmod +x /app/entrypoint.sh

# Create non-root user for cloud security standards
RUN addgroup --system --gid 1001 noirgroup && \
    adduser --system --uid 1001 --gid 1001 noiruser && \
    mkdir -p /app/staticfiles && \
    chown -R noiruser:noirgroup /app

# Switch to unprivileged user
USER noiruser

# Expose backend port
EXPOSE 8000

# Health check for container engines
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

# Launch container via entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# Default ASGI command with Daphne
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "backend.asgi:application"]
