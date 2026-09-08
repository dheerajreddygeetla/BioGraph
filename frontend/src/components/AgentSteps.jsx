import React from 'react';

const AgentSteps = ({ steps }) => {
  if (!steps || steps.length === 0) {
    return <p className="text-gray-500 text-sm">No agent steps yet.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      <h4 className="text-sm font-semibold text-gray-700">Agent Reasoning Steps</h4>
      <ul className="space-y-1">
        {steps.map((step, idx) => (
          <li key={idx} className="border-l-4 border-blue-400 pl-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{step.agent}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  step.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : step.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {step.status}
              </span>
            </div>
            {step.output && (
              <div className="text-gray-600 text-xs mt-0.5">
                {typeof step.output === 'string'
                  ? step.output
                  : JSON.stringify(step.output).slice(0, 100) + (JSON.stringify(step.output).length > 100 ? '…' : '')}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AgentSteps;