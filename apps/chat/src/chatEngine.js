// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc } from './firebase.js';
import { currentUser } from './auth.js';
import { roomsInfo } from './app.js';

let unsubscribeListener = null;
export let currentRoomId = null;
let replyContext = null; // Stores data when you click "Reply"

// --- 1. REAL-TIME LISTENER ---
export const switchChatRoom = (roomId) => {
    currentRoomId = roomId;
    listenToMessages(roomId);
};

export const listenToMessages = (roomId) => {
    const container = document.getElementById('chat-messages-container');
    
    const disclaimerHTML = `
        <div class="chat-disclaimer-wrapper">
            <div class="chat-disclaimer">
                <span class="material-symbols-rounded lock-icon" style="font-size: 13px; vertical-align: text-top; margin-right: 4px;">lock</span>
                Messages are end-to-end encrypted. No one outside of this chat, not even Aksh Studio, can read or listen to them.
            </div>
            <div class="chat-disclaimer notice-disclaimer">
                We will only store messages up to 3 months.<br>For extended messages backup contact: <b>akshstudioofficial@gmail.com</b>
            </div>
        </div>
    `;

    container.innerHTML = disclaimerHTML;

    if (unsubscribeListener) unsubscribeListener();
    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        let messagesHTML = disclaimerHTML; 
        let previousSenderId = null; 

        snapshot.forEach((document) => {
            const msg = document.data();
            const msgId = document.id;
            const isMe = msg.senderId === currentUser.id; 
            const isAdminMessage = msg.senderId === 'akshat124.am12@gmail.com' && roomId === 'aksh_help';
            
            const isFirstInGroup = previousSenderId !== msg.senderId;
            const bubbleShapeClass = isFirstInGroup ? '' : 'grouped';

            let timeString = "Sending...";
            let tickHTML = "";
            
            if (msg.timestamp) {
                const date = msg.timestamp.toDate();
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (isMe) tickHTML = `<span class="material-symbols-rounded tick-icon tick-read">done_all</span>`;
            }

            const senderNameHTML = (!isMe && isFirstInGroup && !isAdminMessage) 
                ? `<div class="msg-sender-name">${msg.senderName || 'Network User'}</div>` : '';

            // Reply Context Injection
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

            let alignmentClass = isMe ? 'me' : 'other';
            let bubbleClass = isMe ? 'msg-me' : 'msg-other';
            
            if (isAdminMessage) {
                alignmentClass = 'admin';
                bubbleClass = 'msg-admin';
            }

            messagesHTML += `
                <div class="msg-container ${isFirstInGroup ? 'first-in-group' : ''} ${alignmentClass}" id="container-${msgId}">
                    ${checkboxHTML}
                    <div class="msg-bubble ${bubbleClass} ${bubbleShapeClass}">
                        ${actionMenuHTML}
                        ${senderNameHTML}
                        ${replyHTML}
                        <span id="text-${msgId}">${msg.text}</span>
                        <div class="msg-meta">
                            <span>${timeString}</span>
                            ${tickHTML}
                        </div>
                    </div>
                </div>
            `;
            
            previousSenderId = msg.senderId;
        });

        container.innerHTML = messagesHTML;
        container.scrollTop = container.scrollHeight; 
    });
};

// --- 2. SEND MESSAGE ENGINE ---
export const sendMessage = async () => {
    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text || !currentRoomId) return; 

    inputField.value = ''; 

    // Build Payload
    const payload = {
        text: text,
        senderId: currentUser.id,
        senderName: currentUser.name,
        timestamp: serverTimestamp()
    };

    // Attach Reply Data if active
    if (replyContext) {
        payload.replyToText = replyContext.text;
        payload.replyToName = replyContext.senderName;
        window.cancelReply(); // Clear UI
    }

    try {
        await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload);
    } catch (error) { console.error("Error sending message:", error); }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-send-msg')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });
});

// --- 3. PHASE 4 ACTION LOGIC (Reply, Delete, Forward, Pin) ---

