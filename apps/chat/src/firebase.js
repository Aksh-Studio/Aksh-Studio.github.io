import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, addDoc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const fallbackConfig = { 
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw", 
    authDomain: "aksh-studio.firebaseapp.com", 
    projectId: "aksh-studio", 
    storageBucket: "aksh-studio.firebasestorage.app", 
    messagingSenderId: "349325785973", 
    appId: "1:349325785973:web:86d5a15bcb700bfc15b13c" 
};

const firebaseConfig = (typeof window !== 'undefined' && window.firebaseConfig) ? window.firebaseConfig : fallbackConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { 
  auth, 
  db, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  updateDoc
};
