import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Aksh Studio Firebase Configuration
const firebaseConfig = window.firebaseConfig || {
    apiKey: "AIzaSyAkshStudioMockKey349281",
    authDomain: "aksh-studio-prod.firebaseapp.com",
    projectId: "aksh-studio-prod",
    storageBucket: "aksh-studio-prod.appspot.com",
    messagingSenderId: "987654321012",
    appId: "1:987654321012:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
