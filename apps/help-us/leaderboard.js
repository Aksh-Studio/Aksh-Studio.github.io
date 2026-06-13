// apps/help-us/leaderboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');

async function loadLeaderboard() {
    const listContainer = document.getElementById('leaderboard-list');
    
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("tokens", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        listContainer.innerHTML = ""; 
        
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if ((data.tokens || 0) === 0) return;

            const li = document.createElement('li');
            li.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 15px 10px; border-bottom: 1px solid var(--border); gap: 15px;";
            
            let rankColor = "var(--text-muted)";
            if (rank === 1) rankColor = "#f59e0b"; 
            if (rank === 2) rankColor = "#94a3b8"; 
            if (rank === 3) rankColor = "#b45309"; 

            // Safely resolve user display text to clear structural overlap bugs
            const cleanName = data.displayName && data.displayName.trim() ? data.displayName : "Anonymous Supporter";

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0;">
                    <span style="font-size: 16px; font-weight: 700; color: ${rankColor}; width: 25px; flex-shrink: 0;">#${rank}</span>
                    <img src="${data.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid var(--border);">
                    <div style="flex: 1; min-width: 0;">
                        <h4 style="font-size: 14px; font-weight: 600; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main);">${cleanName}</h4>
                    </div>
                </div>
                <div style="font-weight: 700; font-size: 13px; color: var(--primary); background: var(--blue-light); padding: 6px 14px; border-radius: 20px; flex-shrink: 0; text-align: right;">
                    ${data.tokens} Tokens
                </div>
            `;
            listContainer.appendChild(li);
            rank++;
        });

        if (listContainer.innerHTML === "") {
            listContainer.innerHTML = '<li style="text-align: center; color: var(--text-muted); padding: 20px;">No tokens earned yet. Be the first!</li>';
        }

    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        listContainer.innerHTML = '<li style="text-align: center; color: #ef4444; padding: 20px;">Failed to load data.</li>';
    }
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadLeaderboard();
    } else {
        window.location.href = "../../index.html";
    }
});
