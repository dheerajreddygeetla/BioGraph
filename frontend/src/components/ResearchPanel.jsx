import React, { useState, useEffect } from 'react';
import axios from 'axios';
import AgentSteps from './AgentSteps';

const ResearchPanel = ({ selectedEntity }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);
  const [steps, setSteps] = useState([]);
  const [savedSessions, setSavedSessions] = useState([]);

  // Fetch saved sessions on mount
  useEffect(() => {
    fetchSavedSessions();
  }, []);

  const fetchSavedSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:5000/api/research/saved', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSavedSessions(data);
    } catch (err) {
      console.error('Failed to fetch saved sessions:', err);
    }
  };

  const pollJobStatus = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(
        `http://localhost:5000/api/research/status/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.state === 'completed') {
        setResult(data.result);
        // Extract steps from progress
        if (data.progress && data.progress.steps) {
          setSteps(data.progress.steps);
        }
        setLoading(false);
        setJobId(null);
        return;
      } else if (data.state === 'failed') {
        setError(data.error || 'Job failed');
        setLoading(false);
        setJobId(null);
        return;
      } else {
        // Update steps if available
        if (data.progress && data.progress.steps) {
          setSteps(data.progress.steps);
        }
        setTimeout(() => pollJobStatus(id), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get job status');
      setLoading(false);
      setJobId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedEntity) return;

    setLoading(true);
    setError('');
    setResult(null);
    setJobId(null);
    setSteps([]);

    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.post(
        'http://localhost:5000/api/research/query',
        {
          question: question.trim(),
          entityId: selectedEntity.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.jobId) {
        setJobId(data.jobId);
        pollJobStatus(data.jobId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start research job.');
      setLoading(false);
    }
  };

  const handleSaveSession = async () => {
    if (!result) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/research/save',
        {
          question,
          answer: result.answer,
          citations: result.citations || [],
          confidence: result.confidence || 0.5,
          agentSteps: steps,
          entityId: selectedEntity?.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Session saved!');
      fetchSavedSessions(); // refresh list
    } catch (err) {
      alert('Failed to save session: ' + err.message);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Research Question</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a research question..."
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!selectedEntity || loading}
        />
        <button
          type="submit"
          disabled={!selectedEntity || loading}
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Ask AI'}
        </button>
      </form>
      {!selectedEntity && (
        <p className="text-sm text-amber-600 mt-2">Select a node in the graph to ask about it.</p>
      )}
      {error && (
        <div className="mt-3 p-2 bg-red-100 text-red-700 rounded text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}
      {loading && (
        <div className="mt-3 p-2 bg-blue-50 text-blue-700 rounded text-sm">
          Job queued. Waiting for results...
        </div>
      )}
      {steps.length > 0 && <AgentSteps steps={steps} />}
      {result && (
        <div className="mt-4 border-t pt-3">
          <div className="text-gray-800 whitespace-pre-wrap">{result.answer}</div>
          {result.citations && result.citations.length > 0 && (
            <div className="mt-2">
              <span className="text-sm font-semibold text-gray-600">Citations:</span>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {result.citations.map((cite, idx) => (
                  <li key={idx}>{cite}</li>
                ))}
              </ul>
            </div>
          )}
          {result.confidence !== undefined && (
            <div className="mt-2 flex items-center">
              <span className="text-sm font-medium text-gray-600">Confidence: </span>
              <div className="ml-2 w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${Math.round(result.confidence * 100)}%` }}
                />
              </div>
              <span className="ml-2 text-sm text-gray-600">
                {Math.round(result.confidence * 100)}%
              </span>
            </div>
          )}
          <button
            onClick={handleSaveSession}
            className="mt-3 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          >
            Save Session
          </button>
        </div>
      )}
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-gray-700">Saved Sessions</h4>
        {savedSessions.length === 0 ? (
          <p className="text-sm text-gray-500">No saved sessions yet.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {savedSessions.map((sess) => (
              <li key={sess._id} className="text-sm border-b pb-1">
                <div className="font-medium">{sess.question}</div>
                <div className="text-gray-600 truncate">{sess.answer}</div>
                <div className="text-xs text-gray-400">{new Date(sess.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ResearchPanel;