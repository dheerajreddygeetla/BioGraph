import React, { useState } from 'react';
import axios from 'axios';

const ResearchPanel = ({ selectedEntity }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [jobId, setJobId] = useState(null);

  const pollJobStatus = async (id) => {
    console.log(`🔄 Polling job ${id}...`);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get(
        `http://localhost:5000/api/research/status/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`📊 Job ${id} state:`, data.state);
      
      if (data.state === 'completed') {
        console.log(`✅ Job ${id} completed! Result:`, data.result);
        setResult(data.result);
        setLoading(false);
        setJobId(null);
        return;
      } else if (data.state === 'failed') {
        console.log(`❌ Job ${id} failed:`, data.error);
        setError(data.error || 'Job failed');
        setLoading(false);
        setJobId(null);
        return;
      } else {
        console.log(`⏳ Job ${id} still ${data.state}, polling again in 2s...`);
        setTimeout(() => pollJobStatus(id), 2000);
      }
    } catch (err) {
      console.error('🔥 Polling error:', err);
      setError(err.response?.data?.message || 'Failed to get job status');
      setLoading(false);
      setJobId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedEntity) {
      console.log('⚠️ Missing question or selected entity');
      return;
    }

    console.log('📤 Submitting research question:', { question, entityId: selectedEntity.id });
    setLoading(true);
    setError('');
    setResult(null);
    setJobId(null);

    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Using token:', token ? 'Token exists' : 'NO TOKEN FOUND!');
      
      const response = await axios.post(
        'http://localhost:5000/api/research/query',
        {
          question: question.trim(),
          entityId: selectedEntity.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('✅ Backend response:', response.data);
      
      if (response.data.jobId) {
        console.log(`📌 Job queued with ID: ${response.data.jobId}`);
        setJobId(response.data.jobId);
        pollJobStatus(response.data.jobId);
      } else {
        console.error('⚠️ No jobId in response:', response.data);
        setError('Server did not return a job ID');
        setLoading(false);
      }
    } catch (err) {
      console.error('🔥 Research query error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        headers: err.response?.headers
      });
      
      setError(
        err.response?.data?.message || 
        err.message || 
        'Failed to start research job. Check backend logs.'
      );
      setLoading(false);
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
        </div>
      )}
    </div>
  );
};

export default ResearchPanel;