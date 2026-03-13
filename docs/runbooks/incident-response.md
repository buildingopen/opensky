# Incident Response Runbook

## Severity levels

- **SEV-1**: Core search unavailable for most users, data/security issue, or cost runaway.
- **SEV-2**: Significant degradation (timeouts, high error rate) with workaround.
- **SEV-3**: Minor issue with limited impact.

## First 15 minutes

1. Assign incident commander.
2. Confirm impact (who, what, when).
3. Check backend probes and recent deploys.
4. Stabilize quickly (rollback or feature flag if applicable).
5. Communicate status and next update ETA.

## Investigation checklist

- API 5xx rate and latency
- Rate-limit saturation and abuse traffic
- Provider failure spikes (Gemini / flight providers)
- Recent config or dependency changes

## Resolution and follow-up

1. Confirm system is stable.
2. Share incident closure update.
3. Write postmortem (timeline, root cause, actions).
4. Add preventive tasks to backlog with owners.
