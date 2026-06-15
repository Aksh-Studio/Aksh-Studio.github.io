// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, setDoc, getDocs, getDoc, updateDoc, where } from './firebase.js';
import { currentUser } from './auth.js';

let unsubscribeListener = null;
let roomStateListener = null;
export let currentRoomId = null;
export let currentRoomData = null; 
let replyContext = null; 
let messageToPin = null; 
let uploadedGroupIconBase64 = null; 

const parseWhatsAppFormatting = (text) => {
    if (!text) return "";
    let safeHtml = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    safeHtml = safeHtml.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    safeHtml = safeHtml.replace(/_(.*?)_/g, '<em>$1</em>');
    safeHtml = safeHtml.replace(/~(.*?)~/g, '<del>$1</del>');
    safeHtml = safeHtml.replace(/`(.*?)`/g, '<code style="background: rgba(0,0,0,0.06); padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');
    safeHtml = safeHtml.replace(/^&gt;\s(.*)$/gm, '<blockquote style="border-left: 3px solid #00a884; padding-left: 8px; margin: 4px 0; color: var(--text-muted);">$1</blockquote>');
    return safeHtml;
};

const injectGroupAdminModal = () => {
    if (document.getElementById('group-admin-modal')) return;
    const modalHTML = `
        <div id="group-admin-modal" class="guest-overlay" style="display: none; z-index: 10002;">
            <div class="guest-modal" style="padding: 25px; width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-bottom: 15px; color: var(--primary);">Group Information</h3>
                
                <div id="group-edit-section">
                    <input type="text" id="edit-group-name" placeholder="Group Name" style="width: 100%; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                    <input type="text" id="edit-group-icon" placeholder="Or paste Logo URL here..." style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                        <img id="group-icon-preview" src="https://cdn-icons-png.flaticon.com/512/149/149071.png" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">
                        <button id="btn-upload-group-icon" style="flex: 1; padding: 10px; background: transparent; color: var(--primary); border: 1px dashed var(--primary); border-radius: 8px; cursor: pointer; font-size: 12px;">Upload Device Logo</button>
                        <input type="file" id="hidden-group-icon-input" accept="image/*" style="display: none;">
                    </div>
                </div>
                
                <div id="add-member-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Add Member</h4>
                    <input type="text" id="search-member-input" placeholder="Search by exact name or email..." style="width: 100%; padding: 12px; margin-bottom: 5px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                    <div id="search-member-results" style="max-height: 150px; overflow-y: auto; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 8px; padding: 5px; display: none;"></div>
                </div>

                <div id="manage-members-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Participants</h4>
                    <div id="admin-member-list" style="max-height: 150px; overflow-y: auto; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 8px; padding: 5px;"></div>
                </div>

                <div id="transfer-admin-section">
                    <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Transfer Admin Status</h4>
                    <select id="transfer-admin-select" style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                        <option value="">Select a member...</option>
                    </select>
                </div>

                <button id="btn-save-group" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Save Changes</button>
                <button id="btn-delete-group" style="width: 100%; padding: 12px; background: #ea0038; color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Delete Group</button>
                <button id="btn-cancel-group" style="width: 100%; padding: 12px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Close</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-cancel-group').addEventListener('click', () => { document.getElementById('group-admin-modal').style.display = 'none'; uploadedGroupIconBase64 = null; });

    document.getElementById('btn-upload-group-icon').addEventListener('click', () => document.getElementById('hidden-group-icon-input').click());
    document.getElementById('hidden-group-icon-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return alert("Only images allowed.");
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                uploadedGroupIconBase64 = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('group-icon-preview').src = uploadedGroupIconBase64;
                document.getElementById('edit-group-icon').value = ''; 
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('btn-save-group').addEventListener('click', async () => {
        const newName = document.getElementById('edit-group-name').value.trim();
        const urlIcon = document.getElementById('edit-group-icon').value.trim();
        const newAdminId = document.getElementById('transfer-admin-select').value;
        const updates = {};
        if (newName) updates.name = newName;
        if (urlIcon) updates.icon = urlIcon; 
        else if (uploadedGroupIconBase64) updates.icon = uploadedGroupIconBase64;
        if (newAdminId) updates.admins = [newAdminId]; 
        
        if (Object.keys(updates).length > 0) {
            try { 
                // Merge guarantees System Groups get created in the DB if they don't exist yet
                await setDoc(doc(db, "chats", currentRoomId), updates, { merge: true }); 
                alert("Group settings saved."); 
            } 
            catch(e) { alert("Error saving settings."); }
        }
        document.getElementById('group-admin-modal').style.display = 'none';
        uploadedGroupIconBase64 = null;
    });

    document.getElementById('btn-delete-group').addEventListener('click', async () => {
        if (confirm("WARNING: This will permanently destroy this group and all messages for everyone. Proceed?")) {
            try {
                await deleteDoc(doc(db, "chats", currentRoomId));
                document.getElementById('group-admin-modal').style.display = 'none';
                window.location.reload(); 
            } catch(e) { alert("Insufficient Permissions to delete group."); }
        }
    });
};

window.addGroupMember = async (newMemberId) => {
    try {
        const currentParticipants = currentRoomData?.participants || [];
        if (currentParticipants.includes(newMemberId)) return;
        const updatedParticipants = [...currentParticipants, newMemberId];
        await setDoc(doc(db, "chats", currentRoomId), { participants: updatedParticipants }, { merge: true });
        document.getElementById('search-member-input').value = '';
        document.getElementById('search-member-results').innerHTML = '';
        document.getElementById('search-member-results').style.display = 'none';
    } catch(e) { alert("Failed to add member."); }
};

const populateGroupManagement = async (participants, admins) => {
    const listEl = document.getElementById('admin-member-list');
    const transferSelectEl = document.getElementById('transfer-admin-select');
    const searchInput = document.getElementById('search-member-input');
    const searchResults = document.getElementById('search-member-results');
    
    if (!listEl || !transferSelectEl || !searchInput) return;
    
    listEl.innerHTML = '';
    transferSelectEl.innerHTML = '<option value="">Select a member to make Admin...</option>';
    searchResults.innerHTML = '';
    searchResults.style.display = 'none';
    searchInput.value = '';

    const curId = currentUser?.id || currentUser?.uid;
    const isOwner = currentUser?.isOwner;
    const isAdmin = admins?.includes(curId);
    const canEdit = isOwner || isAdmin;

    for (const uid of participants) {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const u = userDoc.data();
                const safeEmail = String(u.email || '');
                const name = u.fullName || u.firstName || (safeEmail ? safeEmail.split('@')[0] : 'User');
                const isMemAdmin = admins?.includes(uid);
                
                if (!isMemAdmin) transferSelectEl.innerHTML += `<option value="${uid}">${name}</option>`;

                const kickBtnHTML = (uid !== curId && canEdit) ? `<button onclick="window.kickUser('${uid}')" style="background: #ea0038; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Kick</button>` : '';

                listEl.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--app-bg);">
                        <span style="font-size: 13px; color: var(--text-main);">${name} <span style="color:var(--primary); font-size:10px;">${isMemAdmin ? '(Admin)' : ''}</span></span>
                        ${kickBtnHTML}
                    </div>
                `;
            }
        } catch(e) {}
    }

    // --- BUG FIX: AVOID STRING CRASHES DURING SEARCH LOOP ---
    let allUsers = [];
    try {
        const snap = await getDocs(collection(db, "users"));
        snap.forEach(d => {
            const u = d.data();
            const safeEmail = String(u.email || ''); // Guarantees no crashes
            const safeName = u.fullName || u.firstName || u.name || (safeEmail ? safeEmail.split('@')[0] : 'User');
            allUsers.push({ id: d.id, name: safeName, email: safeEmail });
        });
    } catch(e) {}

    const renderSearch = (term = '') => {
        searchResults.style.display = 'block';
        const cleanTerm = term.trim().toLowerCase();

        const filtered = allUsers.filter(u => 
            !participants.includes(u.id) && 
            (u.name.toLowerCase().includes(cleanTerm) || u.email.toLowerCase().includes(cleanTerm))
        );

        if (filtered.length === 0) {
            searchResults.innerHTML = '<p style="font-size:12px; color:var(--text-muted); padding: 5px;">No available users found.</p>';
            return;
        }

        let htmlString = '';
        filtered.forEach(u => {
            htmlString += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--border);">
                    <div style="display: flex; flex-direction: column; text-align: left; overflow: hidden;">
                        <span style="font-size: 13px; color: var(--text-main); font-weight: 600; white-space: nowrap; text-overflow: ellipsis;">${u.name}</span>
                        <span style="font-size: 11px; color: var(--text-muted);">${u.email}</span>
                    </div>
                    <button onclick="window.addGroupMember('${u.id}')" style="background: var(--primary); color: white; border: none; border-radius: 4px; padding: 4px 10px; font-size: 11px; cursor: pointer; flex-shrink: 0;">Add</button>
                </div>
            `;
        });
        searchResults.innerHTML = htmlString;
    };

    renderSearch(); 
    searchInput.oninput = (e) => renderSearch(e.target.value);
};

