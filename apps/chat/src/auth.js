// src/auth.js
import { auth, db, doc, getDoc, onAuthStateChanged } from './firebase.js';

export const currentUser = {
    id: null, name: 'Loading...', email: null, photoURL: '',
    get isAdmin() { return this.email === 'akshat124.am12@gmail.com' || this.email === 'akshat124am.12@gmail.com'; },
    get isGuest() { return !this.id; }
};

export const initAuth = (onSuccessBoot) => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    let isBooted = false;

    // The Failsafe Boot Function
    const forceBoot = (uid, email, name, photo) => {
        if (isBooted) return;
        isBooted = true;

        currentUser.id = uid;
        currentUser.email = email;
        currentUser.name = name || email.split('@')[0];
        currentUser.photoURL = photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`;

        if (overlay) overlay.style.display = 'none';
        if (root) root.classList.remove('guest-blur');

        const nameEl = document.getElementById('nav-profile-name');
        if (nameEl) nameEl.innerText = `Name: ${currentUser.name}${currentUser.isAdmin ? ' (Admin)' : ''}`;
        document.getElementById('nav-profile-email').innerText = `Email: ${currentUser.email}`;
        document.getElementById('nav-profile-pic').src = currentUser.photoURL;

        if (onSuccessBoot) onSuccessBoot();
    };

    // 1. Primary Check: Official Firebase Sync
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let dName = user.displayName;
            let pUrl = user.photoURL;
            try {
                const uDoc = await getDoc(doc(db, "users", user.uid));
                if (uDoc.exists()) {
                    dName = uDoc.data().fullName || dName;
                    pUrl = uDoc.data().customProfilePic || pUrl;
                }
            } catch (error) {}
            forceBoot(user.uid, user.email, dName, pUrl);
        } else {
            // 2. Secondary Check: If Firebase says logged out, check Local Storage as a backup
            const localEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email');
            if (localEmail) {
                const localId = localStorage.getItem('aksh_user_id') || localStorage.getItem('uid') || localEmail;
                const localName = localStorage.getItem('aksh_user_name') || localStorage.getItem('name');
                const localPhoto = localStorage.getItem('aksh_photo_url');
                forceBoot(localId, localEmail, localName, localPhoto);
            } else {
                // Completely logged out
                currentUser.id = null;
                if (overlay) overlay.style.display = 'flex';
                if (root) root.classList.add('guest-blur');
            }
        }
    });

    // 3. The 1.5 Second Nuclear Fallback
    setTimeout(() => {
        if (!isBooted) {
            const backupEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email');
            if (backupEmail) {
                forceBoot(backupEmail, backupEmail, localStorage.getItem('aksh_user_name'), null);
            }
        }
    }, 1500);
};
