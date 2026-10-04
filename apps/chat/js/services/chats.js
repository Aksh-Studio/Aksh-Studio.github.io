import { db } from "../firebase-config.js";
import { state } from "../state.js";
import { 
    collection, doc, query, where, onSnapshot, 
    addDoc, updateDoc, serverTimestamp, getDoc, setDoc, deleteDoc, deleteField
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { normalizeTimestamp } from "../utils/timestamps.js";

export function listenToChats(callback) {
    if (!state.currentUser) return () => {};

    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", state.currentUser.uid)
    );

    return onSnapshot(q, (snapshot) => {
        let chats = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Check if deleted for current user
            if (data[`deletedFor_${state.currentUser.uid}`] === true && state.activeChatId !== id) {
                return;
            }

            // Hide empty DMs if they are not active
            if (data.type === "dm" && !data.lastMessage && !data.lastMessageTime && state.activeChatId !== id) {
                return;
            }
            
            chats.push({ id, ...data });
        });
        
        // Sort in memory by lastMessageTime or updatedAt desc to avoid composite index
        chats.sort((a, b) => {
            const tA = normalizeTimestamp(a.lastMessageTime || a.updatedAt)?.getTime() || 0;
            const tB = normalizeTimestamp(b.lastMessageTime || b.updatedAt)?.getTime() || 0;
            return tB - tA;
        });
        
        callback(chats);
    }, (error) => {
        console.error("Error listening to chats:", error);
    });
}

export async function createDirectMessage(otherUserId) {
    if (!state.currentUser) throw new Error("Not signed in");
    if (state.currentUser.uid === otherUserId) throw new Error("Cannot message yourself");
    
    const uid1 = state.currentUser.uid;
    const uid2 = otherUserId;
    
    const sortedIds = [uid1, uid2].sort();
    const dmId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    
    const chatRef = doc(db, "chats", dmId);
    const snap = await getDoc(chatRef);
    
    if (!snap.exists()) {
        await setDoc(chatRef, {
            type: "dm",
            participants: [uid1, uid2],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: "",
            lastMessageTime: Date.now()
        });
    }
    return dmId;
}

export async function createGroup(name, participants, iconUrl = null) {
    if (!state.currentUser) throw new Error("Not signed in");
    const nameTrimmed = (name || "").trim();
    if (!nameTrimmed) throw new Error("Group name required");
    if (nameTrimmed.length > 50) throw new Error("Group name must be 50 characters or less");
    
    const allParticipants = Array.from(new Set([...participants, state.currentUser.uid]));
    
    const groupData = {
        type: "group",
        name: nameTrimmed,
        participants: allParticipants,
        admins: [state.currentUser.uid],
        createdBy: state.currentUser.uid, // required by rules
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: "Group created",
        lastMessageTime: Date.now()
    };

    if (iconUrl) {
        groupData.icon = iconUrl;
    }
    
    const docRef = await addDoc(collection(db, "chats"), groupData);
    return docRef.id;
}

export async function updateGroupName(chatId, newName) {
    if (!state.currentUser) throw new Error("Not signed in");
    const trimmed = (newName || "").trim();
    if (!trimmed) throw new Error("Group name cannot be empty");
    if (trimmed.length > 50) throw new Error("Group name must be 50 characters or less");

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, { name: trimmed });
    if (state.activeChatData && state.activeChatId === chatId) {
        state.activeChatData.name = trimmed;
        state.activeChatData.title = trimmed;
    }
}

export async function updateGroupIcon(chatId, iconUrl) {
    if (!state.currentUser) throw new Error("Not signed in");
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, { icon: iconUrl });
    if (state.activeChatData && state.activeChatId === chatId) {
        state.activeChatData.icon = iconUrl;
        state.activeChatData.avatar = iconUrl;
    }
}

