const express = require('express');
const app = express();

app.use(express.json());

// ============================================================
// Alertmanager webhook receiver
// Logs every alert group to stdout. In production, forward to
// Slack, PagerDuty, or store in a database for auditing.
// ============================================================
app.post('/alerts', (req, res) => {
  const payload = req.body;

  console.log('\n' + '='.repeat(60));
  console.log(`🔔 ALERT RECEIVED at ${new Date().toISOString()}`);
  console.log(`   Status:   ${payload.status}`);
  console.log(`   Receiver: ${payload.receiver}`);
  console.log(`   Group:    ${payload.groupKey}`);
  console.log(`   Alerts:   ${payload.alerts?.length || 0}`);

  for (const alert of payload.alerts || []) {
    console.log('\n   ---');
    console.log(`   Alert:    ${alert.labels.alertname}`);
    console.log(`   Service:  ${alert.labels.service || 'n/a'}`);
    console.log(`   Severity: ${alert.labels.severity}`);
    console.log(`   Status:   ${alert.status}`);
    console.log(`   Summary:  ${alert.annotations.summary || 'n/a'}`);
    console.log(`   Desc:     ${alert.annotations.description || 'n/a'}`);
  }

  console.log('='.repeat(60) + '\n');

  res.status(200).json({ received: true, count: payload.alerts?.length || 0 });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'alert-webhook-receiver' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🔔 Alert webhook receiver listening on port ${PORT}`);
});