// src/App.js
import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import core application pages
import ChatHub from './pages/ChatHub';
import Settings from './pages/Settings';

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
        {/* Main Application Interface */}
        <Route path="/" element={<ChatHub />} />
        <Route path="/settings" element={<Settings />} />
        
        {/* Catch-all Fallback Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
