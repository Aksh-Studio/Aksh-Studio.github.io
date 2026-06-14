// src/app.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from './firebase.js';

// --- 1. APPLICATION & USER STATE ---
let isMobileChatOpen = false;
let activeChatId = 'global_channel'; 
let activeTab = 'all'; // State for the new Filter Tabs
let unsubscribeListener = null; 

const currentUser = {
    id: 'akshat124',
    name: 'Akshat',
    email: 'akshat124.am12@gmail.com',
    photoURL: localStorage.getItem('aksh_photo_url') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    isGuest: false 
};

// Expanded Database to test WhatsApp Tabs
const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group', unread: false, fav: false, network: false },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group', unread: true, fav: true, network: false },
    'john_doe': { name: 'John Doe', icon: 'person', type: 'direct', unread: false, fav: false, network: true }
};

// --- 2. THEME ENGINE ---
const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');
};

const toggleTheme = () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.innerText = isDark ? 'Light Mode' : 'Dark Mode';
};

// --- 3. NAVIGATION & FILTER ENGINE (NEW) ---
const switchTab = (tabName) => {
    activeTab = tabName;
    document.querySelectorAll('.tab-pill').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    renderSidebarList();
};

const renderSidebarList = () => {
    const listContainer = document.getElementById('dynamic-user-list');
    listContainer.innerHTML = '';

    Object.keys(roomsInfo).forEach(id => {
        const room = roomsInfo[id];
        let show = false;

        // Routing logic based on WhatsApp Tabs
        if (activeTab === 'all' && !room.network) show = true;
        if (activeTab === 'unread' && room.unread) show = true;
        if (activeTab === 'fav' && room.fav) show = true;
        if (activeTab === 'groups' && room.type === 'group') show = true;
        if (activeTab === 'network' && room.network) show = true;

        if (show) {
            const isActive = activeChatId === id ? 'active' : '';
            const unreadBadge = room.unread ? `<span class="unread-badge">1</span>` : '';
            
            listContainer.innerHTML += `
                <div class="user-item ${isActive}" onclick="window.switchChat('${id}')" id="btn-${id}">
                    <div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div>
                    <div class="user-info">
                        <h4>${room.name}</h4>
                        <p>Tap to view messages</p>
                    </div>
                    ${unreadBadge}
                </div>
            `;
        }
    });

    if (listContainer.innerHTML === '') {
        listContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px;">No chats found here.</p>`;
    }
};

window.switchChat = (chatId) => {
    activeChatId = chatId;
    isMobileChatOpen = true; 
    
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`btn-${chatId}`);
    if (btn) btn.classList.add('active');

    document.getElementById('active-room-name').innerText = roomsInfo[chatId].name;
    document.getElementById('active-room-icon').innerText = roomsInfo[chatId].icon;

    listenToMessages(chatId);
    
    const layout = document.getElementById('main-layout');
    if (layout) layout.className = 'app-layout mobile-chat-active';
};

const closeMobileChat = () => {
    isMobileChatOpen = false;
    const layout = document.getElementById('main-layout');
    if (layout) layout.className = 'app-layout';
};

