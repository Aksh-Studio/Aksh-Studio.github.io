import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio",
    storageBucket: "aksh-studio.firebasestorage.app",
    messagingSenderId: "349325785973",
    appId: "1:349325785973:web:86d5a15bcb700bfc15b13c"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const isLoginPage = (window.location.pathname === "/" || window.location.pathname.endsWith("/index.html")) && !window.location.pathname.includes("/apps/");

const loginSec = document.getElementById('login-section');
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
    authError.innerHTML = msg.replace("auth/", "").replace(/-/g, " ");
    authError.style.display = "block";
}

async function handleUserRouting(user) {
    if (!isLoginPage) return;

    // Email Verification Check
    if (!user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
        authError.style.display = "block";
        authError.style.color = "#d9534f";
        authError.innerHTML = `Please verify your email. Check your inbox/spam folder.<br><a href="#" id="resend-verification" style="color: #128C7E; font-weight: bold; text-decoration: underline; cursor: pointer;">Click here to resend the email</a>`;
        
        document.getElementById('resend-verification').onclick = async (e) => {
            e.preventDefault();
            try {
                await sendEmailVerification(user);
                alert("A new verification link has been sent! Please check your inbox and spam folder.");
            } catch (err) {
                alert("Wait a moment before requesting another email.");
            }
        };
        await signOut(auth);
        return;
    }

    window.location.href = window.location.origin + "/dashboard.html";
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await handleUserRouting(user);
    } else {
        if (!isLoginPage) window.location.href = window.location.origin + "/index.html";
    }
});

if (googleBtn) {
    googleBtn.onclick = async () => {
        try {
            const result = await signInWithPopup(auth, new GoogleAuthProvider());
            const user = result.user;
            // For new Google logins, ensure they have a basic Firestore profile
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    firstName: user.displayName.split(" ")[0] || "User",
                    lastName: user.displayName.split(" ").slice(1).join(" ") || "",
                    createdAt: new Date()
                });
            }
        } catch(err) {
            showError(err.message);
        }
    };
}

if (toggleModeText) {
    toggleModeText.onclick = () => {
        isSignUpMode = !isSignUpMode;
        if (authError) authError.style.display = "none";
        emailAuthBtn.textContent = isSignUpMode ? "Create Account" : "Sign In";
        authSubtitle.textContent = isSignUpMode ? "Create your personal profile" : "Sign in to access your utilities";
        signupSecurityFields.style.display = isSignUpMode ? "block" : "none";
        toggleModeText.innerHTML = isSignUpMode ? 'Already have an account? <span>Sign In</span>' : 'New here? <span>Create an account</span>';
    };
}

if (emailAuthBtn) {
    emailAuthBtn.onclick = async () => {
        const e = document.getElementById("email-input").value.trim();
        const p = document.getElementById("password-input").value.trim();
        
        if (!e || !p) return showError("auth/missing-credentials");

        if (isSignUpMode) {
            const first = document.getElementById("signup-first-name").value.trim();
            const middle = document.getElementById("signup-middle-name").value.trim();
            const last = document.getElementById("signup-last-name").value.trim();
            const dob = document.getElementById("signup-dob").value;
            const gender = document.getElementById("signup-gender").value;
            const phone = document.getElementById("signup-phone").value.trim();

            if (!first || !dob || !phone || !gender) return showError("First Name, DOB, Gender, and Phone are required.");

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, e, p);
                const user = userCredential.user;
                
                // Update the Dashboard Name immediately
                const fullName = `${first} ${last}`.trim();
                await updateProfile(user, { displayName: fullName });

                // Save full personal details to Firestore
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    firstName: first,
                    middleName: middle,
                    lastName: last,
                    fullName: fullName,
                    dob: dob,
                    gender: gender,
                    phone: phone,
                    createdAt: new Date()
                });

                await sendEmailVerification(user);
                alert("Account created! A verification link has been sent to your email.");
                await signOut(auth);
                window.location.reload();
            } catch (err) {
                showError(err.message);
            }
        } else {
            try {
                await signInWithEmailAndPassword(auth, e, p);
            } catch (err) {
                showError("Invalid Email or Password.");
            }
        }
    };
}

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
        }).catch(err => showError(err.message));
    };
}
