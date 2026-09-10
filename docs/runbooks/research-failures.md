# Runbook: HighResearchJobFailureRate

## Symptom
> 20% of research jobs fail in 10 minutes.

## Diagnosis
1. Check worker logs: `docker compose logs research-worker --tail=100`
2. Look for specific agent failures (Planner, Graph, Literature, Reasoning, Evidence)
3. Check external dependencies: OpenAI, PubMed, Qdrant

## Mitigation
1. If OpenAI rate-limited: switch to heuristic fallback or wait
2. If PubMed down: temporarily disable PubMed in agent pipeline
3. If Qdrant unreachable: check `docker compose logs qdrant`