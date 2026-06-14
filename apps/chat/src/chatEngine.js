// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc } from './firebase.js';
import { currentUser } from './auth.js';
import { roomsInfo } from './app.js';

let unsubscribeListener = null;
export let currentRoomId = null;
let replyContext = null; 

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

        snapshot.forEach((documentObj) => {
            const msg = documentObj.data();
            const msgId = documentObj.id;
            const isMe = msg.senderId === currentUser.id; 
            const isAdminMessage = currentUser.isAdmin && msg.senderId === currentUser.id && roomId === 'aksh_help';
            
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
    if (currentUser.isGuest) return;

    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text || !currentRoomId) return; 

    inputField.value = ''; 

    const payload = {
        text: text,
        senderId: currentUser.id,
        senderName: currentUser.name,
        timestamp: serverTimestamp()
    };

    if (replyContext) {
        payload.replyToText = replyContext.text;
        payload.replyToName = replyContext.senderName;
        window.cancelReply(); 
    }

    try {
        await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload);
    } catch (error) { console.error("Error sending message:", error); }
};

// --- 3. UI ACTION LISTENERS (SAFELY LOADED) ---
document.addEventListener('DOMContentLoaded', () => {
    // Send Button
    document.getElementById('btn-send-msg')?.addEventListener('click', sendMessage);
    document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
    });

    // Delete Button Logic
    document.getElementById('btn-action-delete')?.addEventListener('click', async () => {
        const selected = document.querySelectorAll('.msg-checkbox:checked');
        if (selected.length === 0) return alert("Please select at least one message to delete.");
        
        if (!confirm(`Are you sure you want to delete ${selected.length} message(s)? This cannot be undone.`)) return;

        for (let box of selected) {
            try { 
                await deleteDoc(doc(db, `chats/${currentRoomId}/messages`, box.value)); 
            } catch(e) { 
                console.error("Delete failed:", e); 
                alert("Error deleting message. Check Firebase Rules.");
            }
        }
        window.enableSelectionMode(false);
    });

    // Forward Button Logic
    document.getElementById('btn-action-forward')?.addEventListener('click', async () => {
        const selected = document.querySelectorAll('.msg-checkbox:checked');
        if (selected.length === 0) return alert("Please select at least one message to forward.");

        const targetRoom = prompt("Enter the exact Room ID to forward to (e.g., global_channel or aksh_help):");
        if (!targetRoom || !roomsInfo[targetRoom]) return alert("Invalid room ID. Forward cancelled.");

        for (let box of selected) {
            const textEl = document.getElementById(`text-${box.value}`);
            const textToForward = textEl ? textEl.innerText : "Forwarded Message";
            
            try {
                await addDoc(collection(db, `chats/${targetRoom}/messages`), {
                    text: `[Forwarded] ${textToForward}`,
                    senderId: currentUser.id,
                    senderName: currentUser.name,
                    timestamp: serverTimestamp()
                });
            } catch(e) { console.error("Forward failed:", e); }
        }
        window.enableSelectionMode(false);
        alert("Messages forwarded successfully!");
    });

    // Cancel Selection Mode
    document.getElementById('btn-cancel-selection')?.addEventListener('click', () => {
        window.enableSelectionMode(false);
    });

    // Cancel Reply
    document.getElementById('btn-cancel-reply')?.addEventListener('click', () => {
        window.cancelReply();
    });

    // Hide Pinned Banner
    document.getElementById('pinned-message-banner')?.addEventListener('click', () => {
        document.getElementById('pinned-message-banner').style.display = 'none';
    });
});

// --- GLOBAL HELPERS ---
window.toggleActionMenu = (msgId) => {
    document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active'));
    document.getElementById(`menu-${msgId}`).classList.toggle('active');
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.msg-bubble')) {
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    }
});

window.replyToMessage = (msgId) => {
    const textEl = document.getElementById(`text-${msgId}`);
    if (!textEl) return;
    
    const text = textEl.innerText;
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
    const banner = document.getElementById('reply-preview-banner');
    if(banner) banner.style.display = 'none';
};

window.pinMessage = (msgId) => {
    const textEl = document.getElementById(`text-${msgId}`);
    if (!textEl) return;
    
    document.getElementById('pinned-message-text').innerText = textEl.innerText;
    document.getElementById('pinned-message-banner').style.display = 'flex';
    window.toggleActionMenu(msgId);
};

window.enableSelectionMode = (enable = true) => {
    const container = document.getElementById('chat-messages-container');
    const stdHeader = document.getElementById('standard-chat-header');
    const selHeader = document.getElementById('selection-chat-header');
    
    if (!container || !stdHeader || !selHeader) return;

    if (enable) {
        container.classList.add('selection-mode');
        stdHeader.style.display = 'none';
        selHeader.style.display = 'flex';
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    } else {
        container.classList.remove('selection-mode');
        stdHeader.style.display = 'flex';
        selHeader.style.display = 'none';
        document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
    }
};

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('msg-checkbox')) {
        const count = document.querySelectorAll('.msg-checkbox:checked').length;
        const countEl = document.getElementById('selection-count');
        if (countEl) countEl.innerText = `${count} Selected`;
    }
});
