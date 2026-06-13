import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// --- PLACEHOLDER COMPONENTS (We will replace these with real files later) ---
const AuthScreen = () => <div style={{ padding: '50px', textAlign: 'center' }}><h2>Login Screen</h2><p>Phone/OTP Verification goes here.</p></div>;
const ChatHubScreen = () => <div style={{ padding: '50px', textAlign: 'center' }}><h2>Main Chat Interface</h2><p>Sidebar and messaging window goes here.</p></div>;
const SettingsScreen = () => <div style={{ padding: '50px', textAlign: 'center' }}><h2>Settings</h2><p>Privacy, Security, and Storage management.</p></div>;

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
        {/* Public Route */}
        <Route path="/login" element={<AuthScreen />} />
        
        {/* Protected Routes (Will add Auth Guards later) */}
        <Route path="/" element={<ChatHubScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