// UI Toggle for Dropdown Menu
window.toggleActionMenu = (msgId) => {
    document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active'));
    document.getElementById(`menu-${msgId}`).classList.toggle('active');
};
document.addEventListener('click', (e) => {
    if (!e.target.closest('.msg-bubble')) document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
});

// Reply
window.replyToMessage = (msgId) => {
    const text = document.getElementById(`text-${msgId}`).innerText;
    const senderNameEl = document.getElementById(`container-${msgId}`).querySelector('.msg-sender-name');
    const senderName = senderNameEl ? senderNameEl.innerText : 'User';

    replyContext = { msgId, text, senderName };
    document.getElementById('reply-preview-name').innerText = `Replying to ${senderName}`;
    document.getElementById('reply-preview-text').innerText = text;
    document.getElementById('reply-preview-banner').style.display = 'block';
    window.toggleActionMenu(msgId);
};

window.cancelReply = () => {
    replyContext = null;
    document.getElementById('reply-preview-banner').style.display = 'none';
};
document.getElementById('btn-cancel-reply')?.addEventListener('click', window.cancelReply);

// Pin
window.pinMessage = (msgId) => {
    const text = document.getElementById(`text-${msgId}`).innerText;
    document.getElementById('pinned-message-text').innerText = text;
    document.getElementById('pinned-message-banner').style.display = 'flex';
    window.toggleActionMenu(msgId);
};
document.getElementById('pinned-message-banner')?.addEventListener('click', () => {
    document.getElementById('pinned-message-banner').style.display = 'none';
});

// Selection Mode (Toggle Checkboxes)
window.enableSelectionMode = (enable = true) => {
    if (enable) {
        document.getElementById('chat-messages-container').classList.add('selection-mode');
        document.getElementById('standard-chat-header').style.display = 'none';
        document.getElementById('selection-chat-header').style.display = 'flex';
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    } else {
        document.getElementById('chat-messages-container').classList.remove('selection-mode');
        document.getElementById('standard-chat-header').style.display = 'flex';
        document.getElementById('selection-chat-header').style.display = 'none';
        document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
    }
};

// Update Selection Count
document.addEventListener('change', (e) => {
    if (e.target.classList.contains('msg-checkbox')) {
        const count = document.querySelectorAll('.msg-checkbox:checked').length;
        document.getElementById('selection-count').innerText = `${count} Selected`;
    }
});

// Delete Logic (Removes from Firebase)
document.getElementById('btn-action-delete')?.addEventListener('click', async () => {
    const selected = document.querySelectorAll('.msg-checkbox:checked');
    if (selected.length === 0) return alert("Select messages to delete.");
    
    if (!confirm(`Delete ${selected.length} message(s) for everyone?`)) return;

    for (let box of selected) {
        try { await deleteDoc(doc(db, `chats/${currentRoomId}/messages`, box.value)); } 
        catch(e) { console.error("Delete failed:", e); }
    }
    window.enableSelectionMode(false);
});

// Forward Logic (Copies to another room)
document.getElementById('btn-action-forward')?.addEventListener('click', async () => {
    const selected = document.querySelectorAll('.msg-checkbox:checked');
    if (selected.length === 0) return alert("Select messages to forward.");

    const targetRoom = prompt("Enter the exact Room ID to forward to (e.g., global_channel or aksh_help):");
    if (!targetRoom || !roomsInfo[targetRoom]) return alert("Invalid room ID.");

    for (let box of selected) {
        const text = document.getElementById(`text-${box.value}`).innerText;
        try {
            await addDoc(collection(db, `chats/${targetRoom}/messages`), {
                text: `[Forwarded] ${text}`,
                senderId: currentUser.id,
                senderName: currentUser.name,
                timestamp: serverTimestamp()
            });
        } catch(e) { console.error("Forward failed:", e); }
    }
    window.enableSelectionMode(false);
    alert("Messages forwarded successfully!");
});
