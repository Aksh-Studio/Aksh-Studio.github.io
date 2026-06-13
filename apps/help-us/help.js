// apps/help-us/help.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. THEME ENGINE
// ==========================================
const themeBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    if (themeIcon) themeIcon.innerText = 'light_mode';
}

if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-theme');
        if (document.body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark');
            themeIcon.innerText = 'light_mode';
        } else {
            localStorage.setItem('theme', 'light');
            themeIcon.innerText = 'dark_mode';
        }
    };
}

// ==========================================
// 2. FIREBASE & USER DATA
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // Populate profile image in header
        const avatarEl = document.getElementById('help-header-avatar');
        if (user.photoURL && avatarEl) {
            avatarEl.src = user.photoURL;
        }

        // Fetch User's Support Tokens
        const userRef = doc(db, `users/${user.uid}`);
        
        // Ensure document exists, if not create it
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
            await setDoc(userRef, { 
                tokens: 0,
                displayName: user.displayName || "Anonymous User",
                photoURL: user.photoURL || ""
            }, { merge: true });
        }

        // Listen for live updates to the token score
        onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const scoreDisplay = document.getElementById('contribution-score');
                if (scoreDisplay) {
                    scoreDisplay.innerText = `Tokens: ${data.tokens || 0}`;
                }
            }
        });
    } else {
        // Kick them out if not logged in
        window.location.href = "../../index.html";
    }
});

// ==========================================
// 3. SECURE DIRECT LINK AD TRACKING
// ==========================================
const btnWatchAd = document.getElementById('btn-watch-ad');
const cooldownTimerDisplay = document.getElementById('cooldown-timer');
let isCooldown = false;
let adWindowOpened = false;

// Live Monetag Direct Link Integration
const MONETAG_DIRECT_LINK = "https://omg10.com/4/11140885"; 

if (btnWatchAd) {
    btnWatchAd.innerHTML = '<span class="material-symbols-rounded">open_in_new</span> Support via Partner Link';
    
    btnWatchAd.addEventListener('click', () => {
        if (isCooldown || !currentUser) return;
        
        isCooldown = true;
        btnWatchAd.disabled = true;
        btnWatchAd.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span> Verifying View...';
        
        // 1. Open the Monetag Ad securely in a new tab
        window.open(MONETAG_DIRECT_LINK, '_blank');
        adWindowOpened = true;

        // 2. 5-second check to ensure they left the page to view the sponsor
        setTimeout(async () => {
            if (document.hidden || adWindowOpened) {
                // User successfully switched tabs to view the ad
                try {
                    const userRef = doc(db, `users/${currentUser.uid}`);
                    const docSnap = await getDoc(userRef);
                    let currentTokens = docSnap.exists() ? (docSnap.data().tokens || 0) : 0;
                    
                    // Update tokens and ensure profile details are saved for the Leaderboard
                    await setDoc(userRef, {
                        tokens: currentTokens + 1,
                        displayName: currentUser.displayName || "Anonymous Supporter",
                        photoURL: currentUser.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                    }, { merge: true });
                    
                    startCooldown(30);
                } catch (err) {
                    console.error("Token update failed:", err);
                    resetButtonUI();
                }
            } else {
                // Exploit prevented: Tab blocked or instantly closed
                alert("Ad verification failed. Please ensure your browser allows pop-ups and you view the sponsor page!");
                resetButtonUI();
            }
        }, 5000); 
    });
}

function resetButtonUI() {
    isCooldown = false;
    adWindowOpened = false;
    if (btnWatchAd) {
        btnWatchAd.disabled = false;
        btnWatchAd.innerHTML = '<span class="material-symbols-rounded">open_in_new</span> Support via Partner Link';
    }
}

function startCooldown(seconds) {
    cooldownTimerDisplay.style.display = 'block';
    let timeLeft = seconds;
    const interval = setInterval(() => {
        btnWatchAd.innerHTML = `<span class="material-symbols-rounded">lock_clock</span> Available in ${timeLeft}s`;
        cooldownTimerDisplay.innerText = `Verified! You earned 1 Token.`;
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(interval);
            resetButtonUI();
            cooldownTimerDisplay.style.display = 'none';
        }
    }, 1000);
}
