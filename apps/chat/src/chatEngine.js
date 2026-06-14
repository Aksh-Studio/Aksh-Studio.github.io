// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, setDoc, getDocs, getDoc, updateDoc, where } from './firebase.js';
import { currentUser } from './auth.js';

let unsubscribeListener = null;
let roomStateListener = null;
export let currentRoomId = null;
export let currentRoomData = null; 
let replyContext = null; 
let messageToPin = null; 

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

// --- DYNAMIC GROUP MANAGEMENT DASHBOARD ---
const injectGroupAdminModal = () => {
    if (document.getElementById('group-admin-modal')) return;
    const modalHTML = `
        <div id="group-admin-modal" class="guest-overlay" style="display: none; z-index: 10002;">
            <div class="guest-modal" style="padding: 25px; width: 90%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-bottom: 15px; color: var(--primary);">Group Settings</h3>
                
                <input type="text" id="edit-group-name" placeholder="Group Name" style="width: 100%; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                <input type="text" id="edit-group-icon" placeholder="Image URL for Icon" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                
                <button id="btn-add-group-member" style="width: 100%; padding: 10px; background: transparent; color: var(--primary); border: 1px dashed var(--primary); border-radius: 8px; margin-bottom: 15px; cursor: pointer; font-weight: 600;">+ Add Member by Email</button>

                <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Manage Members</h4>
                <div id="admin-member-list" style="max-height: 180px; overflow-y: auto; margin-bottom: 15px; border: 1px solid var(--border); border-radius: 8px; padding: 5px;"></div>

                <h4 style="font-size: 13px; text-align: left; margin-bottom: 8px; color: var(--text-muted);">Transfer Admin Status</h4>
                <select id="transfer-admin-select" style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                    <option value="">Select a member...</option>
                </select>

                <button id="btn-save-group" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Save Changes</button>
                <button id="btn-delete-group" style="width: 100%; padding: 12px; background: #ea0038; color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Delete Group</button>
                <button id="btn-cancel-group" style="width: 100%; padding: 12px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Close</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-cancel-group').addEventListener('click', () => { document.getElementById('group-admin-modal').style.display = 'none'; });

    document.getElementById('btn-add-group-member').addEventListener('click', async () => {
        const email = prompt("Enter the exact email of the user you want to add:");
        if (!email) return;
        try {
            const q = query(collection(db, "users"), where("email", "==", email.toLowerCase().trim()));
            const snap = await getDocs(q);
            if (snap.empty) return alert("User not found in network directory.");
            const newMemberId = snap.docs[0].id;
            const currentParticipants = currentRoomData?.participants || [];
            if (currentParticipants.includes(newMemberId)) return alert("User is already in this group.");
            const updatedParticipants = [...currentParticipants, newMemberId];
            await setDoc(doc(db, "chats", currentRoomId), { participants: updatedParticipants }, { merge: true });
            alert("Member added successfully!");
        } catch(e) { alert("Failed to add member."); }
    });

    document.getElementById('btn-save-group').addEventListener('click', async () => {
        const newName = document.getElementById('edit-group-name').value.trim();
        const newIcon = document.getElementById('edit-group-icon').value.trim();
        const newAdminId = document.getElementById('transfer-admin-select').value;
        const updates = {};
        if (newName) updates.name = newName;
        if (newIcon) updates.icon = newIcon;
        if (newAdminId) updates.admins = [newAdminId]; 
        
        if (Object.keys(updates).length > 0) {
            try { await setDoc(doc(db, "chats", currentRoomId), updates, { merge: true }); alert("Group settings saved."); } 
            catch(e) { alert("Error saving settings."); }
        }
        document.getElementById('group-admin-modal').style.display = 'none';
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

const populateGroupManagement = async (participants, admins) => {
    const listEl = document.getElementById('admin-member-list');
    const selectEl = document.getElementById('transfer-admin-select');
    if (!listEl || !selectEl) return;
    
    listEl.innerHTML = '';
    selectEl.innerHTML = '<option value="">Select a member to make Admin...</option>';
    
    for (const uid of participants) {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const u = userDoc.data();
                const name = u.fullName || u.firstName || u.email.split('@')[0];
                const isAdmin = admins?.includes(uid);
                
                if (!isAdmin) selectEl.innerHTML += `<option value="${uid}">${name}</option>`;

                const myId = currentUser?.id || currentUser?.uid;
                const kickBtnHTML = (uid !== myId) ? `<button onclick="window.kickUser('${uid}')" style="background: #ea0038; color: white; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer;">Kick</button>` : '';

                listEl.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid var(--app-bg);">
                        <span style="font-size: 13px; color: var(--text-main);">${name} <span style="color:var(--primary); font-size:10px;">${isAdmin ? '(Admin)' : ''}</span></span>
                        ${kickBtnHTML}
                    </div>
                `;
            }
        } catch(e) {}
    }
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
    
    const audioBtn = document.getElementById('btn-start-audio-call');
    const videoBtn = document.getElementById('btn-start-video-call');
    if (audioBtn) audioBtn.style.display = 'none';
    if (videoBtn) videoBtn.style.display = 'none';

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
        const isGroupAdmin = currentRoomData?.admins?.includes(curId);
        const isSystemGroup = roomId === 'global_channel' || roomId === 'aksh_help';
        
        const existingGear = document.getElementById('group-settings-btn');
        if (existingGear) existingGear.remove();

        const titleEl = document.getElementById('active-room-name');
        
        if ((currentRoomData.type === 'group' || isSystemGroup) && (isGroupAdmin || isOwner)) {
            const gearHTML = `<span id="group-settings-btn" title="Group Settings" class="material-symbols-rounded" style="font-size: 20px; color: var(--primary); margin-left: 10px; cursor: pointer; vertical-align: middle;">settings</span>`;
            
            const baseName = currentRoomData.name || (isSystemGroup ? 'System Group' : 'Group');
            titleEl.innerHTML = `${baseName} ${gearHTML}`;
            
            document.getElementById('group-settings-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                injectGroupAdminModal(); 
                
                const delBtn = document.getElementById('btn-delete-group');
                if (delBtn) delBtn.style.display = isSystemGroup ? 'none' : 'block';

                document.getElementById('edit-group-name').value = currentRoomData.name || '';
                document.getElementById('edit-group-icon').value = currentRoomData.icon?.startsWith('http') ? currentRoomData.icon : '';
                
                populateGroupManagement(currentRoomData.participants || [], currentRoomData.admins || []);
                document.getElementById('group-admin-modal').style.display = 'flex';
            });
        } else {
            if (titleEl && titleEl.innerHTML.includes('group-settings-btn')) {
                titleEl.innerHTML = currentRoomData.name || 'Chat';
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
        const otherParticipants = (currentRoomData?.participants || []).filter(id => id !== curId);

        if (snapshot.docs.length > 0) {
            const lastMsg = snapshot.docs[snapshot.docs.length - 1].data();
            if (lastMsg.senderId !== curId) {
                try { setDoc(doc(db, "chats", roomId), { [`readReceipts.${curId}`]: Date.now() }, { merge: true }); } catch(e){}
            }
        }

        snapshot.forEach((documentObj) => {
            const msgId = documentObj.id;
            if (hiddenMsgs.includes(msgId)) return;

            const msg = documentObj.data();
            const isMe = msg.senderId === curId; 
            const isFirstInGroup = previousSenderId !== msg.senderId;

            // --- THE FIX: Owner Global Center Alignment Logic ---
            // Forces the message to the center of everyone's screen if it was sent by the Owner in a system room.
            const isSystemAdminMsg = msg.isOwner === true && (roomId === 'global_channel' || roomId === 'aksh_help');

            let timeString = "Sending...";
            let tickHTML = "";
            
            if (msg.timestamp) {
                const msgTime = msg.timestamp.toMillis();
                timeString = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                if (isMe) {
                    let allRead = false;
                    if (otherParticipants.length > 0) {
                        allRead = otherParticipants.every(pid => readReceipts[pid] >= msgTime);
                    }
                    const tickColor = allRead ? "#53bdeb" : "#8696a0"; 
                    tickHTML = `<span class="material-symbols-rounded tick-icon tick-read" style="color: ${tickColor}; font-size: 16px; margin-left: 2px;">done_all</span>`;
                }
            }

            // --- THE FIX: Owner & Admin Badges ---
            // Reads from the MESSAGE payload so everyone sees the correct badge, not just you.
            let roleBadge = '';
            if (msg.isOwner === true) {
                roleBadge = ' <span style="color:var(--primary); font-size:11px; font-weight:700;">(Owner)</span>';
            } else if (currentRoomData?.admins?.includes(msg.senderId)) {
                roleBadge = ' <span style="color:var(--text-muted); font-size:11px; font-weight:700;">(Admin)</span>';
            }

            // If it's a centered announcement, we still want to show the sender name inside the bubble
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
            
            // Uses the new Global Alignment Logic
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
        text, 
        senderId: curId, 
        senderName: currentUser?.name || 'User', 
        isOwner: currentUser?.isOwner === true, // Embeds your Owner status strictly into the message!
        timestamp: serverTimestamp() 
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
                        isOwner: currentUser?.isOwner === true, 
                        timestamp: serverTimestamp() 
                    };
                    try { 
                        await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); 
                        await setDoc(doc(db, "chats", currentRoomId), { [`readReceipts.${curId}`]: Date.now() }, { merge: true });
                    } catch (error) { console.error("Image Upload Failed", error); }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file); 
        });
    }

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

window.enableSelectionMode = (enable = true) => {
    const container = document.getElementById('chat-messages-container');
    if (enable) {
        container.classList.add('selection-mode');
        document.getElementById('standard-chat-header').style.display = 'none';
        document.getElementById('selection-chat-header').style.display = 'flex';
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    } else {
        container.classList.remove('selection-mode');
        document.getElementById('standard-chat-header').style.display = 'flex';
        document.getElementById('selection-chat-header').style.display = 'none';
        document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
    }
};
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('msg-checkbox')) {
        const count = document.querySelectorAll('.msg-checkbox:checked').length;
        document.getElementById('selection-count').innerText = `${count} Selected`;
    }
});
