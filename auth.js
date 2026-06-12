import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
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

const loginSec = document.getElementById('login-section');
const onboardSec = document.getElementById('onboarding-section');
const forgotSec = document.getElementById('forgot-password-section');
const authError = document.getElementById('auth-error');
const googleBtn = document.getElementById("google-login-btn");
const emailAuthBtn = document.getElementById("email-auth-btn");
const toggleModeText = document.getElementById("toggle-mode-text");
const signupSecurityFields = document.getElementById("signup-security-fields");
const authSubtitle = document.getElementById("auth-subtitle");

let isSignUpMode = false;

function showError(msg) {
    if (!authError) return;
    authError.textContent = msg.replace("auth/", "").replace(/-/g, " ");
    authError.style.display = "block";
}

async function handleUserRouting(user) {
    if (!isLoginPage) return;

    // Check if email is verified
    if (!user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
        authError.style.display = "block";
        authError.style.color = "#d9534f";
        
        // Add a clickable "Resend" link to the error message
        authError.innerHTML = `Please verify your email. Check your inbox/spam folder.<br><a href="#" id="resend-verification" style="color: #128C7E; font-weight: bold; text-decoration: underline; cursor: pointer;">Click here to resend the email</a>`;
        
        // Make the Resend link actually work
        document.getElementById('resend-verification').onclick = async (e) => {
            e.preventDefault();
            try {
                await sendEmailVerification(user);
                alert("A new verification link has been sent! Please check your inbox.");
            } catch (err) {
                if (err.code === "auth/too-many-requests") {
                    alert("Firebase paused emails due to too many requests. Please wait a few minutes and try again.");
                } else {
                    alert("Error: " + err.message);
                }
            }
        };

        await signOut(auth);
        return;
    }

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

// UI Toggle for Sign In vs Create Account
if (toggleModeText) {
    toggleModeText.onclick = () => {
        isSignUpMode = !isSignUpMode;
        if (authError) authError.style.display = "none";
        emailAuthBtn.textContent = isSignUpMode ? "Create Account" : "Sign In";
        authSubtitle.textContent = isSignUpMode ? "Create a secure account" : "Sign in to access your utilities";
        signupSecurityFields.style.display = isSignUpMode ? "block" : "none";
        toggleModeText.innerHTML = isSignUpMode ? 'Already have an account? <span>Sign In</span>' : 'New here? <span>Create an account</span>';
    };
}

// Authentication Logic
if (emailAuthBtn) {
    emailAuthBtn.onclick = async () => {
        const e = document.getElementById("email-input").value.trim();
        const p = document.getElementById("password-input").value.trim();
        
        if (!e || !p) return showError("auth/missing-credentials");

        if (isSignUpMode) {
            const dob = document.getElementById("signup-dob").value;
            const phone = document.getElementById("signup-phone").value;
            if (!dob || !phone) return showError("DOB and Phone are required to create an account.");

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, e, p);
                const user = userCredential.user;
                
                // Immediately save security data to Firestore
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    dob: dob,
                    phone: phone,
                    createdAt: new Date()
                });

                // Send Email Verification to block fake emails
                await sendEmailVerification(user);
                
                alert("Account created successfully! A verification link has been sent to your email. Please verify it before logging in.");
                await signOut(auth);
                window.location.reload();
            } catch (err) {
                showError(err.code);
            }
        } else {
            try {
                await signInWithEmailAndPassword(auth, e, p);
          } catch (err) {
                console.error("FIREBASE EXPLANATION: ", err.message);
                showError(err.message);
            }
        }
    };
}

// Onboarding Save Logic (For Google Sign-Ins)
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

// Forgot Password Flow
if (document.getElementById('link-forgot-password')) {
    document.getElementById('link-forgot-password').onclick = () => {
        loginSec.style.display = "none";
        forgotSec.style.display = "block";
    };
}

if (document.getElementById('link-back-login')) {
    document.getElementById('link-back-login').onclick = () => {
        forgotSec.style.display = "none";
        loginSec.style.display = "block";
    };
}

if (document.getElementById('btn-send-reset')) {
    document.getElementById('btn-send-reset').onclick = () => {
        const email = document.getElementById('reset-email').value;
        if(!email) return showError("Please enter an email");
        sendPasswordResetEmail(auth, email).then(() => {
            alert("Secure password reset link sent to your email.");
            forgotSec.style.display = "none";
            loginSec.style.display = "block";
        }).catch(err => showError(err.code));
    };
}
