// src/auth.js

let savedEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email') || localStorage.getItem('userEmail');
let savedName = localStorage.getItem('aksh_user_name') || localStorage.getItem('name');
let savedPhoto = localStorage.getItem('aksh_photo_url') || localStorage.getItem('photoURL');
let savedId = localStorage.getItem('aksh_user_id') || localStorage.getItem('uid');

// SMART FALLBACK: If no data is found, create a temporary Random ID so different profiles don't overwrite each other!
if (!savedEmail) {
    const randomID = Math.floor(Math.random() * 10000);
    savedId = `test_user_${randomID}`;
    savedName = `Test User ${randomID}`;
    savedEmail = `test${randomID}@example.com`;
    savedPhoto = `https://ui-avatars.com/api/?name=User+${randomID}&background=random&color=fff`;
}

export const currentUser = {
    id: savedId || savedEmail, 
    name: savedName,
    email: savedEmail,
    photoURL: savedPhoto,
    
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com';
    },
    
    // Safety check bypass
    get isGuest() { return false; }
};

export const initAuth = () => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    
    // Always unlock for testing
    if (overlay) overlay.style.display = 'none';
    if (root) root.classList.remove('guest-blur');

    // Populate Profile Dropdown
    const nameEl = document.getElementById('nav-profile-name');
    const emailEl = document.getElementById('nav-profile-email');
    const picEl = document.getElementById('nav-profile-pic');

    if (nameEl) nameEl.innerText = `Name: ${currentUser.name}`;
    if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
    if (picEl) picEl.src = currentUser.photoURL;
};
