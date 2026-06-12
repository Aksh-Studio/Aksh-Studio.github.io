// apps/help-us/help.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, updateDoc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
        
        // Populate profile image
        const avatarEl = document.getElementById('help-header-avatar');
        if (user.photoURL && avatarEl) {
            avatarEl.src = user.photoURL;
        }

        // Fetch User's Support Tokens
        const userRef = doc(db, `users/${user.uid}`);
        
        // Ensure document exists, if not create it
        const docSnap = await getDoc(userRef);
        if (!docSnap.exists()) {
            await setDoc(userRef, { tokens: 0 }, { merge: true });
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
// 3. AD BUTTON REWARD LOGIC (Cooldown System)
// ==========================================
const btnWatchAd = document.getElementById('btn-watch-ad');
const cooldownTimerDisplay = document.getElementById('cooldown-timer');
let isCooldown = false;

if (btnWatchAd) {
    btnWatchAd.addEventListener('click', async () => {
        if (isCooldown || !currentUser) return;
        
        // 1. Disable button to prevent spam
        isCooldown = true;
        btnWatchAd.disabled = true;
        btnWatchAd.innerHTML = '<span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">hourglass_empty</span> Loading Clip...';
        
        // 2. Simulate watching an Ad (In the future, you put AppLixir code here)
        // We will fake a 5-second ad watch for now.
        setTimeout(async () => {
            
            // Give them a Token in Firebase!
            try {
                const userRef = doc(db, `users/${currentUser.uid}`);
                const docSnap = await getDoc(userRef);
                let currentTokens = docSnap.exists() ? (docSnap.data().tokens || 0) : 0;
                
                await updateDoc(userRef, {
                    tokens: currentTokens + 1
                });
                
            } catch (err) {
                console.error("Error updating token:", err);
            }

            // 3. Start a 30-second cooldown timer before they can click again
            startCooldown(30);

        }, 5000); // 5 seconds "watch time"
    });
}

function startCooldown(seconds) {
    cooldownTimerDisplay.style.display = 'block';
    
    let timeLeft = seconds;
    const interval = setInterval(() => {
        btnWatchAd.innerHTML = `<span class="material-symbols-rounded">lock_clock</span> Available in ${timeLeft}s`;
        cooldownTimerDisplay.innerText = `Thanks for supporting! You earned 1 Token.`;
        
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(interval);
            isCooldown = false;
            btnWatchAd.disabled = false;
            btnWatchAd.innerHTML = '<span class="material-symbols-rounded">play_circle</span> Watch Supporting Clip';
            cooldownTimerDisplay.style.display = 'none';
        }
    }, 1000);
}
