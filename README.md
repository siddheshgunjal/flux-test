# FluxTest

![FluxTest Logo](https://raw.githubusercontent.com/siddheshgunjal/flux-test/refs/heads/main/static/image/flux_logo_text.webp)

FluxTest is a self-hosted server network diagnosis application that measures:

- Latency (round-trip time)
- Jitter (RTT consistency)
- Download throughput
- Upload throughput
- Bufferbloat (latency under load)

After each test, FluxTest generates an overall A–F network score with per-metric diagnosis and actionable recommendations. Results can be exported as a branded PNG report card.

The app serves a browser UI and exposes HTTP endpoints for health checks and throughput testing between a client and your own hosted server.
It is designed to run locally, in Docker.

[<img alt="Static Badge" src="https://img.shields.io/badge/Watch%20Demo-click_to_watch-informational?style=for-the-badge&logo=youtube&logoColor=white&color=blue">][demo]

## Intended Use

FluxTest is intended for testing network performance of self-hosted infrastructure (home lab, VPS, bare-metal, edge nodes, private cloud).

It is not a public internet speed benchmark service and does not attempt to compare your ISP speed against geographically distributed public test nodes.

## Features

- **Latency & Jitter**: 5 sequential pings measure average RTT and jitter (standard deviation)
- **Bufferbloat detection**: concurrent `/bloat` pings during the download test reveal latency inflation under load
- **Time-based download test**: server streams random data for a fixed 15 s window
- **Time-based upload test**: browser streams random data to the server for a fixed 15 s window
- **Connection Analysis**: A–F network score (0–100) with per-metric diagnosis and production-focused recommendations
- **Shareable Report**: one-click PNG export of the full diagnosis card — ready to attach to a ticket or archive
- Live progress rings, speed readout, and elapsed-time display for both tests
- Guaranteed completion at any network speed — no timeout on slow connections
- Health endpoint for monitoring and orchestration
- Container-ready deployment with Gunicorn
- Reverse proxy-friendly Docker Compose labels (Traefik example)
- Designed for private deployments and self-hosted diagnostics

## Quick Start

### Option A: Docker Compose

1. Create a file named docker-compose.yml:

	```yml
	services:
		speedtest:
			image: ghcr.io/siddheshgunjal/flux-test:latest
			container_name: flux-test
			ports:
				- "4855:4855"
			environment:
				- SERVER_NAME=${SERVER_NAME:-${HOSTNAME:-speedtest-host}}
			restart: unless-stopped
			deploy:
				resources:
					reservations:
						memory: 256M
						cpus: 0.5
			labels:
				- "traefik.enable=true"
				- "traefik.http.routers.speedtest.rule=Host(`speedtest.example.com`)"
				- "traefik.http.routers.speedtest.entrypoints=websecure"
				- "traefik.http.routers.speedtest.tls.certresolver=letsencrypt"
	```

2. Start:

	```bash
	docker compose -f docker-compose.yml up -d
	```

3. Stop:

	```bash
	docker compose -f docker-compose.yml down
	```

### Option B: Docker run

```bash
docker pull ghcr.io/siddheshgunjal/flux-test:latest
docker run --rm -p 4855:4855 -e SERVER_NAME=${HOSTNAME} ghcr.io/siddheshgunjal/flux-test:latest
```

Access the UI at: http://your-ip:4855

## Project Structure

```text
├── app.py                  # Flask application and API routes
├── main.py                 # Minimal CLI entry file
├── pyproject.toml          # Project metadata and hatchling build config
├── Dockerfile              # Production container image build
├── docker-compose.yml      # Compose service definition
├── templates/
│   └── index.html          # Frontend page
└── static/
		├── css/index.css       # UI styling and animations
		└── js/index.js         # Client speed test logic
```

## Local Development

### Prerequisites

- Python 3.14 or later
- uv (for virtual environment and dependency management) or pip + venv
- Docker (optional, for containerized testing)

### Option 1: Run with venv + pip

```bash
uv sync
python app.py
```

The app will be available at:

- http://localhost:4855

### Option 2: Run with Gunicorn (production-style locally)

```bash
uv sync
gunicorn --bind 0.0.0.0:4855 --workers 2 app:app
```

## Local Testing with Docker

Choose one of the methods below.

### Method 1: Run with Docker Compose (recommended for self-hosting)

Use the included compose file to build from source:

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down -v
```

Access the UI at: http://your-ip:4855

Note:

- The default compose file includes Traefik labels and an example host rule.
- Update domain, entrypoints, and certificate resolver for your environment.

## Operational Notes

- Default HTTP port: 4855
- Download test duration: 15 s (server streams random data for exactly 15 s)
- Upload test duration: 15 s (browser streams random data for exactly 15 s)
- Full test completes in approximately 35 s (5 s latency probes + 15 s download with bufferbloat probes + 15 s upload)
- Works correctly at any network speed — from gigabit LAN to sub-1 Mbps WAN links
- Gunicorn workers in Docker image: 2
- Best used to validate client-to-your-server throughput and latency

You can adjust the test duration in `app.py` by editing `TEST_DURATION_SECONDS`.

## Troubleshooting

- Container health check fails:
	- Verify /health is reachable on port 4855.
	- Confirm reverse proxy or firewall is not blocking traffic.
- Upload or download appears slow:
	- Browser, host CPU limits, or container resource caps can affect results.
	- Check docker-compose resource limits and network path.
- Traefik route does not resolve:
	- Update Host rule and ensure DNS points to your ingress host.

## Security and Production Guidance

### Built-in Security Features

- **Cache Prevention**: Download endpoints include strict cache-control headers (`no-store, no-cache, must-revalidate`) to prevent test data from being cached
- **Secure Streaming**: Both download and upload use memory-efficient chunked streaming (1 MB / 64 KB chunks) — no large buffers are allocated server-side, preventing memory exhaustion
- **Upload Safety Ceiling**: The server-side upload reader enforces a hard ceiling (`TEST_DURATION_SECONDS + 10 s`) so a misbehaving client cannot hold a worker indefinitely
- **Input Validation**: Upload endpoint validates data reception and handles edge cases gracefully
- **Health Monitoring**: `/health` endpoint enables orchestration and monitoring without exposing operational details

### Deployment Security

- **TLS Termination**: Run behind TLS termination (Traefik, Nginx, or cloud load balancer) to encrypt data in transit
- **Environment Variables**: Sensitive configuration (e.g., `SERVER_NAME`) is handled via environment variables, not hardcoded
- **Dependency Management**: Regular updates to Python dependencies and base container image recommended
- **Version Pinning**: Use specific version tags (e.g., `v1.0.0`) for production deployments instead of `latest`
- **Internal Use Only**: Designed as an internal/self-hosted diagnostics tool for private infrastructure—do not expose publicly on the internet


#  Support
If you get stuck, we’re here to help. The following are the best ways to get assistance working through your issue:

* Use our [Github Issue Tracker][gh-issues] for reporting bugs or requesting features.
Contribution are the best way to keep `flux-test` amazing :muscle:
* If you want to contribute please refer [Contributor's Guide][gh-contrib] for how to contribute in a helpful and collaborative way :innocent:

# Citation
Please cite flux-test in your publications if this is useful for your project/research. Here is an example BibTeX entry:
```BibTeX
@misc{siddheshgunjal2026fluxtest,
  title={flux-test: A self-hosted server network test application},
  author={Siddhesh Gunjal},
  year={2026},
  howpublished={\url{https://github.com/siddheshgunjal/flux-test}},
}
```

# Maintainer :sunglasses:
[<img alt="Static Badge" src="https://img.shields.io/badge/my_website-click_to_visit-informational?style=for-the-badge&logo=googlechrome&logoColor=white&color=black">][portfolio]

[gh-issues]: https://github.com/siddheshgunjal/flux-test/issues
[gh-contrib]: https://github.com/siddheshgunjal/flux-test/blob/main/CONTRIBUTING.md
[portfolio]: https://siddheshgunjal.github.io
[demo]: https://drive.google.com/file/d/1wUBIMy3lob654B6bx2i5B20lvt6TyD7J/view?usp=drive_link
