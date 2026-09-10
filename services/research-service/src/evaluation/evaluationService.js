const fs = require('fs').promises;
const path = require('path');
const AgentService = require('../services/agentService');

/**
 * EvaluationService – runs a golden dataset through the full agent
 * pipeline and computes precision/recall/coverage metrics.
 */
class EvaluationService {
  /**
   * Run all test cases in a golden dataset.
   * @param {string} datasetPath - Absolute or relative path to JSON.
   * @returns {Promise<Object>} - Aggregated report.
   */
  static async runGoldenSet(datasetPath) {
    const absolutePath = path.isAbsolute(datasetPath)
      ? datasetPath
      : path.join(__dirname, datasetPath);

    const raw = await fs.readFile(absolutePath, 'utf-8');
    const dataset = JSON.parse(raw);

    console.log(`\n📊 Running golden dataset: ${dataset.name}`);
    console.log(`   ${dataset.testCases.length} test cases\n`);

    const results = [];

    for (const testCase of dataset.testCases) {
      console.log(`🧪 Test: ${testCase.id}`);
      console.log(`   Q: ${testCase.question}`);

      const startTime = Date.now();
      try {
        // Run pipeline with an empty graph context (agent will fetch from Neo4j internally)
        const { steps, finalOutput } = await AgentService.runPipeline(
          testCase.question,
          testCase.entityId,
          { nodes: [], edges: [] },
          testCase.filters || {}
        );

        const metrics = this.computeMetrics(testCase, finalOutput);
        results.push({
          id: testCase.id,
          question: testCase.question,
          passed: metrics.passed,
          metrics,
          duration_ms: Date.now() - startTime,
          answer: finalOutput.answer.slice(0, 200),
        });

        console.log(`   ${metrics.passed ? '✅ PASS' : '❌ FAIL'} – precision: ${metrics.citationPrecision.toFixed(2)}, keywords: ${metrics.keywordCoverage.toFixed(2)}, confidence: ${metrics.confidence.toFixed(2)}\n`);
      } catch (err) {
        results.push({
          id: testCase.id,
          question: testCase.question,
          passed: false,
          error: err.message,
          duration_ms: Date.now() - startTime,
        });
        console.log(`   ❌ ERROR – ${err.message}\n`);
      }
    }

    return this.aggregate(results);
  }

  static computeMetrics(testCase, finalOutput) {
    const answer = (finalOutput.answer || '').toLowerCase();
    const citations = (finalOutput.citations || []).map(c => c.toLowerCase());
    const confidence = finalOutput.confidence || 0;

    // Citation precision = matched expected / total expected
    const expectedCitations = testCase.expectedCitations || [];
    const matchedCitations = expectedCitations.filter(exp =>
      citations.some(c => c.includes(exp.toLowerCase()) || exp.toLowerCase().includes(c))
    );
    const citationPrecision = expectedCitations.length > 0
      ? matchedCitations.length / expectedCitations.length
      : 1;

    // Keyword coverage
    const expectedKeywords = testCase.expectedKeywords || [];
    const matchedKeywords = expectedKeywords.filter(kw =>
      answer.includes(kw.toLowerCase())
    );
    const keywordCoverage = expectedKeywords.length > 0
      ? matchedKeywords.length / expectedKeywords.length
      : 1;

    // Confidence threshold
    const minConfidence = testCase.minConfidence || 0.3;
    const confidenceOk = confidence >= minConfidence;

    // Overall pass: at least 50% precision + 50% keywords + confidence OK
    const passed = citationPrecision >= 0.5 && keywordCoverage >= 0.5 && confidenceOk;

    return {
      passed,
      citationPrecision,
      keywordCoverage,
      confidence,
      confidenceOk,
      expectedCitations: expectedCitations.length,
      matchedCitations: matchedCitations.length,
      expectedKeywords: expectedKeywords.length,
      matchedKeywords: matchedKeywords.length,
    };
  }

  static aggregate(results) {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;

    const avg = (key) =>
      total > 0
        ? parseFloat(
            (results.reduce((s, r) => s + (r.metrics?.[key] || 0), 0) / total).toFixed(3)
          )
        : 0;

    const totalDuration = results.reduce((s, r) => s + (r.duration_ms || 0), 0);

    return {
      summary: {
        total,
        passed,
        failed,
        passRate: total > 0 ? parseFloat((passed / total).toFixed(3)) : 0,
        avgCitationPrecision: avg('citationPrecision'),
        avgKeywordCoverage: avg('keywordCoverage'),
        avgConfidence: avg('confidence'),
        avgDuration_ms: total > 0 ? Math.round(totalDuration / total) : 0,
        totalDuration_ms: totalDuration,
      },
      results,
    };
  }
}

module.exports = EvaluationService;