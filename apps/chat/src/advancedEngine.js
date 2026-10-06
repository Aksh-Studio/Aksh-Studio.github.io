import { db, auth, doc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, getDocs, query, orderBy, limit } from './firebase.js';
import { currentRoomId } from './chatEngine.js';

export function setupDropdowns() {
    const profileBtn = document.getElementById('profile-btn');
    const actionBtn = document.getElementById('chat-action-btn');
    
    if (profileBtn) {
        profileBtn.onclick = () => {
            document.getElementById('profile-dropdown')?.classList.toggle('show');
        };
    }
    
    if (actionBtn) {
        actionBtn.onclick = () => {
            document.getElementById('chat-action-dropdown')?.classList.toggle('show');
        };
    }
    
    window.onclick = (e) => {
        if (!e.target.matches('.dropbtn')) {
            document.querySelectorAll('.dropdown-content.show').forEach(el => el.classList.remove('show'));
        }
    };
}

export async function saveCustomization(wallpaperUrl, nickname) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        const updates = {};
        if (wallpaperUrl) updates.wallpaper = wallpaperUrl;
        if (nickname) updates.nickname = nickname;
        await updateDoc(doc(db, 'users', uid), updates);
        console.log("Customizations saved");
    } catch (error) {
        console.error("Error saving customization", error);
    }
}

export async function blockUser(targetUid) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        await updateDoc(doc(db, 'users', uid), { blockedUsers: arrayUnion(targetUid) });
        console.log(`Blocked user ${targetUid}`);
    } catch (error) {
        console.error("Error blocking user", error);
    }
}

export async function unblockUser(targetUid) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        await updateDoc(doc(db, 'users', uid), { blockedUsers: arrayRemove(targetUid) });
        console.log(`Unblocked user ${targetUid}`);
    } catch (error) {
        console.error("Error unblocking user", error);
    }
}

export async function exportChat(roomId) {
    if (!roomId) return;
    try {
        const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);
        
        let textContent = `Chat Export - Room ${roomId}\n\n`;
        snap.forEach(doc => {
            const data = doc.data();
            const time = new Date(data.timestamp).toLocaleString();
            textContent += `[${time}] ${data.senderId}: ${data.text}\n`;
        });
        
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_export_${roomId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error exporting chat", error);
    }
}

export async function reportUser(targetUid, roomId) {
    const uid = auth.currentUser?.uid;
    if (!uid || !roomId) return;
    
    try {
        const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('timestamp', 'desc'), limit(10));
        const snap = await getDocs(q);
        const evidence = [];
        snap.forEach(doc => evidence.push({ id: doc.id, ...doc.data() }));
        
        await addDoc(collection(db, 'help_complaints'), {
            reporterId: uid,
            reportedId: targetUid,
            roomId,
            evidence,
            timestamp: Date.now(),
            status: 'open'
        });
        console.log("User reported successfully");
        alert("Report submitted.");
    } catch (error) {
        console.error("Error reporting user", error);
    }
}
