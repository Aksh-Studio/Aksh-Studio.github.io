// src/auth.js
import { auth, db, doc, getDoc, onAuthStateChanged } from './firebase.js';

export const currentUser = {
    id: null, 
    name: 'Loading...',
    email: null,
    photoURL: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com' || this.email === 'akshat124am.12@gmail.com'; 
    },
    get isGuest() { 
        return !this.id; 
    }
};

// We now pass a callback function so the app only boots AFTER Firebase gives the final green light
export const initAuth = (onSuccessBoot) => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    const guestBtn = overlay ? overlay.querySelector('a') : null;

    // This listener stays active. It handles the "flicker" automatically.
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. User is verified by Firebase. Fetch Dashboard Data.
            let displayName = user.displayName;
            let photoURL = user.photoURL;

            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.fullName) displayName = userData.fullName;
                    if (userData.customProfilePic) photoURL = userData.customProfilePic;
                }
            } catch (error) {
                console.error("Error fetching Dashboard profile:", error);
            }

            // 2. Populate Chat Identity
            currentUser.id = user.uid;
            currentUser.email = user.email;
            currentUser.name = displayName || user.email.split('@')[0];
            currentUser.photoURL = photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff&bold=true`;

            // 3. Unlock UI
            if (overlay) overlay.style.display = 'none';
            if (root) root.classList.remove('guest-blur');

            // 4. Render Profile Menu
            const nameEl = document.getElementById('nav-profile-name');
            const emailEl = document.getElementById('nav-profile-email');
            const picEl = document.getElementById('nav-profile-pic');
            const displayRole = currentUser.isAdmin ? ' (Admin)' : '';

            if (nameEl) nameEl.innerText = `Name: ${currentUser.name}${displayRole}`;
            if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
            if (picEl) picEl.src = currentUser.photoURL;

            // 5. Tell app.js to boot the chat interface!
            if (onSuccessBoot) onSuccessBoot();

        } else {
            // FIREBASE CONFIRMS USER IS LOGGED OUT
            currentUser.id = null;
            if (overlay) overlay.style.display = 'flex';
            if (root) root.classList.add('guest-blur');
            
            // Route them back to the root login page
            if (guestBtn) guestBtn.href = '../../index.html';
        }
    });
};
