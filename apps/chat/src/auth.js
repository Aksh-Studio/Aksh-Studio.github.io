// src/auth.js

// 1. Check every possible key your Dashboard might use to save user data
const savedEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email') || localStorage.getItem('userEmail');
let savedName = localStorage.getItem('aksh_user_name') || localStorage.getItem('name') || localStorage.getItem('displayName');
const savedPhoto = localStorage.getItem('aksh_photo_url') || localStorage.getItem('photoURL') || localStorage.getItem('profile_pic') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const savedId = localStorage.getItem('aksh_user_id') || localStorage.getItem('uid') || localStorage.getItem('userId');

// Fallback: If they have an email but no name loaded, use the first part of their email as their name
if (savedEmail && !savedName) {
    savedName = savedEmail.split('@')[0];
}

export const currentUser = {
    id: savedId || savedEmail, // Fallback to email as ID if UID is missing
    name: savedName,
    email: savedEmail,
    photoURL: savedPhoto,
    
    get isAdmin() {
        // Strictly checks for your exact email to grant Super Admin rights
        return this.email === 'akshat124.am12@gmail.com' || this.email === 'akshat124am.12@gmail.com'; 
    },
    
    get isGuest() {
        // If there is no email and no ID, they are locked out as a guest
        return !this.id && !this.email;
    }
};

export const initAuth = () => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    
    // Guest Lockout Logic
    if (currentUser.isGuest) {
        if (overlay) overlay.style.display = 'flex';
        if (root) root.classList.add('guest-blur');
    } else {
        if (overlay) overlay.style.display = 'none';
        if (root) root.classList.remove('guest-blur');
    }

    // Populate Top Right Profile UI
    const nameEl = document.getElementById('nav-profile-name');
    const emailEl = document.getElementById('nav-profile-email');
    const picEl = document.getElementById('nav-profile-pic');

    // Add an official "(Admin)" tag if you are logged in
    const displayRole = currentUser.isAdmin ? ' (Admin)' : '';

    if (nameEl) nameEl.innerText = `Name: ${currentUser.name || 'Unknown User'}${displayRole}`;
    if (emailEl) emailEl.innerText = `Email: ${currentUser.email || 'No email'}`;
    if (picEl) picEl.src = currentUser.photoURL;
};
