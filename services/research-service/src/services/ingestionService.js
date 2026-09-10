const Paper = require('../models/Paper');
const VectorService = require('./vectorService');
const ChunkingService = require('./chunkingService');

class IngestionService {
  static async ingestPaper(paperData) {
    console.log(`📥 Ingesting paper: ${paperData.title}`);

    const filter = paperData.doi
      ? { doi: paperData.doi }
      : { title: paperData.title };

    const paper = await Paper.findOneAndUpdate(
      filter,
      {
        $set: {
          title: paperData.title,
          authors: paperData.authors || [],
          publicationDate: paperData.publicationDate || null,
          journal: paperData.journal || '',
          doi: paperData.doi || undefined,
          abstract: paperData.abstract || '',
          fullText: paperData.fullText || '',
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`  📖 Paper ID: ${paper._id}`);

    // Delete old chunks (idempotent re-indexing)
    try {
      await VectorService.deleteByPaperId(paper._id.toString());
    } catch (err) {
      // Nothing to delete on first run
    }

    // Chunk the paper
    const chunks = ChunkingService.chunkBySection({
      paperId: paper._id.toString(),
      ...paperData,
    });

    console.log(`  📄 Created ${chunks.length} chunks`);

    const indexedIds = await VectorService.upsertChunks(chunks);
    console.log(`  ✅ Indexed ${indexedIds.length} chunks in Qdrant`);

    return {
      paperId: paper._id,
      chunksIndexed: indexedIds.length,
      wasUpsert: true,
    };
  }

  static async ingestBatch(papers) {
    const results = [];
    for (const paper of papers) {
      try {
        const result = await this.ingestPaper(paper);
        results.push({ success: true, title: paper.title, ...result });
      } catch (error) {
        console.error(`  ❌ Failed to ingest "${paper.title}":`, error.message);
        results.push({
          success: false,
          title: paper.title,
          error: error.message,
        });
      }
    }
    return results;
  }
}

module.exports = IngestionService;