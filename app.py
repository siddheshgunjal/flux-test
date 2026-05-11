from flask import Flask, request, jsonify, Response, make_response, render_template
import random
import time
import socket
import os
import psutil
from threading import Lock

app = Flask(__name__)
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

# Configuration
TEST_DURATION_SECONDS = 15
_NET_SAMPLE_LOCK = Lock()
_LAST_NET_SAMPLE = None


def get_server_name():
    """Prefer configured server name, then fallback to runtime hostname."""
    return os.getenv('SERVER_NAME') or socket.gethostname()

def _generate_chunks_for_duration(duration_seconds):
    """Yield random data in 1 MB chunks for a fixed duration."""
    chunk_size = 1024 * 1024
    end_time = time.time() + duration_seconds
    while time.time() < end_time:
        yield random.randbytes(chunk_size)


def _sample_network_throughput_mbps():
    """Return (tx_mbps, rx_mbps) computed from the delta since previous sample."""
    global _LAST_NET_SAMPLE
    now = time.time()
    counters = psutil.net_io_counters()
    sent = counters.bytes_sent
    recv = counters.bytes_recv

    with _NET_SAMPLE_LOCK:
        if _LAST_NET_SAMPLE is None:
            _LAST_NET_SAMPLE = (now, sent, recv)
            return 0.0, 0.0

        prev_now, prev_sent, prev_recv = _LAST_NET_SAMPLE
        _LAST_NET_SAMPLE = (now, sent, recv)

    elapsed = max(now - prev_now, 1e-6)
    tx_mbps = max(0.0, ((sent - prev_sent) * 8) / elapsed / 1_000_000)
    rx_mbps = max(0.0, ((recv - prev_recv) * 8) / elapsed / 1_000_000)
    return tx_mbps, rx_mbps

@ app.route('/')
def index():
    """Basic welcome endpoint"""
    return render_template('index.html', server=get_server_name(), test_duration=TEST_DURATION_SECONDS)

@app.route('/health')
def health():
    """Basic health check"""
    return jsonify({
        'status': 'Online',
        'server': get_server_name(),
        'version': '0.1.0'
    })


@app.route('/ping', methods=['GET'])
def ping():
    """Minimal latency probe — the client measures round-trip time."""
    return jsonify({
        'server': get_server_name(),
        'timestamp': time.time()
    })

@app.route('/bloat', methods=['GET'])
def bloat():
    """Latency probe used during active download to measure bufferbloat."""
    return jsonify({
        'ts': time.time()
    })


@app.route('/stats', methods=['GET'])
def stats():
    """Server resource snapshot so clients can identify server-side bottlenecks."""
    mem = psutil.virtual_memory()
    counters = psutil.net_io_counters()
    tx_mbps, rx_mbps = _sample_network_throughput_mbps()

    return jsonify({
        'server': get_server_name(),
        'timestamp': time.time(),
        'cpu_percent': round(psutil.cpu_percent(interval=None), 1),
        'memory_percent': round(mem.percent, 1),
        'memory_used_mb': round(mem.used / (1024 * 1024), 1),
        'memory_total_mb': round(mem.total / (1024 * 1024), 1),
        'net_bytes_sent': counters.bytes_sent,
        'net_bytes_recv': counters.bytes_recv,
        'net_tx_mbps': round(tx_mbps, 2),
        'net_rx_mbps': round(rx_mbps, 2),
    })

@app.route('/download', methods=['GET'])
def download():
    """Download test endpoint — streams random data to the client for a fixed duration."""
    resp = Response(
        _generate_chunks_for_duration(TEST_DURATION_SECONDS),
        content_type='application/octet-stream',
    )
    resp.headers['X-Test-Duration'] = str(TEST_DURATION_SECONDS)
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    return resp


@app.route('/upload', methods=['POST'])
def upload():
    """Upload test endpoint — reads the client stream until it closes or the safety ceiling is hit."""
    start_time = time.time()
    received_bytes = 0
    ceiling = TEST_DURATION_SECONDS + 10

    while True:
        if time.time() - start_time > ceiling:
            break
        chunk = request.stream.read(65536)
        if not chunk:
            break
        received_bytes += len(chunk)

    duration = time.time() - start_time

    if received_bytes == 0:
        return jsonify({'error': 'No data received'}), 400

    speed_bytes = received_bytes / duration if duration > 0 else 0
    speed_mbps = (speed_bytes / 1024 / 1024) * 8

    return jsonify({
        'status': 'received',
        'received_bytes': received_bytes,
        'duration_seconds': round(duration, 3),
        'speed_mbps': round(speed_mbps, 2)
    })


if __name__ == '__main__':
    print(f"Starting server at {get_server_name()}")
    print("Waiting for connections...")
    app.run(host='0.0.0.0', port=4855, debug=False)