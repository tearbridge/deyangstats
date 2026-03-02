#!/bin/bash
set -e

# 在香港服务器上运行的部署脚本
# Usage: bash scripts/deploy.sh

APP_DIR="/var/www/deyangstats"

echo "🚀 Deploying deyangstats..."

cd "$APP_DIR"
git pull

echo "📦 Installing backend dependencies..."
cd backend
npm install --production

echo "📦 Installing frontend dependencies and building..."
cd ../frontend
npm install
npm run build

echo "🔄 Restarting backend with PM2..."
cd ..
if pm2 list | grep -q "deyangstats-backend"; then
  pm2 restart deyangstats-backend
else
  pm2 start backend/src/server.js --name deyangstats-backend --cwd "$APP_DIR"
fi

pm2 save

echo "✅ Deploy complete!"
echo "Backend running on port 3001"
echo "Frontend built to frontend/dist/"
