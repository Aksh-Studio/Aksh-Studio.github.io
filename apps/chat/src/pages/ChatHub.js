// src/pages/ChatHub.js
import React, { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import '../styles/chathub.css';

const ChatHub = () => {
    // State to track which room the user is currently viewing
    const [activeRoom, setActiveRoom] = useState('global_network');
    const [activeRoomName, setActiveRoomName] = useState('Global Network');
    
    // State to handle the Mobile View Sliding Interface
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    // Triggered when user clicks a room in the Sidebar
    const handleRoomSelect = (roomId, roomName) => {
        setActiveRoom(roomId);
        setActiveRoomName(roomName);
        setIsMobileChatOpen(true); // Slides chat window open on mobile
    };

    // Triggered when user clicks "Back" arrow on mobile
    const handleMobileBack = () => {
        setIsMobileChatOpen(false); // Slides back to contacts
    };

    return (
        <div className={`app-layout ${isMobileChatOpen ? 'mobile-chat-active' : ''}`}>
            
            {/* The Left Panel */}
            <Sidebar 
                activeRoom={activeRoom} 
                onSelectRoom={handleRoomSelect} 
            />

            {/* The Right Panel (Temporary Placeholder until we build ChatWindow.js) */}
            <main className="chat-main" style={{ display: isMobileChatOpen ? 'flex' : 'none' }}>
                <div style={{ padding: '20px', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button className="icon-btn mobile-back" onClick={handleMobileBack}>
                        <span className="material-symbols-rounded">arrow_back_ios_new</span>
                    </button>
                    <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{activeRoomName}</h3>
                </div>
                
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '48px', opacity: 0.5 }}>forum</span>
                        <p style={{ marginTop: '10px' }}>Loading real-time message stream...</p>
                    </div>
                </div>
            </main>

        </div>
    );
};

export default ChatHub;
