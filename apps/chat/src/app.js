// src/app.js
import { db, collection, getDocs, onSnapshot, doc, setDoc } from './firebase.js';
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom } from './chatEngine.js';

export const appState = { activeChatId: null, activeTab: 'all', isMobileChatOpen: false };

export const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group' },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group' }
};

export const dynamicDMs = JSON.parse(localStorage.getItem('active_dynamic_dms')) || {};

const saveDynamicDMs = () => {
    localStorage.setItem('active_dynamic_dms', JSON.stringify(dynamicDMs));
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
    const targetPanel = document.getElementById('chat-main-panel');
    if (savedWallpaper && targetPanel) {
        targetPanel.style.backgroundImage = `url(${savedWallpaper})`;
        targetPanel.style.backgroundSize = 'cover';
        targetPanel.style.backgroundPosition = 'center';
    }

    document.getElementById('btn-settings')?.addEventListener('click', () => {
        const hasWallpaper = !!localStorage.getItem('chat_wallpaper');
        let optionsMsg = "Settings Menu:\n\nEnter a direct image URL to set a new chat background.";
        if (hasWallpaper) optionsMsg += "\n\nType the word 'REMOVE' in the box below to wipe out your custom wallpaper.";
        
        const userInput = prompt(optionsMsg);
        if (userInput === null) return; 
        
        if (userInput.trim().toUpperCase() === 'REMOVE') {
            localStorage.removeItem('chat_wallpaper');
            if (targetPanel) targetPanel.style.backgroundImage = 'none';
        } else if (userInput.trim() !== '') {
            localStorage.setItem('chat_wallpaper', userInput.trim());
            if (targetPanel) {
                targetPanel.style.backgroundImage = `url(${userInput.trim()})`;
                targetPanel.style.backgroundSize = 'cover';
                targetPanel.style.backgroundPosition = 'center';
            }
        }
    });
};