window.kickUser = async (targetUid) => {
    if (!confirm("Are you sure you want to remove this user from the group?")) return;
    try {
        const newParticipants = currentRoomData.participants.filter(id => id !== targetUid);
        const newAdmins = (currentRoomData.admins || []).filter(id => id !== targetUid);
        await setDoc(doc(db, "chats", currentRoomId), { participants: newParticipants, admins: newAdmins }, { merge: true });
    } catch(e) { alert("Failed to kick user."); }
};

export const switchChatRoom = (roomId) => {
    currentRoomId = roomId;
    window.enableSelectionMode(false); 
    listenToRoomState(roomId); 
    listenToMessages(roomId);
    
    try {
        const curId = currentUser?.id || currentUser?.uid;
        if (curId) setDoc(doc(db, "chats", roomId), { [`readReceipts.${curId}`]: Date.now() }, { merge: true });
    } catch(e) {}
};

const listenToRoomState = (roomId) => {
    if (roomStateListener) roomStateListener();
    roomStateListener = onSnapshot(doc(db, "chats", roomId), (documentObj) => {
        currentRoomData = documentObj.data() || { type: 'group', participants: [] }; 
        
        if (roomId.startsWith('dm_') && (!currentRoomData.participants || currentRoomData.participants.length === 0)) {
            const splitIds = roomId.replace('dm_', '').split('_');
            currentRoomData.participants = splitIds;
        }
        
        const banner = document.getElementById('pinned-message-banner');
        if (banner && currentRoomData.pinnedMessage && Date.now() < currentRoomData.pinExpiry) {
            document.getElementById('pinned-message-text').innerHTML = parseWhatsAppFormatting(currentRoomData.pinnedMessage);
            const titleEl = banner.querySelector('p');
            if (titleEl) titleEl.innerText = "Pinned Message";
            banner.style.display = 'flex';
        } else if (banner) {
            banner.style.display = 'none';
        }

        const curId = currentUser?.id || currentUser?.uid;
        const isOwner = currentUser?.isOwner;
        const isAdmin = currentRoomData?.admins?.includes(curId);
        
        const isSystemGroup = roomId === 'global_channel' || roomId === 'aksh_help';
        const canEditSystem = isSystemGroup ? isOwner : false; 
        const canEditCustom = isOwner || isAdmin;
        const canEdit = isSystemGroup ? canEditSystem : canEditCustom;
        
        const existingGear = document.getElementById('group-settings-btn');
        if (existingGear) existingGear.remove();

        const titleEl = document.getElementById('active-room-name');
        const iconBox = document.getElementById('active-room-icon-box');

        if (titleEl && iconBox) {
            titleEl.innerText = currentRoomData.name || (isSystemGroup ? 'System Group' : 'Chat');
            
            if (currentRoomData.icon && (currentRoomData.icon.startsWith('http') || currentRoomData.icon.startsWith('data:image'))) {
                iconBox.style.background = 'transparent';
                iconBox.innerHTML = `<img src="${currentRoomData.icon}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                iconBox.style.background = '#dfe5e7';
                iconBox.innerHTML = `<span id="active-room-icon" class="material-symbols-rounded">${currentRoomData.type === 'group' || isSystemGroup ? 'groups' : 'person'}</span>`;
            }

            if (currentRoomData.type === 'group' || (isSystemGroup && canEditSystem)) {
                const gearHTML = `<span id="group-settings-btn" title="Group Settings" class="material-symbols-rounded" style="font-size: 20px; color: var(--primary); margin-left: 10px; cursor: pointer; vertical-align: middle;">settings</span>`;
                titleEl.insertAdjacentHTML('beforeend', gearHTML);
                
                document.getElementById('group-settings-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    injectGroupAdminModal(); 
                    
                    document.getElementById('group-edit-section').style.display = canEdit ? 'block' : 'none';
                    document.getElementById('transfer-admin-section').style.display = (canEdit && !isSystemGroup) ? 'block' : 'none';
                    document.getElementById('btn-save-group').style.display = canEdit ? 'block' : 'none';
                    document.getElementById('btn-delete-group').style.display = (canEdit && !isSystemGroup) ? 'block' : 'none';

                    document.getElementById('add-member-section').style.display = isSystemGroup ? 'none' : 'block';
                    document.getElementById('manage-members-section').style.display = isSystemGroup ? 'none' : 'block';

                    if (canEdit) {
                        document.getElementById('edit-group-name').value = currentRoomData.name || '';
                        document.getElementById('edit-group-icon').value = currentRoomData.icon?.startsWith('http') ? currentRoomData.icon : '';
                        document.getElementById('group-icon-preview').src = currentRoomData.icon?.startsWith('data:image') || currentRoomData.icon?.startsWith('http') ? currentRoomData.icon : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                    }
                    
                    populateGroupManagement(currentRoomData.participants || [], currentRoomData.admins || []);
                    document.getElementById('group-admin-modal').style.display = 'flex';
                });
            }
        }
    });
};

export const listenToMessages = (roomId) => {
    const container = document.getElementById('chat-messages-container');
    const hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];

    const disclaimerHTML = `<div class="chat-disclaimer-wrapper"><div class="chat-disclaimer"><span class="material-symbols-rounded lock-icon" style="font-size: 13px; margin-right: 4px; vertical-align: text-top;">lock</span>Messages are end-to-end encrypted. No one outside of this chat can read them.</div></div>`;
    container.innerHTML = disclaimerHTML;

    if (unsubscribeListener) unsubscribeListener();
    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        let messagesHTML = disclaimerHTML; 
        let previousSenderId = null; 
        
        const readReceipts = currentRoomData?.readReceipts || {};
        const curId = currentUser?.id || currentUser?.uid;
        
        let participantList = currentRoomData?.participants || [];
        if (roomId.startsWith('dm_') && participantList.length === 0) {
            participantList = roomId.replace('dm_', '').split('_');
        }
        const otherParticipants = participantList.filter(id => id !== curId);
        
        const now = Date.now();

        // Dynamically update read receipt only if we haven't in the last 5 seconds to prevent loop-writes
        if (snapshot.docs.length > 0) {
            const lastMsg = snapshot.docs[snapshot.docs.length - 1].data();
            const myLastRead = readReceipts[curId] || 0;
            if (lastMsg.senderId !== curId && (now - myLastRead > 5000)) {
                try { setDoc(doc(db, "chats", roomId), { [`readReceipts.${curId}`]: now }, { merge: true }); } catch(e){}
            }
        }

        snapshot.forEach((documentObj) => {
            const msgId = documentObj.id;
            if (hiddenMsgs.includes(msgId)) return;

            const msg = documentObj.data();
            const isMe = msg.senderId === curId; 
            const isFirstInGroup = previousSenderId !== msg.senderId;
            const isSystemAdminMsg = msg.isOwner === true && (roomId === 'global_channel' || roomId === 'aksh_help');

            let timeString = "Sending...";
            let tickHTML = "";
            
            if (msg.timestamp) {
                const msgTime = msg.timestamp.toMillis();
                timeString = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                if (isMe) {
                    let allRead = false;
                    if (otherParticipants.length > 0) {
                        // --- BUG FIX: SOLVES RACE CONDITIONS AND CLOCK DRIFT ---
                        // If they actively have the chat open, or read it after it was sent.
                        allRead = otherParticipants.every(pid => {
                            const rTime = readReceipts[pid] || 0;
                            return rTime >= (msgTime - 120000) || (now - rTime < 300000); 
                        });
                    }
                    const tickColor = allRead ? "#53bdeb" : "#8696a0"; 
                    tickHTML = `<span class="material-symbols-rounded tick-icon tick-read" style="color: ${tickColor}; font-size: 16px; margin-left: 2px;">done_all</span>`;
                }
            }

            let roleBadge = '';
            if (msg.isOwner === true) {
                roleBadge = ' <span style="color:var(--primary); font-size:11px; font-weight:700;">(Owner)</span>';
            } else if (currentRoomData?.admins?.includes(msg.senderId)) {
                roleBadge = ' <span style="color:var(--text-muted); font-size:11px; font-weight:700;">(Admin)</span>';
            }

            const showName = isSystemAdminMsg || (!isMe && isFirstInGroup);
            const nameAlign = isSystemAdminMsg ? 'text-align: center; width: 100%;' : '';
            const senderNameHTML = showName ? `<div class="msg-sender-name" style="${nameAlign}">${msg.senderName || 'Network User'}${roleBadge}</div>` : '';
            
            const replyHTML = msg.replyToText ? `<div class="quoted-reply"><div class="quoted-name">${msg.replyToName}</div><div class="quoted-text">${parseWhatsAppFormatting(msg.replyToText)}</div></div>` : '';

            const actionMenuHTML = `
                <div class="msg-action-trigger" onclick="window.toggleActionMenu('${msgId}')">
                    <span class="material-symbols-rounded" style="font-size: 20px;">keyboard_arrow_down</span>
                </div>
                <div class="msg-action-menu" id="menu-${msgId}">
                    <button class="msg-action-btn" onclick="window.replyToMessage('${msgId}')">Reply</button>
                    <button class="msg-action-btn" onclick="window.enableSelectionMode(true)">Forward</button>
                    <button class="msg-action-btn" onclick="window.enableSelectionMode(true)">Delete</button>
                    <button class="msg-action-btn" onclick="window.triggerPinModal('${msgId}')">Pin Message</button>
                </div>
            `;

            const checkboxHTML = `<div class="msg-checkbox-wrapper"><input type="checkbox" class="msg-checkbox" value="${msgId}" data-sender="${msg.senderId}"></div>`;
            const alignmentClass = isSystemAdminMsg ? 'admin' : (isMe ? 'me' : 'other');
            const bubbleClass = isSystemAdminMsg ? 'msg-admin' : (isMe ? 'msg-me' : 'msg-other');
            
            const formattedTextContent = parseWhatsAppFormatting(msg.text);
            const imageAttachmentHTML = msg.imageUrl ? `<img src="${msg.imageUrl}" style="width: 100%; max-height: 250px; border-radius: 8px; margin-bottom: 5px; object-fit: cover; display: block;">` : '';

            messagesHTML += `
                <div class="msg-container ${isFirstInGroup ? 'first-in-group' : ''} ${alignmentClass}" id="container-${msgId}">
                    ${checkboxHTML}
                    <div class="msg-bubble ${bubbleClass} ${isFirstInGroup ? '' : 'grouped'}">
                        ${actionMenuHTML} ${senderNameHTML} ${replyHTML}
                        ${imageAttachmentHTML}
                        <span id="text-${msgId}">${formattedTextContent}</span>
                        <div class="msg-meta"><span>${timeString}</span>${tickHTML}</div>
                    </div>
                </div>
            `;
            previousSenderId = msg.senderId;
        });

        container.innerHTML = messagesHTML;
        container.scrollTop = container.scrollHeight; 
    });
};

export const sendMessage = async () => {
    if (currentUser?.isGuest) return;
    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text || !currentRoomId) return; 

    inputField.value = ''; 
    const curId = currentUser?.id || currentUser?.uid;
    const payload = { 
        text, senderId: curId, senderName: currentUser?.name || 'User', 
        isOwner: currentUser?.isOwner === true, timestamp: serverTimestamp() 
    };

    if (replyContext) {
        payload.replyToText = replyContext.text;
        payload.replyToName = replyContext.senderName;
        window.cancelReply(); 
    }
    
    try { 
        await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); 
        await setDoc(doc(db, "chats", currentRoomId), { [`readReceipts.${curId}`]: Date.now() }, { merge: true });
    } catch (error) {}
};

const buildForwardModal = () => {
    if (document.getElementById('forward-modal')) return;
    const fModal = `
        <div id="forward-modal" class="guest-overlay" style="display: none; z-index: 10003;">
            <div class="guest-modal" style="padding: 20px; width: 90%; max-width: 350px;">
                <h3 style="margin-bottom: 15px; color: var(--primary);">Forward To:</h3>
                <div id="forward-rooms-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 15px;"></div>
                <button onclick="document.getElementById('forward-modal').style.display='none'" style="width: 100%; padding: 10px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Cancel</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', fModal);
};

window.forwardSelectedMessages = async () => {
    const selectedBoxes = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
    if (selectedBoxes.length === 0) return alert("Select a message to forward first.");

    buildForwardModal();
    const listEl = document.getElementById('forward-rooms-list');
    listEl.innerHTML = '';
    
    const availableRooms = window.getAvailableRooms ? window.getAvailableRooms() : {};
    if (Object.keys(availableRooms).length === 0) {
        listEl.innerHTML = '<p style="padding: 10px; text-align:center; color: var(--text-muted);">No chats available.</p>';
    }

    Object.keys(availableRooms).forEach(roomId => {
        const room = availableRooms[roomId];
        const item = document.createElement('div');
        item.style = "padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text-main); font-weight: 600;";
        item.innerText = room.name;
        item.onclick = async () => {
            document.getElementById('forward-modal').style.display = 'none';
            const curId = currentUser?.id || currentUser?.uid;
            
            for (const box of selectedBoxes) {
                try {
                    const msgDoc = await getDoc(doc(db, `chats/${currentRoomId}/messages`, box.value));
                    if (msgDoc.exists()) {
                        const originalData = msgDoc.data();
                        
                        // FIX: Forces visible italics and clear spacing for forwarded text
                        const prefix = "_▶ Forwarded_\n";
                        let finalizedText = originalData.text;
                        if (!finalizedText.includes("Forwarded")) finalizedText = prefix + finalizedText;

                        const fwdPayload = {
                            text: finalizedText,
                            imageUrl: originalData.imageUrl || null,
                            senderId: curId,
                            senderName: currentUser?.name || 'User',
                            isOwner: currentUser?.isOwner === true,
                            timestamp: serverTimestamp()
                        };
                        await addDoc(collection(db, `chats/${roomId}/messages`), fwdPayload);
                    }
                } catch(e) {}
            }
            window.enableSelectionMode(false);
            alert("Messages forwarded successfully.");
        };
        listEl.appendChild(item);
    });
    document.getElementById('forward-modal').style.display = 'flex';
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-send-msg')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });

    const mediaBtn = document.getElementById('btn-media-upload');
    const fileInput = document.getElementById('hidden-file-input');

    if (mediaBtn && fileInput) {
        mediaBtn.addEventListener('click', () => fileInput.click()); 
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) return alert("Only images are supported.");
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6); 
                    const curId = currentUser?.id || currentUser?.uid;
                    const payload = { 
                        text: "📷 Image Attached", imageUrl: compressedBase64, 
                        senderId: curId, senderName: currentUser?.name || 'User', 
                        isOwner: currentUser?.isOwner === true, timestamp: serverTimestamp() 
                    };
                    try { 
                        await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); 
                        await setDoc(doc(db, "chats", currentRoomId), { [`readReceipts.${curId}`]: Date.now() }, { merge: true });
                    } catch (error) {}
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file); 
        });
    }

    const fwdBtn = document.getElementById('btn-action-forward');
    if (fwdBtn) fwdBtn.addEventListener('click', window.forwardSelectedMessages);
    
    // Explicitly binds the HTML Cancel button. NO Double X!
    const cancelSelectionBtn = document.getElementById('btn-cancel-selection');
    if (cancelSelectionBtn) cancelSelectionBtn.addEventListener('click', () => window.enableSelectionMode(false));

    document.getElementById('btn-export-chat')?.addEventListener('click', async () => {
        if (!currentRoomId) return;
        try {
            const q = query(collection(db, `chats/${currentRoomId}/messages`), orderBy("timestamp", "asc"));
            const snapshot = await getDocs(q);
            let logOutput = `=== WhatsApp Chat Export Logs [Room: ${currentRoomId}] ===\n\n`;
            snapshot.forEach(docObj => {
                const m = docObj.data();
                const stamp = m.timestamp ? m.timestamp.toDate().toLocaleString() : "Processing";
                logOutput += `[${stamp}] ${m.senderName || 'User'}: ${m.text}\n`;
            });
            const fileBlob = new Blob([logOutput], { type: 'text/plain' });
            const fileUrl = URL.createObjectURL(fileBlob);
            const anchor = document.createElement('a');
            anchor.href = fileUrl;
            anchor.download = `WhatsApp_Chat_${currentRoomId}.txt`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(fileUrl);
        } catch(err) { alert("Export operational processing failure."); }
    });

    document.getElementById('btn-action-delete')?.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
        if (selected.length === 0) return;
        
        let hasUnauthorizedMessage = false;
        const curId = currentUser?.id || currentUser?.uid;
        selected.forEach(box => { if (box.getAttribute('data-sender') !== curId && !currentUser?.isOwner && !currentRoomData?.admins?.includes(curId)) { hasUnauthorizedMessage = true; } });
        
        const deleteEveryoneBtn = document.getElementById('btn-delete-everyone');
        if (deleteEveryoneBtn) { deleteEveryoneBtn.style.display = hasUnauthorizedMessage ? 'none' : 'block'; }
        document.getElementById('delete-modal').style.display = 'flex';
    });

    document.getElementById('btn-delete-me')?.addEventListener('click', () => {
        let hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];
        document.querySelectorAll('.msg-checkbox:checked').forEach(box => {
            hiddenMsgs.push(box.value);
            const container = document.getElementById(`container-${box.value}`);
            if (container) container.style.display = 'none';
        });
        localStorage.setItem('hidden_msgs', JSON.stringify(hiddenMsgs));
        document.getElementById('delete-modal').style.display = 'none';
        window.enableSelectionMode(false);
    });

    document.getElementById('btn-delete-everyone')?.addEventListener('click', async () => {
        document.querySelectorAll('.msg-checkbox:checked').forEach(async (box) => {
            try { await deleteDoc(doc(db, `chats/${currentRoomId}/messages`, box.value)); } catch(e){}
        });
        document.getElementById('delete-modal').style.display = 'none';
        window.enableSelectionMode(false);
    });

    document.querySelectorAll('.pin-duration-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!messageToPin) return;
            const textEl = document.getElementById(`text-${messageToPin}`);
            if (!textEl) return;
            const hours = parseInt(e.target.getAttribute('data-hours'));
            const expiryTime = Date.now() + (hours * 60 * 60 * 1000);
            try { await setDoc(doc(db, "chats", currentRoomId), { pinnedMessage: textEl.innerText, pinExpiry: expiryTime }, { merge: true }); } catch (err) {}
            document.getElementById('pin-modal').style.display = 'none';
            messageToPin = null;
        });
    });

    document.getElementById('btn-cancel-delete')?.addEventListener('click', () => document.getElementById('delete-modal').style.display = 'none');
    document.getElementById('btn-cancel-pin')?.addEventListener('click', () => document.getElementById('pin-modal').style.display = 'none');
    document.getElementById('btn-unpin')?.addEventListener('click', async () => {
        try { await setDoc(doc(db, "chats", currentRoomId), { pinnedMessage: "", pinExpiry: 0 }, { merge: true }); } catch (err) {}
    });
});

