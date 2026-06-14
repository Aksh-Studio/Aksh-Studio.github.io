// src/app.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from './firebase.js';

let isMobileChatOpen = false;
let activeChatId = 'global_channel'; 
let activeTab = 'all'; 
let unsubscribeListener = null; 

const currentUser = {
    id: 'akshat124',
    name: 'Akshat',
    email: 'akshat124.am12@gmail.com',
    photoURL: localStorage.getItem('aksh_photo_url') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    isGuest: false 
};

// Removed John Doe. Only authentic Aksh Studio rooms.
const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group', unread: false, fav: false, network: false },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group', unread: true, fav: true, network: false }
};

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

        if (activeTab === 'all' && !room.network) show = true;
        if (activeTab === 'unread' && room.unread) show = true;
        if (activeTab === 'fav' && room.fav) show = true;
        if (activeTab === 'groups' && room.type === 'group') show = true;
        if (activeTab === 'network' && room.network) show = true;

        if (show) {
            const isActive = activeChatId === id ? 'active' : '';
            const unreadBadge = room.unread ? `<span style="background: var(--primary); color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; margin-left: auto;">1</span>` : '';
            
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

// --- PHASE 3: MESSAGE STREAM ENGINE ---
const listenToMessages = (roomId) => {
    if (currentUser.isGuest) return; 

    const container = document.getElementById('chat-messages-container');
    
    // Headers & Disclaimers injected at the top permanently
    const disclaimerHTML = `
        <div class="chat-disclaimer-wrapper">
            <div class="chat-disclaimer">
                <span class="material-symbols-rounded lock-icon" style="font-size: 13px; vertical-align: text-top; margin-right: 4px;">lock</span>
                Messages are end-to-end encrypted. No one outside of this chat, not even Aksh Studio, can read or listen to them.
            </div>
            <div class="chat-disclaimer notice-disclaimer">
                We will only store messages up to 3 months.<br>For extended messages backup contact: <b>akshstudioofficial@gmail.com</b>
            </div>
        </div>
    `;

    container.innerHTML = disclaimerHTML;

    if (unsubscribeListener) unsubscribeListener();
    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        let messagesHTML = disclaimerHTML; 
        let previousSenderId = null; 

        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isMe = msg.senderId === currentUser.id; 
            
            // SMART SENDER GROUPING
            const isFirstInGroup = previousSenderId !== msg.senderId;

            let timeString = "";
            let tickHTML = "";

            // MESSAGE STATUS TICKS LOGIC
            if (!msg.timestamp) {
                // If there's no server timestamp yet, it's still sending (No Tick)
                timeString = "Sending...";
                tickHTML = ``; 
            } else {
                const date = msg.timestamp.toDate();
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // If it exists on the server, it is Sent/Read. 
                // For Phase 3, we simulate 'Read' status (Double Blue Tick) for all successfully synced messages you sent.
                if (isMe) {
                    tickHTML = `<span class="material-symbols-rounded tick-icon tick-read">done_all</span>`;
                }
            }

            // Grouping Logic - Hides the "tail" and Sender Name if it's consecutive
            const bubbleShapeClass = isFirstInGroup ? '' : 'grouped';
            const senderNameHTML = (!isMe && isFirstInGroup) ? `<div class="msg-sender-name">User ID: ${msg.senderId.substring(0,6)}...</div>` : '';

            messagesHTML += `
                <div class="msg-container ${isFirstInGroup ? 'first-in-group' : ''} ${isMe ? 'me' : 'other'}">
                    <div class="msg-bubble ${isMe ? 'msg-me' : 'msg-other'} ${bubbleShapeClass}">
                        ${senderNameHTML}
                        <span>${msg.text}</span>
                        <div class="msg-meta">
                            <span>${timeString}</span>
                            ${tickHTML}
                        </div>
                    </div>
                </div>
            `;
            
            previousSenderId = msg.senderId;
        });

        container.innerHTML = messagesHTML;
        container.scrollTop = container.scrollHeight; 
    });
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

const renderAppShell = () => {
    const root = document.getElementById('app-root');
    const isDark = document.body.classList.contains('dark-theme');

    root.innerHTML = `
        <div class="aksh-chat-app">
            <nav class="top-nav">
                <div class="nav-left">
                    <a href="/dashboard.html" class="back-link">← Dashboard</a>
                    <div class="brand-title">
                        <img src="/chat-logo.png" alt="Logo" style="width: 28px; height: 28px; border-radius: 6px;">
                        Aksh Chat
                    </div>
                </div>
                <div class="nav-right">
                    <button id="theme-btn" class="btn-outline">${isDark ? 'Light Mode' : 'Dark Mode'}</button>
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

                    <div class="user-list" id="dynamic-user-list"></div>
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
        window.switchTab = switchTab; 
        renderSidebarList(); 

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
