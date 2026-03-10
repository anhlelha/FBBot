#!/bin/bash

# Script to update the GCP VM from GitHub
# Usage: ./scripts/deploy-vm.sh

VM_IP="34.9.136.241"
VM_USER="anhlh48"
PROJECT_DIR="fbbot"

set -e

echo "🌐 Connecting to VM $VM_IP to update application..."

ssh -o StrictHostKeyChecking=no $VM_USER@$VM_IP "cd ~/$PROJECT_DIR && \
    set -e && \
    echo '📥 Pulling latest changes from Git...' && \
    git fetch origin main && git reset --hard origin/main && \
    echo '📦 Installing dependencies...' && \
    npm install --omit=dev && \
    echo '🔄 Reloading PM2 process...' && \
    pm2 reload 0 && \
    echo '✅ Update completed on VM!'"

echo "🏁 Deployment update finished (Success)."
