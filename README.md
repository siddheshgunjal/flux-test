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

## Features

- Real-time latency measurement using repeated ping probes
- Streamed download test from server to browser
- Upload test from browser to server with live progress
- Health endpoint for monitoring and orchestration
- Container-ready deployment with Gunicorn
- Reverse proxy-friendly Docker Compose labels (Traefik example)
- Designed for private deployments and self-hosted diagnostics

## Quick Start

### Option A: Docker Compose

1. Create a file named docker-compose.yml:

	```yaml
	services:
	speedtest:
		image: ghcr.io/siddheshgunjal/flux-test:latest
		container_name: flux-test
		ports:
		- "4855:4855"
		environment:
		- FLASK_ENV=production
		- FLASK_DEBUG=false
		restart: unless-stopped
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
docker run --rm -p 4855:4855 ghcr.io/siddheshgunjal/flux-test:latest
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
gunicorn --bind 0.0.0.0:4855 --workers 4 app:app
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

### Built-in Security Features

- **Cache Prevention**: Download endpoints include strict cache-control headers (`no-store, no-cache, must-revalidate`) to prevent sensitive test data from being cached
- **Secure Streaming**: Download test uses memory-efficient chunked streaming (1 MB chunks) instead of loading full test data into memory, preventing memory exhaustion attacks
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
