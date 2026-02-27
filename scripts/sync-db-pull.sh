#!/bin/bash

# Script to sync VM database to Local
# Usage: ./scripts/sync-db-pull.sh

VM_IP="34.9.136.241"
VM_USER="anhlh48"
PROJECT_DIR="fbbot"

echo "⚠️  WARNING: This will overwrite your LOCAL database with data from the VM ($VM_IP)."
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
cp data/app.db data/app.db.bak_$(date +%Y%m%d_%H%M%S)
echo "📦 Local backup created."

# 3. Pull the db file
scp -o StrictHostKeyChecking=no $VM_USER@$VM_IP:~/$PROJECT_DIR/data/app.db data/app.db

# 4. Clean up local WAL/SHM files to ensure local app loads new data cleanly
rm -f data/app.db-shm data/app.db-wal

echo "✅ Database pulled and updated locally!"
