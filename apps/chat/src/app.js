import { db, collection, getDocs, onSnapshot, query, setDoc, doc, getDoc } from './firebase.js';
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom, leaveChatRoom, sendMessage } from './chatEngine.js';
import { initHelpEngine } from './help/helpEngine.js';
import { initGlobalSettings } from './advancedEngine.js';
import { initGroupEngine } from './groupEngine.js';
import { initMediaEngine } from './mediaEngine.js';

export const appState = { activeChatId: null, activeTab: 'all', isMobileChatOpen: false };
window.appState = appState;
window.currentUserAuth = currentUser;

export const roomsInfo = {
    'global_channel': { name: 'Global Channel', icon: 'public', type: 'group', isImage: false },
    'aksh_help': { name: 'Aksh Help Centre', icon: 'support_agent', type: 'group', isImage: false }
};

export let dynamicRooms = {}; 
window.getAvailableRooms = () => { return { ...roomsInfo, ...dynamicRooms }; }; 

const style = document.createElement('style');
style.innerHTML = `#rail-calls, #btn-start-audio-call, #btn-start-video-call { display: none !important; opacity: 0 !important; pointer-events: none !important; width: 0 !important; height: 0 !important; }`;
document.head.appendChild(style);

const listenToCloudRooms = () => {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    setDoc(doc(db, "users", curId), {
        email: currentUser.email || '',
        fullName: currentUser.name || 'User',
        photoURL: currentUser.photoURL || ''
    }, { merge: true }).catch(()=>{});

    onSnapshot(collection(db, "chats"), (snapshot) => {
        dynamicRooms = {}; 
        const myName = String(currentUser.name || "").toLowerCase().trim();
        
        snapshot.forEach(docObj => {
            const data = docObj.data();
            const roomId = docObj.id;
            
            let isUnread = false;
            let roomLastMsgTime = data.lastMessageTime || 0;

            if (data.lastMessageTime && data.readReceipts && data.lastMessageSenderId !== curId) {
                const myReceipt = data.readReceipts[curId];
                let rTime = 0;
                if (myReceipt && typeof myReceipt.toMillis === 'function') rTime = myReceipt.toMillis();
                else if (typeof myReceipt === 'number') rTime = myReceipt;
                if (data.lastMessageTime > rTime) isUnread = true;
            }

            if (roomId === 'global_channel' || roomId === 'aksh_help') {
                if(data.name) roomsInfo[roomId].name = data.name;
                if(data.icon) {
                    roomsInfo[roomId].icon = data.icon;
                    roomsInfo[roomId].isImage = data.icon.startsWith('http') || data.icon.startsWith('data:image');
                }
                roomsInfo[roomId].unread = isUnread;
                roomsInfo[roomId].lastMessageTime = roomLastMsgTime;
            } 
            else if (data.type === 'dm' && Array.isArray(data.participants) && data.participants.includes(curId)) {
                const otherId = data.participants.find(id => id !== curId);
                if (!otherId || otherId === curId) return; 
                
                const otherNameRaw = data.names?.[otherId] || 'User';
                dynamicRooms[roomId] = {
                    name: otherNameRaw,
                    icon: data.avatars?.[otherId] || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherNameRaw)}&background=00a884&color=fff`,
                    type: 'dm',
                    isImage: true,
                    unread: isUnread,
                    lastMessageTime: roomLastMsgTime,
                    clearedAt: data[`clearedAt_${curId}`] || 0
                };
            }
            else if (data.type === 'group' && Array.isArray(data.participants) && data.participants.includes(curId)) {
                dynamicRooms[roomId] = {
                    name: data.name || 'Custom Group',
                    icon: data.icon || 'groups',
                    type: 'group',
                    isImage: !!(data.icon && (data.icon.startsWith('data:image') || data.icon.startsWith('http'))),
                    unread: isUnread,
                    lastMessageTime: roomLastMsgTime,
                    clearedAt: data[`clearedAt_${curId}`] || 0
                };
            }
        });
        renderSidebarList(); 
    });
};

const initThemeAndListeners = () => {
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
        leaveChatRoom(); 
    });

    document.getElementById('btn-create-group')?.addEventListener('click', async () => {
        const groupName = prompt("Enter new Group Name:");
        if (!groupName) return;
        const curId = currentUser?.id || currentUser?.uid;
        if(!curId) return;

        const newGroupId = `group_${Date.now()}`;
        
        try {
            await setDoc(doc(db, "chats", newGroupId), {
                type: 'group', name: groupName, icon: 'groups',
                participants: [curId], admins: [curId], 
                createdBy: curId, createdAt: Date.now(),
                lastMessageTime: Date.now(),
                lastMessageSenderId: curId
            });
            
            appState.activeChatId = newGroupId;
            switchChatRoom(newGroupId, groupName, 'groups', 'group');
            alert("Group created! Click the Gear icon to upload a logo and add members.");
        } catch(e) {
            console.error("Group creation failed:", e);
        }
    });
};

const fetchNetworkUsers = async () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Scanning Network...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        listContainer.innerHTML = '';
        const myUid = String(currentUser?.id || currentUser?.uid || "").trim();
        const allNetworkUsers = new Map(); 

        querySnapshot.forEach((docObj) => {
            const u = docObj.data();
            const targetUid = String(docObj.id).trim();
            const safeEmail = String(u.email || '').toLowerCase().trim();
            const rawName = (u.fullName || u.name || u.firstName || (safeEmail ? safeEmail.split('@')[0] : 'Network User')).trim();
            
            if (targetUid === myUid || !rawName) return; 
            
            allNetworkUsers.set(targetUid, {
                uid: targetUid, name: rawName,
                pic: u.customProfilePic || u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=00a884&color=fff`
            });
        });

        const sortedUsers = Array.from(allNetworkUsers.values()).sort((a, b) => a.name.localeCompare(b.name));

        sortedUsers.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-item';
            item.innerHTML = `<img src="${user.pic}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;"><div class="user-info"><h4>${user.name}</h4><p style="font-size:12px; color: var(--text-muted);">Tap to start private chat</p></div>`;

            item.addEventListener('click', async () => {
                const deterministicId = myUid < user.uid ? `dm_${myUid}_${user.uid}` : `dm_${user.uid}_${myUid}`;
                const myPic = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`;
                
                try {
                    await setDoc(doc(db, "chats", deterministicId), {
                        type: 'dm', participants: [myUid, user.uid],
                        names: { [myUid]: currentUser.name, [user.uid]: user.name },
                        avatars: { [myUid]: myPic, [user.uid]: user.pic }
                    }, { merge: true });
                } catch(e) {}

                appState.activeChatId = deterministicId;
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                switchChatRoom(deterministicId, user.name, user.pic, 'dm');
            });
            listContainer.appendChild(item);
        });
    } catch (e) { listContainer.innerHTML = '<p style="text-align: center; color: red;">Network Directory Error.</p>'; }
};

export const renderSidebarList = () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const combinedRooms = { ...roomsInfo, ...dynamicRooms };
    const myName = String(currentUser.name || "").toLowerCase().trim();

    const sortedRoomIds = Object.keys(combinedRooms).sort((a, b) => {
        return (combinedRooms[b].lastMessageTime || 0) - (combinedRooms[a].lastMessageTime || 0);
    });

    sortedRoomIds.forEach(id => {
        const room = combinedRooms[id];
        let displayQualifies = false;

        if (room.type === 'dm') {
            const roomNameLower = String(room.name).toLowerCase().trim();
            if (roomNameLower === myName || room.name === currentUser.email?.split('@')[0]) return;
        }

        if (appState.activeTab === 'all') displayQualifies = true;
        if (appState.activeTab === 'groups' && room.type === 'group') displayQualifies = true;
        if (appState.activeTab === 'unread' && room.unread) displayQualifies = true;

        if (displayQualifies) {
            const isActive = appState.activeChatId === id ? 'active' : '';
            const item = document.createElement('div');
            item.className = `user-item ${isActive}`;
            const nameStyle = room.unread ? 'font-weight: 700; color: var(--primary);' : 'color: var(--text-main);';
            const badgeHTML = room.unread ? `<div style="width: 10px; height: 10px; background: var(--primary); border-radius: 50%; position: absolute; right: 15px; top: 50%; transform: translateY(-50%);"></div>` : '';

            if (room.isImage) {
                item.innerHTML = `<img src="${room.icon}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;"><div class="user-info"><h4 style="${nameStyle}">${room.name}</h4><p>${room.type === 'dm' ? 'Direct Message' : 'Group Chat'}</p></div>${badgeHTML}`;
            } else {
                item.innerHTML = `<div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div><div class="user-info"><h4 style="${nameStyle}">${room.name}</h4><p>Tap to view messages</p></div>${badgeHTML}`;
            }

            item.addEventListener('click', () => {
                document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                appState.activeChatId = id;
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                switchChatRoom(id, room.name, room.icon, room.type);
            });
            listContainer.appendChild(item);
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    initAuth(() => {
        if (currentUser) {
            listenToCloudRooms(); 
            initHelpEngine(currentUser);
            initGlobalSettings(currentUser);
            initGroupEngine();
            initMediaEngine();
            
            const curId = currentUser.id || currentUser.uid;
            if (curId) {
                getDoc(doc(db, "users", curId)).then(uDoc => {
                    if(uDoc.exists() && uDoc.data().wallpaper) {
                        document.querySelector('.chat-main').style.backgroundImage = `url(${uDoc.data().wallpaper})`;
                        document.querySelector('.chat-main').style.backgroundSize = "cover";
                    }
                }).catch(()=>{});
            }
        }
        
        initThemeAndListeners();
        renderSidebarList();
        
        document.getElementById('btn-send-msg')?.addEventListener('click', sendMessage);
        document.getElementById('chat-input')?.addEventListener('keypress', (e) => { 
            if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } 
        });

        setTimeout(() => {
            const defaultBtn = document.getElementById(`btn-room-global_channel`);
            if(defaultBtn && window.innerWidth > 900) {
                defaultBtn.click();
            }
        }, 300);
    });
});
