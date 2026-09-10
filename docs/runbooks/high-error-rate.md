# Runbook: HighErrorRate

## Symptom
5xx error rate > 5% for 5 minutes on a service.

## Diagnosis
1. Check Grafana dashboard: http://localhost:3000
2. Look at error logs: `docker compose logs <service-name> | grep -i error`
3. Test the failing endpoint manually: `curl -v http://localhost:5000/api/<endpoint>`

## Likely Causes
- Downstream service unavailable (MongoDB, Neo4j, Qdrant)
- Bad deployment (recent code change)
- Rate limit exceeded

## Mitigation
1. Roll back recent deployment
2. Check downstream service health
3. Scale up replicas if load-related