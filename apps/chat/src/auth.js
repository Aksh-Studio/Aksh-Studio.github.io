import { auth, db, doc, setDoc, Timestamp } from './firebase.js';

export let currentUser = { 
    uid: null, 
    email: null, 
    name: null, 
    isOwner: false, 
    isGuest: true 
};

export function initAuth(onSuccessBoot) {
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            currentUser.uid = null;
            currentUser.email = null;
            currentUser.name = null;
            currentUser.isOwner = false;
            currentUser.isGuest = true;
            
            const overlay = document.getElementById('guest-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
            }
            // Do NOT auto-redirect. Let them click the button.
            return;
        }

        // User EXISTS
        const uid = user.uid;
        const email = user.email || '';
        const displayName = user.displayName || 'User';
        const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00a884&color=fff`;

        currentUser.uid = uid;
        currentUser.email = email;
        currentUser.name = displayName;
        currentUser.isOwner = (email === 'akshat124.am12@gmail.com');
        currentUser.isGuest = false;

        const overlay = document.getElementById('guest-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }

        const headerProfileImg = document.getElementById('header-profile-img');
        if (headerProfileImg) {
            headerProfileImg.src = photoURL;
        }

        const headerProfileName = document.getElementById('header-profile-name');
        if (headerProfileName) {
            headerProfileName.textContent = displayName;
        }

        const ownerPanelBtn = document.getElementById('ownerPanelBtn');
        if (ownerPanelBtn) {
            ownerPanelBtn.style.display = currentUser.isOwner ? 'block' : 'none';
        }

        try {
            const payload = {
                uid: uid,
                email: email,
                displayName: displayName,
                name: displayName.split(' ')[0],
                photoURL: photoURL,
                lastLogin: Timestamp.now()
            };
            await setDoc(doc(db, 'users', uid), payload, { merge: true });
        } catch (e) {
            console.error("Profile sync failed, but UI will unlock:", e);
        }

        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.onclick = async () => {
                await auth.signOut();
                sessionStorage.clear();
                localStorage.clear();
                window.location.href = '../../index.html';
            };
        }

        if (typeof onSuccessBoot === 'function') {
            onSuccessBoot(user);
        }
    });
}

