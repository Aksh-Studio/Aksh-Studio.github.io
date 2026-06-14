// src/auth.js

// Smarter Identity Pull: Checks multiple possible keys your dashboard might be using
const savedEmail = localStorage.getItem('aksh_user_email') || localStorage.getItem('email') || localStorage.getItem('userEmail');
const savedName = localStorage.getItem('aksh_user_name') || localStorage.getItem('name') || 'Aksh User';
const savedPhoto = localStorage.getItem('aksh_photo_url') || localStorage.getItem('photoURL') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export const currentUser = {
    id: localStorage.getItem('aksh_user_id') || localStorage.getItem('uid') || savedEmail, // Fallback to email if no UID
    name: savedName,
    email: savedEmail,
    photoURL: savedPhoto,
    
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com';
    },
    
    // If we have an email or an ID, you are NOT a guest.
    get isGuest() {
        return !this.id && !this.email;
    }
};

export const initAuth = () => {
    // 1. Handle Guest Lockout safely
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    
    if (currentUser.isGuest) {
        if (overlay) overlay.style.display = 'flex';
        if (root) root.classList.add('guest-blur');
        
        // Update Guest button to go to Dashboard as requested
        const guestBtn = overlay.querySelector('a');
        if (guestBtn) guestBtn.href = '/dashboard.html';
    } else {
        // Ensure unlock if data is present
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
    
    // 3. Fix Sign Out Button Route
    const signOutBtn = document.getElementById('btn-sign-out');
    if (signOutBtn) signOutBtn.href = '/dashboard.html';
};
