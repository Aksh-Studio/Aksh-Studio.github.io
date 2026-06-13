// src/app.js

// State variables to manage the mobile layout
let isMobileChatOpen = false;

// 1. Global Theme Engine
const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
};

const toggleTheme = () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    renderApp(); 
};

// Toggle the mobile view when a chat is clicked
const openMobileChat = () => {
    isMobileChatOpen = true;
    renderApp();
};

const closeMobileChat = () => {
    isMobileChatOpen = false;
    renderApp();
};

// 2. The Main UI Render Function
const renderApp = () => {
    const root = document.getElementById('app-root');
    const isDark = document.body.classList.contains('dark-theme');

    // Check if we need to apply the mobile sliding class
    const layoutClass = isMobileChatOpen ? 'app-layout mobile-chat-active' : 'app-layout';

    root.innerHTML = `
        <div class="aksh-chat-app">
            
            <nav class="top-nav">
                <div class="nav-left">
                    <a href="../../dashboard.html" class="back-link">← Dashboard</a>
                    <div class="brand-title">
                        <img src="../../chat-logo.png" alt="Logo" style="width: 28px; height: 28px; border-radius: 6px;">
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
                        <div class="user-item active" id="btn-open-chat">
                            <div class="global-icon-box"><span class="material-symbols-rounded">biotech</span></div>
                            <div class="user-info">
                                <h4>AK facts Community</h4>
                                <p>New 9:16 short just dropped!</p>
                            </div>
                        </div>

                        <div class="user-item" id="btn-open-chat-2">
                            <div class="global-icon-box"><span class="material-symbols-rounded">sports_cricket</span></div>
                            <div class="user-info">
                                <h4>Gully Cricket Edits</h4>
                                <p>Render finished for the slow-mo shot.</p>
                            </div>
                        </div>
                    </div>
                </aside>

                <main class="chat-main">
                    
                    <div class="chat-header">
                        <button id="btn-mobile-back" class="mobile-back-btn">
                            <span class="material-symbols-rounded">arrow_back_ios_new</span>
                        </button>
                        <div class="global-icon-box" style="width:40px; height:40px;"><span class="material-symbols-rounded">biotech</span></div>
                        <div>
                            <h3 style="font-size:16px;">AK facts Community</h3>
                            <p style="font-size:12px; color:var(--primary);">Online</p>
                        </div>
                    </div>

                    <div class="chat-messages">
                        <div style="margin: auto; text-align: center; color: var(--text-muted);">
                            <span class="material-symbols-rounded" style="font-size: 48px; opacity: 0.5;">forum</span>
                            <p style="margin-top: 10px;">End-to-End Encrypted Message Stream</p>
                        </div>
                    </div>

                    <div class="chat-input-area">
                        <input type="text" placeholder="Type a message...">
                        <button class="btn-send"><span class="material-symbols-rounded">send</span></button>
                    </div>

                </main>
            </div>

        </div>
    `;

    // 3. Attach Event Listeners
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
    
    // Attach slide logic to the dummy chat buttons
    document.getElementById('btn-open-chat').addEventListener('click', openMobileChat);
    document.getElementById('btn-open-chat-2').addEventListener('click', openMobileChat);
    
    // Attach close logic to the mobile back arrow
    const backBtn = document.getElementById('btn-mobile-back');
    if (backBtn) {
        backBtn.addEventListener('click', closeMobileChat);
    }
};

// Boot Up the Application
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    renderApp();
});
