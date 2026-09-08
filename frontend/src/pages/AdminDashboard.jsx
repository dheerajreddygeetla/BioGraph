import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMetrics();
    fetchLogs();
  }, []);

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:5000/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMetrics(data);
    } catch (err) {
      setError('Failed to load metrics. Ensure you are admin.');
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('http://localhost:5000/api/admin/logs?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading admin dashboard...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">Total Users</div>
            <div className="text-2xl font-bold">{metrics.totalUsers}</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">Research Sessions</div>
            <div className="text-2xl font-bold">{metrics.totalSessions}</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">Queries (24h)</div>
            <div className="text-2xl font-bold">{metrics.recentQueries}</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-sm text-gray-500">Error Rate</div>
            <div className="text-2xl font-bold">{metrics.errorRate.percentage}%</div>
            <div className="text-xs text-gray-400">{metrics.errorRate.count} errors</div>
          </div>
          <div className="bg-white p-4 rounded shadow col-span-2">
            <div className="text-sm text-gray-500">Queue Depth</div>
            <div className="flex gap-4 text-lg">
              <span>Waiting: {metrics.queue.waiting}</span>
              <span>Active: {metrics.queue.active}</span>
              <span>Completed: {metrics.queue.completed}</span>
              <span>Failed: {metrics.queue.failed}</span>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-xl font-semibold mb-2">Recent Audit Logs</h2>
      <div className="bg-white shadow rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Action</th>
              <th className="px-4 py-2 text-left">Resource</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-t">
                <td className="px-4 py-2">{new Date(log.timestamp).toLocaleString()}</td>
                <td className="px-4 py-2">{log.user?.email || 'Anonymous'}</td>
                <td className="px-4 py-2">{log.action}</td>
                <td className="px-4 py-2">{log.resource}</td>
                <td className="px-4 py-2">{log.statusCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;