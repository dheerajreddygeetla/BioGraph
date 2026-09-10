# Runbook: HighLatency

## Symptom
P95 latency > 1s for a service.

## Diagnosis
1. Check Grafana latency panel
2. Check event loop lag: `nodejs_eventloop_lag_seconds`
3. Check DB query times

## Mitigation
1. Add indexes to slow MongoDB queries
2. Cache frequent Neo4j queries
3. Increase Node.js heap: `NODE_OPTIONS=--max-old-space-size=2048`