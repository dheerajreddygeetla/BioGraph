import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Custom node style (optional)
const nodeTypes = {};

const GraphCanvas = ({ nodes: initialNodes, edges: initialEdges, onNodeClick }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Update when props change
  useEffect(() => {
    if (initialNodes.length) {
      // Convert our node format to React Flow format
      const flowNodes = initialNodes.map((n) => ({
        id: n.id,
        type: 'default', // we can define custom types later
        data: { label: n.name, entity: n },
        position: { x: Math.random() * 500, y: Math.random() * 500 }, // random layout initially
        style: {
          background: getColorByType(n.type),
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '2px solid #fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        },
      }));
      setNodes(flowNodes);
    } else {
      setNodes([]);
    }
  }, [initialNodes, setNodes]);

  useEffect(() => {
    if (initialEdges.length) {
      const flowEdges = initialEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        data: e.data,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#888', strokeWidth: 2 },
      }));
      setEdges(flowEdges);
    } else {
      setEdges([]);
    }
  }, [initialEdges, setEdges]);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const onNodeClickHandler = useCallback(
    (event, node) => {
      if (onNodeClick) {
        // pass the full entity data
        onNodeClick(node.data.entity);
      }
    },
    [onNodeClick]
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClickHandler}
        fitView
        attributionPosition="bottom-left"
      >
        <MiniMap />
        <Controls />
        <Background color="#f0f0f0" gap={16} />
      </ReactFlow>
    </div>
  );
};

// Helper to color nodes by type
const getColorByType = (type) => {
  const colors = {
    GENE: '#4F46E5', // indigo
    DISEASE: '#DC2626', // red
    PROTEIN: '#16A34A', // green
    DRUG: '#D97706', // amber
    PATHWAY: '#7C3AED', // purple
    MUTATION: '#E11D48', // rose
    CLINICAL_TRIAL: '#0891B2', // cyan
  };
  return colors[type] || '#6B7280'; // gray default
};

export default GraphCanvas;