// src/auth.js

// 1. Try to grab your real dashboard data
let savedEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email') || localStorage.getItem('userEmail');
let savedName = localStorage.getItem('aksh_user_name') || localStorage.getItem('name') || localStorage.getItem('displayName');
let savedId = localStorage.getItem('aksh_user_id') || localStorage.getItem('uid') || localStorage.getItem('userId');

// 2. THE MASTER FALLBACK: If NO data is found, default directly to your Akshat profile
if (!savedEmail) {
    savedId = 'akshat_master_124';
    savedName = 'Akshat';
    savedEmail = 'akshat124.am12@gmail.com';
}

export const currentUser = {
    id: savedId, 
    name: savedName,
    email: savedEmail,
    photoURL: `https://ui-avatars.com/api/?name=${savedName.replace(' ', '+')}&background=00a884&color=fff`,
    
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com' || this.email === 'akshat124am.12@gmail.com'; 
    },
    
    // PERMANENTLY DISABLED GUEST LOCK
    get isGuest() { return false; }
};

export const initAuth = () => {
    // 3. Delete the lock screen entirely
    const overlay = document.getElementById('guest-overlay');
    if (overlay) overlay.remove(); 

    const root = document.getElementById('app-root');
    if (root) root.classList.remove('guest-blur');

    // 4. Load Your Precise Profile UI
    const nameEl = document.getElementById('nav-profile-name');
    const emailEl = document.getElementById('nav-profile-email');
    const picEl = document.getElementById('nav-profile-pic');

    const displayRole = currentUser.isAdmin ? ' (Admin)' : '';

    if (nameEl) nameEl.innerText = `Name: ${currentUser.name}${displayRole}`;
    if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
    if (picEl) picEl.src = currentUser.photoURL;
};
