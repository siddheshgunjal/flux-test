from flask import Flask, request, jsonify, Response, make_response, render_template
import random
import hashlib
import time
import socket
import os

app = Flask(__name__)

# Configuration
DOWNLOAD_SIZE_MB = 50
UPLOAD_SIZE_MB = 25


def get_server_name():
    """Prefer configured server name, then fallback to runtime hostname."""
    return os.getenv('SERVER_NAME') or socket.gethostname()

def _generate_chunks(size_mb):
    """Yield random data in 1 MB chunks to avoid large allocations."""
    chunk_size = 1024 * 1024
    total_bytes = size_mb * chunk_size
    sent = 0
    while sent < total_bytes:
        yield random.randbytes(min(chunk_size, total_bytes - sent))
        sent += chunk_size

@ app.route('/')
def index():
    """Basic welcome endpoint"""
    return render_template('index.html', server=get_server_name())

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

@app.route('/download', methods=['GET'])
def download():
    """Download test endpoint — streams random data to the client."""
    size = DOWNLOAD_SIZE_MB * 1024 * 1024

    resp = Response(
        _generate_chunks(DOWNLOAD_SIZE_MB),
        content_type='application/octet-stream',
    )
    resp.headers['Content-Length'] = str(size)
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    return resp


@app.route('/upload', methods=['POST'])
def upload():
    """Upload test endpoint — client is responsible for timing accuracy."""
    start_time = time.time()
    data = request.get_data()
    duration = time.time() - start_time

    if len(data) == 0:
        return jsonify({'error': 'No data received'}), 400

    speed_bytes = len(data) / duration if duration > 0 else 0
    speed_mbps = (speed_bytes / 1024 / 1024) * 8

    return jsonify({
        'status': 'received',
        'received_bytes': len(data),
        'duration_seconds': round(duration, 3),
        'speed_mbps': round(speed_mbps, 2)
    })


if __name__ == '__main__':
    print(f"Starting server at {get_server_name()}")
    print("Waiting for connections...")
    app.run(host='0.0.0.0', port=4855, debug=False)