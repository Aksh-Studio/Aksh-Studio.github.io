// src/app.js

// --- 1. APPLICATION STATE (The Brain) ---
let isMobileChatOpen = false;
let activeChatId = 'ak_facts';

// A temporary "database" to hold messages until we connect Firebase
const chatDatabase = {
    'ak_facts': {
        name: 'AK facts Community',
        icon: 'biotech',
        messages: [
            { text: "Welcome to the AK facts Community!", sender: "system", time: "10:00 AM" },
            { text: "New 9:16 short just dropped!", sender: "system", time: "10:05 AM" }
        ]
    },
    'gully_cricket': {
        name: 'Gully Cricket Edits',
        icon: 'sports_cricket',
        messages: [
            { text: "Render finished for the slow-mo shot.", sender: "system", time: "11:30 AM" }
        ]
    }
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
    isMobileChatOpen = true; // Slides open on phones
    renderApp(); // Re-render to show the new chat room name
    scrollToBottom();
};

const closeMobileChat = () => {
    isMobileChatOpen = false;
    renderApp();
};

const sendMessage = () => {
    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    
    // Do nothing if the user tries to send an empty message
    if (!text) return; 

    // Get the current time (e.g., "10:45 PM")
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Push the new message to our database
    chatDatabase[activeChatId].messages.push({
        text: text,
        sender: "me",
        time: timeString
    });

    // Instantly clear the input box
    inputField.value = '';

    // Re-draw the messages and scroll to the bottom
    renderMessagesOnly();
    scrollToBottom();
};

const scrollToBottom = () => {
    const container = document.getElementById('chat-messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
};

// --- 4. RENDER ENGINES ---
const renderMessagesOnly = () => {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const messages = chatDatabase[activeChatId].messages;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div style="margin: auto; text-align: center; color: var(--text-muted);">
                <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.5;">forum</span>
                <p style="margin-top: 10px;">Send a message to start chatting</p>
            </div>
        `;
        return;
    }

    // Loop through the messages and build premium chat bubbles
    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender === 'me';
        return `
            <div style="display: flex; flex-direction: column; align-items: ${isMe ? 'flex-end' : 'flex-start'}; margin-bottom: 15px;">
                <div style="background: ${isMe ? 'var(--primary)' : 'var(--card-bg)'}; color: ${isMe ? '#fff' : 'var(--text-main)'}; padding: 10px 15px; border-radius: 12px; max-width: 75%; box-shadow: 0 1px 2px rgba(0,0,0,0.1); font-size: 14.5px; line-height: 1.4;">
                    ${msg.text}
                </div>
                <span style="font-size: 10.5px; color: var(--text-muted); margin-top: 4px;">${msg.time}</span>
            </div>
        `;
    }).join('');
};

const renderApp = () => {
    const root = document.getElementById('app-root');
    const isDark = document.body.classList.contains('dark-theme');
    const layoutClass = isMobileChatOpen ? 'app-layout mobile-chat-active' : 'app-layout';
    const activeChat = chatDatabase[activeChatId];

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
                <div>
                    <button id="theme-btn" class="btn-outline">
                        ${isDark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                </div>
            </nav>

            <div class="${layoutClass}">
                
                <aside class="chat-sidebar">
                    <div class="sidebar-header">
                        <h2>Messages</h2>
                        <span class="material-symbols-rounded" style="color: var(--text-muted); cursor:pointer;">edit_square</span>
                    </div>
                    <div class="search-bar">
                        <input type="text" placeholder="Search network...">
                    </div>
                    
                    <div class="user-list">
                        <div class="user-item ${activeChatId === 'ak_facts' ? 'active' : ''}" id="btn-ak-facts">
                            <div class="global-icon-box"><span class="material-symbols-rounded">biotech</span></div>
                            <div class="user-info">
                                <h4>AK facts Community</h4>
                                <p>Tap to view messages</p>
                            </div>
                        </div>

                        <div class="user-item ${activeChatId === 'gully_cricket' ? 'active' : ''}" id="btn-gully-cricket">
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
                        <div class="global-icon-box" style="width:40px; height:40px; background:transparent;"><span class="material-symbols-rounded" style="color: var(--primary);">${activeChat.icon}</span></div>
                        <div>
                            <h3 style="font-size:16px;">${activeChat.name}</h3>
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

    // --- 5. ATTACH EVENT LISTENERS (Making Buttons Work) ---
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    document.getElementById('btn-ak-facts').addEventListener('click', () => switchChat('ak_facts'));
    document.getElementById('btn-gully-cricket').addEventListener('click', () => switchChat('gully_cricket'));
    
    // Mobile Back Button
    const backBtn = document.getElementById('btn-mobile-back');
    if (backBtn) backBtn.addEventListener('click', closeMobileChat);

    // Send Button Click
    const sendBtn = document.getElementById('btn-send-msg');
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);

    // Pressing 'Enter' on Keyboard
    const inputField = document.getElementById('chat-input');
    if (inputField) {
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Stop standard form submission
                sendMessage();
            }
        });
    }

    // Render the messages for whatever chat is currently active
    renderMessagesOnly();
    scrollToBottom();
};

// --- 6. BOOT APP ---
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    renderApp();
});
