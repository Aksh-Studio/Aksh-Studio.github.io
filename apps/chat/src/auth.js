import { auth, db, doc, setDoc, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "./firebase.js";

export let currentUser = {
  uid: null,
  email: null,
  name: null,
  photoURL: null,
  isOwner: false,
  isGuest: true
};

export function initAuth(onStateChangeCallback) {
  onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('guest-overlay');
    const ownerBtn = document.getElementById('ownerPanelBtn');

    if (user) {
      const isOwner = (user.email === 'akshat124.am12@gmail.com');
      currentUser = {
        uid: user.uid,
        email: user.email,
        name: user.displayName || 'User',
        photoURL: user.photoURL || '',
        isOwner: isOwner,
        isGuest: false
      };

      try {
        await setDoc(doc(db, "users", user.uid), {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.name,
          photoURL: currentUser.photoURL,
          lastLogin: Date.now()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to sync user profile", err);
      }

      if (overlay) overlay.style.display = 'none';
      if (ownerBtn) ownerBtn.style.display = isOwner ? 'flex' : 'none';
      
      onStateChangeCallback(currentUser);
    } else {
      currentUser = {
        uid: null,
        email: null,
        name: null,
        photoURL: null,
        isOwner: false,
        isGuest: true
      };
      
      if (overlay) overlay.style.display = 'flex';
      if (ownerBtn) ownerBtn.style.display = 'none';
      
      onStateChangeCallback(null);
    }
  });
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed", error);
  }
}

export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
  }
}
