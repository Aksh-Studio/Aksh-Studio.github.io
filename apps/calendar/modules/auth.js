import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// 1. Core Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};

// 2. Initialize App and Auth Services
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 3. Export Global User Reference
export let currentUser = null;

/**
 * Initializes the authentication listener. 
 * Kicks users back to the dashboard if they are not logged in.
 * @param {Function} onReadyCallback - Runs when the user is successfully verified
 */
export function initAuth(onReadyCallback) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if (onReadyCallback) onReadyCallback(user);
        } else {
            // Protect the route
            window.location.href = "../../index.html";
        }
    });
}
