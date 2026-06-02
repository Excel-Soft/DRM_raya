# 🐳 WebExcels DRM — Docker & GCP Deployment Guide

> **For DevOps Engineers** — No Node.js or Python installation required on your machine.  
> Everything runs inside Docker containers.

---

## 📋 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Project Architecture](#-project-architecture)
3. [Environment Variables](#-environment-variables)
4. [Local Docker Build & Run](#-local-docker-build--run)
5. [GCP Deployment (Cloud Build + Cloud Run)](#-gcp-deployment-cloud-build--cloud-run)
6. [One-Time GCP Setup](#-one-time-gcp-setup)
7. [CI/CD Pipeline](#-cicd-pipeline)
8. [Troubleshooting](#-troubleshooting)
9. [Health Checks & Monitoring](#-health-checks--monitoring)
10. [Dockerfile Breakdown](#-dockerfile-breakdown)

---

## 🔧 Prerequisites

You only need these tools installed on your machine:

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Docker Desktop** | ≥ 24.x | Build & run containers | [docker.com/desktop](https://www.docker.com/products/docker-desktop/) |
| **Google Cloud SDK** | Latest | Deploy to GCP | [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install) |

> ⚠️ **You do NOT need Node.js, npm, Python, or any other runtime.** The Dockerfile handles everything.

---

## 🏗 Project Architecture

```
WebExcelsDRM/
├── client/                  # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/      # UI components (shadcn/ui)
│   │   ├── pages/           # Route pages
│   │   ├── lib/             # Utilities
│   │   └── main.tsx         # Entry point
│   └── index.html           # HTML template
├── server/                  # Express.js backend (TypeScript)
│   ├── index.ts             # Server entry point
│   ├── db.ts                # PostgreSQL connection (pg + Drizzle ORM)
│   ├── routes.ts            # API route registration
│   ├── *-routes.ts          # Feature-specific route files
│   └── vite.ts              # Static file serving (production)
├── shared/                  # Shared types/schema (used by both client & server)
│   └── schema.ts            # Drizzle ORM database schema
├── src/db/                  # Database schema definitions
├── migrations/              # SQL migration files
├── dist/                    # Build output (generated)
│   ├── index.js             # Compiled server bundle
│   └── public/              # Compiled frontend assets
├── Dockerfile               # Multi-stage Docker build
├── .dockerignore            # Docker context exclusions
├── cloudbuild.yaml          # GCP Cloud Build pipeline
├── package.json             # Node.js dependencies & scripts
└── .env                     # Environment variables (DO NOT COMMIT)
```

### How the App Works

| Component | Tech Stack | What it does |
|-----------|-----------|--------------|
| **Frontend** | React 18 + Vite + TailwindCSS | Single-page app (SPA) served as static files |
| **Backend** | Express.js + TypeScript | REST API on port `8080` (production) / `5000` (dev) |
| **Database** | PostgreSQL (Supabase) | Uses custom `drm` schema to isolate tables |
| **ORM** | Drizzle ORM | Type-safe database queries |
| **Auth** | JWT (jsonwebtoken) | Token-based authentication |

### Build Pipeline

```
Source Code
    │
    ▼
┌─────────────────────────────────┐
│  Stage 1: Builder (node:20)     │
│  • npm ci (install all deps)    │
│  • vite build (React → HTML/JS)│
│  • esbuild (TS → JS backend)   │
│  Output: dist/                  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  Stage 2: Production (node:20) │
│  • npm ci --omit=dev            │
│  • Copy dist/ from builder      │
│  • Runs: node dist/index.js     │
│  Image size: ~200MB             │
└─────────────────────────────────┘
```

---

## 🔑 Environment Variables

These **MUST** be set at runtime (via Cloud Run secrets or `docker run -e`):

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ Yes | `postgresql://user:pass@host:5432/db` | Supabase PostgreSQL connection string |
| `DATABASE_SSL` | ✅ Yes | `true` | Enable SSL for Supabase |
| `JWT_SECRET` | ✅ Yes | `your-random-secret-string` | JWT signing key |
| `NODE_ENV` | Auto | `production` | Set automatically in Dockerfile |
| `PORT` | Auto | `8080` | Set automatically by Cloud Run |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `*` | Comma-separated allowed CORS origins |
| `FRONTEND_URL` | _(empty)_ | Frontend URL for CORS |
| `DEBUG_ERRORS` | `false` | Show full error stack traces |
| `DEBUG_PG_POOL` | `false` | Log PostgreSQL pool events |
| `SEED_ADMIN_EMAIL` | _(empty)_ | Auto-create admin user on first boot |
| `SEED_ADMIN_PASSWORD` | _(empty)_ | Admin password for seeding |

---

## 🚀 Local Docker Build & Run

### Step 1: Build the Image

```bash
# Navigate to the project root
cd WebExcelsDRM-main

# Build the Docker image
docker build -t webexcels-drm:latest .
```

> ⏱ First build takes ~3-5 minutes. Subsequent builds use cache (~30 seconds).

### Step 2: Run the Container

```bash
docker run -d \
  --name webexcels-drm \
  -p 8080:8080 \
  -e DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.tdofmdaeahxfgmlmjgbp.supabase.co:5432/postgres" \
  -e DATABASE_SSL="true" \
  -e JWT_SECRET="your-jwt-secret-here" \
  -e NODE_ENV="production" \
  -e PORT="8080" \
  webexcels-drm:latest
```

### Step 3: Verify

```bash
# Check if container is running
docker ps

# Check logs
docker logs -f webexcels-drm

# Test health
curl http://localhost:8080/
```

### Stop & Remove

```bash
docker stop webexcels-drm
docker rm webexcels-drm
```

---

## ☁️ GCP Deployment (Cloud Build + Cloud Run)

### Architecture on GCP

```
GitHub Repo
    │
    ▼ (push trigger)
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Cloud Build     │────▶│ Artifact Registry│────▶│  Cloud Run       │
│  (Build Docker)  │     │ (Store Image)    │     │  (Run Container) │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────────┐
                                                  │  Supabase DB     │
                                                  │  (PostgreSQL)    │
                                                  └──────────────────┘
```

---

## 🔨 One-Time GCP Setup

Run these commands **once** to set up your GCP project:

### 1. Authenticate & Set Project

```bash
# Login to GCP
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable Required APIs

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 3. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create webexcels-drm \
  --repository-format=docker \
  --location=us-central1 \
  --description="WebExcels DRM Docker images"
```

### 4. Store Secrets in Secret Manager

```bash
# Store DATABASE_URL
echo -n "postgresql://postgres:YOUR_PASSWORD@db.tdofmdaeahxfgmlmjgbp.supabase.co:5432/postgres" | \
  gcloud secrets create DATABASE_URL --data-file=-

# Store JWT_SECRET
echo -n "your-jwt-secret-here" | \
  gcloud secrets create JWT_SECRET --data-file=-
```

### 5. Grant Cloud Build Permissions

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

# Grant Cloud Build permission to deploy to Cloud Run
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

# Grant Cloud Build permission to act as service account
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Grant Cloud Build permission to read secrets
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 6. (Optional) Set Up Automatic Triggers

```bash
# Connect your GitHub repo first in Cloud Build console:
# https://console.cloud.google.com/cloud-build/triggers
#
# Then create a trigger:
gcloud builds triggers create github \
  --repo-name="WebExcelsDRM" \
  --repo-owner="Excels-Tech" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --description="Deploy WebExcels DRM on push to main"
```

---

## 🔄 CI/CD Pipeline

### Manual Deployment

```bash
# From the project root directory:
gcloud builds submit --config=cloudbuild.yaml .
```

> This will build the Docker image, push to Artifact Registry, and deploy to Cloud Run.

### What `cloudbuild.yaml` Does

| Step | Action | Details |
|------|--------|---------|
| 1️⃣ **Build** | `docker build` | Multi-stage build using the Dockerfile |
| 2️⃣ **Push** | `docker push` | Tags image with `SHORT_SHA` + `latest` |
| 3️⃣ **Deploy** | `gcloud run deploy` | Deploys to Cloud Run with secrets |

### Cloud Run Configuration (set in cloudbuild.yaml)

| Setting | Value | Reason |
|---------|-------|--------|
| Memory | 512Mi | Sufficient for Node.js + Express |
| CPU | 1 | Single vCPU for cost efficiency |
| Min Instances | 0 | Scale to zero when idle (cost saving) |
| Max Instances | 3 | Prevent runaway costs |
| Timeout | 300s | 5-minute request timeout |
| Port | 8080 | Standard Cloud Run port |

---

## 🔍 Troubleshooting

### Issue: Build fails at `npm ci`

```bash
# Check if package-lock.json is committed
git status package-lock.json

# If not, generate it (requires Node.js on your machine temporarily)
# OR use Docker to generate it:
docker run --rm -v $(pwd):/app -w /app node:20-alpine npm install
```

### Issue: "Tenant or user not found" database error

This means the Supabase pooler connection is not configured correctly.
Use the **direct connection** string:
```
postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres
```
NOT the pooler URL.

### Issue: Container starts but API returns 500

```bash
# Check container logs
docker logs webexcels-drm

# Common causes:
# 1. DATABASE_URL not set or incorrect
# 2. DATABASE_SSL should be "true" for Supabase
# 3. JWT_SECRET not set
```

### Issue: "search_path" or "table not found" errors

The app uses a custom PostgreSQL schema called `drm`. The app automatically sets
`search_path TO drm, public` on every connection. If you see schema errors:

```sql
-- Verify drm schema exists on Supabase
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'drm';

-- Verify tables exist in drm schema
SELECT table_name FROM information_schema.tables WHERE table_schema = 'drm';
```

### Issue: Cloud Build permission denied

```bash
# Re-run the IAM policy bindings from the One-Time Setup section
# Make sure the Cloud Build service account has:
# - roles/run.admin
# - roles/iam.serviceAccountUser
# - roles/secretmanager.secretAccessor
```

---

## ❤️ Health Checks & Monitoring

### Docker Health Check

The Dockerfile includes a built-in health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8080/ || exit 1
```

### Cloud Run Health Check

Cloud Run automatically checks the `/` path. The app serves the React SPA at `/`,
which returns a `200 OK`.

### Monitoring Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the React frontend (health check) |
| `/api/auth/me` | GET | Returns current user (requires JWT) |

### Cloud Run Logs

```bash
# View live logs
gcloud run services logs read webexcels-drm --region=us-central1

# Stream logs
gcloud run services logs tail webexcels-drm --region=us-central1
```

---

## 📦 Dockerfile Breakdown

Here's what each section of the Dockerfile does:

### Stage 1: Builder

```dockerfile
FROM node:20-alpine AS builder     # Node 20 LTS — lightweight Alpine Linux
RUN apk add python3 make g++      # Native build tools (for bcrypt, etc.)
COPY package*.json ./              # Copy manifests first (cache optimization)
RUN npm ci                         # Install ALL deps (dev + prod) for building
COPY . .                           # Copy source code
RUN npm run build                  # Vite → dist/public, esbuild → dist/index.js
```

### Stage 2: Production

```dockerfile
FROM node:20-alpine AS production  # Fresh, clean image
RUN apk add tini curl             # tini = proper PID 1, curl = health checks
COPY package*.json ./              # Copy manifests
RUN npm ci --omit=dev              # Install ONLY production deps (smaller image)
COPY --from=builder /app/dist ./dist    # Copy compiled output
COPY --from=builder /app/shared ./shared  # Copy shared schema
ENV NODE_ENV=production PORT=8080
ENTRYPOINT ["/sbin/tini", "--"]    # Proper signal handling (SIGTERM, etc.)
CMD ["node", "dist/index.js"]      # Start the server
```

### Why Multi-Stage?

| Metric | Single Stage | Multi-Stage |
|--------|-------------|-------------|
| Image Size | ~800MB | ~200MB |
| Dev Dependencies | Included ❌ | Excluded ✅ |
| Source Code | Included ❌ | Excluded ✅ |
| Security | Larger attack surface | Minimal surface |

---

## 📝 Quick Reference Commands

```bash
# ── Docker ──────────────────────────────────────────────────
docker build -t webexcels-drm .                    # Build
docker run -d -p 8080:8080 --env-file .env webexcels-drm  # Run with .env file
docker logs -f webexcels-drm                       # View logs
docker exec -it webexcels-drm sh                   # Shell into container

# ── GCP ─────────────────────────────────────────────────────
gcloud builds submit --config=cloudbuild.yaml .    # Deploy via Cloud Build
gcloud run services list                           # List Cloud Run services
gcloud run services describe webexcels-drm --region=us-central1  # Service details
gcloud run services logs read webexcels-drm --region=us-central1 # View logs

# ── Secrets ─────────────────────────────────────────────────
gcloud secrets list                                # List all secrets
gcloud secrets versions access latest --secret=DATABASE_URL  # Read a secret
echo -n "new-value" | gcloud secrets versions add JWT_SECRET --data-file=-  # Update
```

---

> **Last Updated:** February 2026  
> **Maintainer:** Excels-Tech DevOps Team  
> **Repo:** WebExcelsDRM-main
