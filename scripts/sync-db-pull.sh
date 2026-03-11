#!/bin/bash

# Script to sync VM database and uploads to Local
# Usage: ./scripts/sync-db-pull.sh

VM_IP="34.9.136.241"
VM_USER="anhlh48"
PROJECT_DIR="fbbot"
# Get the absolute path of the project root
LOCAL_ROOT=$(cd "$(dirname "$0")/.."; pwd)

echo "⚠️  WARNING: This will overwrite your LOCAL database and uploads with data from the VM ($VM_IP)."
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Aborted."
    exit 1
fi

echo "📥 Pulling database from VM to local..."

# 1. Force checkpoint on VM to merge WAL into main file
ssh -o StrictHostKeyChecking=no $VM_USER@$VM_IP "sqlite3 ~/$PROJECT_DIR/data/app.db 'PRAGMA wal_checkpoint(FULL);'"

# 2. Backup local db first
cp "$LOCAL_ROOT/data/app.db" "$LOCAL_ROOT/data/app.db.bak_$(date +%Y%m%d_%H%M%S)"
echo "📦 Local backup created."

# 3. Pull the db file
scp -o StrictHostKeyChecking=no $VM_USER@$VM_IP:~/$PROJECT_DIR/data/app.db "$LOCAL_ROOT/data/app.db"

# 4. Pull the uploads directory
echo "📥 Pulling uploads directory from VM to local..."
rsync -avz -e "ssh -o StrictHostKeyChecking=no" $VM_USER@$VM_IP:~/$PROJECT_DIR/uploads/ "$LOCAL_ROOT/uploads/"

# 5. Clean up local WAL/SHM files to ensure local app loads new data cleanly
rm -f "$LOCAL_ROOT/data/app.db-shm" "$LOCAL_ROOT/data/app.db-wal"

# 6. Update paths in the local database
echo "🔄 Updating file paths in the local database..."
sqlite3 "$LOCAL_ROOT/data/app.db" "UPDATE documents SET path = replace(path, '/home/$VM_USER/$PROJECT_DIR/', '$LOCAL_ROOT/');"

echo "✅ Database and uploads pulled and updated locally!"
