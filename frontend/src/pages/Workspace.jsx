import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import SearchBar from '../components/SearchBar';
import GraphCanvas from '../components/GraphCanvas';
import EntityPanel from '../components/EntityPanel';

const Workspace = () => {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchGraph = useCallback(async (entityId) => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(`http://localhost:5000/api/graph/${entityId}?depth=2`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGraphData(data);
      // auto-select the root entity (first node)
      if (data.nodes.length > 0) {
        const root = data.nodes.find(n => n.id === entityId) || data.nodes[0];
        setSelectedEntity(root);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (entityId) => {
    if (entityId) {
      fetchGraph(entityId);
    }
  };

  const handleNodeClick = (node) => {
    setSelectedEntity(node);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Search Bar */}
      <div className="p-4 bg-white shadow-md">
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph canvas */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
              <div className="text-xl font-semibold text-gray-600">Loading graph...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 bg-opacity-75 z-10">
              <div className="text-red-600">{error}</div>
            </div>
          )}
          <GraphCanvas
            nodes={graphData.nodes}
            edges={graphData.edges}
            onNodeClick={handleNodeClick}
          />
        </div>

        {/* Entity Details Panel */}
        <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto p-4">
          <EntityPanel entity={selectedEntity} />
        </div>
      </div>
    </div>
  );
};

export default Workspace;