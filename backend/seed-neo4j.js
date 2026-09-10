require('dotenv').config();
const mongoose = require('mongoose');
const Entity = require('./src/models/Entity');
const Relationship = require('./src/models/Relationship');
const Neo4jService = require('./src/services/neo4jService');
const { verifyConnectivity, driver } = require('./src/config/neo4j');

const migrate = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Verify Neo4j
    await verifyConnectivity();

    // Migrate entities
    const entities = await Entity.find();
    console.log(`📦 Migrating ${entities.length} entities...`);
    for (const entity of entities) {
      await Neo4jService.upsertEntity(entity);
    }
    console.log('✅ Entities migrated');

    // Migrate relationships
    const relationships = await Relationship.find();
    console.log(`🔗 Migrating ${relationships.length} relationships...`);
    for (const rel of relationships) {
      await Neo4jService.upsertRelationship(
        rel,
        rel.sourceId.toString(),
        rel.targetId.toString()
      );
    }
    console.log('✅ Relationships migrated');

    console.log('🎉 Neo4j migration complete!');
    await driver.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

migrate();