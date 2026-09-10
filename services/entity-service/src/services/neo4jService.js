const { getSession } = require('../config/neo4j');

class Neo4jService {
  static async findEntityByName(name) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (e:Entity) WHERE e.name = $name RETURN e`,
        { name }
      );
      if (result.records.length === 0) return null;
      const node = result.records[0].get('e');
      return {
        id: node.properties.id,
        name: node.properties.name,
        type: node.properties.type,
        description: node.properties.description,
      };
    } finally {
      await session.close();
    }
  }

  static async searchEntities(query) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (e:Entity)
         WHERE e.name CONTAINS $query OR any(alias IN e.aliases WHERE alias CONTAINS $query)
         RETURN e
         LIMIT 10`,
        { query }
      );
      return result.records.map(record => {
        const node = record.get('e');
        return {
          _id: node.properties.id,
          id: node.properties.id,
          name: node.properties.name,
          type: node.properties.type,
          description: node.properties.description,
          aliases: node.properties.aliases || [],
        };
      });
    } finally {
      await session.close();
    }
  }

  static async upsertEntity(entity) {
    const session = getSession();
    try {
      await session.run(
        `MERGE (e:Entity {id: $id})
         SET e.name = $name,
             e.type = $type,
             e.description = $description,
             e.aliases = $aliases,
             e.updatedAt = datetime()
         RETURN e`,
        {
          id: entity._id.toString(),
          name: entity.name,
          type: entity.type,
          description: entity.description || '',
          aliases: entity.aliases || [],
        }
      );
    } finally {
      await session.close();
    }
  }

  static async upsertRelationship(rel, sourceId, targetId) {
    const session = getSession();
    try {
      await session.run(
        `MATCH (s:Entity {id: $sourceId})
         MATCH (t:Entity {id: $targetId})
         MERGE (s)-[r:RELATION {id: $relId}]->(t)
         SET r.type = $relation,
             r.confidence = $confidence,
             r.evidence = $evidence,
             r.sourceDatabase = $sourceDatabase,
             r.updatedAt = datetime()
         RETURN r`,
        {
          sourceId,
          targetId,
          relId: rel._id.toString(),
          relation: rel.relation,
          confidence: rel.confidence,
          evidence: rel.evidence || [],
          sourceDatabase: rel.sourceDatabase || '',
        }
      );
    } finally {
      await session.close();
    }
  }

  static async getGraph(entityId, depth = 2) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH path = (root:Entity {id: $entityId})-[*1..${depth}]-(connected)
         WITH collect(DISTINCT path) AS paths
         UNWIND paths AS p
         WITH nodes(p) AS ns, relationships(p) AS rs
         UNWIND ns AS n
         WITH collect(DISTINCT n) AS allNodes, collect(DISTINCT rs) AS allRels
         UNWIND allRels AS relList
         UNWIND relList AS r
         WITH allNodes, collect(DISTINCT r) AS uniqueRels
         RETURN
           [n IN allNodes | {
             id: n.id,
             name: n.name,
             type: n.type,
             description: n.description
           }] AS nodes,
           [r IN uniqueRels | {
             id: r.id,
             source: startNode(r).id,
             target: endNode(r).id,
             label: r.type,
             confidence: r.confidence
           }] AS edges
        `,
        { entityId }
      );

      if (result.records.length === 0) {
        const rootResult = await session.run(
          `MATCH (root:Entity {id: $entityId})
           RETURN {
             id: root.id,
             name: root.name,
             type: root.type,
             description: root.description
           } AS node`,
          { entityId }
        );
        const root = rootResult.records[0]?.get('node');
        return { nodes: root ? [root] : [], edges: [] };
      }

      const record = result.records[0];
      return {
        nodes: record.get('nodes') || [],
        edges: record.get('edges') || [],
      };
    } finally {
      await session.close();
    }
  }

  static async findDrugsForPathway(pathwayName) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (p:Entity {type: 'PATHWAY', name: $pathwayName})<-[:RELATION*1..2]-(protein:Entity {type: 'PROTEIN'})
         MATCH (drug:Entity {type: 'DRUG'})-[:RELATION]->(protein)
         RETURN DISTINCT drug.name AS drugName,
                protein.name AS proteinName,
                p.name AS pathwayName
        `,
        { pathwayName }
      );
      return result.records.map(r => ({
        drug: r.get('drugName'),
        protein: r.get('proteinName'),
        pathway: r.get('pathwayName'),
      }));
    } finally {
      await session.close();
    }
  }

  static async shortestPath(sourceId, targetId) {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (a:Entity {id: $sourceId}), (b:Entity {id: $targetId}),
              path = shortestPath((a)-[*..5]-(b))
         RETURN [n IN nodes(path) | n.name] AS pathNodes,
                [r IN relationships(path) | r.type] AS pathRelations
        `,
        { sourceId, targetId }
      );
      if (result.records.length === 0) return null;
      return {
        nodes: result.records[0].get('pathNodes'),
        relations: result.records[0].get('pathRelations'),
      };
    } finally {
      await session.close();
    }
  }
}

module.exports = Neo4jService;