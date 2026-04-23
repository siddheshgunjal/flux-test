from flask import Flask, request, jsonify, Response, make_response, render_template
import random
import time
import socket
import os

app = Flask(__name__)
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

# Configuration
TEST_DURATION_SECONDS = 15


def get_server_name():
    """Prefer configured server name, then fallback to runtime hostname."""
    return os.getenv('SERVER_NAME') or socket.gethostname()

def _generate_chunks_for_duration(duration_seconds):
    """Yield random data in 1 MB chunks for a fixed duration."""
    chunk_size = 1024 * 1024
    end_time = time.time() + duration_seconds
    while time.time() < end_time:
        yield random.randbytes(chunk_size)

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