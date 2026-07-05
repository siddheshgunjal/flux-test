import logging
import os
import random
import socket
import time
import tomllib
from collections.abc import Generator
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Optional, Tuple

import psutil
from flask import Flask, Response, jsonify, render_template, request

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


@dataclass
class AppConfig:
    """Centralised configuration with environment-variable overrides.

    Every value can be sourced from an env var, keeping secrets and
    deployment-specific settings out of the codebase.
    """

    debug: bool = field(
        default_factory=lambda: os.getenv("FLASK_DEBUG", "false").lower() == "true"
    )
    server_name: str = field(
        default_factory=lambda: os.getenv("SERVER_NAME") or socket.gethostname()
    )
    version: str = "0.0.0"
    host: str = "0.0.0.0"
    port: int = 4855
    test_duration_seconds: int = 15
    upload_ceiling_buffer: int = 10
    upload_chunk_size: int = 65536
    download_chunk_size: int = 1024 * 1024  # 1 MiB

    @staticmethod
    def _load_version() -> str:
        """Read the version from ``pyproject.toml``, falling back to ``"0.0.0"``.

        The ``APP_VERSION`` environment variable always takes precedence when set.
        """
        env_version = os.getenv("APP_VERSION")
        if env_version:
            return env_version

        pyproject = Path(__file__).resolve().parent / "pyproject.toml"
        if pyproject.is_file():
            try:
                with pyproject.open("rb") as fh:
                    data = tomllib.load(fh)
                return data["project"]["version"]
            except KeyError, tomllib.TOMLDecodeError, OSError:
                _logger.warning(
                    "Failed to read version from pyproject.toml", exc_info=True
                )

        return "0.0.0"

    @classmethod
    def from_env(cls) -> "AppConfig":
        """Build a config instance, preferring env vars over defaults."""
        return cls(
            debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
            server_name=os.getenv("SERVER_NAME") or socket.gethostname(),
            version=cls._load_version(),
            host=os.getenv("APP_HOST", "0.0.0.0"),
            port=int(os.getenv("APP_PORT", "4855")),
            test_duration_seconds=int(os.getenv("TEST_DURATION_SECONDS", "15")),
            upload_ceiling_buffer=int(os.getenv("UPLOAD_CEILING_BUFFER", "10")),
            upload_chunk_size=int(os.getenv("UPLOAD_CHUNK_SIZE", "65536")),
            download_chunk_size=int(os.getenv("DOWNLOAD_CHUNK_SIZE", str(1024 * 1024))),
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_logger = logging.getLogger(__name__)


def _ok(data: dict, status: int = 200) -> Tuple[Response, int]:
    """Return a consistent JSON success envelope."""
    return jsonify(data), status


def _err(message: str, status: int = 400) -> Tuple[Response, int]:
    """Return a consistent JSON error envelope."""
    return jsonify({"error": message}), status


def _bytes_to_mbps(bytes_count: float, elapsed: float) -> float:
    """Convert a byte count over an elapsed duration to Mbps."""
    return max(0.0, (bytes_count * 8) / max(elapsed, 1e-9) / 1_000_000)


# ---------------------------------------------------------------------------
# Network throughput sampler (thread-safe)
# ---------------------------------------------------------------------------


class NetworkSampler:
    """Samples network I/O counters and returns deltas on each call.

    Thread-safe; intended to be called from Flask routes that may run
    concurrently under gthread workers.
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._last_sample: Optional[Tuple[float, int, int]] = None

    def sample_mbps(self) -> Tuple[float, float]:
        """Return ``(tx_mbps, rx_mbps)`` computed since the last call."""
        now = time.monotonic()
        counters = psutil.net_io_counters()
        sent = counters.bytes_sent
        recv = counters.bytes_recv

        with self._lock:
            if self._last_sample is None:
                self._last_sample = (now, sent, recv)
                return 0.0, 0.0

            prev_now, prev_sent, prev_recv = self._last_sample
            self._last_sample = (now, sent, recv)

        elapsed = now - prev_now
        tx_mbps = _bytes_to_mbps(sent - prev_sent, elapsed)
        rx_mbps = _bytes_to_mbps(recv - prev_recv, elapsed)
        return tx_mbps, rx_mbps


# ---------------------------------------------------------------------------
# Download-stream generator
# ---------------------------------------------------------------------------


def _generate_chunks(duration: float, chunk_size: int) -> Generator[bytes, None, None]:
    """Yield random data chunks for *duration* seconds.

    Uses ``time.monotonic()`` so the loop is immune to system clock
    adjustments.
    """
    end = time.monotonic() + duration
    while time.monotonic() < end:
        yield random.randbytes(chunk_size)


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------


def create_app(config: Optional[AppConfig] = None) -> Flask:
    """Create and configure the Flask application.

    The *config* parameter is provided for testing — when omitted the
    app will read from the environment automatically.
    """
    if config is None:
        config = AppConfig.from_env()

    app = Flask(__name__)
    app.config["DEBUG"] = config.debug

    # Store config on the app for route access.
    app.config["_app_config"] = config

    # Shared sampler instance (one per process — safe under gthread).
    sampler = NetworkSampler()

    # ------------------------------------------------------------------
    # Logging setup
    # ------------------------------------------------------------------
    if not _logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
        )
        _logger.addHandler(handler)
        _logger.setLevel(logging.DEBUG if config.debug else logging.INFO)

    # ------------------------------------------------------------------
    # Error handlers
    # ------------------------------------------------------------------

    @app.errorhandler(400)
    def bad_request(_exc: Exception) -> Tuple[Response, int]:
        return _err("Bad request", 400)

    @app.errorhandler(404)
    def not_found(_exc: Exception) -> Tuple[Response, int]:
        return _err("Not found", 404)

    @app.errorhandler(405)
    def method_not_allowed(_exc: Exception) -> Tuple[Response, int]:
        return _err("Method not allowed", 405)

    @app.errorhandler(500)
    def internal_error(_exc: Exception) -> Tuple[Response, int]:
        _logger.exception("Internal server error")
        return _err("Internal server error", 500)

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------

    @app.route("/")
    def index() -> str:
        """Render the main dashboard."""
        return render_template(
            "index.html",
            server=config.server_name,
            version=config.version,
            test_duration=config.test_duration_seconds,
        )

    @app.route("/health")
    def health() -> Tuple[Response, int]:
        """Basic health check (no DB dependency)."""
        return _ok(
            {
                "status": "Online",
                "server": config.server_name,
                "version": config.version,
            }
        )

    @app.route("/ping", methods=["GET"])
    def ping() -> Tuple[Response, int]:
        """Minimal latency probe — the client measures round-trip time."""
        return _ok({"server": config.server_name, "timestamp": time.time()})

    @app.route("/bloat", methods=["GET"])
    def bloat() -> Tuple[Response, int]:
        """Latency probe used during active download to measure bufferbloat."""
        return _ok({"ts": time.time()})

    @app.route("/stats", methods=["GET"])
    def stats() -> Tuple[Response, int]:
        """Server resource snapshot so clients can identify server-side bottlenecks."""
        mem = psutil.virtual_memory()
        counters = psutil.net_io_counters()
        tx_mbps, rx_mbps = sampler.sample_mbps()

        return _ok(
            {
                "server": config.server_name,
                "timestamp": time.time(),
                "cpu_percent": round(psutil.cpu_percent(interval=None), 1),
                "memory_percent": round(mem.percent, 1),
                "memory_used_mb": round(mem.used / (1024 * 1024), 1),
                "memory_total_mb": round(mem.total / (1024 * 1024), 1),
                "net_bytes_sent": counters.bytes_sent,
                "net_bytes_recv": counters.bytes_recv,
                "net_tx_mbps": round(tx_mbps, 2),
                "net_rx_mbps": round(rx_mbps, 2),
            }
        )

    @app.route("/download", methods=["GET"])
    def download() -> Response:
        """Download test — streams random data to the client for a fixed duration."""
        resp = Response(
            _generate_chunks(config.test_duration_seconds, config.download_chunk_size),
            mimetype="application/octet-stream",
        )
        resp.headers["X-Test-Duration"] = str(config.test_duration_seconds)
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp

    @app.route("/upload", methods=["POST"])
    def upload() -> Tuple[Response, int]:
        """Upload test — reads the client stream until it closes or the safety ceiling is hit.

        The client **must** send ``Content-Type: application/octet-stream``
        so that the server can distinguish a test upload from form data.
        """
        content_type = request.content_type or ""

        if "application/octet-stream" not in content_type:
            return _err("Content-Type must be application/octet-stream", 415)

        start = time.monotonic()
        ceiling = config.test_duration_seconds + config.upload_ceiling_buffer
        received_bytes = 0

        while True:
            if time.monotonic() - start > ceiling:
                _logger.warning("Upload hit safety ceiling (%ds)", ceiling)
                break
            chunk = request.stream.read(config.upload_chunk_size)
            if not chunk:
                break
            received_bytes += len(chunk)

        elapsed = time.monotonic() - start

        if received_bytes == 0:
            return _err("No data received", 400)

        speed_mbps = _bytes_to_mbps(received_bytes, elapsed)

        return _ok(
            {
                "status": "received",
                "received_bytes": received_bytes,
                "duration_seconds": round(elapsed, 3),
                "speed_mbps": round(speed_mbps, 2),
            }
        )

    _logger.info(
        "App initialised (server=%s, duration=%ds, debug=%s)",
        config.server_name,
        config.test_duration_seconds,
        config.debug,
    )

    return app


# ---------------------------------------------------------------------------
# Gunicorn entrypoint (``app:app``) + CLI runner
# ---------------------------------------------------------------------------

app = create_app()

if __name__ == "__main__":
    cfg = AppConfig.from_env()
    _logger.info("Starting server at %s on %s:%s", cfg.server_name, cfg.host, cfg.port)
    app.run(host=cfg.host, port=cfg.port, debug=False)
