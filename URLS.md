# 🌐 BioGraph – Service URLs

After running `docker compose up -d`, open these in your browser:

| Service | URL | Credentials |
|---------|-----|-------------|
| 🖥️  Frontend App       | http://localhost:8080 | (register your own user) |
| 📊 Grafana Dashboard  | http://localhost:3000 | admin / biograph_admin |
| 🔥 Prometheus         | http://localhost:9090 | (no auth) |
| 🚨 Alertmanager       | http://localhost:9093 | (no auth) |
| 📦 cAdvisor           | http://localhost:8081 | (no auth) |
| 🪝 Webhook Receiver   | http://localhost:8082 | (no auth) |

## API Gateway (for curl / Postman)

- Health:     http://localhost:5000/health
- Auth:       http://localhost:5000/api/auth/login
- Entities:   http://localhost:5000/api/entities
- Graph:      http://localhost:5000/api/graph/BRCA1
- Research:   http://localhost:5000/api/research/query

## Container Commands

Start:   docker compose up -d
Stop:    docker compose stop
Logs:    docker compose logs -f
Status:  docker compose ps
Reset:   docker compose down -v
