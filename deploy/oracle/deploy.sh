#!/bin/zsh
# Deploy a committed ref to the Oracle VM. Builds ON the VM (the `lzo` native module must be
# compiled for linux-arm64). Switches the `current` symlink only after the new build is healthy;
# otherwise the previous release keeps running.
#
# Usage: deploy/oracle/deploy.sh <VM_IP> [git-ref]   (default ref: HEAD — committed files only)
set -euo pipefail
VM=${1:?usage: deploy.sh <VM_IP> [git-ref]}
REF=${2:-HEAD}
SSH=(ssh -i ~/.ssh/bayaryuk_oci -o StrictHostKeyChecking=accept-new ubuntu@$VM)
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

SHA=$(git rev-parse --short "$REF")
[[ -n "$(git status --porcelain)" && "$REF" == HEAD ]] && echo "note: uncommitted changes are NOT deployed (git archive of $SHA)"
TS=$(date -u +%Y%m%d%H%M%S)-$SHA
echo "deploying $SHA as release $TS to $VM"

git archive --format=tar.gz "$REF" -- . ':!docs' ':!tools' ':!.github' ':!.claude' ':!workers' \
  | "${SSH[@]}" "sudo -u bayaryuk mkdir -p /opt/bayaryuk/releases/$TS && sudo -u bayaryuk tar -xz -C /opt/bayaryuk/releases/$TS"

"${SSH[@]}" "sudo -u bayaryuk bash -s" <<EOF
set -euo pipefail
cd /opt/bayaryuk/releases/$TS
npm ci --no-audit --no-fund
npm run generate_prisma
npm run build
npm prune --omit=dev
# keep ONLY the arm64 Prisma engine (the Azure workflow deletes exactly this one)
find prisma node_modules/.prisma -name 'libquery_engine-*' ! -name '*linux-arm64*' -delete 2>/dev/null || true
ls prisma/client/generated/client/libquery_engine-linux-arm64* >/dev/null
EOF

PREV=$("${SSH[@]}" "readlink /opt/bayaryuk/current || true")
"${SSH[@]}" "sudo ln -sfn /opt/bayaryuk/releases/$TS /opt/bayaryuk/current && sudo systemctl restart bayaryuk"

for i in {1..30}; do
  if "${SSH[@]}" "curl -sf http://127.0.0.1:8080/health >/dev/null"; then
    echo "healthy: $TS"
    # keep the 3 newest releases (sudo: /opt/bayaryuk is the bayaryuk user's 0750 home)
    "${SSH[@]}" "sudo bash -c 'cd /opt/bayaryuk/releases && ls -1t | tail -n +4 | xargs -r rm -rf'"
    exit 0
  fi
  sleep 2
done

echo "NOT healthy after 60s — rolling back to ${PREV:-<none>}"
"${SSH[@]}" "sudo journalctl -u bayaryuk -n 40 --no-pager" || true
if [[ -n "$PREV" ]]; then
  "${SSH[@]}" "sudo ln -sfn $PREV /opt/bayaryuk/current && sudo systemctl restart bayaryuk"
fi
exit 1
