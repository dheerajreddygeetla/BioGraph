#!/usr/bin/env node
require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const EvaluationService = require('../evaluation/evaluationService');

mongoose.set('bufferTimeoutMS', 30000);

(async () => {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await connectDB();

    console.log('🔧 Connecting to Neo4j...');
    const { verifyConnectivity } = require('../config/neo4j');
    await verifyConnectivity();

    const datasetPath = process.argv[2] || '../evaluation/golden-dataset.json';
    const report = await EvaluationService.runGoldenSet(datasetPath);

    console.log('\n' + '='.repeat(60));
    console.log('📊 EVALUATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total tests:              ${report.summary.total}`);
    console.log(`   Passed:                   ${report.summary.passed}`);
    console.log(`   Failed:                   ${report.summary.failed}`);
    console.log(`   Pass rate:                ${(report.summary.passRate * 100).toFixed(1)}%`);
    console.log(`   Avg citation precision:   ${(report.summary.avgCitationPrecision * 100).toFixed(1)}%`);
    console.log(`   Avg keyword coverage:     ${(report.summary.avgKeywordCoverage * 100).toFixed(1)}%`);
    console.log(`   Avg confidence:           ${(report.summary.avgConfidence * 100).toFixed(1)}%`);
    console.log(`   Avg duration:             ${report.summary.avgDuration_ms}ms`);
    console.log('='.repeat(60) + '\n');

    // Exit code: 0 if all pass, 1 if any fail (useful for CI)
    process.exit(report.summary.failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('❌ Evaluation failed:', err.message);
    process.exit(2);
  }
})();