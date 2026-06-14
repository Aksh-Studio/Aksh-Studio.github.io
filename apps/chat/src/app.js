// src/app.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from './firebase.js';

// --- 1. APPLICATION & USER STATE ---
let isMobileChatOpen = false;
let activeChatId = 'global_channel'; 
let unsubscribeListener = null; 

// Pulls the custom avatar uploaded from the Aksh Dashboard / Login page
const currentUser = {
    id: 'akshat124',
    name: 'Akshat',
    email: 'akshat124.am12@gmail.com',
    photoURL: localStorage.getItem('aksh_photo_url') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    isGuest: false 
};

const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public' }
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
    if (currentUser.isGuest) return; 

    const container = document.getElementById('chat-messages-container');
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 20px;">Syncing secure connection...</div>`;

    if (unsubscribeListener) unsubscribeListener();

    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="margin: auto; text-align: center; color: var(--text-muted);">
                    <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.5;">public</span>
                    <p style="margin-top: 10px;">Welcome to the Global Channel. Be the first to say hello!</p>
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
    (error) => {
        console.error("Firebase Sync Error:", error);
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
        alert("Action blocked by Firebase Security Rules. Please check your Firestore rules.");
    }
};

// --- 5. INITIAL SHELL RENDER ---
const renderAppShell = () => {
    const root = document.getElementById('app-root');
    const isDark = document.body.classList.contains('dark-theme');
    
    const blurClass = currentUser.isGuest ? 'guest-blur' : '';

    const guestOverlayHTML = currentUser.isGuest ? `
        <div class="guest-overlay">
            <div class="guest-modal">
                <span class="material-symbols-rounded" style="font-size: 56px; color: var(--primary); margin-bottom: 15px;">lock_person</span>
                <h2 style="margin-bottom: 10px; color: var(--text-main); font-size: 20px;">Guest Account Restricted</h2>
                <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px; line-height: 1.5;">
                    Guest users cannot use Aksh Chat. Please bind your account with Google or Email on the login page to securely access your messages.
                </p>
                <a href="/login.html" style="display: block; width: 100%; background: var(--primary); color: white; border: none; padding: 14px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; text-decoration: none; transition: 0.2s;">Go to Login Page</a>
            </div>
        </div>
    ` : '';

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
                            <p style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; font-weight: 600; letter-spacing: 0.5px;">Personal Profile</p>
                            <p style="font-size: 14px; font-weight: 600; margin-bottom: 2px; color: var(--text-main);">Name: ${currentUser.name}</p>
                            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px; word-break: break-all;">Email: ${currentUser.email}</p>
                            <hr style="border: 0; border-top: 1px solid var(--border); margin: 10px 0;">
                            <a href="/login.html" style="display: block; width: 100%; background: #dc2626; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; text-align: center; text-decoration: none; transition: 0.2s;">Sign Out</a>
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
                        <input type="text" placeholder="Search">
                    </div>
                    
                    <div class="user-list">
                        <div class="user-item active" id="btn-global_channel">
                            <div class="global-icon-box"><span class="material-symbols-rounded">public</span></div>
                            <div class="user-info">
                                <h4>Global Channel</h4>
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
        ${guestOverlayHTML}
    `;

    if (!currentUser.isGuest) {
        document.getElementById('theme-btn').addEventListener('click', toggleTheme);
        document.getElementById('btn-global_channel').addEventListener('click', () => switchChat('global_channel'));
        
        const mobileBackBtn = document.getElementById('btn-mobile-back');
        if (mobileBackBtn) mobileBackBtn.addEventListener('click', closeMobileChat);
        
        document.getElementById('btn-send-msg').addEventListener('click', sendMessage);

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });

        listenToMessages(activeChatId);
    } else {
        document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    }
};

// --- 6. BOOT APP ---
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    renderAppShell();
});
