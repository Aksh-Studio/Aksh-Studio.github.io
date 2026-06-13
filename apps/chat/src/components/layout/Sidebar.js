// src/components/layout/Sidebar.js
import React, { useState } from 'react';

const Sidebar = ({ activeRoom, onSelectRoom }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Phase 1 Default Rooms
    const rooms = [
        { id: 'global_network', name: 'Global Network', desc: 'Join the public discussion', icon: 'public' },
        { id: 'aksh_announcements', name: 'Aksh Announcements', desc: 'Official updates & news', icon: 'campaign' }
    ];

    return (
        <aside className="chat-sidebar">
            <div className="sidebar-header">
                <h2>Messages</h2>
                <button className="icon-btn" title="New Message">
                    <span className="material-symbols-rounded">edit_square</span>
                </button>
            </div>
            
            <div className="search-bar">
                <span className="material-symbols-rounded search-icon">search</span>
                <input 
                    type="text" 
                    placeholder="Search network..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="user-list">
                <p className="section-title">Public Rooms</p>
                {rooms.map(room => (
                    <div 
                        key={room.id}
                        className={`user-item ${activeRoom === room.id ? 'active' : ''}`}
                        onClick={() => onSelectRoom(room.id, room.name)}
                    >
                        <div className="avatar-wrapper">
                            <span className="material-symbols-rounded global-icon">{room.icon}</span>
                        </div>
                        <div className="user-info">
                            <h4>{room.name}</h4>
                            <p>{room.desc}</p>
                        </div>
                    </div>
                ))}
                
                <hr className="list-divider" />
                <p className="section-title">Direct Messages</p>
                <div className="loading-state">Contacts loading from secure cloud...</div>
            </div>
        </aside>
    );
};

export default Sidebar;
