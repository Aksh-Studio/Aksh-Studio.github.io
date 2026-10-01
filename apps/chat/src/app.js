import { db, collection, getDocs, onSnapshot, query, setDoc, doc, getDoc, updateDoc } from './firebase.js';
import { initAuth, currentUser } from './auth.js';
import { switchChatRoom, leaveChatRoom, sendMessage } from './chatEngine.js';
import { initHelpEngine } from './help/helpEngine.js';
import { initGlobalSettings } from './advancedEngine.js';
import { initGroupEngine } from './groupEngine.js';
import { initMediaEngine } from './mediaEngine.js';

export const appState = { activeChatId: null, activeTab: 'all', isMobileChatOpen: false };
window.appState = appState;
window.currentUserAuth = currentUser;
window.isTargetOwner = false; 

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
                if (data.name) roomsInfo[roomId].name = data.name;
                if (data.icon) {
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
                const isTargetOwner = data.emails && data.emails[otherId] === 'akshat124.am12@gmail.com';

                dynamicRooms[roomId] = {
                    name: otherNameRaw,
                    icon: data.avatars?.[otherId] || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherNameRaw)}&background=00a884&color=fff`,
                    type: 'dm',
                    isImage: true,
                    unread: isUnread,
                    isTargetOwner: isTargetOwner,
                    lastMessageTime: roomLastMsgTime,
                    clearedAt: data[`clearedAt_${curId}`] || 0,
                    deletedForMe: data[`deletedFor_${curId}`] === true
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
                    clearedAt: data[`clearedAt_${curId}`] || 0,
                    deletedForMe: data[`deletedFor_${curId}`] === true
                };
            }
        });
        renderSidebarList(); 
    }, (error) => { /* Suppressed intentionally */ });
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
        if (!curId) return;

        const newGroupId = `group_${Date.now()}`;
        
        try {
            await setDoc(doc(db, "chats", newGroupId), {
                type: 'group', name: groupName, icon: 'groups',
                participants: [curId], admins: [curId], 
                createdBy: curId, createdAt: Date.now(),
                lastMessageTime: Date.now(),
                lastMessageSenderId: curId,
                [`deletedFor_${curId}`]: false
            });
            
            appState.activeChatId = newGroupId;
            switchChatRoom(newGroupId, groupName, 'groups', 'group');
            alert("Group created! Click the Settings gear in the header to manage members.");
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
        const myUid = String(currentUser?.id || currentUser?.uid || "").trim();
        const allNetworkUsers = new Map(); 

        querySnapshot.forEach((docObj) => {
            const u = docObj.data();
            const targetUid = String(docObj.id).trim();
            const safeEmail = String(u.email || '').toLowerCase().trim();
            const rawName = (u.fullName || u.name || u.firstName || (safeEmail ? safeEmail.split('@')[0] : 'Network User')).trim();
            
            if (targetUid === myUid || !rawName) return; 
            
            allNetworkUsers.set(targetUid, {
                uid: targetUid, name: rawName, email: safeEmail,
                pic: u.customProfilePic || u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=00a884&color=fff`
            });
        });

        Object.keys(dynamicRooms).forEach(roomId => {
            const room = dynamicRooms[roomId];
            if (room.type === 'dm') {
                const targetUid = roomId.replace('dm_', '').replace(myUid, '').replace('_', '');
                if (targetUid && targetUid !== myUid && !allNetworkUsers.has(targetUid)) {
                    allNetworkUsers.set(targetUid, {
                        uid: targetUid, name: room.name, email: '', pic: room.icon
                    });
                }
            }
        });

        const regularUsers = [];
        let ownerUser = null;
        Array.from(allNetworkUsers.values()).forEach(user => {
            if (user.email === 'akshat124.am12@gmail.com') ownerUser = user;
            else regularUsers.push(user);
        });

        regularUsers.sort((a, b) => a.name.localeCompare(b.name));
        const sortedUsers = ownerUser ? [ownerUser, ...regularUsers] : regularUsers;

        sortedUsers.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-item';
            const isOwnerTag = user.email === 'akshat124.am12@gmail.com' ? ' <span style="color:var(--primary); font-size:11px; font-weight:700; margin-left: 5px;">(Owner)</span>' : '';

            item.innerHTML = `
                <img src="${user.pic}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00a884&color=fff'">
                <div class="user-info">
                    <h4 style="display: flex; align-items: center;">${user.name}${isOwnerTag}</h4>
                    <p style="font-size:12px; color: var(--text-muted);">Tap to start private chat</p>
                </div>
            `;

            item.addEventListener('click', async () => {
                const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
                const isTargetOwner = user.email === 'akshat124.am12@gmail.com';
                const deterministicId = myUid < user.uid ? `dm_${myUid}_${user.uid}` : `dm_${user.uid}_${myUid}`;
                const myPic = currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`;

                if (!isCurrentOwner && isTargetOwner) {
                    try {
                        const checkDoc = await getDoc(doc(db, "chats", deterministicId));
                        if (!checkDoc.exists()) {
                            alert("You cannot initiate a chat with the App Owner.");
                            return; 
                        }
                    } catch(e) {}
                }

                try {
                    const chatRef = doc(db, "chats", deterministicId);
                    const chatDoc = await getDoc(chatRef);
                    if (!chatDoc.exists()) {
                        // FIX: Hide the chat for the recipient until a message is actually sent!
                        await setDoc(chatRef, {
                            type: 'dm', participants: [myUid, user.uid],
                            [`deletedFor_${myUid}`]: false,
                            [`deletedFor_${user.uid}`]: true, 
                            names: { [myUid]: currentUser.name, [user.uid]: user.name },
                            emails: { [myUid]: String(currentUser.email).toLowerCase(), [user.uid]: user.email }, 
                            avatars: { [myUid]: myPic, [user.uid]: user.pic },
                            lastMessageTime: 0
                        });
                    } else {
                        await updateDoc(chatRef, { [`deletedFor_${myUid}`]: false });
                    }
                } catch(e) {}

                appState.activeChatId = deterministicId;
                appState.isMobileChatOpen = true;
                document.getElementById('main-layout').classList.add('mobile-chat-active');
                
                const searchInput = document.getElementById('chat-search');
                if (searchInput) { searchInput.value = ''; searchInput.placeholder = "Search"; }
                
                switchChatRoom(deterministicId, user.name, user.pic, 'dm');
            });
            listContainer.appendChild(item);
        });
        
        if (sortedUsers.length === 0) listContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No network users found.</p>';
    } catch (e) { listContainer.innerHTML = '<p style="text-align: center; color: red;">Network Directory Error.</p>'; }
};

export const renderSidebarList = () => {
    const listContainer = document.getElementById('dynamic-user-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const combinedRooms = { ...roomsInfo, ...dynamicRooms };
    const myName = String(currentUser.name || "").toLowerCase().trim();

    const sortedRoomIds = Object.keys(combinedRooms).sort((a, b) => {
        const timeA = combinedRooms[a].lastMessageTime || 0;
        const timeB = combinedRooms[b].lastMessageTime || 0;
        return timeB - timeA;
    });

    sortedRoomIds.forEach(id => {
        const room = combinedRooms[id];
        let displayQualifies = false;

        // Hide chat if deleted for me
        if (room.deletedForMe) return;

        if (room.type === 'dm') {
            const roomNameLower = String(room.name).toLowerCase().trim();
            if (roomNameLower === myName || room.name === currentUser.email?.split('@')[0]) return;
            // Also hide if empty (0 messages) and you didn't initiate it
            if (room.lastMessageTime === 0 && room.deletedForMe !== false) return; 
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
            
            const nameStyle = room.unread ? 'font-weight: 700; color: var(--primary);' : 'color: var(--text-main);';
            const badgeHTML = room.unread ? `<div style="width: 10px; height: 10px; background: var(--primary); border-radius: 50%; position: absolute; right: 15px; top: 50%; transform: translateY(-50%);"></div>` : '';
            const ownerBadge = room.isTargetOwner ? ' <span style="color:var(--primary); font-size:10px; font-weight:700; margin-left:5px;">(Owner)</span>' : '';

            if (room.isImage) {
                item.innerHTML = `<img src="${room.icon}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(room.name)}&background=00a884&color=fff'"><div class="user-info"><h4 style="${nameStyle}; display:flex; align-items:center;">${room.name}${ownerBadge}</h4><p>${room.type === 'dm' ? 'Direct Message' : 'Group Chat'}</p></div>${badgeHTML}`;
            } else {
                item.innerHTML = `<div class="global-icon-box"><span class="material-symbols-rounded">${room.icon}</span></div><div class="user-info"><h4 style="${nameStyle}; display:flex; align-items:center;">${room.name}${ownerBadge}</h4><p>Tap to view messages</p></div>${badgeHTML}`;
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
            
            const curId = currentUser.id || currentUser.uid;
            if (curId) {
                getDoc(doc(db, "users", curId)).then(uDoc => {
                    if (uDoc.exists() && uDoc.data().wallpaper) {
                        const mainPanel = document.querySelector('.chat-main');
                        if (mainPanel) {
                            mainPanel.style.backgroundImage = `url(${uDoc.data().wallpaper})`;
                            mainPanel.style.backgroundSize = "cover";
                        }
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
            if (defaultBtn && window.innerWidth > 900) {
                defaultBtn.click();
            }
        }, 300);
    });
});
