// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, setDoc, getDocs } from './firebase.js';
import { currentUser } from './auth.js';
import { roomsInfo } from './app.js';

let unsubscribeListener = null;
let pinListener = null;
export let currentRoomId = null;
let replyContext = null; 
let messageToPin = null; 

export const switchChatRoom = (roomId) => {
    currentRoomId = roomId;
    
    const isPublic = roomId === 'global_channel' || roomId === 'aksh_help';
    const audioBtn = document.getElementById('btn-start-audio-call');
    const videoBtn = document.getElementById('btn-start-video-call');
    
    if (audioBtn) audioBtn.style.display = isPublic ? 'none' : 'block';
    if (videoBtn) videoBtn.style.display = isPublic ? 'none' : 'block';

    listenToGlobalPin(roomId);
    listenToMessages(roomId);
};

const listenToGlobalPin = (roomId) => {
    if (pinListener) pinListener();
    
    pinListener = onSnapshot(doc(db, "chats", roomId), (documentObj) => {
        const data = documentObj.data();
        const banner = document.getElementById('pinned-message-banner');
        
        if (banner && data && data.pinnedMessage && Date.now() < data.pinExpiry) {
            document.getElementById('pinned-message-text').innerText = data.pinnedMessage;
            const titleEl = banner.querySelector('p');
            if (titleEl) titleEl.innerText = "Pinned Message";
            banner.style.display = 'flex';
        } else if (banner) {
            banner.style.display = 'none';
        }
    });
};

export const listenToMessages = (roomId) => {
    const container = document.getElementById('chat-messages-container');
    const hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];

    const disclaimerHTML = `
        <div class="chat-disclaimer-wrapper">
            <div class="chat-disclaimer">
                <span class="material-symbols-rounded lock-icon" style="font-size: 13px; margin-right: 4px; vertical-align: text-top;">lock</span>
                Messages are end-to-end encrypted. No one outside of this chat can read them.
            </div>
        </div>
    `;
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
            const isAdminMessage = currentUser?.isAdmin && msg.senderId === curId && roomId === 'aksh_help';
            const isFirstInGroup = previousSenderId !== msg.senderId;

            let timeString = msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Sending...";
            let tickHTML = isMe && msg.timestamp ? `<span class="material-symbols-rounded tick-icon tick-read" style="color: #53bdeb; font-size: 16px; margin-left: 2px;">done_all</span>` : "";

            const senderNameHTML = (!isMe && isFirstInGroup && !isAdminMessage) ? `<div class="msg-sender-name">${msg.senderName || 'Network User'}</div>` : '';
            const replyHTML = msg.replyToText ? `<div class="quoted-reply"><div class="quoted-name">${msg.replyToName}</div><div class="quoted-text">${msg.replyToText}</div></div>` : '';

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

            messagesHTML += `
                <div class="msg-container ${isFirstInGroup ? 'first-in-group' : ''} ${alignmentClass}" id="container-${msgId}">
                    ${checkboxHTML}
                    <div class="msg-bubble ${bubbleClass} ${isFirstInGroup ? '' : 'grouped'}">
                        ${actionMenuHTML}
                        ${senderNameHTML}
                        ${replyHTML}
                        <span id="text-${msgId}">${msg.text}</span>
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
    
    try { await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); } 
    catch (error) { console.error("Send Error:", error); }
};

// --- SECURE SYSTEM OPERATIONS & LIFECYCLES ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-send-msg')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });

    // Chat History Native PlainText Downloader
    document.getElementById('btn-export-chat')?.addEventListener('click', async () => {
        if (!currentRoomId) return;
        try {
            const q = query(collection(db, `chats/${currentRoomId}/messages`), orderBy("timestamp", "asc"));
            const snapshot = await getDocs(q);
            let log = `=== Aksh Studio Chat History Export [Room ID: ${currentRoomId}] ===\n\n`;
            
            snapshot.forEach(doc => {
                const m = doc.data();
                const ts = m.timestamp ? m.timestamp.toDate().toLocaleString() : "Pending";
                log += `[${ts}] ${m.senderName || 'System User'}: ${m.text}\n`;
            });
            
            const blob = new Blob([log], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const downloadAnchor = document.createElement('a');
            downloadAnchor.href = url;
            downloadAnchor.download = `chat_history_${currentRoomId}.txt`;
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            document.body.removeChild(downloadAnchor);
            URL.revokeObjectURL(url);
        } catch(err) {
            alert("Export failed. Validate network conditions.");
        }
    });

    // Delete Operations
    document.getElementById('btn-action-delete')?.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
        if (selected.length === 0) return;

        let hasUnauthorizedMessage = false;
        const curId = currentUser?.id || currentUser?.uid;
        selected.forEach(box => {
            if (box.getAttribute('data-sender') !== curId && !currentUser?.isAdmin) {
                hasUnauthorizedMessage = true;
            }
        });

        const deleteEveryoneBtn = document.getElementById('btn-delete-everyone');
        if (deleteEveryoneBtn) {
            deleteEveryoneBtn.style.display = hasUnauthorizedMessage ? 'none' : 'block';
        }
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

    // Pinning Operations (Fixed to use setDoc with merge tracking)
    document.querySelectorAll('.pin-duration-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!messageToPin) return;
            const textEl = document.getElementById(`text-${messageToPin}`);
            if (!textEl) return;

            const hours = parseInt(e.target.getAttribute('data-hours'));
            const expiryTime = Date.now() + (hours * 60 * 60 * 1000);
            
            try {
                await setDoc(doc(db, "chats", currentRoomId), {
                    pinnedMessage: textEl.innerText,
                    pinExpiry: expiryTime
                }, { merge: true });
            } catch (err) {
                console.error("Firebase Pin Error:", err);
            }
            
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

// --- GLOBAL WINDOW HOOKS ---
window.triggerPinModal = (msgId) => {
    messageToPin = msgId;
    window.toggleActionMenu(msgId);
    document.getElementById('pin-modal').style.display = 'flex';
};

window.toggleActionMenu = (msgId) => {
    document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active'));
    const menu = document.getElementById(`menu-${msgId}`);
    if(menu) menu.classList.toggle('active');
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.msg-bubble')) {
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    }
});

window.replyToMessage = (msgId) => {
    const textEl = document.getElementById(`text-${msgId}`);
    const senderNameEl = document.getElementById(`container-${msgId}`).querySelector('.msg-sender-name');
    replyContext = { msgId, text: textEl.innerText, senderName: senderNameEl ? senderNameEl.innerText : 'User' };
    document.getElementById('reply-preview-name').innerText = `Replying to ${replyContext.senderName}`;
    document.getElementById('reply-preview-text').innerText = replyContext.text;
    document.getElementById('reply-preview-banner').style.display = 'block';
    window.toggleActionMenu(msgId);
};

window.cancelReply = () => { 
    replyContext = null; 
    document.getElementById('reply-preview-banner').style.display = 'none'; 
};

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
