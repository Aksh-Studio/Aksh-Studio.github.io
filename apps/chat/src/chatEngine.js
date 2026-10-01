import { db, collection, addDoc, onSnapshot, query, orderBy, doc, setDoc, Timestamp } from './firebase.js';
import { currentUser } from './auth.js';
import { encryptMessage, decryptMessage } from './siteCipher.js';
import { initChatOptions } from './advancedEngine.js';
import { injectGroupAdminModal, populateGroupManagement } from './groupEngine.js';

let unsubscribeListener = null;
let roomStateListener = null;
export let currentRoomId = null;
export let currentRoomData = null; 
export let currentRoomMeta = { name: '', icon: '', type: '' }; 
export let currentMessagesSnapshot = []; 
let replyContext = null; 
let messageToPin = null; 
let myLastReceiptUpdate = 0; 

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

export const updateReadReceipt = async (roomId, uid) => {
    if (!roomId || !uid) return;
    try {
        await setDoc(doc(db, "chats", roomId), {
            [`readReceipts.${uid}`]: Date.now()
        }, { merge: true });
    } catch (error) {}
};

export const leaveChatRoom = () => {
    currentRoomId = null;
    if (unsubscribeListener) unsubscribeListener();
    if (roomStateListener) roomStateListener();
};

export const switchChatRoom = (roomId, passedName, passedIcon, passedType) => {
    currentRoomId = roomId;
    window.enableSelectionMode(false); 
    
    currentRoomMeta = { name: passedName, icon: passedIcon, type: passedType };
    
    const titleEl = document.getElementById('active-room-name');
    const iconBox = document.getElementById('active-room-icon-box');
    
    if (titleEl && passedName) titleEl.innerText = passedName;
    if (iconBox && passedIcon) {
        if (passedIcon.startsWith('http') || passedIcon.startsWith('data:image')) {
            iconBox.style.background = 'transparent';
            iconBox.innerHTML = `<img src="${passedIcon}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
            iconBox.style.background = '#dfe5e7';
            iconBox.innerHTML = `<span class="material-symbols-rounded">${passedType === 'group' ? 'groups' : 'person'}</span>`;
        }
    }

    listenToRoomState(roomId); 
    listenToMessages(roomId);
    
    try {
        const curId = currentUser?.id || currentUser?.uid;
        if (curId) updateReadReceipt(roomId, curId);
    } catch(e) {}
};

const renderMessagesUI = () => {
    if (!currentRoomId || !currentMessagesSnapshot) return;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];
    let messagesHTML = `
        <div class="chat-disclaimer-wrapper">
            <div class="chat-disclaimer">
                <span class="material-symbols-rounded lock-icon" style="font-size: 13px; vertical-align: middle;">lock</span> 
                <strong>End-to-End Encrypted</strong><br>
                <span style="font-size: 11px;">Messages are secured and private. <br>Note: Messages are stored for 60 days only. <br>For support: <a href="mailto:akshstudioofficial@gmail.com" style="color:var(--primary);">akshstudioofficial@gmail.com</a></span>
            </div>
        </div>`;    
    let previousSenderId = null; 
    
    const curId = currentUser?.id || currentUser?.uid;
    const readReceipts = currentRoomData?.readReceipts || {};
    
    const safeParticipants = Array.isArray(currentRoomData?.participants) ? currentRoomData.participants : [];
    let participantList = [...safeParticipants];
    
    if (currentRoomId.startsWith('dm_') && participantList.length === 0) {
        participantList = currentRoomId.replace('dm_', '').split('_');
    }
    const otherParticipants = participantList.filter(id => id !== curId);

    const clearTimestamp = currentRoomData ? (currentRoomData[`clearedAt_${curId}`] || 0) : 0;

    currentMessagesSnapshot.forEach((documentObj) => {
        const msgId = documentObj.id;
        const msg = documentObj.data();
        const msgTime = msg.localTimestamp || msg.timestamp || Date.now();
        
        if (msgTime <= clearTimestamp || hiddenMsgs.includes(msgId)) return;

        const isMe = msg.senderId === curId; 
        const isFirstInGroup = previousSenderId !== msg.senderId;
        const isSystemAdminMsg = msg.isOwner === true && (currentRoomId === 'global_channel' || currentRoomId === 'aksh_help');

        const decryptedText = msg.text ? decryptMessage(msg.text) : "";
        const formattedTextContent = parseWhatsAppFormatting(decryptedText);

        let timeString = "Sending...";
        let tickHTML = "";
        
        if (msg.timestamp && typeof msg.timestamp.toDate === 'function') {
            timeString = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            timeString = "Sent";
        }

        if (isMe) {
            let allRead = false;
            if (otherParticipants.length > 0) {
                allRead = otherParticipants.every(pid => {
                    const recObj = readReceipts[pid];
                    let rTime = 0;
                    if (recObj) {
                        if (typeof recObj.toMillis === 'function') rTime = recObj.toMillis();
                        else if (recObj.seconds) rTime = recObj.seconds * 1000;
                        else if (typeof recObj === 'number') rTime = recObj;
                    }
                    return rTime > 0 && rTime >= (msgTime - 5000);
                });
            }
            const tickColor = allRead ? "#53bdeb" : "#8696a0"; 
            tickHTML = `<span class="material-symbols-rounded tick-icon tick-read" style="color: ${tickColor}; font-size: 16px; margin-left: 2px;">done_all</span>`;
        }

        let roleBadge = '';
        if (msg.isOwner === true) {
            roleBadge = ' <span style="color:var(--primary); font-size:11px; font-weight:700;">(Owner)</span>';
        } else if (Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(msg.senderId)) {
            roleBadge = ' <span style="color:var(--text-muted); font-size:11px; font-weight:700;">(Admin)</span>';
        }

        const showName = isSystemAdminMsg || (!isMe && isFirstInGroup);
        const nameAlign = isSystemAdminMsg ? 'text-align: center; width: 100%;' : '';
        const senderNameHTML = showName ? `<div class="msg-sender-name" style="${nameAlign}">${msg.senderName || 'Network User'}${roleBadge}</div>` : '';
        
        const decryptedReplyText = msg.replyToText ? decryptMessage(msg.replyToText) : "";
        const replyHTML = msg.replyToText ? `<div class="quoted-reply"><div class="quoted-name">${msg.replyToName}</div><div class="quoted-text">${parseWhatsAppFormatting(decryptedReplyText)}</div></div>` : '';

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
        
        let mediaAttachmentHTML = '';
        if (msg.fileUrl) {
            const rawFileUrl = decryptMessage(msg.fileUrl);
            const rawFileName = msg.fileName ? decryptMessage(msg.fileName) : 'attachment';

            if (msg.fileType && msg.fileType.startsWith('image')) {
                mediaAttachmentHTML = `
                    <div style="position:relative; margin-bottom: 5px;">
                        <img src="${rawFileUrl}" style="width: 100%; max-height: 250px; border-radius: 8px; object-fit: cover; display: block;">
                        <a href="${rawFileUrl}" download="${rawFileName}" target="_blank" style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.6); color:white; padding:6px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none;">
                            <span class="material-symbols-rounded" style="font-size:16px;">download</span>
                        </a>
                    </div>`;
            } else {
                mediaAttachmentHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 8px; margin-bottom: 5px;">
                        <span class="material-symbols-rounded" style="font-size: 32px; color: var(--primary);">description</span>
                        <div style="flex: 1; overflow: hidden;">
                            <p style="font-size: 13px; font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${rawFileName}</p>
                        </div>
                        <a href="${rawFileUrl}" download="${rawFileName}" target="_blank" style="color: var(--primary); text-decoration: none; display: flex; align-items: center; justify-content: center; background: rgba(0, 168, 132, 0.1); width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;">
                            <span class="material-symbols-rounded" style="font-size:16px;">download</span>
                        </a>
                    </div>`;
            }
        } else if (msg.imageUrl) {
            const rawImageUrl = decryptMessage(msg.imageUrl);
            mediaAttachmentHTML = `
                <div style="position:relative; margin-bottom: 5px;">
                    <img src="${rawImageUrl}" style="width: 100%; max-height: 250px; border-radius: 8px; object-fit: cover; display: block;">
                    <a href="${rawImageUrl}" download="image.jpg" target="_blank" style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.6); color:white; padding:6px; border-radius:50%; display:flex; align-items:center; justify-content:center; text-decoration:none;">
                        <span class="material-symbols-rounded" style="font-size:16px;">download</span>
                    </a>
                </div>`;
        }

        messagesHTML += `
            <div class="msg-container ${isFirstInGroup ? 'first-in-group' : ''} ${alignmentClass}" id="container-${msgId}">
                ${checkboxHTML}
                <div class="msg-bubble ${bubbleClass} ${isFirstInGroup ? '' : 'grouped'}">
                    ${actionMenuHTML} ${senderNameHTML} ${replyHTML}
                    ${mediaAttachmentHTML}
                    <span id="text-${msgId}">${formattedTextContent}</span>
                    <div class="msg-meta"><span>${timeString}</span>${tickHTML}</div>
                </div>
            </div>
        `;
        previousSenderId = msg.senderId;
    });

    container.innerHTML = messagesHTML;
    container.scrollTop = container.scrollHeight; 
};

