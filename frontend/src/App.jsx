import { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Workspace from './pages/Workspace';
import AdminDashboard from './pages/AdminDashboard'; // NEW

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    return token && storedUser ? JSON.parse(storedUser) : null;
  });

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-blue-600">BioGraph</h1>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-gray-700">Welcome, {user.name}</span>
              {user.role === 'admin' && (
                <Link to="/admin" className="text-blue-500 hover:underline">Admin</Link>
              )}
              <button
                onClick={logout}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </>
          )}
          {!user && (
            <>
              <Link to="/login" className="text-blue-500 hover:underline">Login</Link>
              <Link to="/register" className="text-blue-500 hover:underline">Register</Link>
            </>
          )}
        </div>
      </nav>

      <div>
        <Routes>
          <Route
            path="/"
            element={user ? <Navigate to="/workspace" replace /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/workspace"
            element={user ? <Workspace /> : <Navigate to="/login" />}
          />
          <Route
            path="/admin"
            element={user && user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />}
          />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/register" element={<Register setUser={setUser} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;