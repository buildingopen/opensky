#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
SITE_BASE_URL="${SITE_BASE_URL:-}"
TEST_PROMPT="${TEST_PROMPT:-berlin to paris tomorrow}"

if [[ -z "${SITE_BASE_URL}" ]]; then
  if [[ "${API_BASE_URL}" == "https://api.flyfast.app" ]]; then
    SITE_BASE_URL="https://flyfast.app"
  elif [[ "${API_BASE_URL}" == "https://api-preview.flyfast.app" ]]; then
    SITE_BASE_URL="https://preview.flyfast.app"
  fi
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT

echo "Running smoke checks against API=${API_BASE_URL} SITE=${SITE_BASE_URL:-<skipped>}"

health_code="$(curl -s -o "${tmpdir}/health.json" -w "%{http_code}" "${API_BASE_URL}/api/healthz")"
if [[ "${health_code}" != "200" ]]; then
  echo "healthz failed with status ${health_code}"
  exit 1
fi

ready_code="$(curl -s -o "${tmpdir}/ready.json" -w "%{http_code}" "${API_BASE_URL}/api/readyz")"
if [[ "${ready_code}" != "200" ]]; then
  echo "readyz failed with status ${ready_code}"
  exit 1
fi

if ! grep -q '"status":"ready"' "${tmpdir}/ready.json"; then
  echo "readyz payload did not report ready"
  cat "${tmpdir}/ready.json"
  exit 1
fi

direct_search_code="$(curl -s -o "${tmpdir}/direct-search.json" -w "%{http_code}" \
  -X POST "${API_BASE_URL}/api/search" \
  -H "content-type: application/json" \
  --data "{\"prompt\":\"${TEST_PROMPT}\"}")"
if [[ "${direct_search_code}" != "403" ]]; then
  echo "direct API search should be forbidden, got ${direct_search_code}"
  cat "${tmpdir}/direct-search.json"
  exit 1
fi

if [[ -n "${SITE_BASE_URL}" ]]; then
  web_search_code="$(curl -s -o "${tmpdir}/web-search.txt" -w "%{http_code}" \
    -X POST "${SITE_BASE_URL}/api/search" \
    -H "content-type: application/json" \
    --data "{\"prompt\":\"${TEST_PROMPT}\"}")"
  if [[ "${web_search_code}" != "200" ]]; then
    echo "web proxy search failed with status ${web_search_code}"
    sed -n '1,40p' "${tmpdir}/web-search.txt"
    exit 1
  fi
  if ! grep -q 'data: {"type": "results"' "${tmpdir}/web-search.txt"; then
    echo "web proxy search did not stream results"
    sed -n '1,40p' "${tmpdir}/web-search.txt"
    exit 1
  fi
fi

echo "Smoke checks passed."
