import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. UNIVERSAL THEME SYNC ENGINE
// ==========================================
const themeBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    if (themeIcon) themeIcon.innerText = 'light_mode';
}

if (themeBtn) {
    themeBtn.onclick = () => {
        document.body.classList.toggle('dark-theme');
        if (document.body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark');
            if (themeIcon) themeIcon.innerText = 'light_mode';
        } else {
            localStorage.setItem('theme', 'light');
            if (themeIcon) themeIcon.innerText = 'dark_mode';
        }
    };
}

// ==========================================
// 2. FIREBASE INITIALIZATION & AUTH
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentRoom = "global_network"; // Default public room
let unsubscribeMessages = null;

onAuthStateChanged(auth, user => { 
    if(user){ 
        currentUser = user; 
        
        // Populate Profile Dropdown
        const nameEl = document.getElementById('chat-profile-name');
        const emailEl = document.getElementById('chat-profile-email');
        const avatarEl = document.getElementById('chat-header-avatar');
        
        const fallbackProfile = () => {
            if (nameEl) nameEl.innerHTML = `<strong>Name:</strong> ${user.displayName || 'User'}`;
            if (emailEl) emailEl.innerHTML = `<strong>Email:</strong> ${user.email || '-'}`;
            if (avatarEl && user.photoURL) avatarEl.src = user.photoURL;
        };

        try {
            const userRef = doc(db, `users/${user.uid}`);
            onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (nameEl) nameEl.innerHTML = `<strong>Name:</strong> ${data.name || user.displayName || 'User'}`;
                    if (emailEl) emailEl.innerHTML = `<strong>Email:</strong> ${data.email || user.email || '-'}`;
                    if (avatarEl && (data.photoURL || user.photoURL)) avatarEl.src = data.photoURL || user.photoURL;
                } else fallbackProfile();
            }, () => fallbackProfile());
        } catch (err) { fallbackProfile(); }

        // Load the chat room immediately
        loadChatRoom(currentRoom);

    } else {
        // Boot them out if they aren't logged in
        window.location.href = "../../index.html"; 
    }
});

// Safe Signout
setTimeout(() => {
    const signoutBtn = document.getElementById('chat-btn-signout');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => window.location.href = "../../index.html");
        });
    }
}, 500);

// ==========================================
// 3. MOBILE SLIDE ENGINE (Responsive UX)
// ==========================================
const appLayout = document.querySelector('.app-layout');
const btnMobileBack = document.getElementById('btn-mobile-back');
const globalRoomBtn = document.getElementById('global-room-btn');

// When user taps a contact/room on mobile, slide the chat window open
globalRoomBtn.addEventListener('click', () => {
    appLayout.classList.add('mobile-chat-active');
    loadChatRoom('global_network');
});

// When user taps the 'Back' arrow inside the chat on mobile, slide back to contacts
if (btnMobileBack) {
    btnMobileBack.addEventListener('click', () => {
        appLayout.classList.remove('mobile-chat-active');
    });
}

// ==========================================
// 4. REAL-TIME CHAT ENGINE
// ==========================================
const chatMessagesContainer = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const btnSendMessage = document.getElementById('btn-send-message');

function loadChatRoom(roomId) {
    currentRoom = roomId;
    chatMessagesContainer.innerHTML = ''; // Clear current screen
    
    // Stop listening to old room if we switch
    if (unsubscribeMessages) unsubscribeMessages();

    // Query messages ordered by time
    const q = query(collection(db, `chats/${roomId}/messages`), orderBy("timestamp", "asc"));
    
    // Real-time listener: Triggers instantly when anyone sends a message
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        chatMessagesContainer.innerHTML = ''; // Clear for fresh render
        
        if (snapshot.empty) {
            chatMessagesContainer.innerHTML = `
                <div class="empty-chat-state" id="empty-state">
                    <span class="material-symbols-rounded empty-icon">forum</span>
                    <h3>Welcome to the Global Network</h3>
                    <p>Be the first to say hello!</p>
                </div>
            `;
            return;
        }

        snapshot.forEach((doc) => {
            const msg = doc.data();
            renderMessage(msg);
        });
        
        scrollToBottom();
    });
}

function renderMessage(msg) {
    // Check if the message is from the logged-in user or someone else
    const isSentByMe = msg.uid === currentUser.uid;
    const msgClass = isSentByMe ? 'sent' : 'received';
    
    // Format the time securely
    let timeString = "";
    if (msg.timestamp) {
        const date = msg.timestamp.toDate();
        timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        timeString = "Just now";
    }

    const messageHTML = `
        <div class="message ${msgClass}">
            ${!isSentByMe ? `<div class="msg-sender">${msg.displayName || "Anonymous"}</div>` : ""}
            <div class="bubble">${msg.text}</div>
            <div class="msg-time">${timeString}</div>
        </div>
    `;
    
    chatMessagesContainer.insertAdjacentHTML('beforeend', messageHTML);
}

// Auto-scroll to the newest message
function scrollToBottom() {
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// ==========================================
// 5. SENDING MESSAGES
// ==========================================
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentUser) return;
    
    // Immediately clear input for snappy UX
    messageInput.value = '';
    
    try {
        await addDoc(collection(db, `chats/${currentRoom}/messages`), {
            text: text,
            uid: currentUser.uid,
            displayName: currentUser.displayName || "Anonymous User",
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Failed to send message. Please check your connection.");
    }
}

// Send on Button Click
btnSendMessage.addEventListener('click', sendMessage);

// Send on "Enter" Key Press
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});