const listenToRoomState = async (roomId) => {
    if (roomStateListener) roomStateListener();

    const curId = currentUser?.id || currentUser?.uid;
    const uDoc = await getDoc(doc(db, "users", curId));
    const myBlockedList = uDoc.data()?.blockedUsers || [];

    roomStateListener = onSnapshot(doc(db, "chats", roomId), (documentObj) => {
        currentRoomData = documentObj.data() || { type: 'group', participants: [] }; 
        window.currentRoomData = currentRoomData;
        
        if (roomId.startsWith('dm_') && (!Array.isArray(currentRoomData.participants) || currentRoomData.participants.length === 0)) {
            const splitIds = roomId.replace('dm_', '').split('_');
            currentRoomData.participants = splitIds;
        }

        const isGroup = currentRoomData.type === 'group';
        let isBlocked = false;
        if (!isGroup) {
            const safeParticipants = Array.isArray(currentRoomData.participants) ? currentRoomData.participants : [];
            const targetUid = safeParticipants.find(id => id !== curId);
            if (targetUid && myBlockedList.includes(targetUid)) isBlocked = true;
        }

        const inputWrapper = document.getElementById('chat-input-wrapper');
        const blockedWrapper = document.getElementById('blocked-state-wrapper');
        if (isBlocked) {
            if(inputWrapper) inputWrapper.style.display = 'none';
            if(blockedWrapper) blockedWrapper.style.display = 'block';
        } else {
            if(inputWrapper) inputWrapper.style.display = 'flex';
            if(blockedWrapper) blockedWrapper.style.display = 'none';
        }

        initChatOptions(currentUser, roomId, currentRoomData);
        
        const banner = document.getElementById('pinned-message-banner');
        if (banner && currentRoomData.pinnedMessage && Date.now() < currentRoomData.pinExpiry) {
            const decPin = decryptMessage(currentRoomData.pinnedMessage);
            document.getElementById('pinned-message-text').innerHTML = parseWhatsAppFormatting(decPin);
            const titleEl = banner.querySelector('p');
            if (titleEl) titleEl.innerText = "Pinned Message";
            banner.style.display = 'flex';
        } else if (banner) {
            banner.style.display = 'none';
        }

        const isOwner = String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
        const isAdmin = Array.isArray(currentRoomData.admins) && currentRoomData.admins.includes(curId);
        
        const isSystemGroup = roomId === 'global_channel' || roomId === 'aksh_help';
        const canEditSystem = isSystemGroup ? isOwner : false; 
        const canEditCustom = isOwner || isAdmin;
        const canEdit = isSystemGroup ? canEditSystem : canEditCustom;
        
        const existingGear = document.getElementById('group-settings-btn');
        if (existingGear) existingGear.remove();

        const titleEl = document.getElementById('active-room-name');
        if (titleEl) {
            let displayRoomName = currentRoomData.name || 'Chat';
            if (currentRoomData.type === 'dm') {
                const otherId = currentRoomData.participants?.find(id => id !== curId);
                if (otherId && currentRoomData.names?.[otherId]) {
                    displayRoomName = currentRoomData.names[otherId];
                }
            }
            if(displayRoomName !== 'Chat') titleEl.innerText = displayRoomName;
            
            if (currentRoomData.type === 'group' || (isSystemGroup && canEditSystem)) {
                const gearHTML = `<span id="group-settings-btn" title="Group Settings" class="material-symbols-rounded" style="font-size: 20px; color: var(--primary); margin-left: 10px; cursor: pointer;">settings</span>`;
                if (!titleEl.innerHTML.includes('group-settings-btn')) titleEl.insertAdjacentHTML('beforeend', gearHTML);
                
                const gBtn = document.getElementById('group-settings-btn');
                if(gBtn) gBtn.addEventListener('click', (e) => {
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
        
        if (currentMessagesSnapshot.length > 0) renderMessagesUI();
    }, (error) => { console.warn("Room listener suppressed:", error.message); });
};

export const listenToMessages = (roomId) => {
    if (unsubscribeListener) unsubscribeListener();
    const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);

    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));

    unsubscribeListener = onSnapshot(q, (snapshot) => {
        if (currentRoomId !== roomId) return; 
        
        currentMessagesSnapshot = snapshot.docs.filter(docObj => {
            const msg = docObj.data();
            const msgTime = msg.localTimestamp || msg.timestamp || Date.now();
            return msgTime > sixtyDaysAgo;
        });
        
        const curId = currentUser?.id || currentUser?.uid;
        if (snapshot.docs.length > 0) {
            const lastMsg = snapshot.docs[snapshot.docs.length - 1].data();
            if (lastMsg.senderId !== curId && document.visibilityState === 'visible') {
                if (Date.now() - myLastReceiptUpdate > 2000) {
                    myLastReceiptUpdate = Date.now();
                    updateReadReceipt(roomId, curId);
                }
            }
        }
        
        renderMessagesUI();
    }, (error) => { console.warn("Message listener suppressed:", error.message); });
};

export const sendMessage = async () => {
    if (currentUser?.isGuest) return;
    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text || !currentRoomId) return; 

    inputField.value = ''; 
    const curId = currentUser?.id || currentUser?.uid;
    const isOwner = String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
    
    const scrambledText = encryptMessage(text);
    
    const payload = { 
        text: scrambledText, 
        senderId: curId, 
        senderName: currentUser?.name || 'User', 
        isOwner: isOwner, 
        timestamp: Date.now(),
        localTimestamp: Date.now(),
        expireAt: Timestamp.fromMillis(Date.now() + 60 * 24 * 60 * 60 * 1000)    
    };

    if (replyContext) {
        payload.replyToText = encryptMessage(replyContext.text);
        payload.replyToName = replyContext.senderName;
        window.cancelReply(); 
    }
    
    try { 
        await addDoc(collection(db, `chats/${currentRoomId}/messages`), payload); 
        myLastReceiptUpdate = Date.now();
        await setDoc(doc(db, "chats", currentRoomId), { [`readReceipts.${curId}`]: Date.now(), lastMessageTime: Date.now(), lastMessageSenderId: curId }, { merge: true });
    } catch (error) {}
};

