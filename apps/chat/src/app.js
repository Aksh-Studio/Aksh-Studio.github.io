// src/app.js
import { db, collection, getDocs } from './firebase.js';
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom } from './chatEngine.js';

export const appState = { activeChatId: null, activeTab: 'all', isMobileChatOpen: false };

export const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group' },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group' }
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

    const savedWallpaper = localStorage.getItem('chat_wallpaper');
    if (savedWallpaper) {
        document.getElementById('chat-main-panel').style.backgroundImage = `url(${savedWallpaper})`;
        document.getElementById('chat-main-panel').style.backgroundSize = 'cover';
    }

    // Interactive Wallpaper Config & Removal Dialog
    document.getElementById('btn-settings')?.addEventListener('click', () => {
        const activeWallpaper = localStorage.getItem('chat_wallpaper');
        if (activeWallpaper) {
            const action = confirm("Custom wallpaper is active.\n\nClick [OK] to change the image URL.\nClick [Cancel] to completely REMOVE the wallpaper.");
            if (!action) {
                localStorage.removeItem('chat_wallpaper');
                document.getElementById('chat-main-panel').style.backgroundImage = 'none';
                return;
            }
        }
        const bgUrl = prompt("Enter a image URL to assign as your Chat Background:");
        if (bgUrl) {
            localStorage.setItem('chat_wallpaper', bgUrl);
            document.getElementById('chat-main-panel').style.backgroundImage = `url(${bgUrl})`;
            document.getElementById('chat-main-panel').style.backgroundSize = 'cover';
        }
    });
};

const initNavigation = () => {
    const searchInput = document.getElementById('chat-search');
    
    // Left Side Rail Call Tab Controller
    document.getElementById('rail-calls')?.addEventListener('click', () => {
        document.getElementById('rail-chats')?.classList.remove('active');
        document.getElementById('rail-calls')?.classList.add('active');
        const headerTitle = document.getElementById('sidebar-chats')?.querySelector('h2');
        if (headerTitle) headerTitle.innerText = "Calls";
        
        const tabs = document.querySelector('.chat-tabs');
        if (tabs) tabs.style.display = 'none';
        
        document.getElementById('dynamic-user-list').innerHTML = `
            <div style="padding: 30px 20px; text-align: center; color: var(--text-muted);">
                <span class="material-symbols-rounded" style="font-size: 48px; margin-bottom: 10px;">call_log</span>
                <p style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: var(--text-main);">No Call Logs</p>
                <p style="font-size: 12px; max-width: 200px; margin: 0 auto;">Voice and video call history configurations will render here.</p>
            </div>
        `;
    });

    document.getElementById('rail-chats')?.addEventListener('click', () => {
        document.getElementById('rail-calls')?.classList.remove('active');
        document.getElementById('rail-chats')?.classList.add('active');
        const headerTitle = document.getElementById('sidebar-chats')?.querySelector('h2');
        if (headerTitle) headerTitle.innerText = "Chats";
        
        const tabs = document.querySelector('.chat-tabs');
        if (tabs) tabs.style.display = 'flex';
        renderSidebarList();
    });
    
    document.querySelectorAll('.tab-pill').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            appState.activeTab = e.target.getAttribute('data-tab');
            
            if (appState.activeTab === 'network') {
                if (searchInput) searchInput.placeholder = "Search Network Directory...";
                fetchNetworkUsers();
            } else {
                if (searchInput) searchInput.placeholder = "Search";
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
    if (!listContainer) return;
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Scanning Network...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        listContainer.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const u = doc.data();
            
            // Protected check prevents execution breakages if schema ids are mixed
            const curId = currentUser?.id || currentUser?.uid;
            if (doc.id === curId) return; 
            
            const name = u.fullName || u.firstName || u.name || (u.email ? u.email.split('@')[0] : 'Network User');
            const pic = u.customProfilePic || u.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            
            const item = document.createElement('div');
            item.className = 'user-item';
            item.innerHTML = `
                <img src="${pic}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <div class="user-info"><h4>${name}</h4><p style="font-size:12px; color: var(--text-muted);">Network Member</p></div>
            `;
            listContainer.appendChild(item);
        });
    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<p style="text-align: center; color: red; font-size: 13px; padding: 20px;">Network Error. Check Database Rules.</p>';
    }
};

export const renderSidebarList = () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    Object.keys(roomsInfo).forEach(id => {
        const room = roomsInfo[id];
        let show = false;

        if (appState.activeTab === 'all') show = true;
        if (appState.activeTab === 'groups' && room.type === 'group') show = true;

        if (show) {
            const isActive = appState.activeChatId === id ? 'active' : '';
            const item = document.createElement('div');
            item.className = `user-item ${isActive}`;
            item.id = `btn-room-${id}`;
            item.innerHTML = `
                <div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div>
                <div class="user-info"><h4>${room.name}</h4><p>Tap to view messages</p></div>
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
        // Safe Check: Bind User Profile elements explicitly upon successfully pulling Auth payload
        if (currentUser) {
            const navAvatar = document.getElementById('nav-profile-pic');
            if (navAvatar) {
                navAvatar.src = currentUser.customProfilePic || currentUser.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            }
            const navName = document.getElementById('nav-profile-name');
            if (navName) navName.innerText = "Name: " + (currentUser.name || currentUser.fullName || "Loading");
            
            const navEmail = document.getElementById('nav-profile-email');
            if (navEmail) navEmail.innerText = "Email: " + (currentUser.email || "");
        }
        
        initSettingsAndTheme();
        initNavigation();
        renderSidebarList();
        const defaultBtn = document.getElementById(`btn-room-global_channel`);
        if(defaultBtn) defaultBtn.click();
    });
});
