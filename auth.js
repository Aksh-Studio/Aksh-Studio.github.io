import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio",
    storageBucket: "aksh-studio.firebasestorage.app",
    messagingSenderId: "349325785973",
    appId: "1:349325785973:web:86d5a15bcb700bfc15b13c",
    measurementId: "G-R96N91NV2X"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const isLoginPage = (window.location.pathname === "/" || window.location.pathname.endsWith("/index.html")) && !window.location.pathname.includes("/apps/");

// DOM Elements
const loginSec = document.getElementById('login-section');
const onboardSec = document.getElementById('onboarding-section');
const forgotSec = document.getElementById('forgot-password-section');
const authError = document.getElementById('auth-error');
const googleBtn = document.getElementById("google-login-btn");
const emailAuthBtn = document.getElementById("email-auth-btn");
const toggleModeText = document.getElementById("toggle-mode-text");

let isSignUpMode = false;

function showError(msg) {
    if (!authError) return;
    authError.textContent = msg.replace("auth/", "").replace(/-/g, " ");
    authError.style.display = "block";
}

// Intercept routing to check for Security Profile Data
async function handleUserRouting(user) {
    if (!isLoginPage) return;
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists() && userDoc.data().dob && userDoc.data().phone) {
        window.location.href = window.location.origin + "/dashboard.html";
    } else {
        if (loginSec) loginSec.style.display = "none";
        if (onboardSec) onboardSec.style.display = "block";
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await handleUserRouting(user);
    } else {
        if (!isLoginPage) {
            window.location.href = window.location.origin + "/index.html";
        }
    }
});

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
        } catch (err) {
            showError(err.code);
        }
    };
}

// Onboarding Save Logic
const btnSaveProfile = document.getElementById('btn-save-profile');
if (btnSaveProfile) {
    btnSaveProfile.onclick = async () => {
        const dob = document.getElementById('dob-input').value;
        const phone = document.getElementById('phone-input').value;
        if(!dob || !phone) return showError("Both fields are mandatory.");

        await setDoc(doc(db, "users", auth.currentUser.uid), {
            email: auth.currentUser.email,
            dob: dob,
            phone: phone,
            createdAt: new Date()
        }, { merge: true });

        window.location.href = window.location.origin + "/dashboard.html";
    };
}

// Forgot Password Navigation
const linkForgotPassword = document.getElementById('link-forgot-password');
const linkBackLogin = document.getElementById('link-back-login');
const btnSendReset = document.getElementById('btn-send-reset');

if (linkForgotPassword) {
    linkForgotPassword.onclick = () => {
        loginSec.style.display = "none";
        forgotSec.style.display = "block";
    };
}

if (linkBackLogin) {
    linkBackLogin.onclick = () => {
        forgotSec.style.display = "none";
        loginSec.style.display = "block";
    };
}

if (btnSendReset) {
    btnSendReset.onclick = () => {
        const email = document.getElementById('reset-email').value;
        if(!email) return showError("Please enter an email");
        sendPasswordResetEmail(auth, email).then(() => {
            alert("Secure password reset link sent to your email.");
            forgotSec.style.display = "none";
            loginSec.style.display = "block";
        }).catch(err => showError(err.code));
    };
}
