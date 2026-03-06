#!/bin/bash
# ============================================================
# VaultPass — Server Deployment Script
# Run this ON the server (103.235.106.93) after git clone/pull
#
# First-time setup:
#   chmod +x deploy.sh && ./deploy.sh --first-run
#
# After code updates:
#   ./deploy.sh
# ============================================================

set -e  # exit on any error

FIRST_RUN=false
if [[ "$1" == "--first-run" ]]; then FIRST_RUN=true; fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " VaultPass Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Pull latest code ────────────────────────────────────────
echo "→ Pulling latest code..."
git pull origin master

# ── 2. First-run only: install Node deps & create .env ────────
if $FIRST_RUN; then
  echo "→ Installing dependencies..."
  cd backend && npm install && cd ..
  cd frontend && npm install && cd ..

  echo ""
  echo "⚠️  FIRST RUN SETUP"
  echo "   Copy backend/.env.server to backend/.env and fill in:"
  echo "   - JWT_SECRET and JWT_REFRESH_SECRET (random 32+ char strings)"
  echo "   - MICROSOFT_CLIENT_SECRET (from Azure Portal)"
  echo ""
  echo "   Example command:"
  echo "   cp backend/.env.server backend/.env && nano backend/.env"
  echo ""
  read -p "Press ENTER after you have set up backend/.env ..."

  echo "→ Running database migrations..."
  cd backend
  npm run db:migrate
  npm run db:migrate2
  npm run db:migrate3
  cd ..
fi

# ── 3. Build frontend (React → static files) ──────────────────
echo "→ Building React frontend..."
cd frontend && npm run build && cd ..

# ── 4. Compile backend TypeScript ─────────────────────────────
echo "→ Compiling backend TypeScript..."
cd backend && npm run build && cd ..

# ── 5. (Re)start with pm2 ─────────────────────────────────────
echo "→ Starting with pm2..."
if pm2 list | grep -q "vaultpass"; then
  pm2 restart vaultpass
else
  pm2 start ecosystem.config.js
  pm2 save
fi

echo ""
echo "✅ VaultPass is running at http://103.235.106.93:5000"
echo "   pm2 logs vaultpass   → view live logs"
echo "   pm2 status           → check process status"
