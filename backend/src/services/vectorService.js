require('dotenv').config();

const { QdrantClient } = require('@qdrant/js-client-rest');
const EmbeddingService = require('./embeddingService');
const { stringToUuid } = require('../utils/uuid');

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'biograph_papers';
const DENSE_VECTOR_NAME = 'dense';
const SPARSE_VECTOR_NAME = 'sparse-bm25';
const DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION) || 384;

class VectorService {
  // ============================================================
  // COLLECTION MANAGEMENT
  // ============================================================
  static async initCollection() {
    try {
      const exists = await this.collectionExists(COLLECTION_NAME);
      if (exists) {
        console.log(`✅ Qdrant collection "${COLLECTION_NAME}" already exists`);
        await this.createPayloadIndexes();
        return;
      }

      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
          [DENSE_VECTOR_NAME]: {
            size: DIMENSION,
            distance: 'Cosine',
            on_disk: true,
          },
        },
        sparse_vectors: {
          [SPARSE_VECTOR_NAME]: {
            modifier: 'idf',
          },
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        hnsw_config: {
          m: 16,
          ef_construct: 100,
        },
      });

      console.log(`✅ Qdrant collection "${COLLECTION_NAME}" created`);

      await new Promise(r => setTimeout(r, 1500));
      await this.createPayloadIndexes();
    } catch (error) {
      console.error('❌ Qdrant init error:', error.message);
      throw error;
    }
  }

  static async createPayloadIndexes() {
    const indexes = [
      { field: 'paperId', type: 'keyword' },
      { field: 'entityId', type: 'keyword' },
      { field: 'journal', type: 'keyword' },
      { field: 'publicationYear', type: 'integer' },
      { field: 'section', type: 'keyword' },
      { field: 'originalId', type: 'keyword' },
      {
        field: 'title',
        schema: {
          type: 'text',
          tokenizer: 'word',
          min_token_len: 2,
          max_token_len: 20,
          lowercase: true,
        },
      },
    ];

    for (const idx of indexes) {
      try {
        await qdrant.createPayloadIndex(COLLECTION_NAME, {
          field_name: idx.field,
          field_schema: idx.schema || idx.type,
          wait: true,
        });
        console.log(`  ✅ Payload index on "${idx.field}"`);
      } catch (error) {
        const msg = error?.data?.status?.error || error.message || '';
        if (msg.toLowerCase().includes('already exists')) {
          console.log(`  ℹ️  Payload index on "${idx.field}" already exists`);
        } else {
          console.warn(`  ⚠️  Could not create index on "${idx.field}":`, msg);
        }
      }
    }
  }

  static async collectionExists(name) {
    try {
      const collections = await qdrant.getCollections();
      return collections.collections.some(c => c.name === name);
    } catch {
      return false;
    }
  }

  // ============================================================
  // INDEXING
  // ============================================================
  static async upsertChunk(chunk) {
    const {
      id,
      text,
      paperId,
      title,
      journal,
      publicationYear,
      section,
      entityId,
      metadata = {},
    } = chunk;

    if (!text || text.trim().length === 0) {
      throw new Error('Chunk text is required');
    }

    const denseVector = await EmbeddingService.embed(text);
    const sparseVector = this.generateSparseVector(text);
    const pointId = stringToUuid(id);

    const point = {
      id: pointId,
      vector: {
        [DENSE_VECTOR_NAME]: denseVector,
        [SPARSE_VECTOR_NAME]: sparseVector,
      },
      payload: {
        originalId: id,
        text: text.slice(0, 2000),
        paperId,
        title: title || '',
        journal: journal || '',
        publicationYear: publicationYear || null,
        section: section || 'unknown',
        entityId: entityId || null,
        ...metadata,
        indexedAt: new Date().toISOString(),
      },
    };

    await qdrant.upsert(COLLECTION_NAME, {
      points: [point],
      wait: true,
    });

    return pointId;
  }

  static async upsertChunks(chunks, batchSize = 100) {
    const results = [];
    const totalBatches = Math.ceil(chunks.length / batchSize);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      console.log(`  📦 Batch ${batchNum}/${totalBatches} (${batch.length} chunks)`);

      const texts = batch.map(c => c.text);
      const embeddings = await EmbeddingService.embedBatch(texts);

      const points = batch.map((chunk, idx) => ({
        id: stringToUuid(chunk.id),
        vector: {
          [DENSE_VECTOR_NAME]: embeddings[idx],
          [SPARSE_VECTOR_NAME]: this.generateSparseVector(chunk.text),
        },
        payload: {
          originalId: chunk.id,
          text: chunk.text.slice(0, 2000),
          paperId: chunk.paperId,
          title: chunk.title || '',
          journal: chunk.journal || '',
          publicationYear: chunk.publicationYear || null,
          section: chunk.section || 'unknown',
          entityId: chunk.entityId || null,
          ...chunk.metadata,
          indexedAt: new Date().toISOString(),
        },
      }));

      await qdrant.upsert(COLLECTION_NAME, {
        points,
        wait: true,
      });

      results.push(...points.map(p => p.id));

      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  // ============================================================
  // SEARCH
  // ============================================================
  static async search(query, limit = 5, filter = null) {
    const queryVector = await EmbeddingService.embed(query);

    const request = {
      query: queryVector,
      using: DENSE_VECTOR_NAME,
      limit,
      with_payload: true,
      with_vector: false,
    };

    if (filter) request.filter = filter;

    const result = await qdrant.query(COLLECTION_NAME, request);

    return (result.points || []).map(r => ({
      id: r.payload?.originalId || r.id,
      qdrantId: r.id,
      score: r.score,
      text: r.payload?.text || '',
      title: r.payload?.title || '',
      journal: r.payload?.journal || '',
      publicationYear: r.payload?.publicationYear,
      paperId: r.payload?.paperId,
      section: r.payload?.section,
      entityId: r.payload?.entityId,
    }));
  }

  /**
   * Hybrid search with optional metadata filtering.
   * @param {string} query - The search query.
   * @param {number} limit - Max results.
   * @param {object|null} filter - Qdrant filter object (e.g., { must: [...] }).
   */
  static async hybridSearch(query, limit = 5, filter = null) {
    const queryVector = await EmbeddingService.embed(query);
    const sparseQuery = this.generateSparseVector(query);
    const fetchLimit = limit * 3;

    const denseRequest = {
      query: queryVector,
      using: DENSE_VECTOR_NAME,
      limit: fetchLimit,
      with_payload: true,
    };
    if (filter) denseRequest.filter = filter;

    const sparseRequest = {
      query: {
        indices: sparseQuery.indices,
        values: sparseQuery.values,
      },
      using: SPARSE_VECTOR_NAME,
      limit: fetchLimit,
      with_payload: true,
    };
    if (filter) sparseRequest.filter = filter;

    const [denseResult, sparseResult] = await Promise.all([
      qdrant.query(COLLECTION_NAME, denseRequest),
      qdrant.query(COLLECTION_NAME, sparseRequest),
    ]);

    const denseResults = denseResult.points || [];
    const sparseResults = sparseResult.points || [];

    // Reciprocal Rank Fusion (RRF)
    const k = 60;
    const scores = new Map();

    denseResults.forEach((r, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      scores.set(r.id, {
        id: r.id,
        payload: r.payload,
        denseScore: r.score,
        sparseScore: 0,
        rrfScore,
      });
    });

    sparseResults.forEach((r, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      if (scores.has(r.id)) {
        const existing = scores.get(r.id);
        existing.sparseScore = r.score;
        existing.rrfScore += rrfScore;
      } else {
        scores.set(r.id, {
          id: r.id,
          payload: r.payload,
          denseScore: 0,
          sparseScore: r.score,
          rrfScore,
        });
      }
    });

    const fused = Array.from(scores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, limit);

    return fused.map(f => ({
      id: f.payload?.originalId || f.id,
      qdrantId: f.id,
      score: f.rrfScore,
      denseScore: f.denseScore,
      sparseScore: f.sparseScore,
      text: f.payload?.text || '',
      title: f.payload?.title || '',
      journal: f.payload?.journal || '',
      publicationYear: f.payload?.publicationYear,
      paperId: f.payload?.paperId,
      section: f.payload?.section,
      entityId: f.payload?.entityId,
    }));
  }

  static async searchWithFilter(query, filter, limit = 5) {
    return this.hybridSearch(query, limit, filter);
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  static generateSparseVector(text) {
    if (!text) return { indices: [], values: [] };

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    const tf = {};
    words.forEach(w => {
      tf[w] = (tf[w] || 0) + 1;
    });

    const indices = [];
    const values = [];
    for (const [term, freq] of Object.entries(tf)) {
      indices.push(this.hashTerm(term));
      values.push(freq);
    }

    return { indices, values };
  }

  static hashTerm(term) {
    let hash = 0;
    for (let i = 0; i < term.length; i++) {
      const char = term.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 1000000;
  }

  static async deleteByPaperId(paperId) {
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [{ key: 'paperId', match: { value: paperId } }],
      },
      wait: true,
    });
  }

  static async getStats() {
    const info = await qdrant.getCollection(COLLECTION_NAME);
    return {
      pointsCount: info.points_count ?? 0,
      vectorsCount: info.vectors_count ?? info.points_count ?? 0,
      status: info.status,
      optimizerStatus: info.optimizer_status,
      indexedVectorsCount: info.indexed_vectors_count ?? 0,
    };
  }
}

module.exports = VectorService;