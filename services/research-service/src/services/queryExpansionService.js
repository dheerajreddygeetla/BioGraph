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
 * QueryExpansionService – generates alternative search queries
 * from a single user question to improve retrieval recall.
 *
 * If OpenAI is unavailable, falls back to a heuristic expander
 * that appends common biomedical suffixes.
 */
class QueryExpansionService {
  /**
   * Expand a question into multiple variants.
   * @param {string} question - Original question.
   * @param {number} count - Max additional variants (default 3).
   * @returns {Promise<string[]>} - Original + variants.
   */
  static async expand(question, count = 3) {
    const client = getOpenAI();
    if (client) {
      try {
        const variants = await this.expandWithLLM(question, count);
        if (variants.length > 1) return variants;
      } catch (err) {
        console.warn('   🧠 Query expansion via LLM failed:', err.message);
      }
    }
    return this.expandHeuristic(question, count);
  }

  /**
   * LLM-based expansion – produces 3 distinct angles.
   */
  static async expandWithLLM(question, count) {
    const client = getOpenAI();

    const systemPrompt = `You are a biomedical query expansion assistant.
Given a research question, generate exactly ${count} alternative search queries.
Each variant must cover a DIFFERENT angle:
1. Molecular mechanism (genes, proteins, pathways)
2. Therapeutic / drug intervention
3. Clinical / disease context
Return JSON: { "queries": ["...", "...", "..."] }`;

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const variants = Array.isArray(parsed.queries) ? parsed.queries : [];

    // Always include the original as the first query
    const all = [question, ...variants.filter(v => v && v !== question)];
    return all.slice(0, count + 1);
  }

  /**
   * Heuristic fallback – appends domain-specific angles.
   */
  static expandHeuristic(question, count) {
    const angles = [
      'molecular mechanism pathway',
      'therapeutic drug target',
      'clinical trial disease association',
      'gene protein interaction',
      'in vitro in vivo study',
    ];
    const variants = [question];
    for (let i = 0; i < count && i < angles.length; i++) {
      variants.push(`${question} ${angles[i]}`);
    }
    return variants;
  }
}

module.exports = QueryExpansionService;