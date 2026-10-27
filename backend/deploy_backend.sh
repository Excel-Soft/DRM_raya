#!/usr/bin/env bash
set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info(){ echo -e "${GREEN}[DEPLOY]${NC} $*"; }; warn(){ echo -e "${YELLOW}[WARN]${NC}  $*"; }; error(){ echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
REPO_ROOT="/var/www/DRM_raya"; BRANCH="production"; PM2_APP="drm-backend"
info "Pulling latest from origin/${BRANCH}..."
cd "$REPO_ROOT"
if ! git diff --quiet || ! git diff --cached --quiet; then warn "Local changes detected — stashing them first."; git stash push -m "auto-stash before deploy $(date '+%Y-%m-%d %H:%M:%S')"; fi
git fetch origin "$BRANCH"; git checkout "$BRANCH"; git merge --ff-only "origin/$BRANCH" || error "Cannot fast-forward — resolve conflicts manually."
info "Installing backend dependencies..."
cd "$REPO_ROOT/backend"
if [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then rm -f package-lock.json; yarn install --frozen-lockfile 2>&1 | tail -8 || yarn install 2>&1 | tail -8; else npm install 2>&1 | tail -8; fi
info "Building backend (esbuild)..."
if command -v yarn >/dev/null 2>&1 && [ -f yarn.lock ]; then yarn build; else npm run build; fi
[ -f "$REPO_ROOT/backend/dist/index.js" ] || error "Build failed — dist/index.js not found!"
info "Built dist/index.js ($(du -h dist/index.js | cut -f1))"
info "Restarting PM2 app '${PM2_APP}'..."
if pm2 describe "$PM2_APP" >/dev/null 2>&1; then pm2 restart "$PM2_APP" --update-env; else pm2 start npm --name "$PM2_APP" -- run start; fi
pm2 save
info "Waiting 5s for backend..."; sleep 5
curl -sf http://localhost:5001/api/roles >/dev/null 2>&1 || curl -sf http://localhost:5001/ >/dev/null 2>&1 && info "✅ Backend responding" || warn "Backend still starting — check: pm2 logs ${PM2_APP}"
info "✅ Backend deploy complete! Branch=${BRANCH} Commit=$(git -C ${REPO_ROOT} rev-parse --short HEAD)"
pm2 list
