// src/firebase.js

// Import Firebase tools natively from Google's servers (No npm required)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your exact Aksh Studio configuration
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};

// Boot up the database
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Export the tools so app.js can use them
export { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp };
