import React from 'react';

const EntityPanel = ({ entity }) => {
  if (!entity) {
    return (
      <div className="text-gray-500 text-center mt-20">
        <p>Select a node to see details</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">{entity.name}</h2>
      <div className="mb-2">
        <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
          {entity.type}
        </span>
      </div>
      {entity.description && (
        <p className="text-gray-700 mt-2 border-t pt-2">{entity.description}</p>
      )}
      {entity.properties && Object.keys(entity.properties).length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">Properties</h3>
          <div className="bg-gray-50 p-3 rounded-md mt-1">
            {Object.entries(entity.properties).map(([key, value]) => (
              <div key={key} className="flex justify-between py-1 border-b last:border-0">
                <span className="text-sm font-medium text-gray-600">{key}</span>
                <span className="text-sm text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {entity.externalIds && Object.keys(entity.externalIds).length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase">External IDs</h3>
          <div className="bg-gray-50 p-3 rounded-md mt-1">
            {Object.entries(entity.externalIds).map(([source, id]) => (
              <div key={source} className="flex justify-between py-1 border-b last:border-0">
                <span className="text-sm font-medium text-gray-600">{source}</span>
                <span className="text-sm text-gray-800">{id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityPanel;