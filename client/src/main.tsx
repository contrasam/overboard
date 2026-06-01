import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import StoryboardList from './pages/StoryboardList';
import StoryboardEditor from './pages/StoryboardEditor';
import './styles.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"       element={<Landing />} />
      <Route path="/login"  element={<Login />} />
      <Route path="/app"    element={<ProtectedRoute><StoryboardList /></ProtectedRoute>} />
      <Route path="/s/:id"  element={<ProtectedRoute><StoryboardEditor /></ProtectedRoute>} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
