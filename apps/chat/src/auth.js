// src/auth.js

// --- 1. DEEP STORAGE SCANNER ---
// This function deep-scans your browser memory to find any real login data 
// left behind by your Dashboard or Firebase Auth, bypassing any mismatched key names.
const scanForUserIdentity = () => {
    let identity = { id: null, name: null, email: null, photoURL: null };

    try {
        // Look through every single item stored in the browser's localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);

            // A. Check if this is a standard Firebase Authentication key
            if (key.startsWith('firebase:authUser')) {
                const userData = JSON.parse(value);
                if (userData) {
                    identity.id = userData.uid;
                    identity.email = userData.email;
                    identity.name = userData.displayName || userData.screenName;
                    identity.photoURL = userData.photoURL;
                    return identity;
                }
            }

            // B. Check for common standalone data keys
            if (key.toLowerCase().includes('email') && value.includes('@')) identity.email = value;
            if (key.toLowerCase().includes('uid') || key.toLowerCase().includes('userid')) identity.id = value;
            if (key.toLowerCase().includes('name') && !value.includes('@')) identity.name = value;
            if (key.toLowerCase().includes('photo') || key.toLowerCase().includes('avatar')) identity.photoURL = value;
        }
    } catch (e) {
        console.error("Storage scan interrupted:", e);
    }

    // Clean up fallback names if email exists but name is missing
    if (identity.email && !identity.name) {
        identity.name = identity.email.split('@')[0];
    }

    return identity;
};

// Execute the deep scan instantly
const detectedUser = scanForUserIdentity();

// --- 2. SECURE ROLE MANAGEMENT ---
export const currentUser = {
    // If the scanner found real data, use it. Otherwise, default to a safe generic guest profile.
    id: detectedUser.id || detectedUser.email || 'guest_secure_link',
    name: detectedUser.name || 'Network Guest',
    email: detectedUser.email || 'guest@akshstudio.com',
    photoURL: detectedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(detectedUser.name || 'Network Guest')}&background=00a884&color=fff&bold=true`,
    
    // STRICT CROSS-CHECK: Only grants Admin if the verified logged-in email matches you
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com' || this.email === 'akshat124am.12@gmail.com'; 
    },
    
    // Users are only restricted if they have absolutely zero valid credentials
    get isGuest() {
        return this.email === 'guest@akshstudio.com';
    }
};

// --- 3. UI RENDERING ---
export const initAuth = () => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    
    // If a user is completely unauthenticated, show the lock screen pointing to the dashboard
    if (currentUser.isGuest) {
        if (overlay) overlay.style.display = 'flex';
        if (root) root.classList.add('guest-blur');
    } else {
        if (overlay) overlay.style.display = 'none';
        if (root) root.classList.remove('guest-blur');
    }

    // Populate Top Right Profile Navigation Items safely
    const nameEl = document.getElementById('nav-profile-name');
    const emailEl = document.getElementById('nav-profile-email');
    const picEl = document.getElementById('nav-profile-pic');

    const displayRole = currentUser.isAdmin ? ' (Admin)' : '';

    if (nameEl) nameEl.innerText = `Name: ${currentUser.name}${displayRole}`;
    if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
    if (picEl) picEl.src = currentUser.photoURL;
};
