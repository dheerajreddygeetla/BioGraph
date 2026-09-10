# Runbook: QueueBacklog

## Symptom
Research job queue depth > 10 (warning) or > 50 (critical).

## Diagnosis
1. Check worker status: `docker compose ps research-worker`
2. Check worker logs: `docker compose logs research-worker --tail=50`
3. Check Redis: `docker exec -it biograph-redis redis-cli LLEN bull:research:wait`

## Likely Causes
- Worker crashed or stuck
- Slow LLM/embedding calls
- Worker concurrency too low

## Mitigation
1. Restart worker: `docker compose restart research-worker`
2. Increase concurrency in `researchWorker.js` (currently 5)
3. Scale horizontally: `docker compose up -d --scale research-worker=3`