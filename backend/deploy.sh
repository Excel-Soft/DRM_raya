#!/usr/bin/env bash
# =============================================================================
#  DRM Backend — Deploy Script
#  Usage (from server):  cd /var/www/DRM_raya && bash backend/deploy.sh
# =============================================================================
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[DEPLOY]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────────
REPO_ROOT="/var/www/DRM_raya"
BRANCH="production"
PM2_APP="drm-backend"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
info "Pulling latest from origin/${BRANCH}..."
cd "$REPO_ROOT"

# Stash any accidental local changes so the pull never blocks
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Local changes detected — stashing them first."
  git stash push -m "auto-stash before deploy $(date '+%Y-%m-%d %H:%M:%S')"
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git merge --ff-only "origin/$BRANCH" || error "Cannot fast-forward — resolve conflicts manually."

# ── 2. Install / update backend dependencies ──────────────────────────────────
info "Installing backend dependencies..."
cd "$REPO_ROOT/backend"
npm install --omit=dev 2>&1 | tail -5

# ── 3. Restart PM2 ───────────────────────────────────────────────────────────
info "Restarting PM2 app '${PM2_APP}'..."
if pm2 describe "$PM2_APP" > /dev/null 2>&1; then
  pm2 restart "$PM2_APP" --update-env
else
  warn "PM2 app '${PM2_APP}' not found — starting fresh."
  pm2 start npm --name "$PM2_APP" -- run start
fi

pm2 save

# ── 4. Health check ───────────────────────────────────────────────────────────
info "Waiting 3s for backend to come up..."
sleep 3
if curl -sf http://localhost:5001/api/health > /dev/null 2>&1; then
  info "✅ Backend is healthy at http://localhost:5001"
else
  warn "Health check endpoint not reachable — check: pm2 logs ${PM2_APP}"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
info "=========================================="
info " ✅  Backend deploy complete!"
info " Branch  : ${BRANCH}"
info " Commit  : $(git -C ${REPO_ROOT} rev-parse --short HEAD)"
info " PM2 App : ${PM2_APP}"
info "=========================================="
pm2 list
