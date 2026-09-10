const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'biograph123'
  )
);

const verifyConnectivity = async () => {
  try {
    await driver.verifyConnectivity();
    console.log('✅ [research-service] Neo4j Connected');
  } catch (error) {
    console.error('❌ [research-service] Neo4j error:', error.message);
    process.exit(1);
  }
};

const getSession = () => driver.session();

module.exports = { driver, verifyConnectivity, getSession };