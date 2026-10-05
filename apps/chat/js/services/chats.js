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

    let userChats = [];
    let globalDoc = null;
    let helpDoc = null;

    function emitCombined() {
        const list = [...userChats];

        // 1. Global Community Channel: backed by real Firestore document
        if (globalDoc) {
            list.push(globalDoc);
        } else {
            list.push({
                id: "global_channel",
                type: "group",
                name: "Global Community",
                systemRoom: true,
                systemRole: "global",
                icon: "https://cdn-icons-png.flaticon.com/512/615/615075.png",
                participants: [state.currentUser.uid],
                admins: [],
                lastMessageTime: 0
            });
        }

        // 2. Aksh Studio Help Channel: backed by real Firestore document
        if (helpDoc) {
            list.push(helpDoc);
        } else {
            list.push({
                id: "aksh_help",
                type: "dm",
                name: "Aksh Studio Help",
                systemRoom: true,
                systemRole: "help",
                icon: "https://cdn-icons-png.flaticon.com/512/1041/1041883.png",
                participants: [state.currentUser.uid],
                admins: [],
                lastMessageTime: 0
            });
        }

        // Sort descending by lastMessageTime or updatedAt
        list.sort((a, b) => {
            const tA = normalizeTimestamp(a.lastMessageTime || a.updatedAt)?.getTime() || 0;
            const tB = normalizeTimestamp(b.lastMessageTime || b.updatedAt)?.getTime() || 0;
            return tB - tA;
        });

        callback(list);
    }

    const unsubUserChats = onSnapshot(q, (snapshot) => {
        const chats = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;

            // Prevent duplicating system rooms if returned by query
            if (id === "global_channel" || id === "aksh_help") return;

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
        userChats = chats;
        emitCombined();
    }, (error) => {
        console.error("Error listening to user chats (verify Console Rules for chats query):", error);
        emitCombined();
    });

    // Real document subscription to global_channel
    const globalRef = doc(db, "chats", "global_channel");
    const unsubGlobal = onSnapshot(globalRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            globalDoc = {
                id: "global_channel",
                type: "group",
                name: data.name || "Global Community",
                systemRoom: true,
                systemRole: "global",
                icon: data.icon || "https://cdn-icons-png.flaticon.com/512/615/615075.png",
                ...data
            };
        } else {
            globalDoc = {
                id: "global_channel",
                type: "group",
                name: "Global Community",
                systemRoom: true,
                systemRole: "global",
                icon: "https://cdn-icons-png.flaticon.com/512/615/615075.png",
                isUninitialized: true,
                lastMessageTime: 0
            };
        }
        emitCombined();
    }, (err) => {
        console.warn("Global channel doc listener notice (check Console Rules for chats/global_channel):", err);
        emitCombined();
    });

    // Real document subscription to aksh_help
    const helpRef = doc(db, "chats", "aksh_help");
    const unsubHelp = onSnapshot(helpRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            helpDoc = {
                id: "aksh_help",
                type: "dm",
                name: data.name || "Aksh Studio Help",
                systemRoom: true,
                systemRole: "help",
                icon: data.icon || "https://cdn-icons-png.flaticon.com/512/1041/1041883.png",
                ...data
            };
        } else {
            helpDoc = {
                id: "aksh_help",
                type: "dm",
                name: "Aksh Studio Help",
                systemRoom: true,
                systemRole: "help",
                icon: "https://cdn-icons-png.flaticon.com/512/1041/1041883.png",
                isUninitialized: true,
                lastMessageTime: 0
            };
        }
        emitCombined();
    }, (err) => {
        console.warn("Help channel doc listener notice (check Console Rules for chats/aksh_help):", err);
        emitCombined();
    });

    return () => {
        try { unsubUserChats(); } catch (e) {}
        try { unsubGlobal(); } catch (e) {}
        try { unsubHelp(); } catch (e) {}
    };
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
    if (!state.currentUser) throw new Error("Not signed in");
    if (!chatId || typeof chatId !== "string" || !chatId.trim()) {
        throw new Error("Invalid chat ID for clearing");
    }
    const cleanId = chatId.trim();
    const nowMs = Date.now();

    // 1. Update chat document directly
    try {
        const chatRef = doc(db, "chats", cleanId);
        await updateDoc(chatRef, {
            [`clearedAt_${state.currentUser.uid}`]: nowMs
        });
    } catch (e) {
        console.warn("Could not write clearedAt to chat doc:", e);
    }

    // 2. Also write to users/{uid}/chatMeta/{chatId}
    try {
        const metaRef = doc(db, `users/${state.currentUser.uid}/chatMeta`, cleanId);
        await setDoc(metaRef, {
            clearTimestamp: nowMs
        }, { merge: true });
    } catch (e) {
        console.warn("Could not write chatMeta subcollection:", e);
    }

    // Update local state
    if (!state.chatMeta[cleanId]) state.chatMeta[cleanId] = {};
    state.chatMeta[cleanId].clearTimestamp = nowMs;
    if (state.activeChatData && state.activeChatId === cleanId) {
        state.activeChatData[`clearedAt_${state.currentUser.uid}`] = nowMs;
    }
    document.dispatchEvent(new Event("chatMetaUpdated"));
}

export async function deleteChatForMe(chatId) {
    if (!state.currentUser) throw new Error("Not signed in");
    if (!chatId || typeof chatId !== "string" || !chatId.trim()) {
        throw new Error("Invalid chat ID for deletion");
    }
    const cleanId = chatId.trim();
    if (cleanId === "global_channel" || cleanId === "aksh_help") {
        throw new Error("System channels cannot be deleted");
    }

    const chatRef = doc(db, "chats", cleanId);
    await updateDoc(chatRef, {
        [`deletedFor_${state.currentUser.uid}`]: true
    });
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

export async function initSystemRooms() {
    if (!state.currentUser) return;
    const isOwner = state.currentUser.email?.toLowerCase() === "akshat124.am12@gmail.com";
    if (!isOwner) return;

    try {
        const globalRef = doc(db, "chats", "global_channel");
        const gSnap = await getDoc(globalRef);
        if (!gSnap.exists()) {
            await setDoc(globalRef, {
                type: "group",
                name: "Global Community",
                systemRoom: true,
                systemRole: "global",
                icon: "https://cdn-icons-png.flaticon.com/512/615/615075.png",
                createdBy: state.currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: "Welcome to Global Community!",
                lastMessageTime: Date.now()
            });
        }
    } catch (e) {
        console.warn("Global channel auto-initialization notice:", e);
    }

    try {
        const helpRef = doc(db, "chats", "aksh_help");
        const hSnap = await getDoc(helpRef);
        if (!hSnap.exists()) {
            await setDoc(helpRef, {
                type: "dm",
                name: "Aksh Studio Help",
                systemRoom: true,
                systemRole: "help",
                icon: "https://cdn-icons-png.flaticon.com/512/1041/1041883.png",
                createdBy: state.currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessage: "Welcome to Aksh Studio Help!",
                lastMessageTime: Date.now()
            });
        }
    } catch (e) {
        console.warn("Help channel auto-initialization notice:", e);
    }
}
