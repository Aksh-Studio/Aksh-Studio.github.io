import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your verified Aksh-Studio Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
  authDomain: "aksh-studio.firebaseapp.com",
  projectId: "aksh-studio",
  storageBucket: "aksh-studio.firebasestorage.app",
  messagingSenderId: "349325785973",
  appId: "1:349325785973:web:86d5a15bcb700bfc15b13c",
  measurementId: "G-R96N91NV2X"
};

// Initialize Core Engines
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Gateway Route Controller
const isLoginPage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/" || window.location.pathname.endsWith("/");

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

// Auth Element Bindings
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
