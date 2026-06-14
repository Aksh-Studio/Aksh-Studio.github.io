// src/app.js
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom } from './chatEngine.js';
import { initMediaEngine } from './mediaEngine.js';
import { initGroupEngine } from './groupEngine.js';
import { initCallEngine } from './callEngine.js';

export const appState = {
    activeChatId: null,
    activeTab: 'all',
    isMobileChatOpen: false
};

export const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group', unread: false, fav: false, network: false, unleaveable: true },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group', unread: true, fav: true, network: false, unleaveable: true }
};

// --- THEME ENGINE ---
const initTheme = () => {
    const themeBtn = document.getElementById('theme-btn');
    if (!themeBtn) return;

    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    themeBtn.innerText = document.body.classList.contains('dark-theme') ? 'Light Mode' : 'Dark Mode';
    
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
        themeBtn.innerText = document.body.classList.contains('dark-theme') ? 'Light Mode' : 'Dark Mode';
    });
};

// --- NAVIGATION & TABS ---
const initNavigation = () => {
    document.querySelectorAll('.tab-pill').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            appState.activeTab = e.target.getAttribute('data-tab');
            renderSidebarList();
        });
    });

    const mobileBack = document.getElementById('btn-mobile-back');
    if (mobileBack) {
        mobileBack.addEventListener('click', () => {
            appState.isMobileChatOpen = false;
            document.getElementById('main-layout').classList.remove('mobile-chat-active');
        });
    }
};

export const renderSidebarList = () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    Object.keys(roomsInfo).forEach(id => {
        const room = roomsInfo[id];
        let show = false;

        if (appState.activeTab === 'all' && !room.network) show = true;
        if (appState.activeTab === 'unread' && room.unread) show = true;
        if (appState.activeTab === 'fav' && room.fav) show = true;
        if (appState.activeTab === 'groups' && room.type === 'group') show = true;
        if (appState.activeTab === 'network' && room.network) show = true;

        if (show) {
            const isActive = appState.activeChatId === id ? 'active' : '';
            const unreadHTML = room.unread ? `<span style="background: var(--primary); color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; margin-left: auto;">1</span>` : '';
            
            const item = document.createElement('div');
            item.className = `user-item ${isActive}`;
            item.id = `btn-room-${id}`;
            item.innerHTML = `
                <div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div>
                <div class="user-info">
                    <h4>${room.name} ${unreadHTML}</h4>
                    <p>Tap to view messages</p>
                </div>
            `;
            
            item.addEventListener('click', () => {
                document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                document.getElementById('active-room-name').innerText = room.name;
                document.getElementById('active-room-icon').innerText = room.icon;
                document.getElementById('active-room-status').innerText = 'Online';
                
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                
                appState.activeChatId = id;
                switchChatRoom(id);
            });
            
            listContainer.appendChild(item);
        }
    });

    if (listContainer.innerHTML === '') {
        listContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px;">No chats found.</p>`;
    }
};

// --- BOOT SEQUENCE ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Wait for Auth to sync with Dashboard
    initAuth(() => {
        // 2. Initialize Core UI
        initTheme();
        initNavigation();
        
        // 3. Initialize Advanced Engines
        initMediaEngine();
        initGroupEngine();
        initCallEngine();

        // 4. Render and Select Default Room
        renderSidebarList();
        const defaultRoom = 'global_channel';
        const defaultBtn = document.getElementById(`btn-room-${defaultRoom}`);
        if(defaultBtn) defaultBtn.click();
    });
});
