// src/auth.js

// --- 1. MAGIC URL OVERRIDE ---
const urlParams = new URLSearchParams(window.location.search);
const magicEmail = urlParams.get('email');
const magicName = urlParams.get('name');

if (magicEmail) {
    localStorage.setItem('aksh_user_email', magicEmail);
    localStorage.setItem('aksh_user_name', magicName || magicEmail.split('@')[0]);
    window.history.replaceState({}, document.title, window.location.pathname);
}

// --- 2. DEEP STORAGE SCANNER ---
const scanForUserIdentity = () => {
    let identity = { id: null, name: null, email: null, photoURL: null };

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);

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

            if (key.toLowerCase().includes('email') && value.includes('@')) identity.email = value;
            if (key.toLowerCase().includes('uid') || key.toLowerCase().includes('userid')) identity.id = value;
            if (key.toLowerCase().includes('name') && !value.includes('@')) identity.name = value;
            if (key.toLowerCase().includes('photo') || key.toLowerCase().includes('avatar')) identity.photoURL = value;
        }
    } catch (e) { console.error("Storage scan interrupted:", e); }

    if (identity.email && !identity.name) identity.name = identity.email.split('@')[0];
    return identity;
};

const detectedUser = scanForUserIdentity();

// --- 3. SECURE ROLE MANAGEMENT ---
export const currentUser = {
    id: detectedUser.id || detectedUser.email || 'guest_secure_link',
    name: detectedUser.name || 'Network Guest',
    email: detectedUser.email || 'guest@akshstudio.com',
    photoURL: detectedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(detectedUser.name || 'Network Guest')}&background=00a884&color=fff&bold=true`,
    
    get isAdmin() {
        return this.email === 'akshat124.am12@gmail.com' || this.email === 'akshat124am.12@gmail.com'; 
    },
    
    get isGuest() {
        return this.email === 'guest@akshstudio.com';
    }
};

// --- 4. UI RENDERING ---
export const initAuth = () => {
    const overlay = document.getElementById('guest-overlay');
    const root = document.getElementById('app-root');
    
    if (currentUser.isGuest) {
        if (overlay) overlay.style.display = 'flex';
        if (root) root.classList.add('guest-blur');
    } else {
        if (overlay) overlay.style.display = 'none';
        if (root) root.classList.remove('guest-blur');
    }

    const nameEl = document.getElementById('nav-profile-name');
    const emailEl = document.getElementById('nav-profile-email');
    const picEl = document.getElementById('nav-profile-pic');

    const displayRole = currentUser.isAdmin ? ' (Admin)' : '';

    if (nameEl) nameEl.innerText = `Name: ${currentUser.name}${displayRole}`;
    if (emailEl) emailEl.innerText = `Email: ${currentUser.email}`;
    if (picEl) picEl.src = currentUser.photoURL;
};

// --- 5. SECRET DEVELOPER BACKDOOR (God Mode) ---
document.addEventListener('keydown', (e) => {
    // Press Ctrl + Shift + U to instantly bypass the lock screen as Admin
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        console.warn("DEVELOPER OVERRIDE INITIATED");
        
        localStorage.setItem('aksh_user_email', 'akshat124.am12@gmail.com');
        localStorage.setItem('aksh_user_name', 'Akshat');
        
        alert("Developer Override Activated. Welcome back, Admin. Reloading...");
        window.location.reload();
    }
});
