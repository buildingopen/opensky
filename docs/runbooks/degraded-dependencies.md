# Degraded Dependencies Runbook

Use this runbook when external providers (Gemini parser or flight data providers) degrade.

## Symptoms

- `/api/search` errors increase
- Parse failures with 502 responses
- Timeouts > normal baseline

## Actions

1. Confirm which dependency is failing from logs and metrics.
2. Reduce blast radius:
   - Temporarily lower parallel search breadth.
   - Raise retry budget only if latency allows.
3. Communicate degraded mode in status updates.
4. If parser provider is fully down, return user-friendly fallback message.
5. Escalate to provider support when outage persists.