window.forwardSelectedMessages = async () => {
    const selectedBoxes = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
    if (selectedBoxes.length === 0) return alert("Select a message to forward first.");

    if (!document.getElementById('forward-modal')) {
        document.body.insertAdjacentHTML('beforeend', `<div id="forward-modal" class="guest-overlay" style="display: none; z-index: 10003;"><div class="guest-modal" style="padding: 20px; width: 90%; max-width: 350px;"><h3 style="margin-bottom: 15px; color: var(--primary);">Forward To:</h3><div id="forward-rooms-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 15px;"></div><button onclick="document.getElementById('forward-modal').style.display='none'" style="width: 100%; padding: 10px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Cancel</button></div></div>`);
    }

    const listEl = document.getElementById('forward-rooms-list');
    listEl.innerHTML = '';
    
    const availableRooms = window.getAvailableRooms ? window.getAvailableRooms() : {};
    if (Object.keys(availableRooms).length === 0) listEl.innerHTML = '<p style="padding: 10px; text-align:center; color: var(--text-muted);">No chats available.</p>';

    Object.keys(availableRooms).forEach(roomId => {
        const room = availableRooms[roomId];
        const item = document.createElement('div');
        item.style = "padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text-main); font-weight: 600;";
        item.innerText = room.name;
        item.onclick = async () => {
            document.getElementById('forward-modal').style.display = 'none';
            const curId = currentUser?.id || currentUser?.uid;
            const isOwner = String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
            
            for (const box of selectedBoxes) {
                try {
                    const msgDoc = await getDoc(doc(db, `chats/${currentRoomId}/messages`, box.value));
                    if (msgDoc.exists()) {
                        const originalData = msgDoc.data();
                        let finalizedText = originalData.text ? decryptMessage(originalData.text) : "";
                        if (!finalizedText.includes("Forwarded")) finalizedText = "_▶ Forwarded_\n" + finalizedText;

                        const fwdPayload = {
                            text: encryptMessage(finalizedText),
                            imageUrl: originalData.imageUrl || null,
                            fileUrl: originalData.fileUrl || null,
                            fileType: originalData.fileType || null,
                            fileName: originalData.fileName || null,
                            senderId: curId,
                            senderName: currentUser?.name || 'User',
                            isOwner: isOwner,
                            timestamp: Date.now(),
                            localTimestamp: Date.now(),
                            expireAt: Timestamp.fromMillis(Date.now() + 60 * 24 * 60 * 60 * 1000)
                        };
                        await addDoc(collection(db, `chats/${roomId}/messages`), fwdPayload);
                    }
                } catch(e) {}
            }
            await setDoc(doc(db, "chats", roomId), { lastMessageTime: Date.now(), lastMessageSenderId: curId }, { merge: true });
            window.enableSelectionMode(false);
            alert("Messages forwarded successfully.");
        };
        listEl.appendChild(item);
    });
    document.getElementById('forward-modal').style.display = 'flex';
};

