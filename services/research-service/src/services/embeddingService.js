const crypto = require('crypto');

class EmbeddingService {
  constructor() {
    this.provider = process.env.EMBEDDING_PROVIDER || 'local';
    this.model = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
    this.dimension = parseInt(process.env.EMBEDDING_DIMENSION) || 384;
    this.cache = new Map();
    this.pipeline = null;
    this.openai = null;
  }

  async getLocalPipeline() {
    if (this.pipeline) return this.pipeline;
    console.log('🔄 Loading local embedding model...');
    const { pipeline } = await import('@huggingface/transformers');
    this.pipeline = await pipeline('feature-extraction', this.model);
    console.log(`✅ Local embedding ready: ${this.model}`);
    return this.pipeline;
  }

  getOpenAI() {
    if (this.openai) return this.openai;
    if (!process.env.OPENAI_API_KEY) return null;
    const OpenAI = require('openai');
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return this.openai;
  }

  async embed(text) {
    if (!text || text.trim().length === 0) throw new Error('Cannot embed empty text');
    const key = text.trim().slice(0, 500);
    if (this.cache.has(key)) return this.cache.get(key);

    let embedding;
    if (this.provider === 'openai') embedding = await this.embedOpenAI(text);
    else if (this.provider === 'hash') embedding = this.hashEmbedding(text);
    else embedding = await this.embedLocal(text);

    if (this.cache.size > 1000) {
      const k = this.cache.keys().next().value;
      this.cache.delete(k);
    }
    this.cache.set(key, embedding);
    return embedding;
  }

  async embedBatch(texts) {
    if (!texts || texts.length === 0) return [];
    const validIndices = [], validTexts = [];
    texts.forEach((t, i) => {
      if (t && t.trim().length > 0) {
        validIndices.push(i);
        validTexts.push(t.trim().slice(0, 4000));
      }
    });
    if (validTexts.length === 0) return texts.map(() => null);

    let batch;
    if (this.provider === 'openai') batch = await this.embedBatchOpenAI(validTexts);
    else if (this.provider === 'hash') batch = validTexts.map(t => this.hashEmbedding(t));
    else batch = await this.embedBatchLocal(validTexts);

    const embeddings = texts.map(() => null);
    batch.forEach((e, i) => { embeddings[validIndices[i]] = e; });
    return embeddings;
  }

  async embedLocal(text) {
    const pipe = await this.getLocalPipeline();
    const out = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(out.data);
  }

  async embedBatchLocal(texts) {
    const pipe = await this.getLocalPipeline();
    const embeddings = [];
    const mini = 8;
    for (let i = 0; i < texts.length; i += mini) {
      const slice = texts.slice(i, i + mini);
      const out = await Promise.all(slice.map(t => pipe(t, { pooling: 'mean', normalize: true })));
      out.forEach(o => embeddings.push(Array.from(o.data)));
    }
    return embeddings;
  }

  async embedOpenAI(text) {
    const c = this.getOpenAI();
    if (!c) throw new Error('OpenAI not configured');
    const r = await c.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    return r.data[0].embedding;
  }

  async embedBatchOpenAI(texts) {
    const c = this.getOpenAI();
    if (!c) throw new Error('OpenAI not configured');
    const r = await c.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float',
    });
    return r.data.map(d => d.embedding);
  }

  hashEmbedding(text) {
    const dim = this.dimension;
    const vec = new Array(dim).fill(0);
    text.toLowerCase().split(/\s+/).forEach(w => {
      const h = crypto.createHash('md5').update(w).digest();
      for (let i = 0; i < 8; i++) {
        const idx = (h[i * 2] + h[i * 2 + 1] * 256) % dim;
        vec[idx] += 1;
      }
    });
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }

  getDimension() { return this.dimension; }
}

module.exports = new EmbeddingService();