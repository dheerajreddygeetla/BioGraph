const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Entity = require('./src/models/Entity');
const Relationship = require('./src/models/Relationship');

dotenv.config();

const entities = [
  {
    type: 'GENE',
    name: 'BRCA1',
    aliases: ['BRCA1', 'BRCA1 gene'],
    description: 'Breast cancer type 1 susceptibility protein',
    properties: { organism: 'Homo sapiens', chromosome: '17' },
    externalIds: { entrez: '672', uniprot: 'P38398' },
  },
  {
    type: 'DISEASE',
    name: 'Breast Cancer',
    aliases: ['Breast carcinoma', 'Mammary cancer'],
    description: 'Cancer that forms in the cells of the breasts',
    externalIds: { mesh: 'D001943' },
  },
  {
    type: 'PROTEIN',
    name: 'BRCA1 Protein',
    aliases: ['BRCA1'],
    description: 'Protein encoded by the BRCA1 gene',
    properties: { uniprot: 'P38398' },
  },
  {
    type: 'PATHWAY',
    name: 'Homologous Recombination Repair',
    aliases: ['HRR'],
    description: 'Pathway for repairing double-strand DNA breaks',
  },
  {
    type: 'DRUG',
    name: 'Olaparib',
    aliases: ['Lynparza'],
    description: 'PARP inhibitor used in BRCA-mutated cancers',
  },
  {
    type: 'CLINICAL_TRIAL',
    name: 'NCT02032823',
    aliases: ['OlympiAD'],
    description: 'Olaparib vs chemotherapy in BRCA-mutated breast cancer',
  },
];

const relationships = [
  {
    sourceName: 'BRCA1',
    targetName: 'Breast Cancer',
    relation: 'ASSOCIATED_WITH',
    confidence: 0.95,
    evidence: ['PMID:1234567'],
    sourceDatabase: 'curated',
  },
  {
    sourceName: 'BRCA1',
    targetName: 'BRCA1 Protein',
    relation: 'ENCODES',
    confidence: 0.99,
    sourceDatabase: 'curated',
  },
  {
    sourceName: 'BRCA1 Protein',
    targetName: 'Homologous Recombination Repair',
    relation: 'INVOLVED_IN',
    confidence: 0.9,
    sourceDatabase: 'curated',
  },
  {
    sourceName: 'Olaparib',
    targetName: 'BRCA1 Protein',
    relation: 'TARGETS',
    confidence: 0.85,
    evidence: ['PMID:2345678'],
    sourceDatabase: 'drugbank',
  },
  {
    sourceName: 'Olaparib',
    targetName: 'NCT02032823',
    relation: 'TESTED_IN',
    confidence: 1.0,
    sourceDatabase: 'clinicaltrials',
  },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Entity.deleteMany();
    await Relationship.deleteMany();
    console.log('Cleared old data');

    // Insert entities
    const createdEntities = await Entity.insertMany(entities);
    console.log(`✅ Inserted ${createdEntities.length} entities`);

    // Create map from name to _id
    const entityMap = {};
    createdEntities.forEach((e) => {
      entityMap[e.name] = e._id;
      // also map aliases if needed
    });

    // Insert relationships using ObjectIds
    const relDocs = relationships.map((r) => ({
      sourceId: entityMap[r.sourceName],
      targetId: entityMap[r.targetName],
      relation: r.relation,
      confidence: r.confidence,
      evidence: r.evidence || [],
      sourceDatabase: r.sourceDatabase,
    }));

    await Relationship.insertMany(relDocs);
    console.log(`✅ Inserted ${relDocs.length} relationships`);

    console.log('🎉 Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();