// src/auth.js
import { auth, db, doc, getDoc, setDoc, onAuthStateChanged } from './firebase.js';

export const currentUser = {
    id: null, name: 'Loading...', email: null, photoURL: '',
    
    get isOwner() { 
        const e = String(this.email).toLowerCase().trim();
        return e === 'akshat124.am12@gmail.com'; 
    },
    get isGuest() { return !this.id; }
};

export const initAuth = (onSuccessBoot) => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');

    const forceBoot = async (uid, email, name, photo) => {
        currentUser.id = uid;
        currentUser.email = email;
        currentUser.name = name || (email ? email.split('@')[0] : 'User');
        currentUser.photoURL = photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`;

        // BUG 2 FIX: Aggressively register user so they ALWAYS appear in searches
        if (uid && email) {
            try {
                await setDoc(doc(db, "users", uid), {
                    uid: uid,
                    email: String(email).toLowerCase().trim(),
                    fullName: currentUser.name,
                    photoURL: currentUser.photoURL,
                    updatedAt: Date.now()
                }, { merge: true });
            } catch(e) { console.warn("Failed to register user to directory"); }
        }

        if (overlay) overlay.style.display = 'none';
        if (root) root.classList.remove('guest-blur');

        const nameEl = document.getElementById('nav-profile-name');
        if (nameEl) nameEl.innerHTML = `Name: ${currentUser.name} <span style="color:var(--primary); font-size:12px;">${currentUser.isOwner ? '(Owner)' : ''}</span>`;
        
        const emailEl = document.getElementById('nav-profile-email');
        if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
        
        const picEl = document.getElementById('nav-profile-pic');
        if (picEl) {
            picEl.src = currentUser.photoURL;
            picEl.onerror = () => { picEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff`; };
        }

        if (onSuccessBoot) onSuccessBoot();
    };

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let dName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
            let pUrl = user.photoURL || ''; 
            
            try {
                const uDoc = await getDoc(doc(db, "users", user.uid));
                if (uDoc.exists()) {
                    const data = uDoc.data();
                    dName = data.fullName || data.name || data.firstName || dName;
                    pUrl = data.customProfilePic || data.photoURL || data.profilePic || data.avatar || pUrl;
                }
            } catch (error) {}
            
            pUrl = pUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(dName)}&background=00a884&color=fff`;
            
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
};
