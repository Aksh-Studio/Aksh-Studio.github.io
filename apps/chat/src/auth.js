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

export const initAuth = () => {
    // We wrap this in a Promise so the Chat App waits for Firebase to check your login status before loading
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            const overlay = document.getElementById('guest-overlay');
            const root = document.getElementById('app-root');

            if (user) {
                // 1. Grab Base Firebase Auth Data
                let displayName = user.displayName;
                let photoURL = user.photoURL;

                // 2. Fetch specific Dashboard Data from Firestore (Mirroring your dashboard exactly)
                try {
                    const userDocRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        
                        if (!displayName && userData.firstName) {
                            displayName = `${userData.firstName} ${userData.lastName || ""}`.trim();
                        }
                        if (userData.customProfilePic) {
                            photoURL = userData.customProfilePic;
                        }
                    }
                } catch (error) {
                    console.error("Error fetching Dashboard profile:", error);
                }

                // 3. Populate Chat Identity
                currentUser.id = user.uid;
                currentUser.email = user.email;
                currentUser.name = displayName || user.email.split('@')[0];
                currentUser.photoURL = photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=00a884&color=fff&bold=true`;

                // 4. Unlock UI
                if (overlay) overlay.style.display = 'none';
                if (root) root.classList.remove('guest-blur');

                // 5. Render Profile Menu
                const nameEl = document.getElementById('nav-profile-name');
                const emailEl = document.getElementById('nav-profile-email');
                const picEl = document.getElementById('nav-profile-pic');
                const displayRole = currentUser.isAdmin ? ' (Admin)' : '';

                if (nameEl) nameEl.innerText = `Name: ${currentUser.name}${displayRole}`;
                if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
                if (picEl) picEl.src = currentUser.photoURL;

                resolve(true); // Tell the app to boot
            } else {
                // USER IS LOGGED OUT OF DASHBOARD - LOCK THEM OUT OF CHAT
                currentUser.id = null;
                if (overlay) overlay.style.display = 'flex';
                if (root) root.classList.add('guest-blur');
                
                const guestBtn = overlay.querySelector('a');
                if (guestBtn) guestBtn.href = '../../dashboard.html';
                
                resolve(false); // Stop app boot
            }
        });
    });
};
