// apps/office/office.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio",
    storageBucket: "aksh-studio.firebasestorage.app",
    messagingSenderId: "349325785973",
    appId: "1:349325785973:web:86d5a15bcb700bfc15b13c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==========================================
// 2. THEME ENGINE (Matches Dashboard)
// ==========================================
const themeBtn = document.getElementById('theme-toggle');

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    if(themeBtn) themeBtn.innerText = 'Light Mode';
}

if(themeBtn) {
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        if (document.body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark');
            themeBtn.innerText = 'Light Mode';
        } else {
            localStorage.setItem('theme', 'light');
            themeBtn.innerText = 'Dark Mode';
        }
    });
}

// ==========================================
// 3. USER AUTHENTICATION & PROFILE
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Kick out unauthorized users
        window.location.href = "../../index.html"; 
        return;
    }

    let displayName = user.displayName;

    // Check Firestore for detailed profile data
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    let userData = {};

    if (userDoc.exists()) {
        userData = userDoc.data();
        if (!displayName && userData.firstName) {
            displayName = `${userData.firstName} ${userData.lastName || ""}`.trim();
        }
    }

    displayName = displayName || "Studio User";
    document.getElementById('header-name').innerText = displayName;

    // Load Profile Picture
    let picUrl = userData.customProfilePic || user.photoURL;
    const profilePicEl = document.getElementById('profile-pic');
    
    if (picUrl && picUrl.trim() !== "") {
        profilePicEl.src = picUrl;
    } else {
        profilePicEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00a884&color=fff`;
    }

    profilePicEl.onerror = () => {
        profilePicEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=00a884&color=fff`;
    };
});

// Sign Out Logic
const btnSignout = document.getElementById('btn-signout');
if(btnSignout) {
    btnSignout.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = "../../index.html";
        }).catch((error) => {
            alert("Sign out failed: " + error.message);
        });
    });
}

// ==========================================
// 4. DOWNLOAD BUTTON LOGIC (.EXE PLACEHOLDER)
// ==========================================
const btnDownload = document.getElementById('btn-download-office');
if(btnDownload) {
    btnDownload.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Exact alert message requested
        alert("Aksh Office is Under Development, please come after making all apps perfectly.");
    });
}
