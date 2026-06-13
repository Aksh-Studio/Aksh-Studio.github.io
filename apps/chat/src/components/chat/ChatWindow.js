// src/components/chat/ChatWindow.js
import React, { useState, useEffect, useRef } from 'react';
import { subscribeToMessages, sendMessageStream, getSessionUser } from '../../services/firestore';

const ChatWindow = ({ activeRoom, activeRoomName, isMobileOpen, onMobileBack }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    
    // Reference to the bottom of the chat for auto-scrolling
    const messagesEndRef = useRef(null);
    const currentUser = getSessionUser();

    // 1. Real-Time Listener: Triggers every time a room is selected or a message is sent
    useEffect(() => {
        setIsLoading(true);
        
        // Subscribe to the active room's message stream
        const unsubscribe = subscribeToMessages(activeRoom, (newMessages) => {
            setMessages(newMessages);
            setIsLoading(false);
        });

        // Cleanup listener when switching rooms to prevent memory leaks
        return () => unsubscribe();
    }, [activeRoom]);

    // 2. Auto-Scroll Engine: Pushes view to the bottom when new messages arrive
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // 3. Send Message Handler
    const handleSend = async () => {
        const text = inputText.trim();
        if (!text) return;

        // Clear input instantly for snappy UI feel
        setInputText('');

        const response = await sendMessageStream(activeRoom, text);
        if (!response.success) {
            alert("Failed to send message. Please check your connection.");
        }
    };

    // Helper: Safely format Firebase timestamps
    const formatTime = (timestamp) => {
        if (!timestamp) return "Just now"; // For optimistic instant rendering
        const date = timestamp.toDate();
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <main className="chat-main" style={{ display: isMobileOpen ? 'flex' : '' }}>
            
            {/* --- CHAT HEADER --- */}
            <div className="chat-header">
                <div className="chat-header-info">
                    {/* Mobile Back Button (Only visible on small screens) */}
                    <button className="icon-btn mobile-back" onClick={onMobileBack}>
                        <span className="material-symbols-rounded">arrow_back_ios_new</span>
                    </button>
                    
                    {/* Dynamic Avatar & Name */}
                    <span className="material-symbols-rounded global-icon" style={{ fontSize: '36px', padding: '5px' }}>
                        {activeRoom === 'global_network' ? 'public' : 'forum'}
                    </span>
                    <div>
                        <h3>{activeRoomName}</h3>
                        <p className="status-text">Online</p>
                    </div>
                </div>
                <div className="chat-header-actions">
                    <button className="icon-btn" title="Room Info">
                        <span className="material-symbols-rounded">info</span>
                    </button>
                </div>
            </div>

            {/* --- MESSAGE STREAM --- */}
            <div className="chat-messages">
                {isLoading ? (
                    <div className="loading-state">Syncing encrypted messages...</div>
                ) : messages.length === 0 ? (
                    <div className="empty-chat-state">
                        <span className="material-symbols-rounded empty-icon">forum</span>
                        <h3>Welcome to {activeRoomName}</h3>
                        <p>Be the first to send a message!</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isSentByMe = msg.uid === currentUser.uid;
                        return (
                            <div key={msg.id} className={`message ${isSentByMe ? 'sent' : 'received'}`}>
                                {!isSentByMe && <div className="msg-sender">{msg.displayName || "Anonymous User"}</div>}
                                <div className="bubble">{msg.text}</div>
                                <div className="msg-time">{formatTime(msg.timestamp)}</div>
                            </div>
                        );
                    })
                )}
                {/* Invisible div to target for auto-scrolling */}
                <div ref={messagesEndRef} />
            </div>

            {/* --- INPUT AREA --- */}
            <div className="chat-input-area">
                <button className="icon-btn attach-btn" title="Attach Media">
                    <span className="material-symbols-rounded">attach_file</span>
                </button>
                
                <input 
                    type="text" 
                    placeholder="Type a message..." 
                    autoComplete="off"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSend();
                    }}
                />
                
                <button className="btn-primary" onClick={handleSend} title="Send Message">
                    <span className="material-symbols-rounded">send</span>
                </button>
            </div>
            
        </main>
    );
};

export default ChatWindow;
