#!/usr/bin/env bash
# =============================================================================
#  DRM Frontend — Deploy Script
#  Usage (from server):  cd /var/www/DRM_raya && bash frontend/deploy.sh
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
FRONTEND_DIR="$REPO_ROOT/frontend"
DIST_DIR="$FRONTEND_DIR/dist/public"
NGINX_SERVICE="nginx"

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

# ── 2. Install frontend dependencies ──────────────────────────────────────────
info "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install 2>&1 | tail -5

# ── 3. Build ──────────────────────────────────────────────────────────────────
info "Building frontend (this takes ~1 minute)..."
node node_modules/.bin/vite build

if [ ! -d "$DIST_DIR" ]; then
  error "Build failed — dist/public directory not found!"
fi

info "Build output:"
du -sh "$DIST_DIR" 2>/dev/null || true

# ── 4. Reload Nginx (no downtime) ────────────────────────────────────────────
info "Reloading Nginx..."
if systemctl is-active --quiet "$NGINX_SERVICE"; then
  nginx -t && systemctl reload "$NGINX_SERVICE" \
    && info "Nginx reloaded successfully." \
    || warn "Nginx reload failed — check: nginx -t"
else
  warn "Nginx is not running — skipping reload."
fi

# ── 5. Health check ───────────────────────────────────────────────────────────
info "Checking site..."
sleep 2
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" https://app.excels.com.pk/ 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  info "✅ Site is live — HTTP $HTTP_CODE"
else
  warn "Site returned HTTP $HTTP_CODE — check nginx logs: journalctl -u nginx -n 50"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
info "=========================================="
info " ✅  Frontend deploy complete!"
info " Branch : ${BRANCH}"
info " Commit : $(git -C ${REPO_ROOT} rev-parse --short HEAD)"
info " Dist   : ${DIST_DIR}"
info " Site   : https://app.excels.com.pk"
info "=========================================="
