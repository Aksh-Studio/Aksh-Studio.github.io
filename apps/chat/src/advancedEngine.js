import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, getDocs, arrayUnion, arrayRemove, writeBatch } from "../firebase.js";

export function initAdvancedEngine(currentUser, activeChatId, activeChatData) {
    const ownerEmail = 'akshat124.am12@gmail.com';
    const isOwner = currentUser && String(currentUser.email).toLowerCase().trim() === ownerEmail;

    // --- 1. PROFILE MENU CLICK TOGGLE (Fixes disappearing issue) ---
    const profilePic = document.getElementById('nav-profile-pic');
    const profileDropdown = document.getElementById('profile-dropdown-menu');
    
    // Only attach once
    if (!window.profileMenuAttached) {
        profilePic.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
        });
        window.addEventListener('click', () => {
            if(profileDropdown) profileDropdown.style.display = 'none';
        });
        window.profileMenuAttached = true;
    }

    // --- 2. CUSTOMISATION & UNBLOCK MODALS ---
    const customModal = document.getElementById('customModal');
    const unblockModal = document.getElementById('unblockModal');

    document.getElementById('btn-customisation').onclick = async () => {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const data = userDoc.data() || {};
        document.getElementById('custom-nickname').value = data.nickname || currentUser.name;
        document.getElementById('custom-wallpaper').value = data.wallpaper || '';
        customModal.style.display = 'flex';
    };

    document.getElementById('btn-save-custom').onclick = async () => {
        const newNick = document.getElementById('custom-nickname').value.trim();
        const newWall = document.getElementById('custom-wallpaper').value.trim();
        
        await updateDoc(doc(db, "users", currentUser.uid), {
            nickname: newNick,
            wallpaper: newWall
        });
        
        if(newWall) document.querySelector('.chat-main').style.backgroundImage = `url(${newWall})`;
        customModal.style.display = 'none';
    };

    document.getElementById('btn-unblock-users').onclick = async () => {
        const listDiv = document.getElementById('blocked-users-list');
        listDiv.innerHTML = '<p style="color:var(--text-muted);">Loading...</p>';
        unblockModal.style.display = 'flex';

        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const blocked = userDoc.data()?.blockedUsers || [];

        if (blocked.length === 0) {
            listDiv.innerHTML = '<p style="color:var(--text-muted);">No blocked users.</p>';
            return;
        }

        listDiv.innerHTML = '';
        for (const uid of blocked) {
            const uDoc = await getDoc(doc(db, "users", uid));
            const uName = uDoc.exists() ? uDoc.data().name : 'Unknown User';
            
            const item = document.createElement('div');
            item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);";
            item.innerHTML = `
                <span style="color:var(--text-main); font-weight:500;">${uName}</span>
                <button class="unblock-btn" style="padding:6px 12px; background:var(--primary); color:white; border:none; border-radius:6px; cursor:pointer;">Unblock</button>
            `;
            item.querySelector('.unblock-btn').onclick = async () => {
                await updateDoc(doc(db, "users", currentUser.uid), { blockedUsers: arrayRemove(uid) });
                item.remove();
                if(listDiv.children.length === 0) listDiv.innerHTML = '<p style="color:var(--text-muted);">No blocked users.</p>';
            };
            listDiv.appendChild(item);
        }
    };

    document.getElementById('btn-close-custom').onclick = () => customModal.style.display = 'none';
    document.getElementById('btn-close-unblock').onclick = () => unblockModal.style.display = 'none';


    // --- 3. THREE-DOT MENU LOGIC ---
    if (!activeChatId || !activeChatData) return; // Only run if a chat is open

    const optionsBtn = document.getElementById('btn-chat-options');
    const optionsMenu = document.getElementById('chat-options-menu');
    const isGroup = activeChatData.type === 'group';
    
    // Check if the other person in a DM is the Owner
    let targetUid = null;
    let isTargetOwner = false;
    
    if (!isGroup) {
        targetUid = activeChatData.participants.find(id => id !== currentUser.uid);
        const targetData = activeChatData.participantsData?.find(p => p.uid === targetUid);
        if (targetData && targetData.email === ownerEmail) {
            isTargetOwner = true;
        }
    }

    // Configure 3-Dot Menu Visibility
    optionsBtn.style.display = 'block';
    
    // Hide Report/Block for Groups, System Chats, and if target is Owner
    const hideHarshOptions = isGroup || isTargetOwner || activeChatId === 'global_channel';
    document.getElementById('btn-opt-report').style.display = hideHarshOptions ? 'none' : 'block';
    document.getElementById('btn-opt-block').style.display = hideHarshOptions ? 'none' : 'block';

    optionsBtn.onclick = (e) => {
        e.stopPropagation();
        optionsMenu.style.display = optionsMenu.style.display === 'block' ? 'none' : 'block';
    };
    window.addEventListener('click', () => { if(optionsMenu) optionsMenu.style.display = 'none'; });

    // --- REPORT USER ---
    document.getElementById('btn-opt-report').onclick = async () => {
        if (!confirm("Are you sure you want to report this user to the Owner?")) return;
        
        try {
            // Fetch last 10 messages for evidence
            const q = query(collection(db, `chats/${activeChatId}/messages`), orderBy("timestamp", "desc"), limit(10));
            const snap = await getDocs(q);
            let historyStr = "";
            
            snap.forEach(d => {
                const msg = d.data();
                const time = new Date(msg.timestamp).toLocaleString();
                const sender = msg.senderId === currentUser.uid ? 'Reporter' : 'Reported User';
                historyStr = `[${time}] ${sender}: ${msg.text}\n` + historyStr; // Reverse to chronological
            });

            const targetName = activeChatData.participantsData?.find(p => p.uid === targetUid)?.name || 'Unknown User';
            const ticketId = `report_${Date.now()}`;
            
            await setDoc(doc(db, "help_complaints", ticketId), {
                name: currentUser.name,
                email: currentUser.email,
                subject: `🚨 REPORT: ${currentUser.name} reported ${targetName}`,
                details: `Target UID: ${targetUid}\n\n--- LAST 10 MESSAGES (EVIDENCE) ---\n${historyStr || 'No messages found.'}`,
                date: Date.now(),
                status: 'Unresolved'
            });

            alert("Report sent securely to the Owner's Dashboard.");
        } catch (err) {
            console.error(err);
            alert("Failed to send report.");
        }
    };

    // --- BLOCK USER ---
    document.getElementById('btn-opt-block').onclick = async () => {
        if (!confirm("Block this user? They will not be able to message you.")) return;
        await updateDoc(doc(db, "users", currentUser.uid), {
            blockedUsers: arrayUnion(targetUid)
        });
        alert("User blocked.");
        window.location.reload();
    };

    // --- CLEAR CHAT ---
    document.getElementById('btn-opt-clear').onclick = async () => {
        if (!confirm("Clear chat history for you? (The chat will remain in your list)")) return;
        await updateDoc(doc(db, "chats", activeChatId), {
            [`clearedAt_${currentUser.uid}`]: Date.now()
        });
        alert("Chat cleared.");
        window.location.reload(); 
        // NOTE: In your message fetching logic (onSnapshot), you must now filter out messages where msg.timestamp < chatData[`clearedAt_${currentUser.uid}`]
    };

    // --- DELETE CHAT ---
    const delModal = document.getElementById('deleteChatModal');
    document.getElementById('btn-opt-delete').onclick = () => delModal.style.display = 'flex';
    document.getElementById('btn-close-del-chat').onclick = () => delModal.style.display = 'none';

    document.getElementById('btn-del-chat-me').onclick = async () => {
        await updateDoc(doc(db, "chats", activeChatId), {
            participants: arrayRemove(currentUser.uid)
        });
        window.location.reload();
    };

    document.getElementById('btn-del-chat-both').onclick = async () => {
        if (!confirm("Delete entire chat and all messages for everyone?")) return;
        document.getElementById('btn-del-chat-both').textContent = "Deleting...";
        
        // Delete subcollection messages first
        const snap = await getDocs(collection(db, `chats/${activeChatId}/messages`));
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
        
        // Delete main document
        await deleteDoc(doc(db, "chats", activeChatId));
        window.location.reload();
    };

    // --- FIX GROUP REMOVE USER ---
    // Expose this to the global window so your group UI buttons can call it
    window.removeGroupMember = async (uidToRemove) => {
        const isAdmin = activeChatData.admins?.includes(currentUser.uid);
        if (!isAdmin && !isOwner) {
            alert("Only group admins or the Owner can remove members.");
            return;
        }
        if (confirm("Remove user from group?")) {
            await updateDoc(doc(db, "chats", activeChatId), {
                participants: arrayRemove(uidToRemove),
                admins: arrayRemove(uidToRemove) // Also remove from admins just in case
            });
            alert("User removed successfully.");
        }
    };
}