export async function addGroupMembers(chatId, newUids) {
    if (!state.currentUser || !newUids?.length) return;
    const chatRef = doc(db, "chats", chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error("Group not found");
    const data = snap.data();

    const merged = Array.from(new Set([...(data.participants || []), ...newUids]));
    await updateDoc(chatRef, { participants: merged });
    if (state.activeChatData && state.activeChatId === chatId) {
        state.activeChatData.participants = merged;
    }
}

export async function removeGroupMember(chatId, targetUid) {
    if (!state.currentUser) throw new Error("Not signed in");
    const chatRef = doc(db, "chats", chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error("Group not found");
    const data = snap.data();

    if (targetUid === data.createdBy) {
        throw new Error("Cannot remove the group owner.");
    }

    const updatedParticipants = (data.participants || []).filter(u => u !== targetUid);
    const updatedAdmins = (data.admins || []).filter(u => u !== targetUid);

    await updateDoc(chatRef, { 
        participants: updatedParticipants,
        admins: updatedAdmins
    });

    if (state.activeChatData && state.activeChatId === chatId) {
        state.activeChatData.participants = updatedParticipants;
        state.activeChatData.admins = updatedAdmins;
    }
}

export async function toggleGroupAdmin(chatId, targetUid, makeAdmin) {
    if (!state.currentUser) throw new Error("Not signed in");
    const chatRef = doc(db, "chats", chatId);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) throw new Error("Group not found");
    const data = snap.data();

    let updatedAdmins = data.admins || [];
    if (makeAdmin) {
        if (!updatedAdmins.includes(targetUid)) {
            updatedAdmins = [...updatedAdmins, targetUid];
        }
    } else {
        if (targetUid === data.createdBy) {
            throw new Error("Cannot remove admin rights from the group owner.");
        }
        updatedAdmins = updatedAdmins.filter(u => u !== targetUid);
    }

    await updateDoc(chatRef, { admins: updatedAdmins });
    if (state.activeChatData && state.activeChatId === chatId) {
        state.activeChatData.admins = updatedAdmins;
    }
}

export async function deleteGroup(chatId) {
    if (!state.currentUser) throw new Error("Not signed in");
    const chatRef = doc(db, "chats", chatId);
    await deleteDoc(chatRef);
}

export async function clearChat(chatId) {
    if (!state.currentUser) return;
    const nowMs = Date.now();

    // 1. Update chat document directly (authorized by validMemberSelfStateUpdate)
    try {
        const chatRef = doc(db, "chats", chatId);
        await updateDoc(chatRef, {
            [`clearedAt_${state.currentUser.uid}`]: nowMs
        });
    } catch (e) {
        console.warn("Could not write clearedAt to chat doc:", e);
    }

    // 2. Also write to users/{uid}/chatMeta/{chatId}
    try {
        const metaRef = doc(db, `users/${state.currentUser.uid}/chatMeta`, chatId);
        await setDoc(metaRef, {
            clearTimestamp: nowMs
        }, { merge: true });
    } catch (e) {
        console.warn("Could not write chatMeta subcollection:", e);
    }

    // Update local state
    if (!state.chatMeta[chatId]) state.chatMeta[chatId] = {};
    state.chatMeta[chatId].clearTimestamp = nowMs;
    if (state.activeChatData) {
        state.activeChatData[`clearedAt_${state.currentUser.uid}`] = nowMs;
    }
    document.dispatchEvent(new Event("chatMetaUpdated"));
}

export async function deleteChatForMe(chatId) {
    if (!state.currentUser) return;
    try {
        const chatRef = doc(db, "chats", chatId);
        await updateDoc(chatRef, {
            [`deletedFor_${state.currentUser.uid}`]: true
        });
    } catch (e) {
        console.warn("Could not set deletedFor_ on chat doc:", e);
    }
}

export async function updateReadReceipt(chatId) {
    if (!state.currentUser) return;
    const ref = doc(db, "chats", chatId);
    const fieldPath = `readReceipts.${state.currentUser.uid}`;
    await updateDoc(ref, {
        [fieldPath]: Date.now()
    });
}

export function listenToChatMeta(callback) {
    if (!state.currentUser) return () => {};
    const q = query(collection(db, `users/${state.currentUser.uid}/chatMeta`));
    return onSnapshot(q, (snapshot) => {
        const meta = {};
        snapshot.forEach(docSnap => {
            meta[docSnap.id] = docSnap.data();
        });
        callback(meta);
    }, (err) => {
        console.warn("ChatMeta listen error:", err);
    });
}

export async function pinMessage(chatId, messageData, expiryMs = 30 * 24 * 60 * 60 * 1000) {
    if (!state.currentUser) return;
    const ref = doc(db, "chats", chatId);
    await updateDoc(ref, {
        pinnedMessageId: messageData.id,
        pinnedMessage: {
            text: messageData.text || (messageData.attachment ? (messageData.attachment.name || "Attachment") : "Pinned message"),
            senderId: messageData.senderId
        },
        pinExpiry: Date.now() + expiryMs
    });
}

export async function unpinMessage(chatId) {
    if (!state.currentUser) return;
    const ref = doc(db, "chats", chatId);
    await updateDoc(ref, {
        pinnedMessageId: deleteField(),
        pinnedMessage: deleteField(),
        pinExpiry: deleteField()
    });
}

export async function leaveGroup(chatId) {
    if (!state.currentUser) return;
    const ref = doc(db, "chats", chatId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    
    if (data.createdBy === state.currentUser.uid) {
        throw new Error("Owner cannot leave the group. Transfer ownership first.");
    }
    
    const newParticipants = data.participants.filter(uid => uid !== state.currentUser.uid);
    const newAdmins = (data.admins || []).filter(uid => uid !== state.currentUser.uid);
    
    await updateDoc(ref, {
        participants: newParticipants,
        admins: newAdmins
    });
}
