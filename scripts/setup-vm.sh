#!/bin/bash
# Script để tự động cài đặt môi trường trên Ubuntu VM cho FBBot
set -e

echo "🚀 Bắt đầu cài đặt môi trường..."

# 1. Cập nhật hệ thống
sudo apt update
sudo apt upgrade -y

# 2. Cài đặt Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Cài đặt các công cụ cơ bản
sudo apt install -y git build-essential nginx

# 4. Cài đặt PM2
echo "Installing PM2..."
sudo npm install -g pm2

# 5. Cài đặt Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

echo "✅ Cài đặt môi trường hoàn tất!"
node -v
npm -v
pm2 -v
