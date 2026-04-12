# FluxTest

![FluxTest Logo](/static/image/flux_logo_text.webp)

FluxTest is a self-hosted server network test application that measures:

- Latency (round-trip time)
- Download throughput
- Upload throughput

The app serves a browser UI and exposes HTTP endpoints for health checks and throughput testing between a client and your own hosted server.
It is designed to run locally, in Docker, and as a published container image on GitHub Container Registry (GHCR).

## Intended Use

FluxTest is intended for testing network performance of self-hosted infrastructure (home lab, VPS, bare-metal, edge nodes, private cloud).

It is not a public internet speed benchmark service and does not attempt to compare your ISP speed against geographically distributed public test nodes.

## Quick Start
Pull and run the container image:

```bash
docker pull ghcr.io/OWNER/IMAGE:latest
docker run --rm -p 4855:4855 ghcr.io/OWNER/IMAGE:latest
```

Access the UI at: http://your-ip:4855

## Features

- Real-time latency measurement using repeated ping probes
- Streamed download test from server to browser
- Upload test from browser to server with live progress
- Health endpoint for monitoring and orchestration
- Container-ready deployment with Gunicorn
- Reverse proxy-friendly Docker Compose labels (Traefik example)
- Designed for private deployments and self-hosted diagnostics

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
gunicorn --bind 0.0.0.0:4855 --workers 4 app:app
```

## Docker

### Pull and Run from GHCR

```bash
docker pull ghcr.io/OWNER/IMAGE:latest
docker run --rm -p 4855:4855 ghcr.io/OWNER/IMAGE:latest
```

### Build Image

### Run with Docker Compose

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

Note:

- The compose file includes Traefik labels and an example host rule.
- Update domain, entrypoints, and certificate resolver for your environment.

## Operational Notes

- Default HTTP port: 4855
- Download test size: 50 MB
- Upload test size: 25 MB
- Gunicorn workers in Docker image: 4
- Best used to validate client-to-your-server throughput and latency

You can tune test sizes in app.py by editing DOWNLOAD_SIZE_MB and UPLOAD_SIZE_MB.

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

- Run behind TLS termination (Traefik, Nginx, or cloud load balancer)
- Keep container base image and dependencies up to date
- Use pinned tags for production deployments instead of latest
- Treat this as an internal/self-hosted diagnostics tool, not a public speedtest platform


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
