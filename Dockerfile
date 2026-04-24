FROM node:22-alpine AS assets

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY templates/ templates/
COPY static/css/ static/css/
COPY static/js/ static/js/
RUN npm run build_app

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
HEALTHCHECK --interval=30s --timeout=3s \
    CMD curl -sf http://localhost:4855/health || exit 1

# Run via the virtualenv created by uv sync
ENV PATH="/app/.venv/bin:$PATH"
CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]