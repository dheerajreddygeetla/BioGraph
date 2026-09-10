# Runbook: HighEventLoopLag

## Symptom
Node.js event loop lag > 100ms.

## Diagnosis
1. Check CPU usage: `docker stats`
2. Look for synchronous code in hot paths
3. Check for large JSON serialization

## Mitigation
1. Move CPU-heavy work to worker threads
2. Use streaming for large responses
3. Increase container CPU limit