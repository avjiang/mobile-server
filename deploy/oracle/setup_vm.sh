#!/bin/bash
# One-time setup of the Oracle A1 VM (Ubuntu 24.04 aarch64). Idempotent — safe to re-run.
# Run from the Mac:  ssh -i ~/.ssh/bayaryuk_oci ubuntu@<VM_IP> 'sudo bash -s' < deploy/oracle/setup_vm.sh
#
# Layout:
#   /opt/bayaryuk/releases/<ts>/   one build per deploy (built ON the VM: `lzo` is a native module)
#   /opt/bayaryuk/current          symlink → active release
#   /etc/bayaryuk/env              secrets (0600, owner bayaryuk) — same names as the App Service app settings
set -euo pipefail

# Crons in src/cron/cron-manager.ts have no timezone → they follow the server clock.
# App Service is UTC; keep it UTC or every job shifts by 7 h.
timedatectl set-timezone UTC

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
# build-essential + python3: node-gyp for `lzo` on arm64
apt-get install -yq unattended-upgrades fail2ban build-essential python3 curl ca-certificates gnupg jq

# Security patches install themselves; reboot at 03:30 UTC (10:30 WIB, after the crons) only when required.
cat > /etc/apt/apt.conf.d/52bayaryuk-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:30";
EOF
systemctl enable --now unattended-upgrades fail2ban

# SSH: keys only
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh

# 2 GB swap — headroom for `npm ci` + tsc on the 1-OCPU/6-GB shape
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Cap journald so logs can't fill the disk
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=500M\n' > /etc/systemd/journald.conf.d/size.conf
systemctl restart systemd-journald

# Node 22 (NodeSource, arm64)
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi

# cloudflared (Cloudflare Tunnel) — installed only; connected later with `cloudflared service install <token>`
if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -q && apt-get install -yq cloudflared
fi

# App user + folders
id bayaryuk >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/bayaryuk --shell /usr/sbin/nologin bayaryuk
mkdir -p /opt/bayaryuk/releases /etc/bayaryuk
chown -R bayaryuk:bayaryuk /opt/bayaryuk
touch /etc/bayaryuk/env && chown bayaryuk:bayaryuk /etc/bayaryuk/env && chmod 600 /etc/bayaryuk/env

cat > /etc/systemd/system/bayaryuk.service <<'EOF'
[Unit]
Description=Bayar Yuk backend
After=network-online.target
Wants=network-online.target

[Service]
User=bayaryuk
WorkingDirectory=/opt/bayaryuk/current
EnvironmentFile=/etc/bayaryuk/env
Environment=NODE_ENV=production PORT=8080 TZ=UTC
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
# SIGTERM → index.ts disconnects Prisma clients; give it time
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable bayaryuk   # started by deploy.sh once a release exists

# Oracle's Ubuntu image ships iptables rules that allow only SSH inbound — the tunnel needs no
# inbound port, so they stay as they are. Print them for the record.
iptables -S INPUT | grep -E 'dport|REJECT' || true

echo "setup done: node $(node -v), cloudflared $(cloudflared --version 2>&1 | head -1), tz $(timedatectl show -p Timezone --value)"
