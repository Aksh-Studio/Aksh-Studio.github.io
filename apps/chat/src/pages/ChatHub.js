// src/pages/ChatHub.js
import React, { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import '../styles/chathub.css';

const ChatHub = () => {
    const [activeRoom, setActiveRoom] = useState('global_network');
    const [activeRoomName, setActiveRoomName] = useState('Global Network');
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    const handleRoomSelect = (roomId, roomName) => {
        setActiveRoom(roomId);
        setActiveRoomName(roomName);
        setIsMobileChatOpen(true);
    };

    const handleMobileBack = () => {
        setIsMobileChatOpen(false);
    };

    return (
        <div className={`app-layout ${isMobileChatOpen ? 'mobile-chat-active' : ''}`}>
            
            <Sidebar 
                activeRoom={activeRoom} 
                onSelectRoom={handleRoomSelect} 
            />

            <ChatWindow 
                activeRoom={activeRoom}
                activeRoomName={activeRoomName}
                isMobileOpen={isMobileChatOpen}
                onMobileBack={handleMobileBack}
            />

        </div>
    );
};

export default ChatHub;
