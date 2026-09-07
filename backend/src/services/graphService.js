const Entity = require('../models/Entity');
const Relationship = require('../models/Relationship');

const getGraphContext = async (identifier, depth = 2) => {
  console.log('🔍 getGraphContext called with identifier:', identifier, 'depth:', depth);

  const isObjectId = /^[0-9a-fA-F]{24}$/.test(identifier);
  console.log('📝 isObjectId?', isObjectId);

  let root;
  if (isObjectId) {
    console.log('🔍 Searching by ObjectId:', identifier);
    root = await Entity.findById(identifier);
    console.log('📦 Found by ID:', root ? root.name : 'null');
  } else {
    console.log('🔍 Searching by name (regex):', identifier);
    root = await Entity.findOne({ name: { $regex: new RegExp(`^${identifier}$`, 'i') } });
    console.log('📦 Found by name:', root ? root.name : 'null');
  }

  if (!root) {
    console.warn('⚠️ Entity not found for identifier:', identifier);
    return null;
  }

  // ... rest of the function remains the same ...
  const visited = new Set();
  const nodes = [];
  const edges = [];
  const queue = [{ entity: root, currentDepth: 0 }];
  visited.add(root._id.toString());

  nodes.push({
    id: root._id.toString(),
    type: root.type,
    name: root.name,
    description: root.description || '',
  });

  while (queue.length > 0) {
    const { entity, currentDepth } = queue.shift();
    if (currentDepth >= depth) continue;

    const relations = await Relationship.find({
      $or: [{ sourceId: entity._id }, { targetId: entity._id }],
    }).populate('sourceId targetId');

    for (const rel of relations) {
      let neighbour;
      if (rel.sourceId._id.toString() === entity._id.toString()) {
        neighbour = rel.targetId;
      } else {
        neighbour = rel.sourceId;
      }
      const neighbourId = neighbour._id.toString();

      if (!visited.has(neighbourId)) {
        visited.add(neighbourId);
        nodes.push({
          id: neighbourId,
          type: neighbour.type,
          name: neighbour.name,
          description: neighbour.description || '',
        });
        queue.push({ entity: neighbour, currentDepth: currentDepth + 1 });
      }

      edges.push({
        id: rel._id.toString(),
        source: rel.sourceId._id.toString(),
        target: rel.targetId._id.toString(),
        label: rel.relation,
      });
    }
  }

  console.log(`✅ Graph context built: ${nodes.length} nodes, ${edges.length} edges`);
  return { nodes, edges };
};

module.exports = { getGraphContext };