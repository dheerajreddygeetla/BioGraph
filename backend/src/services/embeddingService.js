const crypto = require('crypto');

// ============================================================
// EMBEDDING SERVICE – Local (default) + OpenAI + Hash fallback
// ============================================================
class EmbeddingService {
  constructor() {
    this.provider = process.env.EMBEDDING_PROVIDER || 'local';
    this.model = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
    this.dimension = parseInt(process.env.EMBEDDING_DIMENSION) || 384;
    this.cache = new Map();
    this.pipeline = null;
    this.openai = null;
  }

  // ============================================================
  // LAZY INITIALIZATION
  // ============================================================
  async getLocalPipeline() {
    if (this.pipeline) return this.pipeline;

    console.log('🔄 Loading local embedding model (this may take a moment first time)...');

    // ✅ Use the maintained @huggingface/transformers package
    const { pipeline } = await import('@huggingface/transformers');

    this.pipeline = await pipeline('feature-extraction', this.model);
    console.log(`✅ Local embedding model ready: ${this.model}`);

    return this.pipeline;
  }

  getOpenAI() {
    if (this.openai) return this.openai;
    if (!process.env.OPENAI_API_KEY) return null;
    const OpenAI = require('openai');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return this.openai;
  }

  // ============================================================
  // SINGLE EMBED
  // ============================================================
  async embed(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Cannot embed empty text');
    }

    const cacheKey = text.trim().slice(0, 500);
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    let embedding;

    if (this.provider === 'openai') {
      embedding = await this.embedOpenAI(text);
    } else if (this.provider === 'hash') {
      embedding = this.hashEmbedding(text);
    } else {
      embedding = await this.embedLocal(text);
    }

    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, embedding);

    return embedding;
  }

  // ============================================================
  // BATCH EMBED
  // ============================================================
  async embedBatch(texts) {
    if (!texts || texts.length === 0) return [];

    const validIndices = [];
    const validTexts = [];
    texts.forEach((text, idx) => {
      if (text && text.trim().length > 0) {
        validIndices.push(idx);
        validTexts.push(text.trim().slice(0, 4000));
      }
    });

    if (validTexts.length === 0) return texts.map(() => null);

    let embeddingsBatch;

    if (this.provider === 'openai') {
      embeddingsBatch = await this.embedBatchOpenAI(validTexts);
    } else if (this.provider === 'hash') {
      embeddingsBatch = validTexts.map(t => this.hashEmbedding(t));
    } else {
      embeddingsBatch = await this.embedBatchLocal(validTexts);
    }

    const embeddings = texts.map(() => null);
    embeddingsBatch.forEach((emb, i) => {
      embeddings[validIndices[i]] = emb;
    });

    return embeddings;
  }

  // ============================================================
  // LOCAL EMBEDDINGS (transformers.js via @huggingface/transformers)
  // ============================================================
  async embedLocal(text) {
    const pipe = await this.getLocalPipeline();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async embedBatchLocal(texts) {
    const pipe = await this.getLocalPipeline();
    const embeddings = [];

    // Process in mini-batches to avoid memory spikes
    const miniBatchSize = 8;
    for (let i = 0; i < texts.length; i += miniBatchSize) {
      const miniBatch = texts.slice(i, i + miniBatchSize);
      const outputs = await Promise.all(
        miniBatch.map(text => pipe(text, { pooling: 'mean', normalize: true }))
      );
      outputs.forEach(out => embeddings.push(Array.from(out.data)));
    }

    return embeddings;
  }

  // ============================================================
  // OPENAI EMBEDDINGS (optional)
  // ============================================================
  async embedOpenAI(text) {
    const client = this.getOpenAI();
    if (!client) throw new Error('OpenAI not configured');
    const response = await client.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    return response.data[0].embedding;
  }

  async embedBatchOpenAI(texts) {
    const client = this.getOpenAI();
    if (!client) throw new Error('OpenAI not configured');
    const response = await client.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float',
    });
    return response.data.map(d => d.embedding);
  }

  // ============================================================
  // HASH EMBEDDING (deterministic fallback for offline testing)
  // ============================================================
  hashEmbedding(text) {
    const dim = this.dimension;
    const vec = new Array(dim).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    words.forEach(word => {
      const hash = crypto.createHash('md5').update(word).digest();
      for (let i = 0; i < 8; i++) {
        const idx = (hash[i * 2] + hash[i * 2 + 1] * 256) % dim;
        vec[idx] += 1;
      }
    });

    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }

  // ============================================================
  // UTILITY
  // ============================================================
  getDimension() {
    return this.dimension;
  }
}

module.exports = new EmbeddingService();