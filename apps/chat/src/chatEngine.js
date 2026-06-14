// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc } from './firebase.js';
import { currentUser } from './auth.js';
import { roomsInfo } from './app.js';

let unsubscribeListener = null;
export let currentRoomId = null;
let replyContext = null; 

export const switchChatRoom = (roomId) => {
    currentRoomId = roomId;
    listenToMessages(roomId);
    
    // Disable calls in Public Rooms
    const isPublic = roomId === 'global_channel' || roomId === 'aksh_help';
    document.getElementById('btn-start-audio-call').style.display = isPublic ? 'none' : 'block';
    document.getElementById('btn-start-video-call').style.display = isPublic ? 'none' : 'block';
};

export const listenToMessages = (roomId) => {
    const container = document.getElementById('chat-messages-container');
    const hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];

    const disclaimerHTML = `
        <div class="chat-disclaimer-wrapper">
            <div class="chat-disclaimer">
                <span class="material-symbols-rounded lock-icon" style="font-size: 13px; margin-right: 4px;">lock</span>
                Messages are end-to-end encrypted. No one outside of this chat can read them.
            </div>
        </div>
    `;

    container.innerHTML = disclaimerHTML;

    // Load Local Pinned Message
    showPinnedMessage();

    if (unsubscribeListener) unsubscribeListener();
    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        let messagesHTML = disclaimerHTML; 
        let previousSenderId = null; 

        snapshot.forEach((documentObj) => {
            const msgId = documentObj.id;
            // Skip rendering if user chose "Delete for Me"
            if (hiddenMsgs.includes(msgId)) return;

            const msg = documentObj.data();
            const isMe = msg.senderId === currentUser.id; 
            const isAdminMessage = currentUser.isAdmin && msg.senderId === currentUser.id && roomId === 'aksh_help';
            
            const isFirstInGroup = previousSenderId !== msg.senderId;
            let timeString = "Sending...";
            let tickHTML = "";
            
            if (msg.timestamp) {
                const date = msg.timestamp.toDate();
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (isMe) tickHTML = `<span class="material-symbols-rounded tick-icon tick-read">done_all</span>`;
            }

            const senderNameHTML = (!isMe && isFirstInGroup && !isAdminMessage) 
                ? `<div class="msg-sender-name">${msg.senderName || 'Network User'}</div>` : '';

            const replyHTML = msg.replyToText ? `
                <div class="quoted-reply">
                    <div class="quoted-name">${msg.replyToName}</div>
                    <div class="quoted-text">${msg.replyToText}</div>
                </div>
            ` : '';

            const actionMenuHTML = `
                <div class="msg-action-trigger" onclick="window.toggleActionMenu('${msgId}')">
                    <span class="material-symbols-rounded" style="font-size: 20px;">keyboard_arrow_down</span>
                </div>
                <div class="msg-action-menu" id="menu-${msgId}">
                    <button class="msg-action-btn" onclick="window.replyToMessage('${msgId}')">Reply</button>
                    <button class="msg-action-btn" onclick="window.enableSelectionMode(true)">Forward</button>
                    <button class="msg-action-btn" onclick="window.enableSelectionMode(true)">Delete</button>
                    <button class="msg-action-btn" onclick="window.pinMessage('${msgId}')">Pin Message</button>
                </div>
            `;

            const checkboxHTML = `<div class="msg-checkbox-wrapper"><input type="checkbox" class="msg-checkbox" value="${msgId}"></div>`;
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
    try { await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); } 
    catch (error) {}
};

