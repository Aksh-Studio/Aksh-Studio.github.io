// src/app.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from './firebase.js';

// --- 1. APPLICATION STATE ---
let isMobileChatOpen = false;
let activeChatId = 'ak_facts';
let unsubscribeListener = null; 

const roomsInfo = {
    'ak_facts': { name: 'AK facts Community', icon: 'biotech' },
    'gully_cricket': { name: 'Gully Cricket Edits', icon: 'sports_cricket' }
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
    document.getElementById('theme-btn').innerText = isDark ? 'Light Mode' : 'Dark Mode';
};

// --- 3. CHAT ACTIONS ---
const switchChat = (chatId) => {
    activeChatId = chatId;
    isMobileChatOpen = true; 
    
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`btn-${chatId}`).classList.add('active');
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
    const container = document.getElementById('chat-messages-container');
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 20px;">Syncing secure connection...</div>`;

    if (unsubscribeListener) unsubscribeListener();

    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="margin: auto; text-align: center; color: var(--text-muted);">
                    <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.5;">forum</span>
                    <p style="margin-top: 10px;">Be the first to send a message!</p>
                </div>
            `;
            return;
        }

        let messagesHTML = '';
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isMe = msg.senderId === 'aksh_guest'; 
            
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
    });
};

const sendMessage = async () => {
    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text) return; 

    inputField.value = '';

    try {
        await addDoc(collection(db, `chats/${activeChatId}/messages`), {
            text: text,
            senderId: 'aksh_guest', 
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Check your connection. Message failed to send.");
    }
};

// --- 5. INITIAL SHELL RENDER ---
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
                    <button id="theme-btn" class="btn-outline">
                        ${isDark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                    
                    <div class="profile-menu">
                        <img src="https://cdn-icons-png.flaticon.com/512/149/149071.png" alt="Profile" class="user-avatar">
                        <div class="dropdown-content">
                            <p style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">Personal Profile</p>
                            <p style="font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text-main);">Aksh Guest</p>
                            <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;">
                            <button style="width: 100%; background: var(--primary); color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px;">Settings</button>
                        </div>
                    </div>
                </div>
            </nav>

            <div id="main-layout" class="app-layout">
                
                <aside class="chat-sidebar">
                    <div class="sidebar-header">
                        <h2>Messages</h2>
                        <span class="material-symbols-rounded" style="color: var(--text-muted); cursor:pointer;">edit_square</span>
                    </div>
                    <div class="search-bar">
                        <input type="text" placeholder="Search network...">
                    </div>
                    
                    <div class="user-list">
                        <div class="user-item active" id="btn-ak_facts">
                            <div class="global-icon-box"><span class="material-symbols-rounded">biotech</span></div>
                            <div class="user-info">
                                <h4>AK facts Community</h4>
                                <p>Tap to view messages</p>
                            </div>
                        </div>

                        <div class="user-item" id="btn-gully_cricket">
                            <div class="global-icon-box"><span class="material-symbols-rounded">sports_cricket</span></div>
                            <div class="user-info">
                                <h4>Gully Cricket Edits</h4>
                                <p>Tap to view messages</p>
                            </div>
                        </div>
                    </div>
                </aside>

                <main class="chat-main">
                    
                    <div class="chat-header">
                        <button id="btn-mobile-back" class="mobile-back-btn">
                            <span class="material-symbols-rounded">arrow_back_ios_new</span>
                        </button>
                        <div class="global-icon-box" style="width:40px; height:40px; background:transparent;">
                            <span id="active-room-icon" class="material-symbols-rounded" style="color: var(--primary);">biotech</span>
                        </div>
                        <div>
                            <h3 id="active-room-name" style="font-size:16px;">AK facts Community</h3>
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

    // Attach Listeners
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    document.getElementById('btn-ak_facts').addEventListener('click', () => switchChat('ak_facts'));
    document.getElementById('btn-gully_cricket').addEventListener('click', () => switchChat('gully_cricket'));
    
    document.getElementById('btn-mobile-back').addEventListener('click', closeMobileChat);
    document.getElementById('btn-send-msg').addEventListener('click', sendMessage);

    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });

    listenToMessages(activeChatId);
};

// --- 6. BOOT APP ---
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    renderAppShell();
});
