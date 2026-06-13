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
// 3. IN-PAGE MODAL & AD BUTTON TRACKING
// ==========================================
const btnWatchAd = document.getElementById('btn-watch-ad');
const btnVideoAd = document.getElementById('btn-video-ad');
const cooldownTimerDisplay = document.getElementById('cooldown-timer');
const videoModal = document.getElementById('video-modal');
const adIframe = document.getElementById('ad-iframe');
const btnCloseModal = document.getElementById('btn-close-modal');

let isCooldown = false;
let rewardTimer;

// Adsterra Smartlink (Used in iframe)
const ADSTERRA_URL = "https://www.effectivecpmnetwork.com/s9m8i3khf?key=f0cad199709e55abee9c5c1c8900c0b5";

// Partner Link Logic (Direct Link)
if (btnWatchAd) {
    btnWatchAd.addEventListener('click', (e) => {
        if (isCooldown || !currentUser) {
            e.preventDefault();
            if (!currentUser) alert("Please sign in to earn tokens!");
            return;
        }
        processTokenReward('Partner Link');
    });
}

// In-Page Video Modal Logic
if (btnVideoAd) {
    btnVideoAd.addEventListener('click', () => {
        if (isCooldown || !currentUser) {
            if (!currentUser) alert("Please sign in to earn tokens!");
            return;
        }
        openVideoModal();
    });
}

function openVideoModal() {
    // Show the Support Hub Modal UI
    videoModal.style.display = 'flex';
    
    // Open Adsterra in a floating popup window (Width 800px, Height 600px)
    // Because this happens exactly on a click, popup blockers will allow it!
    const adWindow = window.open(ADSTERRA_URL, 'SponsorAd', 'width=800,height=600,top=100,left=100,scrollbars=yes');
    
    // 10 Second Required Watch Time
    let timeLeft = 10;
    btnCloseModal.disabled = true;
    btnCloseModal.style.background = "#475569";
    btnCloseModal.innerText = `Please wait ${timeLeft}s to claim token...`;

    rewardTimer = setInterval(() => {
        timeLeft--;
        btnCloseModal.innerText = `Please wait ${timeLeft}s to claim token...`;
        
        if (timeLeft <= 0) {
            clearInterval(rewardTimer);
            btnCloseModal.disabled = false;
            btnCloseModal.style.background = "#10b981"; // Turns green
            btnCloseModal.innerText = "Close Video & Claim Token";
        }
    }, 1000);
}

// Claim Reward Button inside the Modal
btnCloseModal.addEventListener('click', () => {
    // Hide Modal & Clear Iframe
    videoModal.style.display = 'none';
    adIframe.src = "";
    
    // Process Token
    processTokenReward('Watch Video Ad');
});

function processTokenReward(originalText) {
    isCooldown = true;
    disableAdButtons();
    
    setTimeout(async () => {
        try {
            const userRef = doc(db, `users/${currentUser.uid}`);
            const docSnap = await getDoc(userRef);
            let currentTokens = docSnap.exists() ? (docSnap.data().tokens || 0) : 0;
            
            await setDoc(userRef, {
                tokens: currentTokens + 1,
                displayName: currentUser.displayName || "Anonymous Supporter",
                photoURL: currentUser.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"
            }, { merge: true });
            
            startCooldown(30, originalText);
        } catch (err) {
            console.error("Token assignment failed:", err);
            resetButtonUI();
        }
    }, 1000);
}

function disableAdButtons() {
    if (btnWatchAd) {
        btnWatchAd.style.pointerEvents = 'none';
        btnWatchAd.style.opacity = '0.5';
    }
    if (btnVideoAd) {
        btnVideoAd.style.pointerEvents = 'none';
        btnVideoAd.style.opacity = '0.5';
    }
}

function resetButtonUI() {
    isCooldown = false;
    if (btnWatchAd) {
        btnWatchAd.style.pointerEvents = 'auto';
        btnWatchAd.style.opacity = '1';
        btnWatchAd.innerHTML = '<span class="material-symbols-rounded">open_in_new</span> Partner Link';
    }
    if (btnVideoAd) {
        btnVideoAd.style.pointerEvents = 'auto';
        btnVideoAd.style.opacity = '1';
        btnVideoAd.innerHTML = '<span class="material-symbols-rounded">movie</span> Watch Video Ad';
    }
}

function startCooldown(seconds, buttonUsed) {
    cooldownTimerDisplay.style.display = 'block';
    let timeLeft = seconds;
    
    const interval = setInterval(() => {
        if (btnWatchAd) btnWatchAd.innerHTML = `<span class="material-symbols-rounded">lock_clock</span> Lock (${timeLeft}s)`;
        if (btnVideoAd) btnVideoAd.innerHTML = `<span class="material-symbols-rounded">lock_clock</span> Lock (${timeLeft}s)`;
        
        cooldownTimerDisplay.innerText = `Tokens updated successfully via ${buttonUsed}!`;
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(interval);
            resetButtonUI();
            cooldownTimerDisplay.style.display = 'none';
        }
    }, 1000);
}
