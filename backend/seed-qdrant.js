require('dotenv').config();
const mongoose = require('mongoose');
const VectorService = require('./src/services/vectorService');
const SchemaMigration = require('./src/services/schemaMigration');
const IngestionService = require('./src/services/ingestionService');
const Paper = require('./src/models/Paper');

const samplePapers = [
  {
    title: 'BRCA1 and DNA Repair: Mechanisms and Implications',
    authors: ['Smith J', 'Doe A'],
    publicationDate: new Date('2020-01-15'),
    journal: 'Nature Genetics',
    doi: '10.1038/s41588-020-001',
    abstract: 'BRCA1 is a critical gene involved in homologous recombination repair of double-strand DNA breaks. Mutations in BRCA1 are associated with increased risk of breast and ovarian cancer.',
    fullText: 'Introduction: BRCA1 plays a central role in DNA damage response. Methods: We analyzed BRCA1 mutations in 500 patients. Results: BRCA1 mutations were found in 15% of breast cancer cases. Discussion: These findings support the role of BRCA1 in homologous recombination repair.',
  },
  {
    title: 'PARP Inhibitors in BRCA-Mutated Cancers',
    authors: ['Johnson M', 'Williams P'],
    publicationDate: new Date('2021-06-01'),
    journal: 'New England Journal of Medicine',
    doi: '10.1056/NEJMoa2021',
    abstract: 'Olaparib, a PARP inhibitor, shows significant efficacy in BRCA-mutated breast and ovarian cancers by exploiting synthetic lethality with homologous recombination deficiency.',
    fullText: 'Background: PARP inhibitors target DNA repair pathways. Methods: Clinical trial of Olaparib in 300 patients. Results: Olaparib improved progression-free survival by 40%. Discussion: PARP inhibitors are effective in BRCA-mutated cancers.',
  },
  {
    title: 'Homologous Recombination Repair Pathway: A Comprehensive Review',
    authors: ['Brown K', 'Davis L'],
    publicationDate: new Date('2019-11-20'),
    journal: 'Cell',
    doi: '10.1016/j.cell.2019.11.001',
    abstract: 'The homologous recombination repair pathway is essential for maintaining genomic stability. Key proteins include BRCA1, BRCA2, RAD51, and PALB2.',
    fullText: 'Introduction: Homologous recombination is a high-fidelity DNA repair mechanism. Methods: Review of current literature. Results: HRR deficiency leads to genomic instability. Discussion: Targeting HRR pathways is a promising therapeutic strategy.',
  },
  {
    title: 'Clinical Trials of Olaparib in Breast Cancer',
    authors: ['Taylor R', 'Anderson S'],
    publicationDate: new Date('2022-03-10'),
    journal: 'Lancet Oncology',
    doi: '10.1016/S1470-2045(22)00123-4',
    abstract: 'The OlympiAD trial demonstrated that Olaparib significantly improves outcomes in patients with BRCA-mutated metastatic breast cancer compared to standard chemotherapy.',
    fullText: 'Background: OlympiAD was a phase III trial. Methods: 302 patients randomized. Results: Olaparib showed superior progression-free survival. Discussion: Olaparib should be considered for BRCA-mutated breast cancer.',
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Optional: wipe old papers for a clean state
    const wipe = process.argv.includes('--wipe');
    if (wipe) {
      const del = await Paper.deleteMany({});
      console.log(`🗑️  Deleted ${del.deletedCount} old papers`);
    }

    // Initialize collection + migrations
    await SchemaMigration.migrate();

    console.log('\n📚 Ingesting sample papers...');
    const results = await IngestionService.ingestBatch(samplePapers);

    console.log('\n📊 Ingestion Results:');
    results.forEach((r, i) => {
      if (r.success) {
        console.log(`  ✅ Paper ${i + 1}: ${r.chunksIndexed} chunks indexed`);
      } else {
        console.log(`  ❌ Paper ${i + 1}: ${r.error}`);
      }
    });

    const stats = await VectorService.getStats();
    console.log(`\n📈 Qdrant Stats: ${stats.pointsCount} points, ${stats.vectorsCount} vectors`);

    console.log('\n🎉 Qdrant seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seed();