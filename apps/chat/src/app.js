// src/app.js
import { db, collection, getDocs, onSnapshot, query, where, setDoc, doc } from './firebase.js';
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom } from './chatEngine.js';

export const appState = { activeChatId: null, activeTab: 'all', isMobileChatOpen: false };

export const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group' },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group' }
};

export let dynamicDMs = {}; 

const listenToCloudDMs = () => {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    const q = query(collection(db, "chats"), where("participants", "array-contains", curId));
    
    onSnapshot(q, (snapshot) => {
        snapshot.forEach(docObj => {
            const data = docObj.data();
            if (data.type === 'dm') {
                const otherId = data.participants.find(id => id !== curId);
                
                // NUCLEAR FILTER: Block self-chats if they slipped into the database
                if (!otherId || otherId === curId) return; 
                
                const otherName = data.names[otherId] || 'User';
                if (otherName === currentUser.name || otherName === currentUser.email.split('@')[0]) return;
                
                dynamicDMs[docObj.id] = {
                    name: otherName,
                    icon: data.avatars[otherId] || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherName)}&background=00a884&color=fff`,
                    type: 'dm',
                    isImage: true 
                };
            }
        });
        renderSidebarList(); 
    });
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
        const targetPanel = document.getElementById('chat-main-panel');
        if (targetPanel) {
            targetPanel.style.backgroundImage = `url(${savedWallpaper})`;
            targetPanel.style.backgroundSize = 'cover';
            targetPanel.style.backgroundPosition = 'center';
        }
    }

    document.getElementById('btn-settings')?.addEventListener('click', () => {
        const hasWallpaper = !!localStorage.getItem('chat_wallpaper');
        let optionsMsg = "Settings Menu:\n\nEnter a direct image URL to set a new chat background.";
        if (hasWallpaper) optionsMsg += "\n\nType the word 'REMOVE' in the box below to wipe out your custom wallpaper.";
        
        const userInput = prompt(optionsMsg);
        if (userInput === null) return; 
        
        const targetPanel = document.getElementById('chat-main-panel');
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

export const renderCallLogs = () => {
    const logs = JSON.parse(localStorage.getItem('call_logs')) || [];
    const listContainer = document.getElementById('dynamic-user-list');
    
    if (logs.length === 0) {
        listContainer.innerHTML = `
            <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
                <span class="material-symbols-rounded" style="font-size: 48px; margin-bottom: 12px; color: var(--text-muted);">call_log</span>
                <p style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: var(--text-main);">No Call Logs Available</p>
                <p style="font-size: 12px; max-width: 220px; margin: 0 auto;">Your incoming and outgoing WebRTC logs will appear here.</p>
            </div>`;
    } else {
        listContainer.innerHTML = '';
        logs.reverse().forEach(log => {
            const icon = log.type === 'Video' ? 'videocam' : 'call';
            const color = log.status === 'Outgoing' ? '#00a884' : '#ea0038';
            listContainer.innerHTML += `
                <div class="user-item">
                    <div class="global-icon-box" style="background: transparent; color: ${color};"><span class="material-symbols-rounded">${icon}</span></div>
                    <div class="user-info">
                        <h4>${log.target}</h4>
                        <p style="font-size: 12px;">${log.date} • ${log.status}</p>
                    </div>
                </div>`;
        });
    }
};

const initNavigation = () => {
    const searchInput = document.getElementById('chat-search');
    
    document.getElementById('rail-calls')?.addEventListener('click', () => {
        document.getElementById('rail-chats')?.classList.remove('active');
        document.getElementById('rail-calls')?.classList.add('active');
        const headerTitle = document.getElementById('sidebar-chats')?.querySelector('h2');
        if (headerTitle) headerTitle.innerText = "Calls";
        
        const tabs = document.querySelector('.chat-tabs');
        if (tabs) tabs.style.display = 'none';
        
        appState.activeTab = 'calls';
        renderCallLogs();
    });

    document.getElementById('rail-chats')?.addEventListener('click', () => {
        document.getElementById('rail-calls')?.classList.remove('active');
        document.getElementById('rail-chats')?.classList.add('active');
        const headerTitle = document.getElementById('sidebar-chats')?.querySelector('h2');
        if (headerTitle) headerTitle.innerText = "Chats";
        
        const tabs = document.querySelector('.chat-tabs');
        if (tabs) tabs.style.display = 'flex';
        
        const allTabBtn = document.querySelector('[data-tab="all"]');
        if (allTabBtn) {
            document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
            allTabBtn.classList.add('active');
        }
        appState.activeTab = 'all';
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
        
        const myUid = String(currentUser?.id || "").trim();
        const myEmail = String(currentUser?.email || "").toLowerCase().trim();

        querySnapshot.forEach((docObj) => {
            const u = docObj.data();
            const targetUid = String(docObj.id).trim();
            const targetEmail = String(u.email || "").toLowerCase().trim();
            
            // NUCLEAR DOUBLE-FILTER: Blocks your exact UID AND your exact Email from appearing
            if (targetUid === myUid || (targetEmail === myEmail && myEmail !== "")) return; 
            
            const name = u.fullName || u.firstName || u.name || (u.email ? u.email.split('@')[0] : 'Network User');
            // Generates a clean profile picture initial badge if they don't have a custom photo
            const pic = u.customProfilePic || u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a884&color=fff`;
            
            const item = document.createElement('div');
            item.className = 'user-item';
            item.innerHTML = `
                <img src="${pic}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00a884&color=fff'">
                <div class="user-info">
                    <h4>${name}</h4>
                    <p style="font-size:12px; color: var(--text-muted);">Tap to start private chat</p>
                </div>
            `;

            item.addEventListener('click', async () => {
                const deterministicId = myUid < targetUid ? `dm_${myUid}_${targetUid}` : `dm_${targetUid}_${myUid}`;
                const myPic = currentUser.customProfilePic || currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`;
                
                try {
                    await setDoc(doc(db, "chats", deterministicId), {
                        type: 'dm',
                        participants: [myUid, targetUid],
                        names: { [myUid]: currentUser.name, [targetUid]: name },
                        avatars: { [myUid]: myPic, [targetUid]: pic }
                    }, { merge: true });
                } catch(e) { console.error("Cloud Handshake Failed:", e); }

                appState.activeChatId = deterministicId;
                document.getElementById('active-room-name').innerText = name;
                document.getElementById('active-room-icon').innerText = 'person';
                
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                
                const allTabBtn = document.querySelector('[data-tab="all"]');
                if (allTabBtn) {
                    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
                    allTabBtn.classList.add('active');
                }
                appState.activeTab = 'all';
                switchChatRoom(deterministicId);
            });
            listContainer.appendChild(item);
        });
    } catch (e) {
        listContainer.innerHTML = '<p style="text-align: center; color: red; font-size: 13px; padding: 20px;">Network Directory Error. Validate database configurations.</p>';
    }
};

export const renderSidebarList = () => {
    if (appState.activeTab === 'calls') return renderCallLogs();

    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const combinedRooms = { ...roomsInfo, ...dynamicDMs };

    Object.keys(combinedRooms).forEach(id => {
        const room = combinedRooms[id];
        let displayQualifies = false;

        // Ensure leftover self-chats in cache are permanently hidden
        if (room.type === 'dm' && (room.name === currentUser.name || room.name === currentUser.email.split('@')[0])) return;

        if (appState.activeTab === 'all') displayQualifies = true;
        if (appState.activeTab === 'groups' && room.type === 'group') displayQualifies = true;
        if (appState.activeTab === 'unread' && room.unread) displayQualifies = true;

        if (displayQualifies) {
            const isActive = appState.activeChatId === id ? 'active' : '';
            const item = document.createElement('div');
            item.className = `user-item ${isActive}`;
            item.id = `btn-room-${id}`;
            
            if (room.isImage) {
                item.innerHTML = `
                    <img src="${room.icon}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(room.name)}&background=00a884&color=fff'">
                    <div class="user-info"><h4>${room.name}</h4><p>Direct Message</p></div>
                `;
            } else {
                item.innerHTML = `
                    <div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div>
                    <div class="user-info"><h4>${room.name}</h4><p>Tap to view messages</p></div>
                `;
            }

            item.addEventListener('click', () => {
                document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                appState.activeChatId = id;
                document.getElementById('active-room-name').innerText = room.name;
                document.getElementById('active-room-icon').innerText = room.type === 'group' ? room.icon : 'person';
                
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
        if (currentUser) {
            listenToCloudDMs(); 
        }
        
        initSettingsAndTheme();
        initNavigation();
        renderSidebarList();
        
        const defaultBtn = document.getElementById(`btn-room-global_channel`);
        if(defaultBtn) defaultBtn.click();
    });
});
