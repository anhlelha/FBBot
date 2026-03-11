#!/bin/bash

# Script to sync Local database and uploads to GCP VM
# Usage: ./scripts/sync-db-push.sh

VM_IP="34.9.136.241"
VM_USER="anhlh48"
PROJECT_DIR="fbbot"
# Get the absolute path of the project root
LOCAL_ROOT=$(cd "$(dirname "$0")/.."; pwd)

echo "⚠️  WARNING: This will overwrite the database and uploads on the VM ($VM_IP) with your local data."
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Aborted."
    exit 1
fi

echo "🚀 Syncing local database and uploads to VM..."

# 1. Force checkpoint on local DB to merge WAL into main file
sqlite3 "$LOCAL_ROOT/data/app.db" "PRAGMA wal_checkpoint(FULL);"

# 2. Push the main db file
scp -o StrictHostKeyChecking=no "$LOCAL_ROOT/data/app.db" $VM_USER@$VM_IP:~/$PROJECT_DIR/data/

# 3. Push the uploads directory
echo "📤 Pushing uploads directory from local to VM..."
rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$LOCAL_ROOT/uploads/" $VM_USER@$VM_IP:~/$PROJECT_DIR/uploads/

# 4. Clean up WAL/SHM on VM and update database paths
# This ensures the VM app starts with the clean main DB file, and paths correctly point to the VM directories
ssh -o StrictHostKeyChecking=no $VM_USER@$VM_IP "rm -f ~/$PROJECT_DIR/data/app.db-shm ~/$PROJECT_DIR/data/app.db-wal && sqlite3 ~/$PROJECT_DIR/data/app.db \"UPDATE documents SET path = replace(path, '$LOCAL_ROOT/', '/home/$VM_USER/$PROJECT_DIR/');\" && pm2 reload hotel-chatbot-fb"

echo "✅ Database and uploads pushed and app reloaded on VM!"
