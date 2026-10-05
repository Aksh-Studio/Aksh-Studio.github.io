import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { state, clearAllState } from "./state.js";
import { listenToChatMeta, initSystemRooms } from "./services/chats.js";

let authGeneration = 0;

export function initAuth(onUserChange) {
    onAuthStateChanged(auth, async (user) => {
        const generation = ++authGeneration;

        if (!user) {
            clearAllState();
            onUserChange(null, null);
            return;
        }

        state.currentUser = user;

        await syncUserProfile(user);

        if (
            generation !== authGeneration ||
            auth.currentUser?.uid !== user.uid
        ) {
            return;
        }

        // Initialize system rooms if owner
        initSystemRooms().catch(err => console.warn("System rooms init notice:", err));

        initUserListeners(user, generation);

        if (
            generation !== authGeneration ||
            auth.currentUser?.uid !== user.uid
        ) {
            return;
        }

        onUserChange(user, state.currentProfile);
    });
}

async function syncUserProfile(user) {
    const userRef = doc(db, "users", user.uid);
    try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            const profile = {
                uid: user.uid,
                fullName: user.displayName || "User",
                nickname: user.displayName || "User",
                photoURL: user.photoURL || "./chat-logo.png",
                createdAt: serverTimestamp(),
                lastLogin: Date.now() // required by validUserSelfUpdate / validUserCreate
            };
            if (user.email) {
                profile.email = user.email;
            }
            try {
                await setDoc(userRef, profile, { merge: true });
                state.currentProfile = profile;
            } catch (e) {
                console.warn("Failed to create user profile in Firestore:", e);
                state.currentProfile = profile;
            }
        } else {
            const data = snap.data();
            state.currentProfile = data;
            // Update lastLogin (rule requires lastLogin is number)
            try {
                await setDoc(userRef, { lastLogin: Date.now() }, { merge: true });
            } catch (e) {
                console.warn("Failed to update last login:", e);
            }
        }
    } catch (err) {
        console.warn("Error fetching user profile:", err);
        state.currentProfile = {
            uid: user.uid,
            email: user.email || "",
            fullName: user.displayName || "User",
            nickname: user.displayName || "User",
            photoURL: user.photoURL || "./chat-logo.png"
        };
    }
    
    // Sync blockedUsers from profile if present
    if (Array.isArray(state.currentProfile?.blockedUsers)) {
        state.blockedUserIds = new Set(state.currentProfile.blockedUsers);
    }
    
    state.profileCache.set(user.uid, state.currentProfile);
}

function initUserListeners(user, generation) {
    // Listen to hidden messages
    try {
        const hiddenRef = collection(db, `users/${user.uid}/hiddenMessages`);
        state.unsubscribers.hiddenMessages = onSnapshot(hiddenRef, (snap) => {
            if (generation !== authGeneration) return;
            state.hiddenMessageIds.clear();
            snap.forEach(doc => {
                state.hiddenMessageIds.add(doc.id);
            });
            document.dispatchEvent(new Event("hiddenMessagesUpdated"));
        }, (err) => {
            console.warn(`[Console Rules Required] hiddenMessages listener denied for users/${user.uid}/hiddenMessages:`, err.message);
        });
    } catch (e) {}

    // Listen to blocked users subcollection
    try {
        const blockedRef = collection(db, `users/${user.uid}/blockedUsers`);
        state.unsubscribers.blockedUsers = onSnapshot(blockedRef, (snap) => {
            if (generation !== authGeneration) return;
            state.blockedUserIds.clear();
            snap.forEach(doc => {
                state.blockedUserIds.add(doc.id);
            });
            document.dispatchEvent(new Event("blockedUsersUpdated"));
        }, (err) => {
            console.warn(`[Console Rules Required] blockedUsers listener denied for users/${user.uid}/blockedUsers:`, err.message);
        });
    } catch (e) {}
    
    // Listen to starred messages
    try {
        const starredRef = collection(db, `users/${user.uid}/starredMessages`);
        state.unsubscribers.starredMessages = onSnapshot(starredRef, (snap) => {
            if (generation !== authGeneration) return;
            state.starredMessageIds.clear();
            snap.forEach(doc => {
                state.starredMessageIds.add(doc.id);
            });
            document.dispatchEvent(new Event("starredMessagesUpdated"));
        }, (err) => {
            console.warn(`[Console Rules Required] starredMessages listener denied for users/${user.uid}/starredMessages:`, err.message);
        });
    } catch (e) {}

    // Listen to chatMeta
    try {
        state.unsubscribers.chatMeta = listenToChatMeta((meta) => {
            if (generation !== authGeneration) return;
            state.chatMeta = meta;
            document.dispatchEvent(new Event("chatMetaUpdated"));
        });
    } catch (e) {
        console.warn(`[Console Rules Required] chatMeta listener error:`, e.message);
    }
}

export async function login() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
}

export async function logout() {
    authGeneration++;
    clearAllState();
    await signOut(auth);
}
