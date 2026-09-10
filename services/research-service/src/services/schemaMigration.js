const { QdrantClient } = require('@qdrant/js-client-rest');
const { stringToUuid } = require('../utils/uuid');

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'biograph_papers';
const DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION) || 1536;
const SCHEMA_METADATA_KEY = '__schema_metadata__';
const SCHEMA_METADATA_ID = stringToUuid(SCHEMA_METADATA_KEY);

class SchemaMigration {
  static CURRENT_VERSION = 1;

  static async getCurrentVersion() {
    try {
      const result = await qdrant.retrieve(COLLECTION_NAME, {
        ids: [SCHEMA_METADATA_ID],
        with_payload: true,
      });
      if (!result || result.length === 0) return 0;
      return result[0].payload?.version || 0;
    } catch {
      return 0;
    }
  }

  static async storeVersion(version) {
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: SCHEMA_METADATA_ID, // now a valid UUID
          vector: {
            dense: new Array(DIMENSION).fill(0),
          },
          payload: {
            schemaKey: SCHEMA_METADATA_KEY,
            version,
            updatedAt: new Date().toISOString(),
          },
        },
      ],
    });
  }

  static async migrate() {
    const currentVersion = await this.getCurrentVersion();
    console.log(`📋 Qdrant schema version: ${currentVersion} (target: ${this.CURRENT_VERSION})`);

    if (currentVersion >= this.CURRENT_VERSION) {
      console.log('✅ Qdrant schema is up to date');
      return;
    }

    const migrations = [
      {
        version: 1,
        name: 'Initial schema with payload indexes',
        up: async () => {
          const VectorService = require('./vectorService');
          await VectorService.initCollection();
        },
      },
    ];

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`  🔄 Applying migration v${migration.version}: ${migration.name}`);
        await migration.up();
        await this.storeVersion(migration.version);
        console.log(`  ✅ Migration v${migration.version} applied`);
      }
    }

    console.log('🎉 All Qdrant migrations complete');
  }
}

module.exports = SchemaMigration;