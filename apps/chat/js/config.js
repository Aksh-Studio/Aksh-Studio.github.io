// js/config.js
let app, auth, db, googleProvider;

try {
    const rootAuth = await import('../../auth.js');
    app = rootAuth.app;
    auth = rootAuth.auth;
    db = rootAuth.db;
    googleProvider = rootAuth.googleProvider || null;
} catch (e) {
    console.warn("Could not import root auth.js. Attempting fallback to window.firebaseConfig.");
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getAuth, GoogleAuthProvider } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    
    if (window.firebaseConfig) {
        app = initializeApp(window.firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        googleProvider = new GoogleAuthProvider();
    } else {
        console.error("CRITICAL: Firebase configuration missing. Must define window.firebaseConfig or export from ../../auth.js.");
    }
}

export { app, auth, db, googleProvider };
