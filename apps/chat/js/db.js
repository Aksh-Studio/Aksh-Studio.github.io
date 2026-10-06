import { db } from './config.js';
import { 
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, 
    deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, increment 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const dbService = {
    createSpace: async (name, description, isPrivate, members, createdBy) => {
        const spacesRef = collection(db, 'spaces');
        return await addDoc(spacesRef, {
            name, description, isPrivate, members, createdBy,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
    },
    listenToSpaces: (uid, callback) => {
        const q = query(collection(db, 'spaces'), where('members', 'array-contains', uid), orderBy('updatedAt', 'desc'));
        return onSnapshot(q, callback);
    },
    leaveSpace: async (spaceId, uid) => {
        const spaceRef = doc(db, 'spaces', spaceId);
        const snap = await getDoc(spaceRef);
        if (snap.exists()) {
            const members = snap.data().members.filter(m => m !== uid);
            await updateDoc(spaceRef, { members, updatedAt: serverTimestamp() });
        }
    },

    createOrGetDirectChat: async (uid1, uid2) => {
        const dmRef = collection(db, 'direct_chats');
        const q = query(dmRef, where('participants', 'array-contains', uid1));
        const snapshot = await getDocs(q);
        
        let existingChat = null;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.participants.includes(uid2) && data.participants.length === 2) { existingChat = { id: doc.id, ...data }; }
        });
        if (existingChat) return existingChat;

        const newDocRef = await addDoc(dmRef, { participants: [uid1, uid2], updatedAt: serverTimestamp(), lastMessage: "" });
        return { id: newDocRef.id, participants: [uid1, uid2], lastMessage: "" };
    },
    listenToDirectChats: (uid, callback) => {
        const q = query(collection(db, 'direct_chats'), where('participants', 'array-contains', uid), orderBy('updatedAt', 'desc'));
        return onSnapshot(q, callback);
    },

    sendMessageToSpace: async (spaceId, senderId, senderName, senderPhoto, content, fileInfo = null) => {
        const messagesRef = collection(db, `spaces/${spaceId}/messages`);
        const msgDoc = await addDoc(messagesRef, {
            spaceId, senderId, senderName, senderPhoto: senderPhoto || "", content,
            fileUrl: fileInfo?.url || null, fileName: fileInfo?.name || null, fileSize: fileInfo?.size || null, fileType: fileInfo?.type || null,
            replyCount: 0, lastReplyAt: null, reactions: {}, isPinned: false, isEdited: false,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'spaces', spaceId), { updatedAt: serverTimestamp() });
        return msgDoc;
    },
    editMessage: async (spaceId, messageId, newText) => {
        const messageRef = doc(db, `spaces/${spaceId}/messages/${messageId}`);
        await updateDoc(messageRef, { content: newText, isEdited: true, updatedAt: serverTimestamp() });
    },
    togglePinMessage: async (spaceId, messageId, isPinned) => {
        const messageRef = doc(db, `spaces/${spaceId}/messages/${messageId}`);
        await updateDoc(messageRef, { isPinned });
    },
    listenToSpaceMessages: (spaceId, callback) => {
        const q = query(collection(db, `spaces/${spaceId}/messages`), orderBy('createdAt', 'asc'));
        return onSnapshot(q, callback);
    },
    deleteSpaceMessage: async (spaceId, messageId) => {
        await deleteDoc(doc(db, `spaces/${spaceId}/messages/${messageId}`));
    },

    replyToThread: async (spaceId, messageId, senderId, senderName, senderPhoto, content) => {
        const repliesRef = collection(db, `spaces/${spaceId}/messages/${messageId}/replies`);
        await addDoc(repliesRef, { messageId, senderId, senderName, senderPhoto: senderPhoto || "", content, createdAt: serverTimestamp() });
        await updateDoc(doc(db, `spaces/${spaceId}/messages/${messageId}`), { replyCount: increment(1), lastReplyAt: serverTimestamp(), updatedAt: serverTimestamp() });
    },
    listenToThreadReplies: (spaceId, messageId, callback) => {
        const q = query(collection(db, `spaces/${spaceId}/messages/${messageId}/replies`), orderBy('createdAt', 'asc'));
        return onSnapshot(q, callback);
    },

    sendDirectMessage: async (chatId, senderId, senderName, senderPhoto, content, fileInfo = null) => {
        const messagesRef = collection(db, `direct_chats/${chatId}/messages`);
        await addDoc(messagesRef, {
            senderId, senderName, senderPhoto: senderPhoto || "", content,
            fileUrl: fileInfo?.url || null, fileName: fileInfo?.name || null, fileSize: fileInfo?.size || null, fileType: fileInfo?.type || null,
            createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'direct_chats', chatId), { updatedAt: serverTimestamp(), lastMessage: content });
    },
    listenToDirectMessages: (chatId, callback) => {
        const q = query(collection(db, `direct_chats/${chatId}/messages`), orderBy('createdAt', 'asc'));
        return onSnapshot(q, callback);
    },

    toggleReaction: async (spaceId, messageId, emoji, uid) => {
        const messageRef = doc(db, `spaces/${spaceId}/messages/${messageId}`);
        const snap = await getDoc(messageRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const reactions = data.reactions || {};
        const users = reactions[emoji] || [];
        if (users.includes(uid)) {
            reactions[emoji] = users.filter(id => id !== uid);
            if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
            reactions[emoji] = [...users, uid];
        }
        await updateDoc(messageRef, { reactions });
    },

    getRegisteredUsers: (callback) => {
        return onSnapshot(collection(db, 'users'), callback);
    },
    updateUserPresence: async (uid, presence) => {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, { presence, lastActive: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
    },
    listenToUserPresence: (uid, callback) => {
        return onSnapshot(doc(db, 'users', uid), callback);
    },

    updateReadReceipt: async (uid, targetId) => {
        const receiptRef = doc(db, `users/${uid}/read_receipts/${targetId}`);
        await setDoc(receiptRef, { lastReadAt: serverTimestamp() }, { merge: true });
    },
    listenToReadReceipts: (uid, callback) => {
        const q = collection(db, `users/${uid}/read_receipts`);
        return onSnapshot(q, callback);
    },

    setTypingStatus: async (spaceId, uid, name, isTyping) => {
        const typingRef = doc(db, `spaces/${spaceId}/typing/${uid}`);
        if (isTyping) {
            await setDoc(typingRef, { isTyping: true, name, updatedAt: serverTimestamp() });
        } else {
            await deleteDoc(typingRef);
        }
    },
    listenToTyping: (spaceId, callback) => {
        const q = query(collection(db, `spaces/${spaceId}/typing`), where('isTyping', '==', true));
        return onSnapshot(q, callback);
    }
};
