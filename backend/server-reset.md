# Hetzner VPS Fresh Start Guide

## Option 1: Rebuild from Hetzner Cloud Console (Recommended)

**Fastest and cleanest method:**

1. Go to https://console.hetzner.cloud/
2. Select your project
3. Click on your server (49.13.133.189)
4. Click **"Rebuild"** in the server actions
5. Choose **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**
6. Confirm the rebuild
7. Wait 2-3 minutes for completion
8. Your server will be completely fresh with a new root password (sent via email)

**⚠️ Warning:** This deletes ALL data on the server.

---

## Option 2: Manual Cleanup via SSH

If you want to clean up without rebuilding:

```bash
ssh root@49.13.133.189
```

### Remove common installations:

```bash
# Stop and remove Docker containers/images
docker stop $(docker ps -aq) 2>/dev/null
docker rm $(docker ps -aq) 2>/dev/null
docker rmi $(docker images -q) 2>/dev/null

# Remove Docker
apt-get purge -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
rm -rf /var/lib/docker /etc/docker

# Remove Node.js/npm
apt-get purge -y nodejs npm
rm -rf /usr/local/lib/node_modules

# Remove Go
rm -rf /usr/local/go /root/go

# Remove PostgreSQL
apt-get purge -y postgresql*
rm -rf /var/lib/postgresql /etc/postgresql

# Remove Redis
apt-get purge -y redis-server
rm -rf /var/lib/redis

# Remove Nginx/Apache
apt-get purge -y nginx nginx-common apache2
rm -rf /etc/nginx /etc/apache2 /var/www

# Clean application directories
rm -rf /opt/* /srv/* /home/*/

# Clean apt cache
apt-get autoremove -y
apt-get autoclean -y
apt-get clean

# Reset firewall to defaults
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw --force enable
```

---

## Option 3: Automated Fresh Setup Script

Save this script and run it after Option 1 or 2:

```bash
#!/bin/bash
# fresh-ubuntu-setup.sh

set -e

echo "🚀 Setting up fresh Ubuntu server..."

# Update system
apt-get update
apt-get upgrade -y

# Install essentials
apt-get install -y \
    curl wget git vim nano \
    build-essential \
    ca-certificates \
    gnupg lsb-release \
    ufw fail2ban

# Configure firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Configure fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Create app directory
mkdir -p /opt/ahla
cd /opt/ahla

echo "✅ Server ready for deployment!"
echo "Next steps:"
echo "1. Clone your repo: git clone https://github.com/lebid15/ahla.git"
echo "2. Configure environment variables"
echo "3. Run docker compose up -d"
```

Usage:
```bash
chmod +x fresh-ubuntu-setup.sh
./fresh-ubuntu-setup.sh
```

---

## Quick Commands Reference

### Check what's running:
```bash
# Docker containers
docker ps -a

# System services
systemctl list-units --type=service --state=running

# Open ports
ss -tulpn

# Disk usage
df -h
du -sh /*
```

### SSH Connection Issues?

If you can't connect via SSH:

1. **Check server status** in Hetzner Console
2. **Use Console access** (VNC) from Hetzner web interface
3. **Check firewall**: `ufw status`
4. **Verify SSH service**: `systemctl status ssh`

---

## After Fresh Start - Deploy AHLA

1. **Clone repository:**
```bash
cd /opt
git clone https://github.com/lebid15/ahla.git
cd ahla/backend
```

2. **Create environment file:**
```bash
cp .env.example .env.production
nano .env.production
# Fill in production values
```

3. **Deploy with Docker:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

4. **Check logs:**
```bash
docker compose logs -f
```

---

## Need Help?

- **Hetzner Docs:** https://docs.hetzner.com/cloud/
- **Server not responding?** Use Hetzner Console's built-in VNC access
- **Lost root password?** Reset it from Hetzner Console under "Rescue" mode
