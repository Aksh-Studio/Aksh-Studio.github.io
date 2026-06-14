// src/app.js
import { db, collection, getDocs } from './firebase.js';
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom } from './chatEngine.js';
import { initMediaEngine } from './mediaEngine.js';
import { initGroupEngine } from './groupEngine.js';
import { initCallEngine } from './callEngine.js';

export const appState = { activeChatId: null, activeTab: 'all', isMobileChatOpen: false };

export const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group', unread: false, fav: false, network: false },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group', unread: false, fav: true, network: false }
};

const initSettingsAndTheme = () => {
    const themeBtn = document.getElementById('theme-btn');
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');
    if (themeBtn) {
        themeBtn.innerText = document.body.classList.contains('dark-theme') ? 'Light Mode' : 'Dark Mode';
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
            themeBtn.innerText = document.body.classList.contains('dark-theme') ? 'Light Mode' : 'Dark Mode';
        });
    }

    // Load Wallpaper
    const savedWallpaper = localStorage.getItem('chat_wallpaper');
    if (savedWallpaper) document.getElementById('chat-main-panel').style.backgroundImage = `url(${savedWallpaper})`;

    // Inject Settings Gear dynamically
    const rail = document.querySelector('.side-rail');
    if (rail) {
        rail.innerHTML += `
            <div style="flex:1;"></div>
            <button class="rail-item" id="btn-settings" title="Settings"><span class="material-symbols-rounded">settings</span></button>
        `;
        document.getElementById('btn-settings').addEventListener('click', () => {
            const bgUrl = prompt("Enter an Image URL to set as your Chat Wallpaper:");
            if (bgUrl) {
                localStorage.setItem('chat_wallpaper', bgUrl);
                document.getElementById('chat-main-panel').style.backgroundImage = `url(${bgUrl})`;
                document.getElementById('chat-main-panel').style.backgroundSize = 'cover';
            }
        });
    }
};

const initNavigation = () => {
    const searchInput = document.getElementById('chat-search');
    
    document.querySelectorAll('.tab-pill').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            appState.activeTab = e.target.getAttribute('data-tab');
            
            if (appState.activeTab === 'network') {
                searchInput.placeholder = "Search Network";
                fetchNetworkUsers();
            } else {
                searchInput.placeholder = "Search";
                renderSidebarList();
            }
        });
    });

    document.getElementById('btn-mobile-back')?.addEventListener('click', () => {
        appState.isMobileChatOpen = false;
        document.getElementById('main-layout').classList.remove('mobile-chat-active');
    });
};

const fetchNetworkUsers = async () => {
    const listContainer = document.getElementById('dynamic-user-list');
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Scanning Network...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        listContainer.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const u = doc.data();
            if (doc.id === currentUser.id) return; // Don't show myself
            
            const name = u.fullName || u.firstName || u.email.split('@')[0];
            const item = document.createElement('div');
            item.className = 'user-item';
            item.innerHTML = `
                <img src="${u.customProfilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">
                <div class="user-info">
                    <h4>${name}</h4>
                    <p style="font-size:12px;">Aksh Studio User</p>
                </div>
            `;
            item.addEventListener('click', () => alert(`Direct Messaging to ${name} will be activated in the next server patch!`));
            listContainer.appendChild(item);
        });
    } catch (e) {
        listContainer.innerHTML = '<p style="text-align: center; color: red;">Network Error</p>';
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

        if (show) {
            const isActive = appState.activeChatId === id ? 'active' : '';
            const unreadHTML = room.unread ? `<span style="background: var(--primary); color: white; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px; margin-left: auto;">1</span>` : '';
            
            const item = document.createElement('div');
            item.className = `user-item ${isActive}`;
            item.id = `btn-room-${id}`;
            item.innerHTML = `
                <div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div>
                <div class="user-info"><h4>${room.name} ${unreadHTML}</h4><p>Tap to view messages</p></div>
            `;
            
            item.addEventListener('click', () => {
                document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                document.getElementById('active-room-name').innerText = room.name;
                document.getElementById('active-room-icon').innerText = room.icon;
                
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                switchChatRoom(id);
            });
            listContainer.appendChild(item);
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initAuth(() => {
        initSettingsAndTheme();
        initNavigation();
        initMediaEngine();
        initGroupEngine();
        initCallEngine();

        renderSidebarList();
        const defaultBtn = document.getElementById(`btn-room-global_channel`);
        if(defaultBtn) defaultBtn.click();
    });
});