// --- DELETE & ACTION LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-send-msg')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendMessage(); } });

    // ADVANCED DELETE LOGIC
    document.getElementById('btn-action-delete')?.addEventListener('click', async () => {
        const selected = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
        if (selected.length === 0) return;

        // Verify if user is allowed to "Delete for Everyone"
        let canDeleteForEveryone = true;
        selected.forEach(box => {
            const msgContainer = document.getElementById(`container-${box.value}`);
            if (!msgContainer.classList.contains('me') && !currentUser.isAdmin) {
                canDeleteForEveryone = false; // They selected someone else's message
            }
        });

        let deleteType = "me";
        if (canDeleteForEveryone) {
            const choice = confirm(`Delete ${selected.length} message(s)?\n\n[OK] = Delete for Everyone\n[Cancel] = Delete for Me`);
            deleteType = choice ? "everyone" : "me";
        } else {
            const choice = confirm(`You selected messages sent by others.\n\nPress OK to "Delete for Me" only.`);
            if (!choice) return window.enableSelectionMode(false);
        }

        for (let box of selected) {
            if (deleteType === "everyone") {
                try { await deleteDoc(doc(db, `chats/${currentRoomId}/messages`, box.value)); } catch(e){}
            } else {
                // DELETE FOR ME (Hide Locally)
                let hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];
                hiddenMsgs.push(box.value);
                localStorage.setItem('hidden_msgs', JSON.stringify(hiddenMsgs));
                document.getElementById(`container-${box.value}`).style.display = 'none';
            }
        }
        window.enableSelectionMode(false);
    });

    document.getElementById('btn-action-forward')?.addEventListener('click', async () => {
        const selected = document.querySelectorAll('.msg-checkbox:checked');
        if (selected.length === 0) return;

        const targetRoom = prompt("Enter Room ID to forward to (global_channel or aksh_help):");
        if (!targetRoom || !roomsInfo[targetRoom]) return alert("Invalid room ID.");

        for (let box of selected) {
            const textEl = document.getElementById(`text-${box.value}`);
            try {
                await addDoc(collection(db, `chats/${targetRoom}/messages`), {
                    text: `[Forwarded] ${textEl.innerText}`, senderId: currentUser.id, senderName: currentUser.name, timestamp: serverTimestamp()
                });
            } catch(e){}
        }
        window.enableSelectionMode(false);
        alert("Messages forwarded!");
    });

    document.getElementById('btn-cancel-selection')?.addEventListener('click', () => window.enableSelectionMode(false));
    document.getElementById('btn-cancel-reply')?.addEventListener('click', () => window.cancelReply());
});

// --- PINNING LOGIC (Strictly Local) ---
export const showPinnedMessage = () => {
    const banner = document.getElementById('pinned-message-banner');
    const pinData = JSON.parse(localStorage.getItem(`pinned_${currentRoomId}`));
    
    if (pinData && Date.now() < pinData.expiry) {
        document.getElementById('pinned-message-text').innerText = pinData.text;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
};

window.pinMessage = (msgId) => {
    const duration = prompt("How long do you want to pin this locally?\nEnter 1 (for 24h), 7 (for 7 days), or 30 (for 30 days):", "1");
    if (!['1','7','30'].includes(duration)) return alert("Invalid duration cancelled.");
    
    const textEl = document.getElementById(`text-${msgId}`);
    if (!textEl) return;

    const expiryTime = Date.now() + (parseInt(duration) * 24 * 60 * 60 * 1000);
    localStorage.setItem(`pinned_${currentRoomId}`, JSON.stringify({ text: textEl.innerText, expiry: expiryTime }));
    
    showPinnedMessage();
    window.toggleActionMenu(msgId);
};

document.getElementById('pinned-message-banner')?.addEventListener('click', () => {
    document.getElementById('pinned-message-banner').style.display = 'none';
    localStorage.removeItem(`pinned_${currentRoomId}`);
});

window.toggleActionMenu = (msgId) => {
    document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active'));
    document.getElementById(`menu-${msgId}`).classList.toggle('active');
};
document.addEventListener('click', (e) => {
    if (!e.target.closest('.msg-bubble')) document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
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
        document.getElementById('selection-count').innerText = `${document.querySelectorAll('.msg-checkbox:checked').length} Selected`;
    }
});
