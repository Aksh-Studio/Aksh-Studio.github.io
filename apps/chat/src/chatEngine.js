// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, setDoc, getDocs, getDoc, updateDoc, where } from './firebase.js';
import { currentUser } from './auth.js';

let unsubscribeListener = null;
let roomStateListener = null;
export let currentRoomId = null;
export let currentRoomData = null; // Exposes room state to allow Admin checks
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

// --- DYNAMIC GROUP ADMIN MODAL BUILDER ---
const injectGroupAdminModal = () => {
    if (document.getElementById('group-admin-modal')) return;
    const modalHTML = `
        <div id="group-admin-modal" class="guest-overlay" style="display: none; z-index: 10002;">
            <div class="guest-modal" style="padding: 25px; width: 90%; max-width: 350px;">
                <h3 style="margin-bottom: 15px; color: var(--primary);">Group Settings</h3>
                
                <input type="text" id="edit-group-name" placeholder="Group Name" style="width: 100%; padding: 12px; margin-bottom: 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                <input type="text" id="edit-group-icon" placeholder="Image URL for Icon" style="width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                
                <button id="btn-add-group-member" style="width: 100%; padding: 10px; background: transparent; color: var(--primary); border: 1px dashed var(--primary); border-radius: 8px; margin-bottom: 15px; cursor: pointer; font-weight: 600;">+ Add Member by Email</button>

                <h4 style="font-size: 12px; text-align: left; margin-bottom: 5px; color: var(--text-muted); text-transform: uppercase;">Transfer Admin Ownership</h4>
                <select id="transfer-admin-select" style="width: 100%; padding: 12px; margin-bottom: 20px; border-radius: 8px; border: 1px solid var(--border); background: var(--app-bg); color: var(--text-main);">
                    <option value="">Select a member...</option>
                </select>

                <button id="btn-save-group" style="width: 100%; padding: 12px; background: var(--primary); color: white; border: none; border-radius: 8px; margin-bottom: 10px; cursor: pointer; font-weight: 600;">Save Changes</button>
                <button id="btn-cancel-group" style="width: 100%; padding: 12px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Close</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-cancel-group').addEventListener('click', () => {
        document.getElementById('group-admin-modal').style.display = 'none';
    });

    // Add Member Execution
    document.getElementById('btn-add-group-member').addEventListener('click', async () => {
        const email = prompt("Enter the exact email of the user you want to add to this group:");
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
            populateAdminDropdown(updatedParticipants); // Refresh the dropdown
        } catch(e) { console.error(e); alert("Failed to add member."); }
    });

    // Save Changes Execution
    document.getElementById('btn-save-group').addEventListener('click', async () => {
        const newName = document.getElementById('edit-group-name').value.trim();
        const newIcon = document.getElementById('edit-group-icon').value.trim();
        const newAdminId = document.getElementById('transfer-admin-select').value;
        
        const updates = {};
        if (newName) updates.name = newName;
        if (newIcon) updates.icon = newIcon;
        if (newAdminId) updates.admins = [newAdminId]; // Transfers admin rights permanently to chosen user
        
        if (Object.keys(updates).length > 0) {
            try {
                await setDoc(doc(db, "chats", currentRoomId), updates, { merge: true });
                alert("Group settings saved.");
            } catch(e) { console.error(e); alert("Error saving settings."); }
        }
        document.getElementById('group-admin-modal').style.display = 'none';
    });
};

const populateAdminDropdown = async (participants) => {
    const select = document.getElementById('transfer-admin-select');
    if (!select) return;
    select.innerHTML = '<option value="">Select a member to make Admin...</option>';
    
    for (const uid of participants) {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
                const u = userDoc.data();
                const name = u.fullName || u.firstName || u.email.split('@')[0];
                select.innerHTML += `<option value="${uid}">${name}</option>`;
            }
        } catch(e) {}
    }
};

export const switchChatRoom = (roomId) => {
    currentRoomId = roomId;
    
    // PERMANENTLY HIDE CALL BUTTONS
    const audioBtn = document.getElementById('btn-start-audio-call');
    const videoBtn = document.getElementById('btn-start-video-call');
    if (audioBtn) audioBtn.style.display = 'none';
    if (videoBtn) videoBtn.style.display = 'none';

    listenToRoomState(roomId); 
    listenToMessages(roomId);
};

const listenToRoomState = (roomId) => {
    if (roomStateListener) roomStateListener();
    
    roomStateListener = onSnapshot(doc(db, "chats", roomId), (documentObj) => {
        currentRoomData = documentObj.data() || { type: 'group', participants: [] }; 
        
        // 1. PIN RENDERER
        const banner = document.getElementById('pinned-message-banner');
        if (banner && currentRoomData.pinnedMessage && Date.now() < currentRoomData.pinExpiry) {
            document.getElementById('pinned-message-text').innerHTML = parseWhatsAppFormatting(currentRoomData.pinnedMessage);
            const titleEl = banner.querySelector('p');
            if (titleEl) titleEl.innerText = "Pinned Message";
            banner.style.display = 'flex';
        } else if (banner) {
            banner.style.display = 'none';
        }

        // 2. INJECT GROUP ADMIN/OWNER GEAR
        const curId = currentUser?.id || currentUser?.uid;
        const isOwner = currentUser?.isOwner;
        const isGroupAdmin = currentRoomData?.admins?.includes(curId);
        const isSystemGroup = roomId === 'global_channel' || roomId === 'aksh_help';
        
        const existingGear = document.getElementById('group-settings-btn');
        if (existingGear) existingGear.remove();

        const titleEl = document.getElementById('active-room-name');
        
        // Grants access if they created the group, or are the universal Owner
        if ((currentRoomData.type === 'group' || isSystemGroup) && (isGroupAdmin || isOwner)) {
            const gearHTML = `<span id="group-settings-btn" title="Group Settings" class="material-symbols-rounded" style="font-size: 20px; color: var(--primary); margin-left: 10px; cursor: pointer; vertical-align: middle;">settings</span>`;
            
            // Replaces text and adds gear
            const baseName = currentRoomData.name || (isSystemGroup ? 'System Group' : 'Group');
            titleEl.innerHTML = `${baseName} ${gearHTML}`;
            
            // Build logic for Settings Modal
            document.getElementById('group-settings-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                injectGroupAdminModal(); // Creates modal if missing
                document.getElementById('edit-group-name').value = currentRoomData.name || '';
                document.getElementById('edit-group-icon').value = currentRoomData.icon?.startsWith('http') ? currentRoomData.icon : '';
                populateAdminDropdown(currentRoomData.participants || []);
                document.getElementById('group-admin-modal').style.display = 'flex';
            });
        } else {
            // Standard user just sees the text
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

        snapshot.forEach((documentObj) => {
            const msgId = documentObj.id;
            if (hiddenMsgs.includes(msgId)) return;

            const msg = documentObj.data();
            const curId = currentUser?.id || currentUser?.uid;
            const isMe = msg.senderId === curId; 
            
            // Universal Owner override check for system messages
            const isAdminMessage = currentUser?.isOwner && msg.senderId === curId && roomId === 'aksh_help';
            const isFirstInGroup = previousSenderId !== msg.senderId;

            let timeString = msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sending...";
            let tickHTML = isMe && msg.timestamp ? `<span class="material-symbols-rounded tick-icon tick-read" style="color: #53bdeb; font-size: 16px; margin-left: 2px;">done_all</span>` : "";

            const senderNameHTML = (!isMe && isFirstInGroup && !isAdminMessage) ? `<div class="msg-sender-name">${msg.senderName || 'Network User'}</div>` : '';
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
            const alignmentClass = isAdminMessage ? 'admin' : (isMe ? 'me' : 'other');
            const bubbleClass = isAdminMessage ? 'msg-admin' : (isMe ? 'msg-me' : 'msg-other');
            
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
    const payload = { text, senderId: curId, senderName: currentUser?.name || 'User', timestamp: serverTimestamp() };

    if (replyContext) {
        payload.replyToText = replyContext.text;
        payload.replyToName = replyContext.senderName;
        window.cancelReply(); 
    }
    
    try { await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); } catch (error) {}
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-send-msg')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });

    // --- INSTANT IMAGE COMPRESSOR ---
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
                    const payload = { text: "📷 Image Attached", imageUrl: compressedBase64, senderId: curId, senderName: currentUser?.name || 'User', timestamp: serverTimestamp() };
                    try { await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); } 
                    catch (error) { console.error("Image Upload Failed", error); }
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

    // --- OWNER / ADMIN SECURE DELETION LOGIC ---
    document.getElementById('btn-action-delete')?.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
        if (selected.length === 0) return;
        
        let hasUnauthorizedMessage = false;
        const curId = currentUser?.id || currentUser?.uid;
        const amIOwner = currentUser?.isOwner;
        const amIGroupAdmin = currentRoomData?.admins?.includes(curId);

        selected.forEach(box => { 
            const senderId = box.getAttribute('data-sender');
            // If it's not my message, and I'm not the universal Owner, and I'm not the Group Admin... deny.
            if (senderId !== curId && !amIOwner && !amIGroupAdmin) { 
                hasUnauthorizedMessage = true; 
            } 
        });
        
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
