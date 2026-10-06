import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs, 
    updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, 
    Timestamp, arrayUnion, arrayRemove, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const defaultConfig = { 
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw", 
    authDomain: "aksh-studio.firebaseapp.com", 
    projectId: "aksh-studio", 
    storageBucket: "aksh-studio.firebasestorage.app", 
    messagingSenderId: "349325785973", 
    appId: "1:349325785973:web:86d5a15bcb700bfc15b13c" 
};

const firebaseConfig = window.firebaseConfig || defaultConfig;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { 
    db, auth, provider, collection, doc, addDoc, setDoc, getDoc, getDocs, 
    updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, 
    Timestamp, arrayUnion, arrayRemove, writeBatch, GoogleAuthProvider 
};
