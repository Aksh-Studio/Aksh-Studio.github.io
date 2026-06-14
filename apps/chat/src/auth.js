// src/auth.js

// 1. Try to grab your real dashboard data
let savedEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email') || localStorage.getItem('userEmail');
let savedName = localStorage.getItem('aksh_user_name') || localStorage.getItem('name') || localStorage.getItem('displayName');
let savedId = localStorage.getItem('aksh_user_id') || localStorage.getItem('uid') || localStorage.getItem('userId');

// 2. If NO data is found, automatically generate a Test Profile so you can test two accounts
if (!savedEmail) {
    const randomID = Math.floor(Math.random() * 9000) + 1000;
    savedId = `test_user_${randomID}`;
    savedName = `Test User ${randomID}`;
    savedEmail = `test${randomID}@example.com`;
}

export const currentUser = {
    id: savedId, 
    name: savedName,
    email: savedEmail,
    photoURL: `https://ui-avatars.com/api/?name=${savedName.replace(' ', '+')}&background=random&color=fff`,
    
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com' || this.email === 'akshat124am.12@gmail.com'; 
    },
    
    // PERMANENTLY DISABLED GUEST LOCK
    get isGuest() { return false; }
};

export const initAuth = () => {
    // 3. THE NUCLEAR OPTION: Find the lock screen and physically delete it from the website
    const overlay = document.getElementById('guest-overlay');
    if (overlay) {
        overlay.remove(); 
    }

    // Remove the blur effect
    const root = document.getElementById('app-root');
    if (root) {
        root.classList.remove('guest-blur');
    }

    // 4. Load the Profile UI
    const nameEl = document.getElementById('nav-profile-name');
    const emailEl = document.getElementById('nav-profile-email');
    const picEl = document.getElementById('nav-profile-pic');

    const displayRole = currentUser.isAdmin ? ' (Admin)' : '';

    if (nameEl) nameEl.innerText = `Name: ${currentUser.name}${displayRole}`;
    if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
    if (picEl) picEl.src = currentUser.photoURL;
};
