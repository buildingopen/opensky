# Service Level Objectives

## Scope

Applies to hosted OpenSky application user flow:
`search submitted -> results displayed`.

## SLIs

- API availability: successful responses from `/api/search`, `/api/parse`
- Latency: p95 search completion time
- Reliability: rate of search errors/timeouts

## SLO targets (rolling 30 days)

- Availability: **99.5%**
- p95 search completion: **<= 15s**
- Error rate (`5xx + stream error`): **< 1.5%**

## Alert thresholds

- 5xx error rate > 5% for 5 minutes
- p95 latency > 25s for 10 minutes
- Ready probe failing for 3 consecutive checks

## Error budget policy

If monthly error budget burn exceeds 50%, pause non-critical feature launches until reliability recovers.
