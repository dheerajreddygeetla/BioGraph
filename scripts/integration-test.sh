#!/usr/bin/env bash
# ============================================================
# Integration test runner – spins up the stack and tests APIs.
# Usage: ./scripts/integration-test.sh
# ============================================================
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.test.yml"
PROJECT_NAME="biograph-test"
export COMPOSE_PROJECT_NAME="$PROJECT_NAME"

cleanup() {
  echo "🧹 Tearing down test stack..."
  $COMPOSE down -v --remove-orphans || true
}
trap cleanup EXIT

echo "🔨 Building test images..."
$COMPOSE build

echo "🚀 Starting test stack..."
$COMPOSE up -d --wait --wait-timeout 180

echo "⏳ Waiting for services to be healthy..."
sleep 10

echo "🧪 Testing health endpoints..."
for port in 5000 5001 5003 5004; do
  if curl -sf "http://localhost:$port/health" > /dev/null; then
    echo "  ✅ port $port healthy"
  else
    echo "  ❌ port $port FAILED"
    $COMPOSE logs --tail=50
    exit 1
  fi
done

echo "🧪 Testing auth flow (register + login)..."
TEST_EMAIL="ci-test-$(date +%s)@example.com"
REGISTER_RESPONSE=$(curl -sf -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"CI Test\",\"email\":\"$TEST_EMAIL\",\"password\":\"test1234\"}")

echo "  Register response: $(echo $REGISTER_RESPONSE | head -c 100)..."
TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "  ❌ Failed to get token"
  exit 1
fi
echo "  ✅ Got JWT token"

echo "🧪 Testing entity service..."
curl -sf "http://localhost:5000/api/graph/search?q=BRCA1" > /dev/null
echo "  ✅ Entity search works"

echo "🧪 Testing research queue..."
JOB_RESPONSE=$(curl -sf -X POST http://localhost:5000/api/research/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"test query"}')
echo "  Research response: $(echo $JOB_RESPONSE | head -c 100)..."
echo "  ✅ Research queue accepts jobs"

echo ""
echo "🎉 All integration tests passed!"
