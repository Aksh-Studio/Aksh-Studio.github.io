// src/app.js

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
    renderApp(); // Re-render to update the button text
};

// 2. The Main UI Render Function
const renderApp = () => {
    const root = document.getElementById('app-root');
    const isDark = document.body.classList.contains('dark-theme');

    root.innerHTML = `
        <div class="aksh-chat-app">
            
            <nav class="top-nav">
                <div class="nav-left">
                    <a href="../dashboard.html" class="back-link">← Dashboard</a>
                    <div class="brand-title">
                        <img src="../chat-logo.png" alt="Logo" style="width: 28px; height: 28px; border-radius: 6px;">
                        Aksh Chat
                    </div>
                </div>
                <div>
                    <button id="theme-btn" class="btn-outline">
                        ${isDark ? 'Light Mode' : 'Dark Mode'}
                    </button>
                </div>
            </nav>

            <div class="app-layout">
                <div>
                    <span class="material-symbols-rounded" style="font-size: 64px; color: var(--primary); margin-bottom: 15px;">forum</span>
                    <h2>Aksh Chat Core Installed</h2>
                    <p style="color: var(--text-muted); margin-top: 10px;">The native architecture is successfully running.</p>
                </div>
            </div>

        </div>
    `;

    // Re-attach the event listener after injecting the new HTML
    document.getElementById('theme-btn').addEventListener('click', toggleTheme);
};

// 3. Boot Up the Application
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    renderApp();
});
