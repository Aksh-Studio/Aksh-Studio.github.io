// apps/help-us/leaderboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Fetch and display the top 10 users
async function loadLeaderboard() {
    const listContainer = document.getElementById('leaderboard-list');
    
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, orderBy("tokens", "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        
        listContainer.innerHTML = ""; // Clear loading text
        
        let rank = 1;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Skip users with 0 tokens
            if ((data.tokens || 0) === 0) return;

            const li = document.createElement('li');
            li.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid var(--border);";
            
            // Format top 3 colors
            let rankColor = "var(--text-muted)";
            if (rank === 1) rankColor = "#f59e0b"; // Gold
            if (rank === 2) rankColor = "#94a3b8"; // Silver
            if (rank === 3) rankColor = "#b45309"; // Bronze

            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 18px; font-weight: 700; color: ${rankColor}; width: 25px;">#${rank}</span>
                    <img src="${data.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" style="width: 40px; height: 40px; border-radius: 50%;">
                    <div>
                        <h4 style="font-size: 15px; font-weight: 600;">${data.displayName || 'Anonymous Supporter'}</h4>
                    </div>
                </div>
                <div style="font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 5px 12px; border-radius: 20px;">
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
        listContainer.innerHTML = '<li style="text-align: center; color: red; padding: 20px;">Failed to load leaderboard.</li>';
    }
}

// Ensure dark mode matches main app
if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme');

loadLeaderboard();
