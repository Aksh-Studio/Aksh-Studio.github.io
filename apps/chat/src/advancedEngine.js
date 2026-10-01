import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, getDocs, arrayUnion, arrayRemove, writeBatch } from "./firebase.js";
import { decryptMessage } from "./siteCipher.js";

const ownerEmail = 'akshat124.am12@gmail.com';

// ==========================================
// 1. GLOBAL LAYOUT & SETTINGS LOGIC
// ==========================================
export function initGlobalSettings(currentUser) {
    // 1. Profile Dropdown Click Toggle
    const profilePic = document.getElementById('nav-profile-pic');
    const profileDropdown = document.getElementById('profile-dropdown-menu');
    
    if (profilePic && !window.profileMenuAttached) {
        profilePic.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
        });
        window.profileMenuAttached = true;
    }

    // 2. Settings Slide Panel Logic
    const settingsToggle = document.getElementById('btn-settings-slide');
    const settingsBack = document.getElementById('btn-settings-back');
    const chatsPanel = document.getElementById('chats-sidebar-panel');
    const settingsPanel = document.getElementById('settings-sidebar-panel');

    if (settingsToggle) {
        settingsToggle.onclick = () => {
            chatsPanel.style.display = 'none';
            settingsPanel.style.display = 'flex';
        };
    }
    if (settingsBack) {
        settingsBack.onclick = () => {
            settingsPanel.style.display = 'none';
            chatsPanel.style.display = 'flex';
        };
    }

    // 3. Global Click Listener to close dropdowns
    window.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.style.display = 'none';
        const chatMenu = document.getElementById('chat-options-menu');
        if (chatMenu) chatMenu.style.display = 'none';
    });

    // 4. Customisation Modal
    const customModal = document.getElementById('customModal');
    document.getElementById('btn-open-customisation').onclick = async () => {
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
        
        if(newWall) {
            document.querySelector('.chat-main').style.backgroundImage = `url(${newWall})`;
            document.querySelector('.chat-main').style.backgroundSize = "cover";
        } else {
            document.querySelector('.chat-main').style.backgroundImage = "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')";
        }
        customModal.style.display = 'none';
        alert("Customisation saved!");
    };
    document.getElementById('btn-close-custom').onclick = () => customModal.style.display = 'none';

    // 5. Unblock Users Modal
    const unblockModal = document.getElementById('unblockModal');
    document.getElementById('btn-open-unblock').onclick = async () => {
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
    document.getElementById('btn-close-unblock').onclick = () => unblockModal.style.display = 'none';
}

