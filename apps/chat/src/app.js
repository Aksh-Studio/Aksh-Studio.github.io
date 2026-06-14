// src/app.js
import { db, collection, getDocs, onSnapshot, query, where, setDoc, doc, deleteDoc } from './firebase.js';
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom } from './chatEngine.js';

export const appState = { activeChatId: null, activeTab: 'all', isMobileChatOpen: false };

export const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group' },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group' }
};

export let dynamicRooms = {}; 

const listenToCloudRooms = () => {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    const q = query(collection(db, "chats"), where("participants", "array-contains", curId));
    
    onSnapshot(q, (snapshot) => {
        dynamicRooms = {}; 
        
        snapshot.forEach(docObj => {
            const data = docObj.data();
            
            // Allows Owner/Admins to visually edit System Channels
            if (docObj.id === 'global_channel' || docObj.id === 'aksh_help') {
                if(data.name) roomsInfo[docObj.id].name = data.name;
                if(data.icon) roomsInfo[docObj.id].icon = data.icon;
            } 
            else if (data.type === 'dm') {
                const otherId = data.participants.find(id => id !== curId);
                if (!otherId || otherId === curId) return; 
                
                const otherName = data.names[otherId] || 'User';
                if (otherName === currentUser.name || otherName === currentUser.email.split('@')[0]) return;
                
                dynamicRooms[docObj.id] = {
                    name: otherName,
                    icon: data.avatars[otherId] || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherName)}&background=00a884&color=fff`,
                    type: 'dm',
                    isImage: true 
                };
            }
            // INJECT CUSTOM GROUPS INTO SIDEBAR
            else if (data.type === 'group') {
                dynamicRooms[docObj.id] = {
                    name: data.name || 'Custom Group',
                    icon: data.icon || 'groups',
                    type: 'group',
                    isImage: !!(data.icon && data.icon.startsWith('http'))
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

const initNavigation = () => {
    const searchInput = document.getElementById('chat-search');
    
    // PURGE CALL FEATURES: Force hide the call rail button
    const callRailBtn = document.getElementById('rail-calls');
    if (callRailBtn) callRailBtn.style.display = 'none';

    document.getElementById('rail-chats')?.addEventListener('click', () => {
        document.getElementById('rail-chats')?.classList.add('active');
        const tabs = document.querySelector('.chat-tabs');
        if (tabs) tabs.style.display = 'flex';
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

    // --- CREATE NEW GROUP ---
    document.getElementById('btn-create-group')?.addEventListener('click', async () => {
        const groupName = prompt("Enter new Group Name:");
        if (!groupName) return;
        const curId = currentUser?.id || currentUser?.uid;
        const newGroupId = `group_${Date.now()}`;
        
        try {
            await setDoc(doc(db, "chats", newGroupId), {
                type: 'group',
                name: groupName,
                icon: 'groups',
                participants: [curId],
                admins: [curId], // Creator gets specific Group Admin privileges
                createdBy: curId,
                createdAt: Date.now()
            });
            
            // Auto-Switch to new group
            appState.activeChatId = newGroupId;
            document.getElementById('active-room-name').innerText = groupName;
            document.getElementById('active-room-icon').innerText = 'groups';
            switchChatRoom(newGroupId);
            alert("Group created! Click the Gear icon next to the Group Name to add members.");
        } catch(e) { console.error(e); alert("Database Permission Error."); }
    });
};

const fetchNetworkUsers = async () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Scanning Network...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        listContainer.innerHTML = '';
        
        const myUid = String(currentUser?.id || "").trim();
        const myEmail = String(currentUser?.email || "").toLowerCase().trim();

        querySnapshot.forEach((docObj) => {
            const u = docObj.data();
            const targetUid = String(docObj.id).trim();
            const targetEmail = String(u.email || "").toLowerCase().trim();
            
            if (targetUid === myUid || (targetEmail === myEmail && myEmail !== "")) return; 
            
            const name = u.fullName || u.firstName || u.name || (u.email ? u.email.split('@')[0] : 'Network User');
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
                        type: 'dm', participants: [myUid, targetUid],
                        names: { [myUid]: currentUser.name, [targetUid]: name },
                        avatars: { [myUid]: myPic, [targetUid]: pic }
                    }, { merge: true });
                } catch(e) {}

                appState.activeChatId = deterministicId;
                document.getElementById('active-room-name').innerText = name;
                document.getElementById('active-room-icon').innerText = 'person';
                
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                switchChatRoom(deterministicId);
            });
            listContainer.appendChild(item);
        });
    } catch (e) {
        listContainer.innerHTML = '<p style="text-align: center; color: red;">Network Directory Error.</p>';
    }
};

window.deleteSidebarChat = async (roomId) => {
    if (confirm("Permanently delete this chat history for everyone?")) {
        try {
            await deleteDoc(doc(db, "chats", roomId));
            if (appState.activeChatId === roomId) {
                appState.activeChatId = null;
                document.getElementById('chat-messages-container').innerHTML = '';
                document.getElementById('active-room-name').innerText = 'Select a chat';
                document.getElementById('active-room-icon').innerText = 'chat';
            }
        } catch(e) { alert("Delete failed. Check permissions."); }
    }
};

export const renderSidebarList = () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const combinedRooms = { ...roomsInfo, ...dynamicRooms };

    Object.keys(combinedRooms).forEach(id => {
        const room = combinedRooms[id];
        let displayQualifies = false;

        if (room.type === 'dm' && (room.name === currentUser.name || room.name === currentUser.email.split('@')[0])) return;

        if (appState.activeTab === 'all') displayQualifies = true;
        if (appState.activeTab === 'groups' && room.type === 'group') displayQualifies = true;
        if (appState.activeTab === 'unread' && room.unread) displayQualifies = true;

        if (displayQualifies) {
            const isActive = appState.activeChatId === id ? 'active' : '';
            const item = document.createElement('div');
            item.className = `user-item ${isActive}`;
            item.id = `btn-room-${id}`;
            item.style.position = 'relative'; 
            
            const deleteActionHTML = room.type === 'dm' ? `
                <div class="chat-menu-trigger" onclick="event.stopPropagation(); window.deleteSidebarChat('${id}')" style="position: absolute; right: 15px; top: 15px; color: var(--text-muted); display: none; z-index: 10;" title="Delete Chat">
                    <span class="material-symbols-rounded">keyboard_arrow_down</span>
                </div>
            ` : '';

            if (room.isImage) {
                item.innerHTML = `
                    <img src="${room.icon}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(room.name)}&background=00a884&color=fff'">
                    <div class="user-info"><h4>${room.name}</h4><p>Direct Message</p></div>
                    ${deleteActionHTML}
                `;
            } else {
                item.innerHTML = `
                    <div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div>
                    <div class="user-info"><h4>${room.name}</h4><p>Tap to view messages</p></div>
                `;
            }

            item.addEventListener('mouseenter', () => { const trigger = item.querySelector('.chat-menu-trigger'); if(trigger) trigger.style.display = 'block'; });
            item.addEventListener('mouseleave', () => { const trigger = item.querySelector('.chat-menu-trigger'); if(trigger) trigger.style.display = 'none'; });

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
            const myPic = currentUser.customProfilePic || currentUser.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
            const navAvatar = document.getElementById('nav-profile-pic');
            if (navAvatar) { navAvatar.src = myPic; navAvatar.style.display = "block"; }
            
            const navName = document.getElementById('nav-profile-name');
            if (navName) navName.innerText = "Name: " + (currentUser.name || currentUser.fullName || "User");
            
            listenToCloudRooms(); 
        }
        initSettingsAndTheme();
        initNavigation();
        renderSidebarList();
        
        const defaultBtn = document.getElementById(`btn-room-global_channel`);
        if(defaultBtn) defaultBtn.click();
    });
});
