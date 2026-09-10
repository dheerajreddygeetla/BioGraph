require('dotenv').config();

/**
 * Re-ranker Service – cross-encoder re-ranking using @huggingface/transformers.
 *
 * Uses the MS MARCO MiniLM cross-encoder (small, fast, ~23 MB).
 * It scores (query, passage) pairs, giving us much better precision than
 * pure embedding similarity.
 */
class RerankerService {
  constructor() {
    this.pipeline = null;
    this.model = process.env.RERANKER_MODEL || 'Xenova/ms-marco-MiniLM-L-6-v2';
  }

  async getPipeline() {
    if (this.pipeline) return this.pipeline;

    console.log(`   🎯 Reranker: Loading local cross-encoder "${this.model}"...`);
    const { pipeline } = await import('@huggingface/transformers');
    this.pipeline = await pipeline('text-classification', this.model);
    console.log('   🎯 Reranker: Model ready.');
    return this.pipeline;
  }

  /**
   * Re-rank documents by relevance to the query.
   * @param {string} query - The user's question.
   * @param {Array} documents - Documents with a `.text` field.
   * @param {number} topK - How many top documents to return.
   * @returns {Promise<Array>} - Top-K documents with `rerankScore`.
   */
  async rank(query, documents, topK = 5) {
    if (!documents || documents.length === 0) return [];
    if (documents.length <= topK) {
      // Still score them so callers can use rerankScore
      return this.scoreDocuments(query, documents);
    }

    const scored = await this.scoreDocuments(query, documents);
    scored.sort((a, b) => b.rerankScore - a.rerankScore);

    console.log(`   🎯 Reranker: Re-ranked ${documents.length} docs, returning top ${topK}.`);
    return scored.slice(0, topK);
  }

  /**
   * Score every document against the query.
   */
  async scoreDocuments(query, documents) {
    const pipe = await this.getPipeline();
    const scored = [];

    // Process in small batches to avoid memory spikes
    const batchSize = 8;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      const results = await Promise.all(
        batch.map(async (doc) => {
          const text = (doc.text || doc.title || '').slice(0, 512); // truncate for the model
          try {
            const output = await pipe(query, {
              text_pair: text,
              truncation: true,
              padding: true,
            });

            // The model outputs a score (typically a logit).
            // Higher = more relevant.
            const score = Array.isArray(output)
              ? output[0].score
              : output.score;

            return { ...doc, rerankScore: score };
          } catch (err) {
            console.warn('   ⚠️  Reranker failed for doc:', err.message);
            return { ...doc, rerankScore: 0 };
          }
        })
      );

      scored.push(...results);
    }

    return scored;
  }
}

module.exports = new RerankerService();