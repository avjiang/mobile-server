#!/bin/zsh
# One-time setup of the office Mac mini (M1, macOS) as a standby backend host.
# Plan + checklist: docs/future/APP_SERVER_MACMINI.md. Idempotent — safe to re-run.
#
# Run ON the Mac mini, as the admin user (NOT with sudo — it asks for the password itself):
#   zsh setup_macmini.sh
#
# Layout:
#   /opt/bayaryuk/releases/<ts>/   one build per deploy (built HERE: `lzo` is a native module)
#   /opt/bayaryuk/current          symlink → active release
#   /opt/bayaryuk/env              secrets (0600) — same names as the App Service app settings
#   /opt/bayaryuk/logs/backend.log stdout + stderr
#   /Library/LaunchDaemons/net.bayaryuk.backend.plist   starts at boot, no login needed, restarts on crash
set -euo pipefail
zmodload zsh/datetime   # $EPOCHREALTIME
[[ $EUID -eq 0 ]] && { echo "run as your normal admin user, not root/sudo"; exit 1; }
[[ "$(uname -m)" == arm64 ]] || { echo "expected Apple silicon (arm64)"; exit 1; }
ME=$(id -un)
ROOT=/opt/bayaryuk
LABEL=net.bayaryuk.backend
PLIST=/Library/LaunchDaemons/$LABEL.plist
DB_HOST=bayaryuk-db-v2.mysql.database.azure.com

echo "== 1. Network preflight (office firewalls often block 3306 / 7844)"
for target in "$DB_HOST 3306" "region1.v2.argotunnel.com 7844" "github.com 443"; do
  if nc -z -G 5 ${=target} 2>/dev/null; then echo "  OK       $target"; else echo "  BLOCKED  $target"; fi
done
# The Azure MySQL firewall DROPS unknown IPs (timeout), so "BLOCKED 3306" means either the office
# network blocks it or this office IP isn't on the DB firewall yet — add the rule first, then re-run.
# TCP connect time ≈ one network round trip to the DB — each API request makes ~3.4 queries.
samples=()
for i in {1..5}; do
  t0=$EPOCHREALTIME; nc -z -G 5 $DB_HOST 3306 2>/dev/null && samples+=( $(( (EPOCHREALTIME - t0) * 1000 )) )
done
(( ${#samples} )) && printf '  DB round trip (TCP connect, ms): %s\n' "${(j:, :)${(@)samples%.*}}"

echo "== 2. Tools"
xcode-select -p >/dev/null 2>&1 || { xcode-select --install; echo "finish the Command Line Tools install, then re-run"; exit 1; }
command -v brew >/dev/null || { echo 'install Homebrew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'; exit 1; }
brew list node@22 >/dev/null 2>&1 || brew install node@22
brew list cloudflared >/dev/null 2>&1 || brew install cloudflared
NODE=/opt/homebrew/opt/node@22/bin/node
echo "  node $($NODE -v), $(cloudflared --version 2>&1 | head -1)"

echo "== 3. Power: never sleep, boot again after a power cut"
sudo pmset -a sleep 0 disksleep 0 displaysleep 10 powernap 0 autorestart 1 womp 1
sudo systemsetup -setrestartfreeze on >/dev/null 2>&1 || true   # needs Full Disk Access on newer macOS; not critical

echo "== 4. macOS updates: download automatically, install by hand (an update reboot is an outage)"
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool true
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall -bool true

echo "== 5. Folders + secrets file"
sudo mkdir -p $ROOT/releases $ROOT/logs
sudo chown -R ${ME}:staff $ROOT
if [[ ! -s $ROOT/env ]]; then
  # Values: copy from the App Service app settings. SINGLE-quote every value — the DB URLs contain & and ?,
  # and a password may contain $, which double quotes would expand.
  cat > $ROOT/env <<'EOF'
NODE_ENV='production'
PORT='8080'
HOST='127.0.0.1'
TZ='UTC'
# Standby: App Service still runs the nightly jobs. Set to "false" only when this host becomes primary.
DISABLE_CRONS='true'
GLOBAL_DB_URL=''
TENANT_DATABASE_URL=''
PUSHY_SECRET_API_KEY=''
R2_ENDPOINT=''
R2_BUCKET=''
R2_ACCESS_KEY_ID=''
R2_SECRET_ACCESS_KEY=''
R2_PUBLIC_BASE_URL=''
EOF
  echo "  wrote $ROOT/env template — fill in the empty values"
fi
chmod 600 $ROOT/env

cat > $ROOT/run.sh <<EOF
#!/bin/zsh
# Started by launchd ($PLIST). Loads the secrets, then becomes the node process.
set -a; source $ROOT/env; set +a
cd $ROOT/current
exec $NODE dist/index.js
EOF
chmod 755 $ROOT/run.sh

echo "== 6. launchd service $LABEL (runs as $ME, starts at boot without a login)"
sudo tee $PLIST >/dev/null <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>UserName</key><string>$ME</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$ROOT/run.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <!-- SIGTERM → index.ts disconnects the Prisma clients; give it time before SIGKILL -->
  <key>ExitTimeOut</key><integer>30</integer>
  <key>StandardOutPath</key><string>$ROOT/logs/backend.log</string>
  <key>StandardErrorPath</key><string>$ROOT/logs/backend.log</string>
</dict>
</plist>
EOF
sudo chown root:wheel $PLIST && sudo chmod 644 $PLIST
# deploy.sh (run over SSH, no TTY) may load and restart exactly this service without a password.
SUDOERS=/etc/sudoers.d/bayaryuk
echo "$ME ALL=(root) NOPASSWD: /bin/launchctl bootstrap system $PLIST, /bin/launchctl kickstart -k system/$LABEL" \
  | sudo tee $SUDOERS.tmp >/dev/null
sudo visudo -cf $SUDOERS.tmp >/dev/null && sudo mv $SUDOERS.tmp $SUDOERS && sudo chmod 440 $SUDOERS
echo "  service is loaded by the first deploy (deploy/macmini/deploy.sh)"

cat <<EOF

Done. Still manual (see docs/future/APP_SERVER_MACMINI.md):
  - System Settings → General → Sharing → Remote Login ON (for deploys from the dev Mac)
  - Fill in $ROOT/env
  - Azure MySQL firewall: allow this office's public IP ($(curl -s -4 --max-time 5 https://api.ipify.org || echo '?'))
  - Cloudflare Tunnel: create it in the dashboard, then  sudo cloudflared service install <TOKEN>
EOF
