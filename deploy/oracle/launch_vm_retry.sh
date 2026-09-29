#!/bin/zsh
# Retry launching the Always Free A1 VM until Oracle has host capacity.
# Tries 2 OCPU/12 GB, then 1 OCPU/6 GB (both inside Always Free). Never creates a second VM.
# Needs `oci setup bootstrap` done (~/.oci/config, home region ap-singapore-2).
# Usage: [SLEEP=secs] deploy/oracle/launch_vm_retry.sh [rounds]   (default SLEEP=120 → one round ≈ 7 min)
set -u
ROUNDS=${1:-150}
T=$(awk -F= '/^tenancy/{print $2}' ~/.oci/config)
C=$(oci iam compartment list -c $T --name bayaryuk --query 'data[0].id' --raw-output 2>/dev/null)
SN=$(oci network subnet list -c $C --display-name bayaryuk-public --query 'data[0].id' --raw-output 2>/dev/null)
AD=$(oci iam availability-domain list -c $T --query 'data[0].name' --raw-output 2>/dev/null)
IMG=$(oci compute image list -c $T --operating-system "Canonical Ubuntu" --operating-system-version "24.04" \
  --shape VM.Standard.A1.Flex --sort-by TIMECREATED --query 'data[0].id' --raw-output 2>/dev/null)
[[ -z "$C" || -z "$SN" || -z "$IMG" ]] && { echo "lookup failed (compartment/subnet/image)"; exit 2; }
for i in {1..$ROUNDS}; do
  for SHAPE in '{"ocpus":2,"memoryInGBs":12}' '{"ocpus":1,"memoryInGBs":6}'; do
    EXIST=$(oci compute instance list -c $C --query "data[?\"lifecycle-state\"!='TERMINATED' && \"lifecycle-state\"!='TERMINATING'] | length(@)" 2>/dev/null)
    if [[ -n "$EXIST" && "$EXIST" != "0" ]]; then echo "$(date +%T) instance already exists ($EXIST) - stop"; exit 0; fi
    OUT=$(oci compute instance launch -c $C --availability-domain "$AD" --display-name bayaryuk-app --shape VM.Standard.A1.Flex \
      --shape-config "$SHAPE" --image-id $IMG --boot-volume-size-in-gbs 50 --subnet-id $SN --assign-public-ip true \
      --hostname-label bayaryuk-app --ssh-authorized-keys-file ~/.ssh/bayaryuk_oci.pub \
      --query 'data."lifecycle-state"' --raw-output 2>&1)
    if echo "$OUT" | grep -qE '^(PROVISIONING|RUNNING)$'; then echo "$(date +%T) round $i: LAUNCHED ($OUT) shape=$SHAPE"; exit 0; fi
    echo "$(date +%T) round $i $SHAPE: $(echo "$OUT" | grep -E '"(code|message)"' | tr -s ' ' | tr '\n' ' ')"
    sleep ${SLEEP:-120}   # 45s tripped TooManyRequests on ~40% of attempts; SLEEP=600 for a gentle pace
  done
done
echo "gave up after $ROUNDS rounds"; exit 1
