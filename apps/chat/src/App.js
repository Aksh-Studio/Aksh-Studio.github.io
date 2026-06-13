// src/App.js
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import the real Authentication screen
import Auth from './pages/Auth';

// Temporary placeholders for remaining panels (to be built next)
const ChatHub = () => <div style={{ padding: '50px', textAlign: 'center' }}><h2>Chat Hub</h2><p>Main interface loading...</p></div>;
const Settings = () => <div style={{ padding: '50px', textAlign: 'center' }}><h2>Settings</h2><p>Preferences loading...</p></div>;

function App() {
  // Global Theme Sync Engine on app boot
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
    }
  }, []);

  return (
    <div className="aksh-chat-app">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Auth />} />
        
        {/* Protected Core Application Routes */}
        <Route path="/" element={<ChatHub />} />
        <Route path="/settings" element={<Settings />} />
        
        {/* Catch-all Fallback Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
