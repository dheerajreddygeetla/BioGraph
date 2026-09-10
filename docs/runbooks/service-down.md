# Runbook: ServiceDown

## Symptom
Prometheus cannot scrape the service for > 1 minute.

## Diagnosis
1. Check container status: `docker compose ps`
2. Check container logs: `docker compose logs <service-name> --tail=100`
3. Check if the port is listening: `curl http://localhost:<port>/health`

## Likely Causes
- Container crashed (OOM, unhandled exception)
- Database connection lost
- Port conflict

## Mitigation
1. Restart the container: `docker compose restart <service-name>`
2. If OOM: increase memory limit in `docker-compose.yml`
3. If DB issue: check `docker compose logs mongo`