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
        
        const avatarEl = document.getElementById('help-header-avatar');
        if (user.photoURL && avatarEl) {
            avatarEl.src = user.photoURL;
        }

        const userRef = doc(db, `users/${user.uid}`);
        
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
            await setDoc(userRef, { 
                tokens: 0,
                displayName: user.displayName || "Anonymous User",
                photoURL: user.photoURL || ""
            }, { merge: true });
        }

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
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelAd = document.getElementById('btn-cancel-ad');

let isCooldown = false;
let rewardTimer;

// Partner Link Logic (Direct Link opens in new tab)
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

// Watch Video Ad Logic (Opens Modal with 300x250 Video/Banner inside)
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
    videoModal.style.display = 'flex';
    
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
            btnCloseModal.innerText = "Claim Token & Close";
        }
    }, 1000);
}

// Normal Close - Claim Reward Button inside the Modal
btnCloseModal.addEventListener('click', () => {
    videoModal.style.display = 'none';
    processTokenReward('Watch Video Ad');
});

// Cancel Ad ("X" Button) Logic
if (btnCancelAd) {
    btnCancelAd.addEventListener('click', () => {
        const confirmCancel = confirm("Are you sure you want to close the ad early? You will not receive your token reward.");
        
        if (confirmCancel) {
            clearInterval(rewardTimer); // Stop the countdown
            videoModal.style.display = 'none'; // Hide the modal
            resetButtonUI(); // Make sure buttons are clickable again
        }
    });
}

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