const initNavigation = () => {
    const searchInput = document.getElementById('chat-search');
    
    // Call Logs Engine
    document.getElementById('rail-calls')?.addEventListener('click', () => {
        document.getElementById('rail-chats')?.classList.remove('active');
        document.getElementById('rail-calls')?.classList.add('active');
        const headerTitle = document.getElementById('sidebar-chats')?.querySelector('h2');
        if (headerTitle) headerTitle.innerText = "Calls";
        
        const tabs = document.querySelector('.chat-tabs');
        if (tabs) tabs.style.display = 'none';
        
        const logs = JSON.parse(localStorage.getItem('aksh_call_logs')) || [];
        const listContainer = document.getElementById('dynamic-user-list');
        
        if (logs.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
                    <span class="material-symbols-rounded" style="font-size: 48px; margin-bottom: 12px; color: var(--text-muted);">call_log</span>
                    <p style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: var(--text-main);">No Call Logs Available</p>
                    <p style="font-size: 12px; max-width: 220px; margin: 0 auto;">End-to-end encrypted direct cellular calls are tracked cleanly inside this layout view.</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = '';
            logs.forEach(log => {
                listContainer.innerHTML += `
                    <div class="user-item">
                        <div class="global-icon-box" style="background: ${log.type === 'Video' ? '#00a88422' : '#e9edef'}; color: ${log.type === 'Video' ? '#00a884' : '#111b21'};"><span class="material-symbols-rounded">${log.type === 'Video' ? 'videocam' : 'call'}</span></div>
                        <div class="user-info">
                            <h4>${log.name}</h4>
                            <p style="font-size:12px; color: var(--text-muted);">${log.date} • Outgoing</p>
                        </div>
                    </div>
                `;
            });
        }
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
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Scanning Network Architecture...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        listContainer.innerHTML = '';
        const myUid = currentUser?.id || currentUser?.uid;

        querySnapshot.forEach((docObj) => {
            const u = docObj.data();
            const targetUid = docObj.id;
            
            if (targetUid === myUid) return; 
            
            const name = u.fullName || u.firstName || u.name || (u.email ? u.email.split('@')[0] : 'Network User');
            const pic = u.customProfilePic || u.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            
            const item = document.createElement('div');
            item.className = 'user-item';
            item.innerHTML = `
                <img src="${pic}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
                <div class="user-info">
                    <h4>${name}</h4>
                    <p style="font-size:12px; color: var(--text-muted);">Tap to start private chat</p>
                </div>
            `;

            // Deterministic P2P Routing
            item.addEventListener('click', () => {
                const deterministicId = myUid < targetUid ? `dm_${myUid}_${targetUid}` : `dm_${targetUid}_${myUid}`;
                
                dynamicDMs[deterministicId] = { name: name, pic: pic, type: 'dm', targetUid: targetUid };
                saveDynamicDMs();

                appState.activeChatId = deterministicId;
                document.getElementById('active-room-name').innerText = name;
                document.getElementById('active-room-icon-box').innerHTML = `<img src="${pic}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                
                const allTabBtn = document.querySelector('[data-tab="all"]');
                if (allTabBtn) {
                    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
                    allTabBtn.classList.add('active');
                }
                appState.activeTab = 'all';
                
                renderSidebarList();
                switchChatRoom(deterministicId);
            });

            listContainer.appendChild(item);
        });
    } catch (e) {
        listContainer.innerHTML = '<p style="text-align: center; color: red; font-size: 13px; padding: 20px;">Network Directory Error. Validate database configurations.</p>';
    }
};

export const renderSidebarList = () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const combinedRooms = { ...roomsInfo, ...dynamicDMs };

    Object.keys(combinedRooms).forEach(id => {
        const room = combinedRooms[id];
        let displayQualifies = false;

        if (appState.activeTab === 'all') displayQualifies = true;
        if (appState.activeTab === 'groups' && room.type === 'group') displayQualifies = true;

        if (displayQualifies) {
            const isActive = appState.activeChatId === id ? 'active' : '';
            const item = document.createElement('div');
            item.className = `user-item ${isActive}`;
            item.id = `btn-room-${id}`;
            
            if (room.type === 'group') {
                item.innerHTML = `
                    <div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div>
                    <div class="user-info"><h4>${room.name}</h4><p>Tap to view messages</p></div>
                `;
            } else {
                // Renders the ACTUAL profile picture in the sidebar
                const picSrc = room.pic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                item.innerHTML = `
                    <img src="${picSrc}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png'">
                    <div class="user-info"><h4>${room.name}</h4><p>Direct Message</p></div>
                `;
            }

            item.addEventListener('click', () => {
                document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                appState.activeChatId = id;
                document.getElementById('active-room-name').innerText = room.name;
                
                if (room.type === 'group') {
                    document.getElementById('active-room-icon-box').innerHTML = `<span id="active-room-icon" class="material-symbols-rounded">${room.icon}</span>`;
                } else {
                    document.getElementById('active-room-icon-box').innerHTML = `<img src="${room.pic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                }
                
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
        const myUid = currentUser?.id || currentUser?.uid;
        
        if (currentUser) {
            const myPic = currentUser.customProfilePic || currentUser.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            const navAvatar = document.getElementById('nav-profile-pic');
            if (navAvatar) navAvatar.src = myPic;
            
            const navName = document.getElementById('nav-profile-name');
            if (navName) navName.innerText = "Name: " + (currentUser.name || currentUser.fullName || "Authenticated User");
            
            const navEmail = document.getElementById('nav-profile-email');
            if (navEmail) navEmail.innerText = "Email: " + (currentUser.email || "No Email Bound");

            // Cloud Inbox Listener - Automatically syncs inbound DMs
            onSnapshot(collection(db, 'users', myUid, 'inbox'), (snapshot) => {
                let requiresRender = false;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const roomId = data.roomId;
                    if (!dynamicDMs[roomId]) {
                        dynamicDMs[roomId] = { name: data.senderName, pic: data.senderPic, type: 'dm', targetUid: doc.id };
                        requiresRender = true;
                    }
                });
                if (requiresRender) {
                    saveDynamicDMs();
                    if (appState.activeTab === 'all') renderSidebarList();
                }
            });
        }
        
        initSettingsAndTheme();
        initNavigation();
        renderSidebarList();
        
        const defaultBtn = document.getElementById(`btn-room-global_channel`);
        if(defaultBtn) defaultBtn.click();
    });
});
