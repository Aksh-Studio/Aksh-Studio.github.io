// src/app.js
import { db, collection, getDocs, onSnapshot, query, where, setDoc, doc, deleteDoc } from './firebase.js';
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom } from './chatEngine.js';

export const appState = { activeChatId: null, activeTab: 'all', isMobileChatOpen: false };

export const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group', isImage: false },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group', isImage: false }
};

export let dynamicRooms = {}; 
window.getAvailableRooms = () => { return { ...roomsInfo, ...dynamicRooms }; }; 

const listenToCloudRooms = () => {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    onSnapshot(collection(db, "chats"), (snapshot) => {
        dynamicRooms = {}; 
        const myName = String(currentUser.name || "").toLowerCase().trim();
        
        snapshot.forEach(docObj => {
            const data = docObj.data();
            const roomId = docObj.id;
            
            if (roomId === 'global_channel' || roomId === 'aksh_help') {
                if(data.name) roomsInfo[roomId].name = data.name;
                if(data.icon) {
                    roomsInfo[roomId].icon = data.icon;
                    roomsInfo[roomId].isImage = data.icon.startsWith('http') || data.icon.startsWith('data:image');
                }
            } 
            else if (data.type === 'dm' && data.participants?.includes(curId)) {
                const otherId = data.participants.find(id => id !== curId);
                if (!otherId || otherId === curId) return; 
                
                const otherNameRaw = data.names[otherId] || 'User';
                dynamicRooms[roomId] = {
                    name: otherNameRaw,
                    icon: data.avatars[otherId] || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherNameRaw)}&background=00a884&color=fff`,
                    type: 'dm',
                    isImage: true 
                };
            }
            else if (data.type === 'group' && data.participants?.includes(curId)) {
                dynamicRooms[roomId] = {
                    name: data.name || 'Custom Group',
                    icon: data.icon || 'groups',
                    type: 'group',
                    isImage: !!(data.icon && (data.icon.startsWith('data:image') || data.icon.startsWith('http')))
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
        }
    }
};

const initNavigation = () => {
    const searchInput = document.getElementById('chat-search');
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            document.querySelectorAll('#dynamic-user-list .user-item').forEach(item => {
                const name = item.querySelector('.user-info h4').innerText.toLowerCase();
                item.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });
    }

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
            
            if (searchInput) searchInput.value = ''; 
            
            if (appState.activeTab === 'network') {
                if (searchInput) searchInput.placeholder = "Search Network...";
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

    document.getElementById('btn-create-group')?.addEventListener('click', async () => {
        const groupName = prompt("Enter new Group Name:");
        if (!groupName) return;
        const curId = currentUser?.id || currentUser?.uid;
        const newGroupId = `group_${Date.now()}`;
        
        try {
            await setDoc(doc(db, "chats", newGroupId), {
                type: 'group', name: groupName, icon: 'groups',
                participants: [curId], admins: [curId], 
                createdBy: curId, createdAt: Date.now()
            });
            
            appState.activeChatId = newGroupId;
            switchChatRoom(newGroupId);
            alert("Group created! Click the Gear icon to upload a logo and add members.");
        } catch(e) {}
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
        const myName = String(currentUser?.name || "").toLowerCase().trim();

        querySnapshot.forEach((docObj) => {
            const u = docObj.data();
            const targetUid = String(docObj.id).trim();
            const safeEmail = String(u.email || '');
            const targetEmail = safeEmail.toLowerCase().trim();
            const rawName = u.fullName || u.firstName || u.name || (safeEmail ? safeEmail.split('@')[0] : 'Network User');
            const targetNameLower = String(rawName).toLowerCase().trim();
            
            if (targetUid === myUid) return; 
            if (targetEmail === myEmail && myEmail !== "") return; 
            if (targetNameLower === myName && myName !== "") return;
            if (currentUser.isOwner && targetEmail === 'akshat124.am12@gmail.com') return;
            
            const pic = u.customProfilePic || u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=00a884&color=fff`;
            
            const item = document.createElement('div');
            item.className = 'user-item';
            item.innerHTML = `
                <img src="${pic}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=00a884&color=fff'">
                <div class="user-info">
                    <h4>${rawName}</h4>
                    <p style="font-size:12px; color: var(--text-muted);">Tap to start private chat</p>
                </div>
            `;

            item.addEventListener('click', async () => {
                const deterministicId = myUid < targetUid ? `dm_${myUid}_${targetUid}` : `dm_${targetUid}_${myUid}`;
                const myPic = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`;
                
                try {
                    await setDoc(doc(db, "chats", deterministicId), {
                        type: 'dm', participants: [myUid, targetUid],
                        names: { [myUid]: currentUser.name, [targetUid]: rawName },
                        avatars: { [myUid]: myPic, [targetUid]: pic }
                    }, { merge: true });
                } catch(e) {}

                appState.activeChatId = deterministicId;
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                
                const searchInput = document.getElementById('chat-search');
                if (searchInput) { searchInput.value = ''; searchInput.placeholder = "Search"; }
                
                switchChatRoom(deterministicId);
            });
            listContainer.appendChild(item);
        });
    } catch (e) {}
};

window.deleteSidebarChat = async (roomId) => {
    if (confirm("Permanently delete this chat history for everyone?")) {
        try {
            await deleteDoc(doc(db, "chats", roomId));
            if (appState.activeChatId === roomId) {
                appState.activeChatId = null;
                document.getElementById('chat-messages-container').innerHTML = '';
                document.getElementById('active-room-name').innerText = 'Select a chat';
                const iconBox = document.getElementById('active-room-icon-box');
                if (iconBox) {
                    iconBox.style.background = '#dfe5e7';
                    iconBox.innerHTML = `<span class="material-symbols-rounded">chat</span>`;
                }
            }
        } catch(e) { alert("Delete failed. Check permissions."); }
    }
};

export const renderSidebarList = () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const combinedRooms = { ...roomsInfo, ...dynamicRooms };
    const myName = String(currentUser.name || "").toLowerCase().trim();

    Object.keys(combinedRooms).forEach(id => {
        const room = combinedRooms[id];
        let displayQualifies = false;

        if (room.type === 'dm') {
            const roomNameLower = String(room.name).toLowerCase().trim();
            if (roomNameLower === myName || room.name === currentUser.email.split('@')[0]) return;
        }

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
                    <div class="user-info"><h4>${room.name}</h4><p>${room.type === 'dm' ? 'Direct Message' : 'Group Chat'}</p></div>
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
        if (currentUser) listenToCloudRooms(); 
        initSettingsAndTheme();
        initNavigation();
        renderSidebarList();
        
        const defaultBtn = document.getElementById(`btn-room-global_channel`);
        if(defaultBtn) defaultBtn.click();
    });
});
