// ============================================================================
// Aksh Calendar - Authentication & Session Module (modules/auth.js)
// ============================================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { cleanupCalendarListeners } from "./db.js";

let app;
if (getApps().length > 0) {
  app = getApp();
} else if (window.firebaseConfig) {
  app = initializeApp(window.firebaseConfig);
}

export const auth = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
const authCallbacks = new Set();

/**
 * Subscribe to authentication state changes in Aksh Calendar
 */
export function initCalendarAuth(onUserChanged) {
  if (typeof onUserChanged === "function") {
    authCallbacks.add(onUserChanged);
  }

  if (!auth) {
    console.warn("[Calendar Auth] Firebase Auth not initialized; running in local mode.");
    if (onUserChanged) onUserChanged(null);
    return () => {};
  }

  return onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
    if (!user) {
      // Detach Firestore listeners immediately when user is signed out
      cleanupCalendarListeners();
    }
    authCallbacks.forEach((cb) => {
      try {
        cb(currentUser);
      } catch (e) {
        console.error("[Calendar Auth] Callback error:", e);
      }
    });
  });
}

/**
 * Trigger Google Sign-In Popup
 */
export async function loginToCalendar() {
  if (!auth) {
    window.location.href = "../../index.html";
    return null;
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("[Calendar Auth] Sign-in error:", error.message);
    throw error;
  }
}

/**
 * Safely detach Firestore snapshot listeners BEFORE signing out
 */
export async function logoutFromCalendar(redirectUrl = "../../index.html") {
  try {
    // 1. Stop all Firestore snapshot listeners first so base.js:1 never throws permission-denied
    cleanupCalendarListeners();

    // 2. Sign out of Firebase Auth
    if (auth) {
      await signOut(auth);
    }

    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  } catch (error) {
    console.error("[Calendar Auth] Logout error:", error.message);
  }
}

export function getCurrentCalendarUser() {
  return currentUser || (auth ? auth.currentUser : null);
}