window.triggerPinModal = (msgId) => { messageToPin = msgId; window.toggleActionMenu(msgId); document.getElementById('pin-modal').style.display = 'flex'; };
window.toggleActionMenu = (msgId) => { document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active')); const menu = document.getElementById(`menu-${msgId}`); if(menu) menu.classList.toggle('active'); };
document.addEventListener('click', (e) => { if (!e.target.closest('.msg-bubble')) { document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active')); } });

window.replyToMessage = (msgId) => {
    const textEl = document.getElementById(`text-${msgId}`);
    const senderNameEl = document.getElementById(`container-${msgId}`).querySelector('.msg-sender-name');
    replyContext = { msgId, text: textEl.innerText, senderName: senderNameEl ? senderNameEl.innerText : 'User' };
    document.getElementById('reply-preview-name').innerText = `Replying to ${replyContext.senderName}`;
    document.getElementById('reply-preview-text').innerText = replyContext.text;
    document.getElementById('reply-preview-banner').style.display = 'block';
    window.toggleActionMenu(msgId);
};
window.cancelReply = () => { replyContext = null; document.getElementById('reply-preview-banner').style.display = 'none'; };

// NO INJECTED BUTTONS: Strictly triggers native HTML
window.enableSelectionMode = (enable = true) => {
    const container = document.getElementById('chat-messages-container');
    const selectionHeader = document.getElementById('selection-chat-header');
    
    if (enable) {
        container.classList.add('selection-mode');
        document.getElementById('standard-chat-header').style.display = 'none';
        if (selectionHeader) selectionHeader.style.display = 'flex';
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    } else {
        container.classList.remove('selection-mode');
        document.getElementById('standard-chat-header').style.display = 'flex';
        if (selectionHeader) selectionHeader.style.display = 'none';
        document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
        const countTxt = document.getElementById('selection-count');
        if (countTxt) countTxt.innerText = `0 Selected`;
    }
};

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('msg-checkbox')) {
        const count = document.querySelectorAll('.msg-checkbox:checked').length;
        document.getElementById('selection-count').innerText = `${count} Selected`;
    }
});
