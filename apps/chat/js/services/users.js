import { db } from "../firebase-config.js";
import { state, registerProfileCleanup } from "../state.js";
import { 
    doc, getDoc, updateDoc, setDoc, serverTimestamp, 
    collection, query, getDocs, limit, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const profileListeners = new Map();
const profileInFlight = new Map();

export function unsubscribeAllProfiles() {
    for (const unsub of profileListeners.values()) {
        try { unsub(); } catch (e) {}
    }
    profileListeners.clear();
    profileInFlight.clear();
}

// Register synchronous cleanup hook with state
registerProfileCleanup(unsubscribeAllProfiles);

export async function fetchProfile(uid) {
    if (!uid) return { uid: "unknown", nickname: "User", fullName: "User", photoURL: "./chat-logo.png" };
    
    if (state.profileCache.has(uid)) {
        return state.profileCache.get(uid);
    }
    
    if (profileInFlight.has(uid)) {
        return profileInFlight.get(uid);
    }

    const promise = new Promise(async (resolve) => {
        // If it's current user, attach realtime listener
        if (state.currentUser && uid === state.currentUser.uid) {
            const userRef = doc(db, "users", uid);
            const unsub = onSnapshot(userRef, (snap) => {
                let data;
                if (snap.exists()) {
                    data = snap.data();
                } else {
                    data = { uid, nickname: "User", fullName: "User", photoURL: "./chat-logo.png" };
                }
                state.profileCache.set(uid, data);
                state.currentProfile = data;
                // Sync blockedUsers if present in profile
                if (Array.isArray(data.blockedUsers)) {
                    state.blockedUserIds = new Set(data.blockedUsers);
                }
                document.dispatchEvent(new CustomEvent("profileUpdated", { detail: uid }));
                resolve(data);
            }, (err) => {
                console.error("Profile listen error:", err);
                const fallback = { uid, nickname: "User", fullName: "User", photoURL: "./chat-logo.png" };
                state.profileCache.set(uid, fallback);
                resolve(fallback);
            });
            profileListeners.set(uid, unsub);
        } else {
            // One-off cached read for others
            try {
                const userRef = doc(db, "users", uid);
                const snap = await getDoc(userRef);
                let data;
                if (snap.exists()) {
                    data = snap.data();
                } else {
                    data = { uid, nickname: "User", fullName: "User", photoURL: "./chat-logo.png" };
                }
                state.profileCache.set(uid, data);
                resolve(data);
            } catch (err) {
                console.error("Fetch profile error:", err);
                const fallback = { uid, nickname: "User", fullName: "User", photoURL: "./chat-logo.png" };
                state.profileCache.set(uid, fallback);
                resolve(fallback);
            }
        }
    });

    profileInFlight.set(uid, promise);
    const result = await promise;
    profileInFlight.delete(uid); 
    return result;
}

export async function searchUsers(searchTerm) {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    
    const q = query(collection(db, "users"), limit(50));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach(docSnap => {
        const data = docSnap.data();
        if (
            (data.nickname && data.nickname.toLowerCase().includes(term)) ||
            (data.fullName && data.fullName.toLowerCase().includes(term)) ||
            (data.name && data.name.toLowerCase().includes(term)) ||
            (data.email && data.email.toLowerCase().includes(term))
        ) {
            results.push(data);
        }
    });
    return results;
}

export async function blockUser(targetUid) {
    if (!state.currentUser) return;
    
    // Per Firestore Security Rules, blockedUsers is an array on users/{uid}
    const currentList = Array.isArray(state.currentProfile?.blockedUsers) 
        ? [...state.currentProfile.blockedUsers] 
        : Array.from(state.blockedUserIds);
        
    if (!currentList.includes(targetUid)) {
        currentList.push(targetUid);
    }
    
    try {
        await updateDoc(doc(db, "users", state.currentUser.uid), {
            blockedUsers: currentList
        });
    } catch (e) {
        console.warn("Could not update users document blockedUsers:", e);
    }
    
    // Also try subcollection if rules allow
    try {
        const ref = doc(db, `users/${state.currentUser.uid}/blockedUsers`, targetUid);
        await setDoc(ref, { blockedAt: serverTimestamp() });
    } catch (e) {}
    
    state.blockedUserIds.add(targetUid);
    if (state.currentProfile) {
        state.currentProfile.blockedUsers = currentList;
    }
    document.dispatchEvent(new Event("blockedUsersUpdated"));
}

export async function unblockUser(targetUid) {
    if (!state.currentUser) return;
    
    const currentList = Array.isArray(state.currentProfile?.blockedUsers) 
        ? [...state.currentProfile.blockedUsers] 
        : Array.from(state.blockedUserIds);
        
    const updated = currentList.filter(id => id !== targetUid);
    
    try {
        await updateDoc(doc(db, "users", state.currentUser.uid), {
            blockedUsers: updated
        });
    } catch (e) {
        console.warn("Could not update users document blockedUsers:", e);
    }
    
    // Also try subcollection if rules allow
    try {
        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const ref = doc(db, `users/${state.currentUser.uid}/blockedUsers`, targetUid);
        await deleteDoc(ref);
    } catch (e) {}
    
    state.blockedUserIds.delete(targetUid);
    if (state.currentProfile) {
        state.currentProfile.blockedUsers = updated;
    }
    document.dispatchEvent(new Event("blockedUsersUpdated"));
}

export async function updateProfile(data) {
    if (!state.currentUser) return;
    const ref = doc(db, "users", state.currentUser.uid);
    await updateDoc(ref, data);
    const current = state.profileCache.get(state.currentUser.uid) || {};
    state.profileCache.set(state.currentUser.uid, { ...current, ...data });
}
