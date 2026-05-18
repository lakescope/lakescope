# LakeScope

Delta Lake transaction log visualizer — reads directly from `_delta_log/` via **delta-rs** + **boto3**. No Spark required.

## Features

- Commit history timeline with operation filtering
- Schema viewer, file-size distribution, and commit frequency heatmap
- Vacuum, optimize, and checkpoint health panel
- S3 bucket browser to navigate tables without typing paths
- URL-as-state — share a link to a specific table + commit
- Keyboard shortcuts (`j/k` to scrub commits, `⌘K` to focus path, `?` for cheatsheet)
- Graceful degradation for very large tables whose checkpoint parquet exceeds S3 read limits

## Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12+ · FastAPI · deltalake (delta-rs) · boto3 |
| Frontend | React 18 · Vite · Chart.js |
| Serving | nginx (frontend) + uvicorn (backend) |
| Runtime | Docker Compose |

## Prerequisites

- Docker + Docker Compose v2
- AWS credentials with **s3:GetObject** and **s3:ListBucket** on the target bucket

## Quick start (Docker)

```bash
# Using env-var credentials (CI, ECS task roles, etc.)
AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... docker compose up --build

# Using a named AWS profile from ~/.aws/credentials
docker compose run --rm -e AWS_PROFILE=my-profile \
  -v ~/.aws:/root/.aws:ro backend

# Override region
AWS_REGION=eu-west-1 docker compose up --build
```

Open **http://localhost:3000**, paste an `s3://` path in the search bar, and press Enter.

## Local development (no Docker)

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

**Frontend** (separate terminal)

```bash
cd frontend
npm install
# VITE_API_TARGET points the dev-server proxy at your local backend
VITE_API_TARGET=http://localhost:8000 npm run dev
```

Open **http://localhost:5173**

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DELTA_TABLE_PATH` | _(empty)_ | Default S3 URI loaded on startup — leave blank to enter via UI |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | — | Static credentials (takes priority over profile) |
| `AWS_SESSION_TOKEN` | — | STS session token when using temporary credentials |
| `AWS_PROFILE` | `default` | Named profile from `~/.aws/credentials` (used when key/secret are absent) |
| `AWS_REGION` | `us-east-1` | Region (auto-detected from bucket location if omitted) |

> **Note**: CORS is set to `allow_origins=["*"]` which is fine for local use. If you expose the backend beyond localhost, restrict this in `backend/src/main.py`.

## API

| Endpoint | Description |
|---|---|
| `GET /api/info?path=s3://…` | Table metadata, version, file count, size |
| `GET /api/history?path=s3://…&limit=N` | Commit history (newest first) |
| `GET /api/schema?path=s3://…` | Current schema fields |
| `GET /api/files?path=s3://…` | Active files + size-bucket distribution |
| `GET /api/health?path=s3://…` | Vacuum, optimize, checkpoint status |
| `GET /api/browse?prefix=s3://…` | List subdirectories and Delta tables under a prefix |

## Large tables

For tables with very large checkpoint parquet files (tens of millions of active files), `deltalake` may fail to load the table due to an S3 byte-range response decoding issue. LakeScope automatically falls back to reading `_delta_log/*.json` files directly via boto3 — history, schema, and health remain fully functional. File-count and size statistics are unavailable in fallback mode.

## Extending

The reader lives in `backend/src/delta_reader.py`. Swap `DeltaTable` for a different table format (e.g. `pyiceberg.table.Table`) and expose the same API surface to add Iceberg support.

## Contributing

1. Fork and create a feature branch
2. Run backend + frontend locally (see above)
3. Open a pull request — describe what and why

## License

[MIT](LICENSE)
