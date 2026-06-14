// src/chatEngine.js
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, deleteDoc, setDoc, getDocs } from './firebase.js';
import { currentUser } from './auth.js';

let unsubscribeListener = null;
let roomStateListener = null;
export let currentRoomId = null;
let replyContext = null; 
let messageToPin = null; 

let localStream = null;

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

// --- TWO-WAY CALLING SYNCHRONIZATION ---
const startLocalMedia = async (isVideo) => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        if (isVideo) {
            const videoContainer = document.getElementById('video-container');
            let videoEl = document.getElementById('local-video-stream');
            if (!videoEl) {
                videoEl = document.createElement('video');
                videoEl.id = 'local-video-stream';
                videoEl.autoplay = true; videoEl.playsInline = true; videoEl.muted = true; 
                videoEl.style = 'width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; border-radius: 16px;';
                videoContainer.appendChild(videoEl);
            }
            videoEl.srcObject = localStream;
            videoEl.style.display = 'block';
        }
    } catch(e) { console.error("Hardware Blocked", e); }
};

const startCallUI = async (type) => {
    const targetName = document.getElementById('active-room-name').innerText;
    const overlay = document.getElementById('call-overlay');
    
    // Logs outbound call locally
    let logs = JSON.parse(localStorage.getItem('call_logs')) || [];
    logs.push({ target: targetName, type: type, status: 'Outgoing', date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });
    localStorage.setItem('call_logs', JSON.stringify(logs));

    // Signalling Firestore to ring the RECIPIENT'S device!
    try {
        await setDoc(doc(db, "chats", currentRoomId), {
            callState: { callerId: currentUser.id || currentUser.uid, callerName: currentUser.name, type: type, status: 'ringing', timestamp: Date.now() }
        }, { merge: true });

        if (overlay) {
            document.getElementById('call-target-name').innerText = targetName;
            document.getElementById('call-status-text').innerText = 'Calling...';
            document.getElementById('call-center-icon').innerText = type === 'Video' ? 'videocam' : 'person';
            
            // Reset Call Answer Button to normal End state for caller
            document.getElementById('btn-call-record').style.display = 'block';
            const micBtn = document.getElementById('btn-call-mic');
            micBtn.innerHTML = `<span class="material-symbols-rounded">mic</span>`;
            micBtn.style.background = '#202c33';
            micBtn.onclick = null; // Clear incoming hack

            overlay.style.display = 'flex';
            startLocalMedia(type === 'Video');
        }
    } catch(e) { console.error(e); }
};

const endCallUI = async (updateDB = true) => {
    const overlay = document.getElementById('call-overlay');
    document.getElementById('call-status-text').innerText = 'Call Ended';
    
    // Signal Firestore to terminate call on BOTH devices
    if (updateDB && currentRoomId) {
        try { await setDoc(doc(db, "chats", currentRoomId), { callState: { status: 'ended' } }, { merge: true }); } catch(e){}
    }

    if (localStream) { localStream.getTracks().forEach(track => track.stop()); localStream = null; }
    const videoEl = document.getElementById('local-video-stream');
    if (videoEl) videoEl.style.display = 'none';

    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 800);
};

export const switchChatRoom = (roomId) => {
    currentRoomId = roomId;
    const isPublicGroup = roomId === 'global_channel' || roomId === 'aksh_help';
    const audioBtn = document.getElementById('btn-start-audio-call');
    const videoBtn = document.getElementById('btn-start-video-call');
    
    if (audioBtn) audioBtn.style.display = isPublicGroup ? 'none' : 'block';
    if (videoBtn) videoBtn.style.display = isPublicGroup ? 'none' : 'block';

    listenToRoomState(roomId); // Handles both Pins and Incoming Calls!
    listenToMessages(roomId);
};

// COMBINED LISTENER: Pins & Incoming Calls
const listenToRoomState = (roomId) => {
    if (roomStateListener) roomStateListener();
    
    roomStateListener = onSnapshot(doc(db, "chats", roomId), (documentObj) => {
        const data = documentObj.data();
        if (!data) return;

        // 1. PINNED MESSAGE RENDERER
        const banner = document.getElementById('pinned-message-banner');
        if (banner && data.pinnedMessage && Date.now() < data.pinExpiry) {
            document.getElementById('pinned-message-text').innerHTML = parseWhatsAppFormatting(data.pinnedMessage);
            const titleEl = banner.querySelector('p');
            if (titleEl) titleEl.innerText = "Pinned Message";
            banner.style.display = 'flex';
        } else if (banner) {
            banner.style.display = 'none';
        }

        // 2. INCOMING CALL RENDERER
        const curId = currentUser?.id || currentUser?.uid;
        const overlay = document.getElementById('call-overlay');
        
        if (data.callState && data.callState.status === 'ringing' && data.callState.callerId !== curId) {
            // RECIEVER SEES INCOMING CALL!
            if (overlay && overlay.style.display !== 'flex') {
                document.getElementById('call-target-name').innerText = data.callState.callerName;
                document.getElementById('call-status-text').innerText = `Incoming ${data.callState.type} Call...`;
                document.getElementById('call-center-icon').innerText = data.callState.type === 'Video' ? 'videocam' : 'call';
                
                // Hijack the middle button to act as a green 'Answer' button
                document.getElementById('btn-call-record').style.display = 'none'; 
                const answerBtn = document.getElementById('btn-call-mic');
                answerBtn.innerHTML = `<span class="material-symbols-rounded">call</span>`;
                answerBtn.style.background = '#00a884'; // Green Accept
                
                answerBtn.onclick = async () => {
                    await setDoc(doc(db, "chats", currentRoomId), { callState: { ...data.callState, status: 'answered' } }, { merge: true });
                    document.getElementById('call-status-text').innerText = 'Connected';
                    answerBtn.style.background = '#202c33';
                    answerBtn.innerHTML = `<span class="material-symbols-rounded">mic</span>`;
                    startLocalMedia(data.callState.type === 'Video');
                };
                
                overlay.style.display = 'flex';
            }
        } else if (data.callState && data.callState.status === 'ended') {
            // Call terminated remotely
            if (overlay && overlay.style.display === 'flex') {
                document.getElementById('call-status-text').innerText = 'Call Ended';
                setTimeout(() => endCallUI(false), 800); 
            }
        } else if (data.callState && data.callState.status === 'answered' && data.callState.callerId === curId) {
            // Caller sees that the receiver accepted!
            document.getElementById('call-status-text').innerText = 'Connected';
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
            const isAdminMessage = currentUser?.isAdmin && msg.senderId === curId && roomId === 'aksh_help';
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
                    // Compress Image via Canvas to bypass Firebase size limits!
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800; // Resize to perfect chat-width
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6); // Compress to 60% quality (~100kb)

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

    // Call Buttons
    document.getElementById('btn-start-audio-call')?.addEventListener('click', () => startCallUI('Voice'));
    document.getElementById('btn-start-video-call')?.addEventListener('click', () => startCallUI('Video'));
    document.getElementById('btn-call-end')?.addEventListener('click', () => endCallUI(true)); // update db on end

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
        selected.forEach(box => { if (box.getAttribute('data-sender') !== curId && !currentUser?.isAdmin) { hasUnauthorizedMessage = true; } });
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
