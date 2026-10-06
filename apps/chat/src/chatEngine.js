import { db, auth, collection, doc, query, where, onSnapshot, addDoc, updateDoc, writeBatch, getDocs, Timestamp, arrayUnion } from './firebase.js';

export let currentRoomId = null;
export let currentRoomData = null;
export let hiddenMessageIds = new Set();
export let selectedMessageIds = new Set();

let unsubscribeMessages = null;
let unsubscribeHidden = null;

export function parseFormatting(text) {
    if (!text) return text;
    let formatted = text.replace(/\*(.*?)\*/g, '<b>$1</b>');
    formatted = formatted.replace(/_(.*?)_/g, '<i>$1</i>');
    formatted = formatted.replace(/~(.*?)~/g, '<del>$1</del>');
    formatted = formatted.replace(/\\(.*?)\\/g, '<code>$1</code>');
    return formatted;
}

export function setCurrentRoom(roomId, roomData) {
    currentRoomId = roomId;
    currentRoomData = roomData;
    listenToHiddenMessages();
    listenToMessages();
}

export function listenToHiddenMessages() {
    if (unsubscribeHidden) unsubscribeHidden();
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const hiddenRef = collection(db, 'users', uid, 'hiddenMessages');
    unsubscribeHidden = onSnapshot(hiddenRef, (snapshot) => {
        hiddenMessageIds.clear();
        snapshot.forEach(doc => {
            hiddenMessageIds.add(doc.id);
        });
        // re-render messages if needed
    });
}

export function listenToMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    if (!currentRoomId) return;

    const sixtyDaysAgoNum = Date.now() - (60 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgoTs = Timestamp.fromMillis(sixtyDaysAgoNum);

    const messagesRef = collection(db, 'rooms', currentRoomId, 'messages');
    // Simplified due to firestore limitations on OR queries natively without complex setup, 
    // but demonstrating the dual constraint conceptually or using a single query if timestamps are consistent
    const q = query(messagesRef, where('timestamp', '>=', sixtyDaysAgoNum));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach(doc => {
            if (!hiddenMessageIds.has(doc.id)) {
                messages.push({ id: doc.id, ...doc.data() });
            }
        });
        renderMessages(messages);
    });
}

export function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';
    messages.forEach(msg => {
        const el = document.createElement('div');
        el.className = 'message';
        el.innerHTML = parseFormatting(msg.text || '');
        container.appendChild(el);
    });
}

export async function deleteForMe(messageId) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        await addDoc(collection(db, 'users', uid, 'hiddenMessages'), { messageId });
        hiddenMessageIds.add(messageId);
        listenToMessages(); // trigger re-render
    } catch (error) {
        console.error("Error deleting for me", error);
    }
}

export async function deleteForEveryone(messageIds) {
    if (!currentRoomId || !messageIds || messageIds.length === 0) return;
    try {
        const batch = writeBatch(db);
        let count = 0;
        let batchPromises = [];
        
        for (const msgId of messageIds) {
            const msgRef = doc(db, 'rooms', currentRoomId, 'messages', msgId);
            batch.delete(msgRef);
            count++;
            
            if (count === 400) {
                batchPromises.push(batch.commit());
                count = 0;
            }
        }
        
        if (count > 0) {
            batchPromises.push(batch.commit());
        }
        
        await Promise.all(batchPromises);
        selectedMessageIds.clear();
    } catch (error) {
        console.error("Error deleting for everyone", error);
    }
}

export async function updateReadReceipt(messageId) {
    if (!currentRoomId || !messageId) return;
    try {
        const msgRef = doc(db, 'rooms', currentRoomId, 'messages', messageId);
        await updateDoc(msgRef, {
            readBy: arrayUnion(auth.currentUser.uid)
        });
    } catch (error) {
        console.error("Error updating read receipt", error);
    }
}

export async function pinMessage(messageId, duration) {
    if (!currentRoomId) return;
    let expiresAt = null;
    const now = Date.now();
    if (duration === '24h') expiresAt = now + 24 * 60 * 60 * 1000;
    else if (duration === '7d') expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    else if (duration === '30d') expiresAt = now + 30 * 24 * 60 * 60 * 1000;

    try {
        await updateDoc(doc(db, 'rooms', currentRoomId), {
            pinnedMessage: {
                messageId,
                expiresAt
            }
        });
    } catch (error) {
        console.error("Error pinning message", error);
    }
}

export function quoteReply(messageId, text) {
    // UI logic to attach quote to input
    const input = document.getElementById('message-input');
    if (input) {
        input.value = `> ${text}\n\n` + input.value;
        input.focus();
    }
}
