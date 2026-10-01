import { db, collection, addDoc, onSnapshot, query, orderBy, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, Timestamp, writeBatch } from './firebase.js';
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
        await updateDoc(doc(db, "chats", roomId), {
            [`readReceipts.${uid}`]: Date.now()
        });
    } catch (error) {
        try { await setDoc(doc(db, "chats", roomId), { readReceipts: { [uid]: Date.now() } }, { merge: true }); } catch(e) {}
    }
};

window.leaveChatRoom = () => {
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
    const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
    const readReceipts = currentRoomData?.readReceipts || {};
    
    const safeParticipants = Array.isArray(currentRoomData?.participants) ? currentRoomData.participants : [];
    let participantList = [...safeParticipants];
    
    if (currentRoomId.startsWith('dm_') && participantList.length === 0) {
        participantList = currentRoomId.replace('dm_', '').split('_');
    }
    const otherParticipants = participantList.filter(id => id !== curId);
    const clearTimestamp = currentRoomData ? (currentRoomData[`clearedAt_${curId}`] || 0) : 0;
    const isSystemGroup = currentRoomId === 'global_channel' || currentRoomId === 'aksh_help';

    currentMessagesSnapshot.forEach((documentObj) => {
        const msgId = documentObj.id;
        const msg = documentObj.data();
        const msgTime = msg.localTimestamp || msg.timestamp || Date.now();
        
        if (msgTime <= clearTimestamp || hiddenMsgs.includes(msgId)) return;

        const isMe = msg.senderId === curId; 
        const isFirstInGroup = previousSenderId !== msg.senderId;
        const isSystemAdminMsg = msg.isOwner === true && isSystemGroup;

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
                    return rTime > 0 && rTime >= (msgTime - 30000);
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

        // FIX: Pin Message Privileges (Only Owner in Global, Admins elsewhere)
        let canPin = false;
        if (isSystemGroup) {
            canPin = isCurrentOwner;
        } else {
            const isAdmin = Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(curId);
            canPin = isCurrentOwner || isAdmin;
        }
        const pinBtnHTML = canPin ? `<button class="msg-action-btn" onclick="window.triggerPinModal('${msgId}')">Pin Message</button>` : '';

        const actionMenuHTML = `
            <div class="msg-action-trigger" onclick="window.toggleActionMenu('${msgId}')">
                <span class="material-symbols-rounded" style="font-size: 20px;">keyboard_arrow_down</span>
            </div>
            <div class="msg-action-menu" id="menu-${msgId}">
                <button class="msg-action-btn" onclick="window.replyToMessage('${msgId}')">Reply</button>
                <button class="msg-action-btn" onclick="window.startForwardSingleMessage('${msgId}')">Forward</button>
                <button class="msg-action-btn" onclick="window.startDeleteSingleMessage('${msgId}')">Delete</button>
                ${pinBtnHTML}
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
    let myBlockedList = [];

    if (curId) {
        try {
            const uDoc = await getDoc(doc(db, "users", curId));
            if (uDoc.exists()) {
                myBlockedList = uDoc.data()?.blockedUsers || [];
            }
        } catch(e) {}
    }

    roomStateListener = onSnapshot(doc(db, "chats", roomId), async (documentObj) => {
        if (!documentObj.exists()) {
            if (currentRoomId === roomId) {
                alert("This chat has been deleted.");
                window.location.reload();
            }
            return;
        }

        currentRoomData = documentObj.data(); 
        window.currentRoomData = currentRoomData;
        window.isTargetOwner = false; 

        if (roomId.startsWith('dm_') && (!Array.isArray(currentRoomData.participants) || currentRoomData.participants.length === 0)) {
            currentRoomData.participants = roomId.replace('dm_', '').split('_');
        }

        const isGroup = currentRoomData.type === 'group';
        const isSystemGroup = roomId === 'global_channel' || roomId === 'aksh_help';
        const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';

        if (isGroup && !isSystemGroup) {
            if (Array.isArray(currentRoomData.participants) && !currentRoomData.participants.includes(curId) && !isCurrentOwner) {
                if (currentRoomId === roomId) {
                    alert("You have been removed from this group.");
                    window.location.reload();
                }
                return;
            }
        }

        let isBlocked = false;
        let theyBlockedMe = false;

        if (!isGroup && !isSystemGroup && curId) {
            const safeParticipants = Array.isArray(currentRoomData.participants) ? currentRoomData.participants : [];
            const targetUid = safeParticipants.find(id => id !== curId);
            if (targetUid) {
                if (myBlockedList.includes(targetUid)) isBlocked = true;
                
                try {
                    const targetDoc = await getDoc(doc(db, "users", targetUid));
                    if (targetDoc.exists()) {
                        const targetData = targetDoc.data();
                        if (targetData.blockedUsers?.includes(curId)) {
                            theyBlockedMe = true;
                            isBlocked = true;
                        }
                        if (String(targetData.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com') {
                            window.isTargetOwner = true;
                        }
                    }
                } catch(e) {}
            }
        }

        const inputWrapper = document.getElementById('chat-input-wrapper');
        const blockedWrapper = document.getElementById('blocked-state-wrapper');
        if (isBlocked) {
            if (inputWrapper) inputWrapper.style.display = 'none';
            if (blockedWrapper) {
                blockedWrapper.style.display = 'block';
                blockedWrapper.innerText = theyBlockedMe ? "You have been blocked by this contact." : "You have blocked this contact. Unblock them in settings to send a message.";
            }
        } else {
            if (inputWrapper) inputWrapper.style.display = 'flex';
            if (blockedWrapper) blockedWrapper.style.display = 'none';
        }

        initChatOptions(currentUser, roomId, currentRoomData);
        
        const banner = document.getElementById('pinned-message-banner');
        if (banner && currentRoomData.pinnedMessage && Date.now() < (currentRoomData.pinExpiry || 0)) {
            const decPin = decryptMessage(currentRoomData.pinnedMessage);
            document.getElementById('pinned-message-text').innerHTML = parseWhatsAppFormatting(decPin);
            banner.style.display = 'flex';
        } else if (banner) {
            banner.style.display = 'none';
        }

        const isAdmin = Array.isArray(currentRoomData.admins) && currentRoomData.admins.includes(curId);
        const canEditSystem = isSystemGroup ? isCurrentOwner : false; 
        const canEditCustom = isCurrentOwner || isAdmin;
        const canEdit = isSystemGroup ? canEditSystem : canEditCustom;
        
        const existingGear = document.getElementById('group-settings-btn');
        if (existingGear) {
            if ((isGroup || isSystemGroup) && canEdit) {
                existingGear.style.display = 'inline-flex';
                existingGear.onclick = (e) => {
                    e.stopPropagation();
                    injectGroupAdminModal(); 
                    
                    const groupEditSec = document.getElementById('group-edit-section');
                    const transferSec = document.getElementById('transfer-admin-section');
                    const btnSaveGroup = document.getElementById('btn-save-group');
                    const btnDeleteGroup = document.getElementById('btn-delete-group');
                    const addMemberSec = document.getElementById('add-member-section');
                    const manageMemberSec = document.getElementById('manage-members-section');

                    if (groupEditSec) groupEditSec.style.display = canEdit ? 'block' : 'none';
                    if (transferSec) transferSec.style.display = (canEdit && !isSystemGroup) ? 'block' : 'none';
                    if (btnSaveGroup) btnSaveGroup.style.display = canEdit ? 'block' : 'none';
                    if (btnDeleteGroup) btnDeleteGroup.style.display = (canEdit && !isSystemGroup) ? 'block' : 'none';
                    if (addMemberSec) addMemberSec.style.display = isSystemGroup ? 'none' : 'block';
                    if (manageMemberSec) manageMemberSec.style.display = isSystemGroup ? 'none' : 'block';

                    if (canEdit) {
                        document.getElementById('edit-group-name').value = currentRoomData.name || '';
                        document.getElementById('edit-group-icon').value = currentRoomData.icon?.startsWith('http') ? currentRoomData.icon : '';
                        document.getElementById('group-icon-preview').src = currentRoomData.icon?.startsWith('data:image') || currentRoomData.icon?.startsWith('http') ? currentRoomData.icon : 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                    }
                    
                    populateGroupManagement(currentRoomData.participants || [], currentRoomData.admins || []);
                    const groupModal = document.getElementById('group-admin-modal');
                    if(groupModal) groupModal.style.display = 'flex';
                };
            } else {
                existingGear.style.display = 'none';
            }
        }

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
        }
        
        if (currentMessagesSnapshot.length > 0) renderMessagesUI();
    }, (error) => { /* Suppress Error Logs Safely */ });
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
        if (snapshot.docs.length > 0 && curId) {
            const lastMsg = snapshot.docs[snapshot.docs.length - 1].data();
            if (lastMsg.senderId !== curId && document.visibilityState === 'visible') {
                if (Date.now() - myLastReceiptUpdate > 2000) {
                    myLastReceiptUpdate = Date.now();
                    updateReadReceipt(roomId, curId);
                }
            }
        }
        
        renderMessagesUI();
    }, (error) => { /* Suppress Error Logs Safely */ });
};

export const sendMessage = async () => {
    if (currentUser?.isGuest) return;
    const inputField = document.getElementById('chat-input');
    const text = inputField.value.trim();
    if (!text || !currentRoomId) return; 

    const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
    
    // OWNER PRIVACY: Ignore messages attempting to reach Owner if they are not the Owner
    if (window.isTargetOwner && !isCurrentOwner) {
        const ownerHasMessaged = currentMessagesSnapshot.some(docObj => {
            return docObj.data().isOwner === true || String(docObj.data().senderName).includes('Owner');
        });
        if (!ownerHasMessaged) {
            inputField.value = ''; 
            alert("You cannot message the Owner until they initiate a conversation with you.");
            return;
        }
    }

    inputField.value = ''; 
    const curId = currentUser?.id || currentUser?.uid;
    const scrambledText = encryptMessage(text);
    const payload = { 
        text: scrambledText, 
        senderId: curId, 
        senderName: currentUser?.name || 'User', 
        isOwner: isCurrentOwner, 
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
        
        const targetUpdate = {};
        if (currentRoomData?.type === 'dm') {
            const otherParticipant = currentRoomData.participants.find(id => id !== curId);
            if (otherParticipant) {
                targetUpdate[`deletedFor_${otherParticipant}`] = false;
            }
        }
        
        await updateDoc(doc(db, "chats", currentRoomId), { 
            [`readReceipts.${curId}`]: Date.now(), 
            lastMessageTime: Date.now(), 
            lastMessageSenderId: curId,
            ...targetUpdate
        });
    } catch (error) {
        try {
            await setDoc(doc(db, "chats", currentRoomId), { lastMessageTime: Date.now(), lastMessageSenderId: curId }, { merge: true });
        } catch(e) {}
    }
};

// --- FIX: DIRECT SINGLE-MESSAGE ACTIONS ---
window.startForwardSingleMessage = (msgId) => {
    document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
    const box = document.querySelector(`.msg-checkbox[value="${msgId}"]`);
    if (box) box.checked = true;
    window.toggleActionMenu(msgId);
    window.forwardSelectedMessages(); // Triggers direct forward modal without showing selection header
};

window.startDeleteSingleMessage = (msgId) => {
    document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
    const box = document.querySelector(`.msg-checkbox[value="${msgId}"]`);
    if (box) box.checked = true;
    window.toggleActionMenu(msgId);
    window.openDeleteMessagesModal(); // Triggers direct delete modal without showing selection header
};

const updateSelectionCount = () => {
    const selectedBoxes = document.querySelectorAll('.msg-checkbox:checked');
    const countTxt = document.getElementById('selection-count');
    if (countTxt) countTxt.innerText = `${selectedBoxes.length} Selected`;
};

window.enableSelectionMode = (enable = true) => {
    const container = document.getElementById('chat-messages-container');
    const selectionHeader = document.getElementById('selection-chat-header');
    const stdHeader = document.getElementById('standard-chat-header');
    
    if (enable) {
        if (container) container.classList.add('selection-mode');
        if (stdHeader) stdHeader.style.display = 'none';
        if (selectionHeader) selectionHeader.style.display = 'flex';
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    } else {
        if (container) container.classList.remove('selection-mode');
        if (stdHeader) stdHeader.style.display = 'flex';
        if (selectionHeader) selectionHeader.style.display = 'none';
        document.querySelectorAll('.msg-checkbox').forEach(box => box.checked = false);
        const countTxt = document.getElementById('selection-count');
        if (countTxt) countTxt.innerText = `0 Selected`;
    }
};

window.openDeleteMessagesModal = () => {
    const selectedBoxes = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
    if (selectedBoxes.length === 0) return alert("Select at least one message to delete.");

    const curId = currentUser?.id || currentUser?.uid;
    const isCurrentOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
    const isAdmin = Array.isArray(currentRoomData?.admins) && currentRoomData.admins.includes(curId);

    // Senders can always delete their OWN messages for everyone. Admins/Owner can delete ALL messages for everyone.
    const allMine = selectedBoxes.every(b => b.getAttribute('data-sender') === curId);
    const canDeleteEveryone = allMine || isCurrentOwner || isAdmin;

    const btnEveryone = document.getElementById('btn-delete-everyone');
    if (btnEveryone) btnEveryone.style.display = canDeleteEveryone ? 'block' : 'none';

    const delModal = document.getElementById('delete-modal');
    if (delModal) delModal.style.display = 'flex';
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.msg-bubble')) {
        document.querySelectorAll('.msg-action-menu').forEach(m => m.classList.remove('active'));
    }
});

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('msg-checkbox')) {
        updateSelectionCount();
    }
});

document.getElementById('btn-cancel-selection')?.addEventListener('click', () => { window.enableSelectionMode(false); });
document.getElementById('btn-action-delete')?.addEventListener('click', () => { window.openDeleteMessagesModal(); });
document.getElementById('btn-action-forward')?.addEventListener('click', () => { window.forwardSelectedMessages(); });
document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
    const delModal = document.getElementById('delete-modal');
    if (delModal) delModal.style.display = 'none';
});

document.getElementById('btn-delete-me')?.addEventListener('click', () => {
    const selectedBoxes = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
    const hiddenMsgs = JSON.parse(localStorage.getItem('hidden_msgs')) || [];
    selectedBoxes.forEach(b => hiddenMsgs.push(b.value));
    localStorage.setItem('hidden_msgs', JSON.stringify(hiddenMsgs));
    
    document.getElementById('delete-modal').style.display = 'none';
    window.enableSelectionMode(false);
    renderMessagesUI();
});

document.getElementById('btn-delete-everyone')?.addEventListener('click', async () => {
    const selectedBoxes = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
    const batch = writeBatch(db);
    for (const b of selectedBoxes) {
        batch.delete(doc(db, `chats/${currentRoomId}/messages`, b.value));
    }
    try { await batch.commit(); } catch(e) {}
    document.getElementById('delete-modal').style.display = 'none';
    window.enableSelectionMode(false);
});

window.forwardSelectedMessages = async () => {
    const selectedBoxes = Array.from(document.querySelectorAll('.msg-checkbox:checked'));
    if (selectedBoxes.length === 0) return alert("Select at least one message to forward.");

    if (!document.getElementById('forward-modal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="forward-modal" class="guest-overlay" style="display: none; z-index: 10003;">
                <div class="guest-modal" style="padding: 20px; width: 90%; max-width: 350px;">
                    <h3 style="margin-bottom: 15px; color: var(--primary);">Forward To:</h3>
                    <div id="forward-rooms-list" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 15px;"></div>
                    <button id="btn-cancel-forward" style="width: 100%; padding: 10px; background: transparent; color: var(--text-muted); border: none; cursor: pointer;">Cancel</button>
                </div>
            </div>
        `);
        document.getElementById('btn-cancel-forward')?.addEventListener('click', () => {
            document.getElementById('forward-modal').style.display = 'none';
        });
    }

    const listEl = document.getElementById('forward-rooms-list');
    listEl.innerHTML = '';
    
    const availableRooms = window.getAvailableRooms ? window.getAvailableRooms() : {};
    Object.keys(availableRooms).forEach(roomId => {
        const room = availableRooms[roomId];
        const item = document.createElement('div');
        item.style = "padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; color: var(--text-main); font-weight: 600;";
        item.innerText = room.name;
        item.onclick = async () => {
            document.getElementById('forward-modal').style.display = 'none';
            const curId = currentUser?.id || currentUser?.uid;
            const isOwner = currentUser?.isOwner || String(currentUser?.email || '').toLowerCase().trim() === 'akshat124.am12@gmail.com';
            
            for (const box of selectedBoxes) {
                try {
                    const msgDoc = await getDoc(doc(db, `chats/${currentRoomId}/messages`, box.value));
                    if (msgDoc.exists()) {
                        const originalData = msgDoc.data();
                        let finalizedText = originalData.text ? decryptMessage(originalData.text) : "";
                        if (!finalizedText.includes("Forwarded")) finalizedText = "_▶ Forwarded_\n" + finalizedText;

                        const fwdPayload = {
                            text: encryptMessage(finalizedText),
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
            try { await updateDoc(doc(db, "chats", roomId), { lastMessageTime: Date.now(), lastMessageSenderId: curId }); } catch(e){}
            window.enableSelectionMode(false);
            alert("Messages forwarded successfully.");
        };
        listEl.appendChild(item);
    });
    document.getElementById('forward-modal').style.display = 'flex';
};

window.toggleActionMenu = (msgId) => { 
    document.querySelectorAll('.msg-action-menu').forEach(menu => menu.classList.remove('active')); 
    const menu = document.getElementById(`menu-${msgId}`); 
    if (menu) menu.classList.add('active'); 
};

window.triggerPinModal = (msgId) => { 
    messageToPin = msgId; 
    window.toggleActionMenu(msgId); 
    const pinModal = document.getElementById('pin-modal');
    if (pinModal) pinModal.style.display = 'flex'; 
};

document.getElementById('btn-cancel-pin')?.addEventListener('click', () => {
    const pinModal = document.getElementById('pin-modal');
    if (pinModal) pinModal.style.display = 'none';
});

document.querySelectorAll('.pin-duration-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
        if (!messageToPin || !currentRoomId) return;
        const textEl = document.getElementById(`text-${messageToPin}`);
        if (!textEl) return;
        const hours = parseInt(e.target.getAttribute('data-hours'));
        try { 
            await updateDoc(doc(db, "chats", currentRoomId), { 
                pinnedMessage: encryptMessage(textEl.innerText), 
                pinExpiry: Date.now() + (hours * 60 * 60 * 1000) 
            }); 
        } catch (err) {}
        const pinModal = document.getElementById('pin-modal');
        if (pinModal) pinModal.style.display = 'none';
        messageToPin = null;
    });
});

document.getElementById('btn-unpin')?.addEventListener('click', async () => {
    if (!currentRoomId) return;
    try { await updateDoc(doc(db, "chats", currentRoomId), { pinnedMessage: "", pinExpiry: 0 }); } catch (err) {}
});

window.replyToMessage = (msgId) => {
    const textEl = document.getElementById(`text-${msgId}`);
    const senderNameEl = document.getElementById(`container-${msgId}`)?.querySelector('.msg-sender-name');
    replyContext = { msgId, text: textEl ? textEl.innerText : '', senderName: senderNameEl ? senderNameEl.innerText : 'User' };
    
    const prevName = document.getElementById('reply-preview-name');
    const prevText = document.getElementById('reply-preview-text');
    const prevBanner = document.getElementById('reply-preview-banner');
    
    if (prevName) prevName.innerText = `Replying to ${replyContext.senderName}`;
    if (prevText) prevText.innerText = replyContext.text;
    if (prevBanner) prevBanner.style.display = 'block';
    
    window.toggleActionMenu(msgId);
    document.getElementById('chat-input')?.focus();
};

window.cancelReply = () => { 
    replyContext = null; 
    const banner = document.getElementById('reply-preview-banner');
    if (banner) banner.style.display = 'none'; 
};
document.getElementById('btn-cancel-reply')?.addEventListener('click', window.cancelReply);
