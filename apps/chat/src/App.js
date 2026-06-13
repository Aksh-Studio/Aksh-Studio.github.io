import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// --- PLACEHOLDER COMPONENTS (To be built in later phases) ---
const ChatHub = () => <div style={{ padding: '50px', textAlign: 'center' }}><h2>Chat Hub</h2><p>Main interface loading...</p></div>;
const Settings = () => <div style={{ padding: '50px', textAlign: 'center' }}><h2>Settings</h2><p>Preferences loading...</p></div>;
const Calls = () => <div style={{ padding: '50px', textAlign: 'center' }}><h2>Calls</h2><p>WebRTC engine loading...</p></div>;

function App() {
  // Global Theme Initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
    }
  }, []);

  return (
    <div className="aksh-chat-app">
      <Routes>
        {/* Core Application Routes */}
        <Route path="/" element={<ChatHub />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/calls" element={<Calls />} />
        
        {/* Catch-all Fallback Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
