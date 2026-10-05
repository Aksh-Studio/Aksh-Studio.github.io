import { db } from "../firebase-config.js";
import { state } from "../state.js";
import { 
    collection, doc, query, orderBy, onSnapshot, 
    updateDoc, serverTimestamp, setDoc, deleteDoc,
    writeBatch, deleteField 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { encryptMessage, decryptMessage } from "../cipher.js";

const MAX_BATCH_SIZE = 400;

export function listenToMessages(chatId, callback) {
    if (!state.currentUser) return () => {};

    const q = query(
        collection(db, `chats/${chatId}/messages`),
        orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            
            // Decrypt text content for display
            if (data.type === "text" && data.text) {
                data.text = decryptMessage(data.text);
            }
            if (data.replyTo?.text) {
                data.replyTo.text = decryptMessage(data.replyTo.text);
            }
            
            messages.push({ id: docSnap.id, ...data });
        });
        callback(messages);
    }, (error) => {
        console.error("Error listening to messages:", error);
    });
}

export async function sendMessage(chatId, text, type = "text", attachment = null, replyTo = null, isForwarded = false) {
    if (!state.currentUser) throw new Error("Not authenticated");

    const isAppOwner = state.currentUser.email?.toLowerCase() === "akshat124.am12@gmail.com";

    // Encrypt text payload before Firestore write
    const storedText = (type === "text" && text) ? encryptMessage(text) : (text || "");

    const message = {
        senderId: state.currentUser.uid,
        type,
        text: storedText,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        expireAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        deletedForEveryone: false,
        isOwner: isAppOwner
    };

    if (attachment) message.attachment = attachment;
    if (replyTo) {
        message.replyTo = {
            messageId: replyTo.id || replyTo.messageId,
            text: replyTo.text ? encryptMessage(replyTo.text) : "",
            senderId: replyTo.senderId || ""
        };
    }
    if (isForwarded) message.forwarded = true;

    const batch = writeBatch(db);
    
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const newMsgRef = doc(messagesRef);
    batch.set(newMsgRef, message);
    
    // Update chat metadata atomically
    // Note: Firestore Security Rules require lastMessageTime to be a NUMBER,
    // and lastMessageSenderId == request.auth.uid.
    const chatRef = doc(db, "chats", chatId);
    const chatUpdate = {
        lastMessageTime: Date.now(),
        lastMessageSenderId: state.currentUser.uid
    };

    // If active chat is a DM and the other user deleted it, reset deletedFor for other user
    if (state.activeChatData?.type === "dm" && Array.isArray(state.activeChatData.participants)) {
        const otherUid = state.activeChatData.participants.find(u => u !== state.currentUser.uid);
        if (otherUid) {
            chatUpdate[`deletedFor_${otherUid}`] = false;
        }
    }

    // Owner can update lastMessage and updatedAt per rules
    if (isAppOwner) {
        chatUpdate.lastMessage = storedText || (attachment ? (attachment.name || "Attachment") : "");
        chatUpdate.updatedAt = serverTimestamp();
    }

    batch.set(chatRef, chatUpdate, { merge: true });
    
    await batch.commit();
    return newMsgRef.id;
}

export async function deleteForEveryone(chatId, messageIds) {
    if (!state.currentUser || !messageIds?.length) return;

    const chunks = [];
    for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
        chunks.push(messageIds.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const msgId of chunk) {
            const msgRef = doc(db, `chats/${chatId}/messages`, msgId);
            batch.update(msgRef, {
                deletedForEveryone: true,
                text: "This message was deleted",
                attachment: null,
                updatedAt: serverTimestamp()
            });
        }
        await batch.commit();
    }
}

export async function deleteForMe(chatId, messageIds) {
    if (!state.currentUser || !messageIds?.length) return;

    const chunks = [];
    for (let i = 0; i < messageIds.length; i += MAX_BATCH_SIZE) {
        chunks.push(messageIds.slice(i, i + MAX_BATCH_SIZE));
    }

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const msgId of chunk) {
            const hiddenRef = doc(db, `users/${state.currentUser.uid}/hiddenMessages`, msgId);
            batch.set(hiddenRef, { hiddenAt: serverTimestamp(), chatId });
        }
        try {
            await batch.commit();
        } catch (e) {
            console.warn("Could not write hiddenMessages subcollection:", e);
        }
    }

    // Also update local state
    messageIds.forEach(id => state.hiddenMessageIds.add(id));
    document.dispatchEvent(new Event("hiddenMessagesUpdated"));
}

export async function editMessage(chatId, messageId, newText) {
    if (!state.currentUser) return;
    const msgRef = doc(db, `chats/${chatId}/messages`, messageId);
    await updateDoc(msgRef, {
        text: encryptMessage(newText),
        edited: true,
        updatedAt: serverTimestamp()
    });
}

export async function starMessage(chatId, messageId, messageData) {
    if (!state.currentUser) return;
    const ref = doc(db, `users/${state.currentUser.uid}/starredMessages`, messageId);
    try {
        await setDoc(ref, {
            chatId,
            messageId,
            text: messageData.text || "",
            senderId: messageData.senderId,
            starredAt: serverTimestamp()
        });
    } catch (e) {
        console.warn("Starred messages subcollection write error:", e);
    }
    state.starredMessageIds.add(messageId);
    document.dispatchEvent(new Event("starredMessagesUpdated"));
}

export async function unstarMessage(messageId) {
    if (!state.currentUser) return;
    const ref = doc(db, `users/${state.currentUser.uid}/starredMessages`, messageId);
    try {
        await deleteDoc(ref);
    } catch (e) {
        console.warn("Starred messages subcollection delete error:", e);
    }
    state.starredMessageIds.delete(messageId);
    document.dispatchEvent(new Event("starredMessagesUpdated"));
}

export async function toggleReaction(chatId, messageId, emoji) {
    if (!state.currentUser) return;
    const ref = doc(db, `chats/${chatId}/messages`, messageId);
    const fieldPath = `reactions.${state.currentUser.uid}`;
    await updateDoc(ref, { [fieldPath]: emoji });
}

export async function removeReaction(chatId, messageId) {
    if (!state.currentUser) return;
    const ref = doc(db, `chats/${chatId}/messages`, messageId);
    const fieldPath = `reactions.${state.currentUser.uid}`;
    await updateDoc(ref, { [fieldPath]: deleteField() });
}
