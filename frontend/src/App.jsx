import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Basic decode or just set user from localStorage
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
    setLoading(false);
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">BioGraph</h1>
        <div>
          {user ? (
            <>
              <span className="mr-4 text-gray-700">Welcome, {user.name}</span>
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="mr-2 text-blue-500 hover:underline">
                Login
              </Link>
              <Link to="/register" className="text-blue-500 hover:underline">
                Register
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="p-6">
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <div className="text-center mt-20">
                  <h2 className="text-3xl font-bold">Welcome to BioGraph</h2>
                  <p className="text-gray-600 mt-4">
                    Search for biomedical entities, explore the knowledge graph, and ask AI research questions.
                  </p>
                  <p className="text-sm text-gray-400 mt-8">(Graph UI will be added on Day 2)</p>
                </div>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/register" element={<Register setUser={setUser} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;