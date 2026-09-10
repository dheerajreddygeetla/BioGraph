require('dotenv').config();
const OpenAI = require('openai');

let openai = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * CitationVerificationService – checks whether each citation in the
 * generated answer is actually supported by the retrieved sources.
 *
 * This is a hallucination guardrail: if the LLM cites a paper that
 * doesn't exist in the source set, or claims something the paper
 * doesn't say, verification flags it.
 */
class CitationVerificationService {
  /**
   * Verify a list of citations against source documents.
   * @param {string} answer - The generated answer.
   * @param {string[]} citations - List of citation strings.
   * @param {Array} sources - Source documents (papers + entities).
   * @returns {Promise<Array>} - Per-citation verification objects.
   */
  static async verify(answer, citations, sources) {
    if (!citations || citations.length === 0) return [];

    const client = getOpenAI();
    if (client) {
      try {
        return await this.verifyWithLLM(answer, citations, sources);
      } catch (err) {
        console.warn('   🧾 Citation verification via LLM failed:', err.message);
      }
    }
    return this.verifyHeuristic(answer, citations, sources);
  }

  /**
   * LLM-based verification – checks each claim against sources.
   */
  static async verifyWithLLM(answer, citations, sources) {
    const client = getOpenAI();

    // Build a compact source context (first 300 chars of each)
    const sourceContext = sources.slice(0, 10).map((s, i) => {
      const label = s.title || s.name || `Source ${i + 1}`;
      const text = (s.snippet || s.text || s.abstract || '').slice(0, 300);
      return `[${i + 1}] ${label}\n    ${text}`;
    }).join('\n\n');

    const systemPrompt = `You are a scientific fact-checker.
Given an ANSWER, a list of CITATIONS used in it, and the SOURCE documents, determine for each citation whether it is actually supported by the sources.
Return JSON: {
  "verifications": [
    { "citation": "...", "supported": true|false, "evidence": "short quote or null", "confidence": 0.0-1.0 }
  ]
}`;

    const userPrompt = `ANSWER:\n${answer}\n\nCITATIONS:\n${citations.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nSOURCES:\n${sourceContext}`;

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return Array.isArray(parsed.verifications) ? parsed.verifications : [];
  }

  /**
   * Heuristic fallback – string matching against source text.
   */
  static verifyHeuristic(answer, citations, sources) {
    return citations.map(citation => {
      const needle = citation.toLowerCase();
      const match = sources.find(s => {
        const haystack = [
          s.title || '',
          s.name || '',
          s.snippet || '',
          s.text || '',
          s.abstract || '',
        ].join(' ').toLowerCase();
        return haystack.includes(needle);
      });

      return {
        citation,
        supported: !!match,
        evidence: match ? (match.title || match.name || null) : null,
        confidence: match ? 0.7 : 0.3,
      };
    });
  }

  /**
   * Aggregate verification results into a summary.
   */
  static summarize(verifications) {
    const total = verifications.length;
    const supported = verifications.filter(v => v.supported).length;

    return {
      total,
      supported,
      unsupported: total - supported,
      supportRate: total > 0 ? parseFloat((supported / total).toFixed(3)) : 1,
      hallucinationRate: total > 0 ? parseFloat(((total - supported) / total).toFixed(3)) : 0,
    };
  }
}

module.exports = CitationVerificationService;