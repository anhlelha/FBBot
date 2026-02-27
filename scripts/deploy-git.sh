#!/bin/bash

# Script to push changes to GitHub
# Usage: ./scripts/deploy-git.sh "Your commit message"

COMMIT_MSG=${1:-"Update deployment configurations"}

echo "🚀 Starting Git push..."

# Add all changes
git add .

# Commit with provided message or default
git commit -m "$COMMIT_MSG"

# Push to main branch
git push origin main

echo "✅ Git push completed!"