// --- 4. FIREBASE REAL-TIME ENGINE ---
const listenToMessages = (roomId) => {
    if (currentUser.isGuest) return; 

    const container = document.getElementById('chat-messages-container');
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 20px;">Syncing secure connection...</div>`;

    if (unsubscribeListener) unsubscribeListener();

    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="margin: auto; text-align: center; color: var(--text-muted);">
                    <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.5;">forum</span>
                    <p style="margin-top: 10px;">Be the first to say hello!</p>
                </div>
            `;
            return;
        }

        let messagesHTML = '';
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isMe = msg.senderId === currentUser.id; 
            
            let timeString = "Just now";
            if (msg.timestamp) {
                const date = msg.timestamp.toDate();
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            messagesHTML += `
                <div style="display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; margin-bottom: 15px;">
                    <div style="background: ${isMe ? 'var(--primary)' : 'var(--card-bg)'}; color: ${isMe ? '#fff' : 'var(--text-main)'}; padding: 10px 15px; border-radius: 12px; max-width: 75%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); font-size: 14.5px; line-height: 1.4;">
                        ${msg.text}
                    </div>
                    <span style="font-size: 10.5px; color: var(--text-muted); margin-top: 4px;">${timeString}</span>
                </div>
            `;
        });

        container.innerHTML = messagesHTML;
        container.scrollTop = container.scrollHeight; 
    }, 
    (error) => { console.error("Firebase Sync Error:", error); });
};

const sendMessage = async () => {
    if (currentUser.isGuest) return;

    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text) return; 

    inputField.value = '';

    try {
        await addDoc(collection(db, `chats/${activeChatId}/messages`), {
            text: text,
            senderId: currentUser.id, 
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error sending message:", error);
    }
};

// --- 5. INITIAL SHELL RENDER ---
const renderAppShell = () => {
    const root = document.getElementById('app-root');
    const isDark = document.body.classList.contains('dark-theme');
    const blurClass = currentUser.isGuest ? 'guest-blur' : '';

    root.innerHTML = `
        <div class="aksh-chat-app ${blurClass}">
            <nav class="top-nav">
                <div class="nav-left">
                    <a href="/dashboard.html" class="back-link">← Dashboard</a>
                    <div class="brand-title">
                        <img src="/chat-logo.png" alt="Logo" style="width: 28px; height: 28px; border-radius: 6px;">
                        Aksh Chat
                    </div>
                </div>
                <div class="nav-right">
                    <button id="theme-btn" class="btn-outline">
                        ${isDark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    <div class="profile-menu">
                        <img src="${currentUser.photoURL}" alt="Profile" class="user-avatar">
                        <div class="dropdown-content">
                            <p style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; font-weight: 600;">Personal Profile</p>
                            <p style="font-size: 14px; font-weight: 600; margin-bottom: 2px; color: var(--text-main);">Name: ${currentUser.name}</p>
                            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px; word-break: break-all;">Email: ${currentUser.email}</p>
                            <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;">
                            <a href="/login.html" style="display: block; width: 100%; background: #dc2626; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; text-align: center; text-decoration: none;">Sign Out</a>
                        </div>
                    </div>
                </div>
            </nav>

            <div id="main-layout" class="app-layout">
                
                <nav class="side-rail">
                    <button class="rail-item active" title="Chats"><span class="material-symbols-rounded">chat</span></button>
                    <button class="rail-item" title="Calls"><span class="material-symbols-rounded">call</span></button>
                </nav>

                <aside class="chat-sidebar">
                    <div class="sidebar-header">
                        <h2>Chats</h2>
                        <span class="material-symbols-rounded" style="color: var(--text-muted); cursor:pointer;">edit_square</span>
                    </div>
                    <div class="search-bar">
                        <input type="text" placeholder="Search">
                    </div>
                    
                    <div class="chat-tabs">
                        <button class="tab-pill active" id="tab-all" onclick="window.switchTab('all')">All</button>
                        <button class="tab-pill" id="tab-network" onclick="window.switchTab('network')">Search Network</button>
                        <button class="tab-pill" id="tab-unread" onclick="window.switchTab('unread')">Unread</button>
                        <button class="tab-pill" id="tab-fav" onclick="window.switchTab('fav')">Favorites</button>
                        <button class="tab-pill" id="tab-groups" onclick="window.switchTab('groups')">Groups</button>
                    </div>

                    <div class="user-list" id="dynamic-user-list">
                        </div>
                </aside>

                <main class="chat-main">
                    <div class="chat-header">
                        <button id="btn-mobile-back" class="mobile-back-btn">
                            <span class="material-symbols-rounded">arrow_back_ios_new</span>
                        </button>
                        <div class="global-icon-box" style="width:40px; height:40px; background:transparent;">
                            <span id="active-room-icon" class="material-symbols-rounded" style="color: var(--primary);">public</span>
                        </div>
                        <div>
                            <h3 id="active-room-name" style="font-size:16px;">Global Channel</h3>
                            <p style="font-size:12px; color:var(--primary);">Online</p>
                        </div>
                    </div>

                    <div class="chat-messages" id="chat-messages-container"></div>

                    <div class="chat-input-area">
                        <input type="text" id="chat-input" placeholder="Type a message..." autocomplete="off">
                        <button id="btn-send-msg" class="btn-send"><span class="material-symbols-rounded">send</span></button>
                    </div>
                </main>
            </div>
        </div>
    `;

    if (!currentUser.isGuest) {
        document.getElementById('theme-btn').addEventListener('click', toggleTheme);
        window.switchTab = switchTab; // Expose to global for inline clicks
        renderSidebarList(); // Initial list render

        const mobileBackBtn = document.getElementById('btn-mobile-back');
        if (mobileBackBtn) mobileBackBtn.addEventListener('click', closeMobileChat);
        
        document.getElementById('btn-send-msg').addEventListener('click', sendMessage);
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
        });

        listenToMessages(activeChatId);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    renderAppShell();
});