// ==========================================
// 2. ACTIVE CHAT LOGIC (3-Dot Menu)
// ==========================================
export function initChatOptions(currentUser, activeChatId, activeChatData) {
    if (!activeChatId || !activeChatData) return;

    const optionsBtn = document.getElementById('btn-chat-options');
    const optionsMenu = document.getElementById('chat-options-menu');
    const isGroup = activeChatData.type === 'group';
    
    let targetUid = null;
    let targetName = 'Unknown User';
    let isTargetOwner = false;
    
    if (!isGroup) {
        targetUid = activeChatData.participants.find(id => id !== currentUser.uid);
        const targetData = activeChatData.participantsData?.find(p => p.uid === targetUid);
        if (targetData) {
            targetName = targetData.name;
            if (targetData.email === ownerEmail) isTargetOwner = true;
        }
    }

    // Configure 3-Dot Visibility
    optionsBtn.style.display = isGroup ? 'none' : 'block';
    
    // Hide Report/Block if target is Owner
    const hideHarshOptions = isGroup || isTargetOwner || activeChatId === 'global_channel';
    document.getElementById('btn-opt-report').style.display = hideHarshOptions ? 'none' : 'block';
    document.getElementById('btn-opt-block').style.display = hideHarshOptions ? 'none' : 'block';

    optionsBtn.onclick = (e) => {
        e.stopPropagation();
        optionsMenu.style.display = optionsMenu.style.display === 'block' ? 'none' : 'block';
    };

    // --- EXPORT CHAT ---
    document.getElementById('btn-opt-export').onclick = async () => {
        try {
            const q = query(collection(db, `chats/${activeChatId}/messages`), orderBy("timestamp", "asc"));
            const snapshot = await getDocs(q);
            let logOutput = `=== WhatsApp Chat Export Logs [Room: ${activeChatData.name}] ===\n\n`;
            snapshot.forEach(docObj => {
                const m = docObj.data();
                const stamp = new Date(m.localTimestamp || m.timestamp || Date.now()).toLocaleString();
                const decText = m.text ? decryptMessage(m.text) : "";
                logOutput += `[${stamp}] ${m.senderName || 'User'}: ${decText}\n`;
            });
            const fileBlob = new Blob([logOutput], { type: 'text/plain' });
            const fileUrl = URL.createObjectURL(fileBlob);
            const anchor = document.createElement('a');
            anchor.href = fileUrl;
            anchor.download = `Aksh-Chat_Chat_${activeChatData.name.replace(/\s+/g, '_')}.txt`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(fileUrl);
            optionsMenu.style.display = 'none';
        } catch(err) { alert("Export operational processing failure."); }
    };

    // --- REPORT USER ---
    document.getElementById('btn-opt-report').onclick = async () => {
        if (!confirm(`Are you sure you want to report ${targetName} to the Owner?`)) return;
        
        try {
            const q = query(collection(db, `chats/${activeChatId}/messages`), orderBy("timestamp", "desc"), limit(10));
            const snap = await getDocs(q);
            let historyStr = "";
            
            snap.forEach(d => {
                const msg = d.data();
                const time = new Date(msg.timestamp).toLocaleString();
                const sender = msg.senderId === currentUser.uid ? currentUser.name : targetName;
                const decText = msg.text ? decryptMessage(msg.text) : "";
                historyStr = `[${time}] ${sender}: ${decText}\n` + historyStr; 
            });

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
            optionsMenu.style.display = 'none';
        } catch (err) { alert("Failed to send report."); }
    };

    // --- BLOCK USER ---
    document.getElementById('btn-opt-block').onclick = async () => {
        if (!confirm(`Block ${targetName}? They will not be able to message you.`)) return;
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
    };

    // --- DELETE CHAT ---
    const delModal = document.getElementById('deleteChatModal');
    document.getElementById('btn-opt-delete').onclick = () => {
        delModal.style.display = 'flex';
        optionsMenu.style.display = 'none';
    };
    document.getElementById('btn-close-del-chat').onclick = () => delModal.style.display = 'none';

    document.getElementById('btn-del-chat-me').onclick = async () => {
        await updateDoc(doc(db, "chats", activeChatId), {
            participants: arrayRemove(currentUser.uid)
        });
        window.location.reload();
    };

    document.getElementById('btn-del-chat-both').onclick = async () => {
        if (!confirm("This will permanently delete the chat and all messages for everyone. Continue?")) return;
        document.getElementById('btn-del-chat-both').textContent = "Deleting...";
        
        try {
            const snap = await getDocs(collection(db, `chats/${activeChatId}/messages`));
            const batch = writeBatch(db);
            snap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            await deleteDoc(doc(db, "chats", activeChatId));
            window.location.reload();
        } catch(e) { alert("Failed. Check permissions."); }
    };
}

// ==========================================
// 3. GROUP REMOVAL FIX
// ==========================================
window.removeGroupMember = async (uidToRemove) => {
    const activeChatId = window.appState?.activeChatId;
    const activeChatData = window.currentRoomData;
    const curId = window.currentUserAuth?.uid || window.currentUserAuth?.id;
    const isOwner = window.currentUserAuth?.email === ownerEmail;
    
    if(!activeChatId || !activeChatData) return;

    const isAdmin = activeChatData.admins?.includes(curId);

    if (!isAdmin && !isOwner) {
        alert("Only group admins or the Owner can remove members.");
        return;
    }
    
    if (confirm("Remove user from group?")) {
        await updateDoc(doc(db, "chats", activeChatId), {
            participants: arrayRemove(uidToRemove),
            admins: arrayRemove(uidToRemove)
        });
        alert("User removed successfully.");
    }
};
