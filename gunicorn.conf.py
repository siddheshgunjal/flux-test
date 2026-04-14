bind = "0.0.0.0:4855"

# Threaded workers handle slow tunneled uploads better than sync workers.
worker_class = "gthread"
workers = 2
threads = 8

# Allow long uploads over high-latency links (Cloudflare Tunnel/public internet).
timeout = 300
graceful_timeout = 30
keepalive = 15

# Recycle workers periodically to avoid long-run memory drift.
max_requests = 1000
