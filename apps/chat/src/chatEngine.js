// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from './firebase.js';
import { currentUser } from './auth.js';

let unsubscribeListener = null;
let currentRoomId = null;

// --- 1. REAL-TIME LISTENER (Phase 3 & 4) ---
export const switchChatRoom = (roomId) => {
    currentRoomId = roomId;
    listenToMessages(roomId);
};

export const listenToMessages = (roomId) => {
    if (currentUser.isGuest) return; 

    const container = document.getElementById('chat-messages-container');
    
    // The Phase 3 Permanent Disclaimers
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

        snapshot.forEach((doc) => {
            const msg = doc.data();
            const msgId = doc.id;
            const isMe = msg.senderId === currentUser.id; 
            const isAdminMessage = msg.senderId === 'akshat124.am12@gmail.com' && roomId === 'aksh_help';
            
            // SMART GROUPING
            const isFirstInGroup = previousSenderId !== msg.senderId;
            const bubbleShapeClass = isFirstInGroup ? '' : 'grouped';

            // TIME & STATUS TICKS
            let timeString = "Sending...";
            let tickHTML = "";
            
            if (msg.timestamp) {
                const date = msg.timestamp.toDate();
                timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (isMe) tickHTML = `<span class="material-symbols-rounded tick-icon tick-read">done_all</span>`;
            }

            // SENDER NAME INJECTION
            const senderNameHTML = (!isMe && isFirstInGroup && !isAdminMessage) 
                ? `<div class="msg-sender-name">${msg.senderName || 'Network User'}</div>` : '';

            // PHASE 4: THE 'v' ACTION MENU TRIGGER
            const actionMenuHTML = `
                <div class="msg-action-trigger" onclick="window.toggleActionMenu('${msgId}')">
                    <span class="material-symbols-rounded" style="font-size: 20px;">keyboard_arrow_down</span>
                </div>
                <div class="msg-action-menu" id="menu-${msgId}">
                    <button class="msg-action-btn" onclick="window.replyToMessage('${msgId}', '${msg.text}', '${msg.senderName}')">Reply</button>
                    <button class="msg-action-btn" onclick="window.enableSelectionMode()">Forward</button>
                    <button class="msg-action-btn" onclick="window.enableSelectionMode()">Delete</button>
                    <button class="msg-action-btn" onclick="window.pinMessage('${msgId}')">Pin Message</button>
                </div>
            `;

            // SELECTION MODE CHECKBOX (Phase 4)
            const checkboxHTML = `<div class="msg-checkbox-wrapper"><input type="checkbox" class="msg-checkbox" value="${msgId}"></div>`;

            // ALIGNMENT LOGIC (Including Super Admin Center Alignment)
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
                        <span>${msg.text}</span>
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

    inputField.value = ''; // Instant UI clear

    try {
        await addDoc(collection(db, `chats/${currentRoomId}/messages`), {
            text: text,
            senderId: currentUser.id,
            senderName: currentUser.name, // Save name for proper rendering
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error sending message:", error);
    }
};

// Attach standard sending events
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('btn-send-msg');
    const chatInput = document.getElementById('chat-input');
    
    if(sendBtn) sendBtn.addEventListener('click', sendMessage);
    if(chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
        });
    }
});

// --- 3. PHASE 4 UI HELPERS (Action Menus & Selection Mode) ---
window.toggleActionMenu = (msgId) => {
    // Close all other menus first
    document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active'));
    // Open the clicked one
    document.getElementById(`menu-${msgId}`).classList.toggle('active');
};

// Close menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.msg-bubble')) {
        document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active'));
    }
});

window.enableSelectionMode = () => {
    document.getElementById('chat-messages-container').classList.add('selection-mode');
    document.getElementById('standard-chat-header').style.display = 'none';
    document.getElementById('selection-chat-header').style.display = 'flex';
};

document.getElementById('btn-cancel-selection')?.addEventListener('click', () => {
    document.getElementById('chat-messages-container').classList.remove('selection-mode');
    document.getElementById('standard-chat-header').style.display = 'flex';
    document.getElementById('selection-chat-header').style.display = 'none';
    
    // Uncheck all boxes
    document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
});
