#!/bin/bash

# Script to sync Local database to GCP VM
# Usage: ./scripts/sync-db-push.sh

VM_IP="34.9.136.241"
VM_USER="anhlh48"
PROJECT_DIR="fbbot"

echo "⚠️  WARNING: This will overwrite the database on the VM ($VM_IP) with your local data."
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Aborted."
    exit 1
fi

echo "🚀 Syncing local database to VM..."

# 1. Force checkpoint on local DB to merge WAL into main file
sqlite3 data/app.db "PRAGMA wal_checkpoint(FULL);"

# 2. Push the main db file
scp -o StrictHostKeyChecking=no data/app.db $VM_USER@$VM_IP:~/$PROJECT_DIR/data/

# 3. Clean up WAL/SHM on VM and reload app
# This ensures the VM app starts with the clean main DB file
ssh -o StrictHostKeyChecking=no $VM_USER@$VM_IP "rm -f ~/$PROJECT_DIR/data/app.db-shm ~/$PROJECT_DIR/data/app.db-wal && pm2 reload hotel-chatbot-fb"

echo "✅ Database pushed and app reloaded on VM!"
