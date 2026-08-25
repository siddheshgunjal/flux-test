FROM node:22-alpine AS assets

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY templates/ templates/
COPY static/css/ static/css/
COPY static/js/ static/js/
RUN npm run build:app

FROM python:3.14-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies (separate layer for caching)
COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev --no-install-project

# Copy application
COPY app.py .
COPY gunicorn.conf.py .
COPY templates/ templates/
COPY static/js/ static/js/
COPY static/image/ static/image/
COPY --from=assets /app/static/lib/css/ static/lib/css/

# Create non-root user for security
RUN groupadd -r appuser \
    && useradd -r -m -d /home/appuser -g appuser appuser \
    && chown -R appuser:appuser /app /home/appuser
ENV HOME=/home/appuser
USER appuser

# Expose port
EXPOSE 4855

# Health check
# Use Python from the runtime image; curl is not installed in python:3.14-slim.
HEALTHCHECK --interval=30s --timeout=3s \
    CMD python -c "import urllib.request; r=urllib.request.urlopen('http://127.0.0.1:4855/health', timeout=3); raise SystemExit(0 if r.status == 200 else 1)"

# Run via the virtualenv created by uv sync
ENV PATH="/app/.venv/bin:$PATH"
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]
