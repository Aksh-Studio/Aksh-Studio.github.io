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

let networkCache = null;
let networkCacheTime = 0;
const CACHE_TTL_MS = 45000;

export async function searchUsers(searchTerm = "") {
    if (!state.currentUser) return [];
    const term = (searchTerm || "").trim().toLowerCase();
    const now = Date.now();

    // Check memory cache
    if (!networkCache || (now - networkCacheTime > CACHE_TTL_MS)) {
        try {
            const q = query(collection(db, "users"), limit(60));
            const snap = await getDocs(q);
            const userMap = new Map();
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const uid = data.uid || docSnap.id;
                if (!uid || uid === state.currentUser?.uid) return;
                
                userMap.set(uid, {
                    uid,
                    fullName: data.fullName || data.name || "User",
                    nickname: data.nickname || data.fullName || "User",
                    email: data.email || "",
                    photoURL: data.photoURL || "./chat-logo.png",
                    isOwner: (data.email || "").toLowerCase() === "akshat124.am12@gmail.com"
                });
            });
            networkCache = Array.from(userMap.values());
            networkCacheTime = now;
        } catch (err) {
            console.warn("Network users fetch notice (verify Console Rules for users collection):", err);
            networkCache = networkCache || [];
        }
    }

    const currentBlocked = state.blockedUserIds;
    const candidates = networkCache.map(u => ({
        ...u,
        isBlocked: currentBlocked.has(u.uid)
    }));

    if (!term) {
        // Return discovery list when query is empty
        return candidates.slice(0, 30);
    }

    return candidates.filter(u => 
        u.nickname.toLowerCase().includes(term) ||
        u.fullName.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term)
    );
}

export async function blockUser(targetUid) {
    if (!state.currentUser) throw new Error("Not signed in");
    if (!targetUid || targetUid === state.currentUser.uid) return;
    
    // 1. Canonical subcollection: users/{uid}/blockedUsers/{targetUid}
    try {
        const subRef = doc(db, `users/${state.currentUser.uid}/blockedUsers`, targetUid);
        await setDoc(subRef, {
            blockedAt: serverTimestamp(),
            targetUid
        });
    } catch (e) {
        console.warn("Could not write blockedUsers subcollection (check Console Rules):", e);
    }

    state.blockedUserIds.add(targetUid);

    // 2. Synchronize profile array for backward compatibility
    try {
        const currentList = Array.from(state.blockedUserIds);
        await updateDoc(doc(db, "users", state.currentUser.uid), {
            blockedUsers: currentList
        });
        if (state.currentProfile) {
            state.currentProfile.blockedUsers = currentList;
        }
    } catch (e) {}

    document.dispatchEvent(new Event("blockedUsersUpdated"));
}

export async function unblockUser(targetUid) {
    if (!state.currentUser) throw new Error("Not signed in");
    if (!targetUid) return;

    // 1. Canonical subcollection delete: users/{uid}/blockedUsers/{targetUid}
    try {
        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
        const subRef = doc(db, `users/${state.currentUser.uid}/blockedUsers`, targetUid);
        await deleteDoc(subRef);
    } catch (e) {
        console.warn("Could not delete from blockedUsers subcollection (check Console Rules):", e);
    }

    state.blockedUserIds.delete(targetUid);

    // 2. Synchronize profile array for backward compatibility
    try {
        const currentList = Array.from(state.blockedUserIds);
        await updateDoc(doc(db, "users", state.currentUser.uid), {
            blockedUsers: currentList
        });
        if (state.currentProfile) {
            state.currentProfile.blockedUsers = currentList;
        }
    } catch (e) {}

    document.dispatchEvent(new Event("blockedUsersUpdated"));
}

export async function updateProfile(data) {
    if (!state.currentUser) return;
    const ref = doc(db, "users", state.currentUser.uid);
    await updateDoc(ref, data);
    const current = state.profileCache.get(state.currentUser.uid) || {};
    state.profileCache.set(state.currentUser.uid, { ...current, ...data });
}
