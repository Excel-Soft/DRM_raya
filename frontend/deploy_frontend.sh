#!/usr/bin/env bash
set -euo pipefail
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info(){ echo -e "${GREEN}[DEPLOY]${NC} $*"; }; warn(){ echo -e "${YELLOW}[WARN]${NC}  $*"; }; error(){ echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
REPO_ROOT="/var/www/DRM_raya"; BRANCH="production"; FRONTEND_DIR="$REPO_ROOT/frontend"; DIST_DIR="$FRONTEND_DIR/dist/public"
info "Pulling latest from origin/${BRANCH}..."
cd "$REPO_ROOT"
if ! git diff --quiet || ! git diff --cached --quiet; then warn "Local changes detected — stashing them first."; git stash push -m "auto-stash before deploy $(date '+%Y-%m-%d %H:%M:%S')"; fi
git fetch origin "$BRANCH"; git checkout "$BRANCH"; git merge --ff-only "origin/$BRANCH" || error "Cannot fast-forward — resolve conflicts manually."
info "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
if [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then rm -f package-lock.json; yarn install --frozen-lockfile 2>&1 | tail -8 || yarn install 2>&1 | tail -8; else warn "falling back to npm"; npm install 2>&1 | tail -8; fi
info "Building frontend..."
if [ -x node_modules/.bin/vite ]; then node node_modules/.bin/vite build; elif command -v yarn >/dev/null 2>&1; then yarn build; else npx vite build; fi
[ -d "$DIST_DIR" ] || error "Build failed — dist/public not found!"
info "Build output: $(du -sh "$DIST_DIR" | cut -f1)"
info "Reloading Nginx..."; nginx -t && systemctl reload nginx && info "Nginx reloaded."
sleep 2; HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" https://app.excels.com.pk/ || echo 000)
[[ "$HTTP_CODE" == "200" ]] && info "✅ Site live — HTTP $HTTP_CODE" || warn "Site HTTP $HTTP_CODE"
info "✅ Frontend deploy complete! Commit=$(git -C ${REPO_ROOT} rev-parse --short HEAD)"
