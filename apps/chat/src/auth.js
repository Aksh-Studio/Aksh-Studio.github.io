// src/auth.js

// --- DEVELOPER BYPASS MODE ---
// Set this to 'true' while we are building the app. It forces the app to unlock 
// even if your dashboard hasn't saved your login data to the browser yet.
const DEV_MODE_ENABLED = true; 

let savedEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email') || localStorage.getItem('userEmail');
let savedName = localStorage.getItem('aksh_user_name') || localStorage.getItem('name');
let savedPhoto = localStorage.getItem('aksh_photo_url') || localStorage.getItem('photoURL');
let savedId = localStorage.getItem('aksh_user_id') || localStorage.getItem('uid');

// THE FAILSAFE: If Dev Mode is ON and no data is found, force the Admin Identity
if (DEV_MODE_ENABLED && !savedEmail) {
    console.warn("Dev Mode Active: Bypassing Guest Lock");
    savedEmail = 'akshat124.am12@gmail.com';
    savedName = 'Akshat (Admin)';
    savedId = 'dev_admin_124';
    savedPhoto = 'https://ui-avatars.com/api/?name=Akshat&background=00a884&color=fff&bold=true';
}

export const currentUser = {
    id: savedId || savedEmail, 
    name: savedName || 'Guest User',
    email: savedEmail || 'Not provided',
    photoURL: savedPhoto || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com';
    },
    
    get isGuest() {
        return !this.id && !this.email;
    }
};

export const initAuth = () => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    
    // 1. Guest Lock Logic
    if (currentUser.isGuest) {
        if (overlay) overlay.style.display = 'flex';
        if (root) root.classList.add('guest-blur');
        
        const guestBtn = overlay.querySelector('a');
        if (guestBtn) guestBtn.href = '../../dashboard.html';
    } else {
        // FORCE UNLOCK
        if (overlay) overlay.style.display = 'none';
        if (root) root.classList.remove('guest-blur');
    }

    // 2. Populate Profile
    const nameEl = document.getElementById('nav-profile-name');
    const emailEl = document.getElementById('nav-profile-email');
    const picEl = document.getElementById('nav-profile-pic');

    if (nameEl) nameEl.innerText = `Name: ${currentUser.name}`;
    if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
    if (picEl) picEl.src = currentUser.photoURL;
};
