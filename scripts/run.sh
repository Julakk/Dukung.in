#!/usr/bin/env bash
# Menjalankan server dan menyalakannya lagi otomatis kalau berhenti.
# Pakai:  nohup bash scripts/run.sh > /dev/null 2>&1 &
# Stop:   pkill -f scripts/run.sh; pkill -f "node server.js"
cd "$(dirname "$0")/.." || exit 1
termux-wake-lock 2>/dev/null || true
while true; do
  [ "$(stat -c %s server.log 2>/dev/null || echo 0)" -gt 5000000 ] && : > server.log
  START=$SECONDS
  node server.js >> server.log 2>&1
  rc=$?
  RUN=$((SECONDS - START))
  echo "[$(date '+%F %T')] server berhenti (kode $rc, jalan ${RUN}s), nyala lagi otomatis" >> server.log
  if [ "$RUN" -lt 10 ]; then sleep ${RESTART_FAST_DELAY:-30}; else sleep 3; fi
done
