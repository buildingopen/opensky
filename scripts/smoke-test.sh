#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"

echo "Running smoke checks against ${API_BASE_URL}"

health_code="$(curl -s -o /tmp/opensky-health.json -w "%{http_code}" "${API_BASE_URL}/api/healthz")"
if [[ "${health_code}" != "200" ]]; then
  echo "healthz failed with status ${health_code}"
  exit 1
fi

ready_code="$(curl -s -o /tmp/opensky-ready.json -w "%{http_code}" "${API_BASE_URL}/api/readyz")"
if [[ "${ready_code}" != "200" && "${ready_code}" != "503" ]]; then
  echo "readyz failed with unexpected status ${ready_code}"
  exit 1
fi

echo "Smoke checks passed."
