// src/auth.js
import { auth, db, doc, getDoc, onAuthStateChanged } from './firebase.js';

export const currentUser = {
    id: null, name: 'Loading...', email: null, photoURL: '',
    // UPGRADED TO GLOBAL OWNER STATUS
    get isOwner() { return this.email === 'akshat124.am12@gmail.com' || this.email === 'akshat124am.12@gmail.com'; },
    get isGuest() { return !this.id; }
};

export const initAuth = (onSuccessBoot) => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    let isBooted = false;

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
        // TAG UPDATED TO OWNER
        if (nameEl) nameEl.innerText = `Name: ${currentUser.name}${currentUser.isOwner ? ' (Owner)' : ''}`;
        
        const emailEl = document.getElementById('nav-profile-email');
        if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
        
        const picEl = document.getElementById('nav-profile-pic');
        if (picEl) picEl.src = currentUser.photoURL;

        if (onSuccessBoot) onSuccessBoot();
    };

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
            const localEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email');
            if (localEmail) {
                const localId = localStorage.getItem('aksh_user_id') || localStorage.getItem('uid') || localEmail;
                const localName = localStorage.getItem('aksh_user_name') || localStorage.getItem('name');
                const localPhoto = localStorage.getItem('aksh_photo_url');
                forceBoot(localId, localEmail, localName, localPhoto);
            } else {
                currentUser.id = null;
                if (overlay) overlay.style.display = 'flex';
                if (root) root.classList.add('guest-blur');
            }
        }
    });

    setTimeout(() => {
        if (!isBooted) {
            const backupEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email');
            if (backupEmail) forceBoot(backupEmail, backupEmail, localStorage.getItem('aksh_user_name'), null);
        }
    }, 1500);
};
