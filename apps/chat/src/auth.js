// src/auth.js

// Dynamically pull user data from localStorage (set by your Login page)
export const currentUser = {
    // If no ID is found, they are marked as a Guest
    id: localStorage.getItem('aksh_user_id') || null,
    name: localStorage.getItem('aksh_user_name') || 'Guest User',
    email: localStorage.getItem('aksh_user_email') || 'Not provided',
    photoURL: localStorage.getItem('aksh_photo_url') || 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
    
    // Check if they have admin privileges (Your specific email)
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com';
    },
    
    get isGuest() {
        return this.id === null;
    }
};

export const initAuth = () => {
    // 1. Enforce Guest Restriction
    if (currentUser.isGuest) {
        const overlay = document.getElementById('guest-overlay');
        if (overlay) overlay.style.display = 'flex';
        
        const root = document.getElementById('app-root');
        if (root) root.classList.add('guest-blur');
    }

    // 2. Populate the Top Right Profile Dropdown dynamically
    const nameEl = document.getElementById('nav-profile-name');
    const emailEl = document.getElementById('nav-profile-email');
    const picEl = document.getElementById('nav-profile-pic');

    if (nameEl) nameEl.innerText = `Name: ${currentUser.name}`;
    if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
    if (picEl) picEl.src = currentUser.photoURL;
};