window.triggerPinModal = (msgId) => { 
    messageToPin = msgId; 
    window.toggleActionMenu(msgId); 
    const pinModal = document.getElementById('pin-modal');
    if(pinModal) pinModal.style.display = 'flex'; 
};

window.toggleActionMenu = (msgId) => { 
    document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active')); 
    const menu = document.getElementById(`menu-${msgId}`); 
    if(menu) menu.classList.add('active'); 
};

document.addEventListener('click', (e) => { if (!e.target.closest('.msg-bubble')) { document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active')); } });

window.replyToMessage = (msgId) => {
    const textEl = document.getElementById(`text-${msgId}`);
    const senderNameEl = document.getElementById(`container-${msgId}`).querySelector('.msg-sender-name');
    replyContext = { msgId, text: textEl ? textEl.innerText : '', senderName: senderNameEl ? senderNameEl.innerText : 'User' };
    
    const prevName = document.getElementById('reply-preview-name');
    const prevText = document.getElementById('reply-preview-text');
    const prevBanner = document.getElementById('reply-preview-banner');
    
    if (prevName) prevName.innerText = `Replying to ${replyContext.senderName}`;
    if (prevText) prevText.innerText = replyContext.text;
    if (prevBanner) prevBanner.style.display = 'block';
    
    window.toggleActionMenu(msgId);
};
window.cancelReply = () => { 
    replyContext = null; 
    const banner = document.getElementById('reply-preview-banner');
    if(banner) banner.style.display = 'none'; 
};

window.enableSelectionMode = (enable = true) => {
    const container = document.getElementById('chat-messages-container');
    const selectionHeader = document.getElementById('selection-chat-header');
    const stdHeader = document.getElementById('standard-chat-header');
    
    if (enable) {
        if(container) container.classList.add('selection-mode');
        if(stdHeader) stdHeader.style.display = 'none';
        document.querySelectorAll('#injected-close-btn').forEach(b => b.remove());
        if (selectionHeader) selectionHeader.style.display = 'flex';
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    } else {
        if(container) container.classList.remove('selection-mode');
        if(stdHeader) stdHeader.style.display = 'flex';
        if (selectionHeader) selectionHeader.style.display = 'none';
        document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
        const countTxt = document.getElementById('selection-count');
        if (countTxt) countTxt.innerText = `0 Selected`;
    }
};

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('msg-checkbox')) {
        const count = document.querySelectorAll('.msg-checkbox:checked').length;
        const countTxt = document.getElementById('selection-count');
        if (countTxt) countTxt.innerText = `${count} Selected`;
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentRoomId) {
        const curId = currentUser?.id || currentUser?.uid;
        if (curId && (Date.now() - myLastReceiptUpdate > 2000)) {
            myLastReceiptUpdate = Date.now();
            try { setDoc(doc(db, "chats", currentRoomId), { [`readReceipts.${curId}`]: Date.now() }, { merge: true }); } catch(e){}
        }
    }
});
