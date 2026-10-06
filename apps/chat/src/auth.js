import { auth, db, doc, setDoc, Timestamp } from './firebase.js';

export let currentUser = {
    uid: null,
    email: null,
    displayName: null,
    photoURL: null,
    get isOwner() {
        return this.email === 'akshat124.am12@gmail.com';
    },
    get isGuest() {
        return !this.uid;
    }
};

export function initAuth(onSuccessBoot) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const uid = user.uid;
            const email = user.email || '';
            const fullName = user.displayName || 'Guest';
            const name = fullName.split(' ')[0];
            const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}`;
            
            currentUser.uid = uid;
            currentUser.email = email;
            currentUser.displayName = fullName;
            currentUser.photoURL = photoURL;

            try {
                const userPayload = {
                    uid: uid,
                    email: email,
                    displayName: fullName,
                    fullName: fullName,
                    name: name,
                    photoURL: photoURL,
                    lastLogin: Timestamp.now(),
                    updatedAt: Timestamp.now()
                };
                await setDoc(doc(db, 'users', uid), userPayload, { merge: true });
            } catch (e) {
                console.error("Error updating user profile. UI will continue to unlock.", e);
            }

            const guestOverlay = document.getElementById('guest-overlay');
            if (guestOverlay) guestOverlay.style.display = 'none';
            
            const guestBlurElements = document.querySelectorAll('.guest-blur');
            guestBlurElements.forEach(el => el.classList.remove('guest-blur'));

            const headerProfileImg = document.getElementById('header-profile-img');
            if (headerProfileImg) headerProfileImg.src = photoURL;
            const headerProfileName = document.getElementById('header-profile-name');
            if (headerProfileName) headerProfileName.textContent = name;

            const ownerPanelBtn = document.getElementById('ownerPanelBtn');
            if (ownerPanelBtn) {
                if (email === 'akshat124.am12@gmail.com') {
                    ownerPanelBtn.style.display = 'block';
                } else {
                    ownerPanelBtn.style.display = 'none';
                }
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
        } else {
            currentUser.uid = null;
            currentUser.email = null;
            currentUser.displayName = null;
            currentUser.photoURL = null;
            window.location.href = '../../index.html';
        }
    });
}
