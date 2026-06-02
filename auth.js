import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA_lmaWDdayWIOKK02h2uvZSeBasdUonXc",
    authDomain: "chat-with-anyone-73526.firebaseapp.com",
    projectId: "chat-with-anyone-73526",
    storageBucket: "chat-with-anyone-73526.firebasestorage.app",
    messagingSenderId: "440915092993",
    appId: "1:440915092993:web:96e7af7a1a05156ae6c200"
};

// Initialize and export apps for child access
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Check current page context
const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/" || window.location.pathname.endsWith("/");

// Authentication State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (isLoginPage) {
            window.location.href = "dashboard.html";
        }
    } else {
        if (!isLoginPage) {
            window.location.href = window.location.origin + "/index.html";
        }
    }
});

// Event Binding for Login View Elements if present on page
const googleBtn = document.getElementById("google-login-btn");
const emailAuthBtn = document.getElementById("email-auth-btn");
const toggleModeText = document.getElementById("toggle-mode-text");
const authError = document.getElementById("auth-error");

let isSignUpMode = false;

if (googleBtn) {
    googleBtn.onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(err => showError(err.code));
}

if (toggleModeText) {
    toggleModeText.onclick = () => {
        isSignUpMode = !isSignUpMode;
        if (authError) authError.style.display = "none";
        emailAuthBtn.textContent = isSignUpMode ? "Create Account" : "Sign In";
        toggleModeText.innerHTML = isSignUpMode ? 'Already have an account? <span>Sign In</span>' : 'New here? <span>Create an account</span>';
    };
}

if (emailAuthBtn) {
    emailAuthBtn.onclick = async () => {
        const e = document.getElementById("email-input").value.trim();
        const p = document.getElementById("password-input").value.trim();
        if (!e || !p) return showError("auth/missing-credentials");
        try {
            if (isSignUpMode) await createUserWithEmailAndPassword(auth, e, p);
            else await signInWithEmailAndPassword(auth, e, p);
        } catch (err) { showError(err.code); }
    };
}

function showError(code) {
    if (!authError) return;
    authError.textContent = `Error: ${code.replace("auth/", "").replace(/-/g, " ")}`;
    authError.style.display = "block";
}
