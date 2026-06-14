// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, updateDoc } from './firebase.js';
import { currentUser } from './auth.js';
import { roomsInfo } from './app.js';

let unsubscribeListener = null;
let pinListener = null;
export let currentRoomId = null;
let replyContext = null; 
let messageToPin = null; 

export const switchChatRoom = (roomId) => {
    currentRoomId = roomId;
    
    // Disable Call Buttons in Public Groups
    const isPublic = roomId === 'global_channel' || roomId === 'aksh_help';
    document.getElementById('btn-start-audio-call').style.display = isPublic ? 'none' : 'block';
    document.getElementById('btn-start-video-call').style.display = isPublic ? 'none' : 'block';

    listenToGlobalPin(roomId);
    listenToMessages(roomId);
};

// 1. GLOBAL FIREBASE PINNING LISTENER
const listenToGlobalPin = (roomId) => {
    if (pinListener) pinListener();
    pinListener = onSnapshot(doc(db, "chats", roomId), (documentObj) => {
        const data = documentObj.data();
        const banner = document.getElementById('pinned-message-banner');
        
        if (data && data.pinnedMessage && Date.now() < data.pinExpiry) {
            document.getElementById('pinned-message-text').innerText = data.pinnedMessage;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    });
};

export const listenToMessages = (roomId) => {
    const container = document.getElementById('chat-messages-container');
    const hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];

    const disclaimerHTML = `<div class="chat-disclaimer-wrapper"><div class="chat-disclaimer">End-to-End Encrypted.</div></div>`;
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
            const isMe = msg.senderId === currentUser.id; 
            const isAdminMessage = currentUser.isAdmin && msg.senderId === currentUser.id && roomId === 'aksh_help';
            const isFirstInGroup = previousSenderId !== msg.senderId;

            let timeString = msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sending...";
            let tickHTML = isMe && msg.timestamp ? `<span class="material-symbols-rounded tick-icon tick-read">done_all</span>` : "";

            const senderNameHTML = (!isMe && isFirstInGroup && !isAdminMessage) ? `<div class="msg-sender-name">${msg.senderName}</div>` : '';
            const replyHTML = msg.replyToText ? `<div class="quoted-reply"><div class="quoted-name">${msg.replyToName}</div><div class="quoted-text">${msg.replyToText}</div></div>` : '';

            const actionMenuHTML = `
                <div class="msg-action-trigger" onclick="window.toggleActionMenu('${msgId}')"><span class="material-symbols-rounded" style="font-size: 20px;">keyboard_arrow_down</span></div>
                <div class="msg-action-menu" id="menu-${msgId}">
                    <button class="msg-action-btn" onclick="window.replyToMessage('${msgId}')">Reply</button>
                    <button class="msg-action-btn" onclick="window.enableSelectionMode(true)">Forward</button>
                    <button class="msg-action-btn" onclick="window.enableSelectionMode(true)">Delete</button>
                    <button class="msg-action-btn" onclick="window.triggerPinModal('${msgId}')">Pin Message</button>
                </div>
            `;

            // Embeds actual sender ID into the checkbox for security validation
            const checkboxHTML = `<div class="msg-checkbox-wrapper"><input type="checkbox" class="msg-checkbox" value="${msgId}" data-sender="${msg.senderId}"></div>`;

            messagesHTML += `
                <div class="msg-container ${isFirstInGroup ? 'first-in-group' : ''} ${isAdminMessage ? 'admin' : (isMe ? 'me' : 'other')}" id="container-${msgId}">
                    ${checkboxHTML}
                    <div class="msg-bubble ${isAdminMessage ? 'msg-admin' : (isMe ? 'msg-me' : 'msg-other')} ${isFirstInGroup ? '' : 'grouped'}">
                        ${actionMenuHTML} ${senderNameHTML} ${replyHTML} <span id="text-${msgId}">${msg.text}</span>
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
    if (currentUser.isGuest) return;
    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text || !currentRoomId) return; 

    inputField.value = ''; 
    const payload = { text, senderId: currentUser.id, senderName: currentUser.name, timestamp: serverTimestamp() };

    if (replyContext) {
        payload.replyToText = replyContext.text;
        payload.replyToName = replyContext.senderName;
        window.cancelReply(); 
    }
    try { await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); } catch (e) {}
};

// --- SECURE UI ACTIONS ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-send-msg')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });

    // 2. STRICT ADMIN DELETE LOGIC
    document.getElementById('btn-action-delete')?.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
        if (selected.length === 0) return;

        // Security Check: Make sure they only selected their own messages OR they are the admin
        let hasUnauthorizedMessage = false;
        selected.forEach(box => {
            if (box.getAttribute('data-sender') !== currentUser.id && !currentUser.isAdmin) {
                hasUnauthorizedMessage = true;
            }
        });

        if (hasUnauthorizedMessage) {
            document.getElementById('btn-delete-everyone').style.display = 'none'; // Lock out normal users
        } else {
            document.getElementById('btn-delete-everyone').style.display = 'block'; // Grant access
        }
        document.getElementById('delete-modal').style.display = 'flex';
    });

    document.getElementById('btn-delete-me')?.addEventListener('click', () => {
        let hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];
        document.querySelectorAll('.msg-checkbox:checked').forEach(box => {
            hiddenMsgs.push(box.value);
            document.getElementById(`container-${box.value}`).style.display = 'none';
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

    // 3. GLOBAL PIN MODAL LOGIC
    document.querySelectorAll('.pin-duration-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!messageToPin) return;
            const textEl = document.getElementById(`text-${messageToPin}`);
            if (!textEl) return;

            const hours = parseInt(e.target.getAttribute('data-hours'));
            const expiryTime = Date.now() + (hours * 60 * 60 * 1000);
            
            // Save globally to Firestore
            try {
                await updateDoc(doc(db, "chats", currentRoomId), {
                    pinnedMessage: textEl.innerText,
                    pinExpiry: expiryTime
                });
            } catch (err) {
                console.error("Firebase Pin Error:", err);
            }
            
            document.getElementById('pin-modal').style.display = 'none';
            messageToPin = null;
        });
    });

    // Clean up Modals
    document.getElementById('btn-cancel-delete')?.addEventListener('click', () => document.getElementById('delete-modal').style.display = 'none');
    document.getElementById('btn-cancel-pin')?.addEventListener('click', () => document.getElementById('pin-modal').style.display = 'none');
    document.getElementById('btn-unpin')?.addEventListener('click', async () => {
        try { await updateDoc(doc(db, "chats", currentRoomId), { pinnedMessage: "", pinExpiry: 0 }); } catch (err) {}
    });
});

// --- UI HELPERS ---
window.triggerPinModal = (msgId) => {
    messageToPin = msgId;
    window.toggleActionMenu(msgId);
    document.getElementById('pin-modal').style.display = 'flex';
};

window.toggleActionMenu = (msgId) => {
    document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active'));
    document.getElementById(`menu-${msgId}`).classList.toggle('active');
};
document.addEventListener('click', (e) => { if (!e.target.closest('.msg-bubble')) document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active')); });

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
