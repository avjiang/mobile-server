#!/bin/zsh
# Deploy a committed ref to the office Mac mini from the dev Mac, over SSH. Builds ON the Mac mini
# (the `lzo` native module must be compiled there). Switches the `current` symlink only after the
# new build is healthy; otherwise the previous release keeps running.
# The Mac mini needs no GitHub access: the source is streamed from this repo with `git archive`.
#
# Usage: deploy/macmini/deploy.sh <user@macmini-host> [git-ref]   (default ref: HEAD — committed files only)
set -euo pipefail
TARGET=${1:?usage: deploy.sh <user@macmini-host> [git-ref]}
REF=${2:-HEAD}
SSH=(ssh -o StrictHostKeyChecking=accept-new $TARGET)
ROOT=/opt/bayaryuk
LABEL=net.bayaryuk.backend
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

SHA=$(git rev-parse --short "$REF")
[[ -n "$(git status --porcelain)" && "$REF" == HEAD ]] && echo "note: uncommitted changes are NOT deployed (git archive of $SHA)"
TS=$(date -u +%Y%m%d%H%M%S)-$SHA
echo "deploying $SHA as release $TS to $TARGET"

git archive --format=tar.gz "$REF" -- . ':!docs' ':!tools' ':!.github' ':!.claude' ':!workers' \
  | "${SSH[@]}" "mkdir -p $ROOT/releases/$TS && tar -xz -C $ROOT/releases/$TS"

"${SSH[@]}" "zsh -s" <<EOF
set -euo pipefail
export PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin
cd $ROOT/releases/$TS
npm ci --no-audit --no-fund
npm run generate_prisma
npm run build
npm prune --omit=dev
# keep ONLY the macOS arm64 Prisma engine
find prisma node_modules/.prisma -name 'libquery_engine-*' ! -name '*darwin-arm64*' -delete 2>/dev/null || true
ls prisma/client/generated/client/libquery_engine-darwin-arm64* >/dev/null
EOF

PREV=$("${SSH[@]}" "readlink $ROOT/current || true")
# bootstrap loads the service on the first deploy and fails harmlessly once it is loaded
"${SSH[@]}" "ln -sfn $ROOT/releases/$TS $ROOT/current && \
  { sudo -n /bin/launchctl bootstrap system /Library/LaunchDaemons/$LABEL.plist 2>/dev/null || true; } && \
  sudo -n /bin/launchctl kickstart -k system/$LABEL"

for i in {1..30}; do
  if "${SSH[@]}" "curl -sf http://127.0.0.1:8080/health >/dev/null"; then
    echo "healthy: $TS"
    # keep the 3 newest releases
    "${SSH[@]}" "cd $ROOT/releases && ls -1t | tail -n +4 | xargs rm -rf"
    exit 0
  fi
  sleep 2
done

echo "NOT healthy after 60s — rolling back to ${PREV:-<none>}"
"${SSH[@]}" "tail -n 40 $ROOT/logs/backend.log" || true
if [[ -n "$PREV" ]]; then
  "${SSH[@]}" "ln -sfn $PREV $ROOT/current && sudo -n /bin/launchctl kickstart -k system/$LABEL"
fi
exit 1
