// src/services/firestore.js
import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    onSnapshot, 
    limit 
} from "firebase/firestore";

// Aksh Studio Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};

// Initialize Firebase App & Firestore Database
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

/**
 * Retrieves the current session user data passed from the Aksh Logging Page.
 * Falls back to a clean local profile if running in standalone test mode.
 */
export const getSessionUser = () => {
    return {
        uid: localStorage.getItem('aksh_uid') || "guest_dev_user",
        displayName: localStorage.getItem('aksh_display_name') || "Aksh User",
        photoURL: localStorage.getItem('aksh_photo_url') || "",
        username: localStorage.getItem('aksh_username') || "aksh_guest"
    };
};

/**
 * Sends a real-time message to a specific room, group, or channel.
 * @param {string} roomId - The target document ID of the chat stream.
 * @param {string} text - The text content of the message.
 * @param {object} attachments - Optional structured data for images, audio waveforms, or docs.
 */
export const sendMessageStream = async (roomId, text, attachments = null) => {
    const user = getSessionUser();
    try {
        await addDoc(collection(db, `chats/${roomId}/messages`), {
            text: text,
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
            timestamp: serverTimestamp(),
            attachments: attachments,
            reactions: {}
        });
        return { success: true };
    } catch (error) {
        console.error("Error writing message stream to Firestore:", error);
        return { success: false, error };
    }
};

/**
 * Listens to updates in a message stream in real-time.
 * @param {string} roomId - Target chat room or conversation identifier.
 * @param {function} callback - Renders data instantly upon state transitions.
 */
export const subscribeToMessages = (roomId, callback) => {
    const q = query(
        collection(db, `chats/${roomId}/messages`), 
        orderBy("timestamp", "asc"),
        limit(100)
    );
    
    return onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        callback(messages);
    }, (error) => {
        console.error("Real-time stream subscription error:", error);
    });
};
