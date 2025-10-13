#!/bin/bash
# تثبيت وتشغيل Redis على WSL

echo "🔧 Installing Redis..."
sudo apt update
sudo apt install -y redis-server

echo "⚙️ Configuring Redis..."
# تعديل الإعدادات لتشغيل Redis في الخلفية
sudo sed -i 's/^supervised no/supervised systemd/' /etc/redis/redis.conf

echo "🚀 Starting Redis..."
sudo service redis-server start

echo "✅ Checking Redis status..."
sudo service redis-server status

echo "🧪 Testing Redis connection..."
redis-cli ping

echo "✨ Redis installation complete!"
echo "Redis is now running on localhost:6379"
