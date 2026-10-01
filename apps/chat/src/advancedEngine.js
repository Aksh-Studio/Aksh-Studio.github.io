import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, getDocs, arrayUnion, arrayRemove, writeBatch } from "./firebase.js";
import { decryptMessage } from "./siteCipher.js";

const ownerEmail = 'akshat124.am12@gmail.com';

// ==========================================
// 1. GLOBAL LAYOUT & SETTINGS LOGIC
// ==========================================
export function initGlobalSettings(currentUser) {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    const profilePic = document.getElementById('nav-profile-pic');
    const profileDropdown = document.getElementById('profile-dropdown-menu');
    const settingsToggle = document.getElementById('btn-settings-toggle');
    const settingsDropdown = document.getElementById('settings-dropdown-menu');

    if (profilePic && !window.profileMenuAttached) {
        profilePic.addEventListener('click', (e) => {
            e.stopPropagation();
            if (settingsDropdown) settingsDropdown.style.display = 'none';
            if (profileDropdown) profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
        });
        window.profileMenuAttached = true;
    }

    if (settingsToggle && !window.settingsMenuAttached) {
        settingsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (profileDropdown) profileDropdown.style.display = 'none';
            if (settingsDropdown) settingsDropdown.style.display = settingsDropdown.style.display === 'block' ? 'none' : 'block';
        });
        window.settingsMenuAttached = true;
    }

    window.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.style.display = 'none';
        if (settingsDropdown) settingsDropdown.style.display = 'none';
        const chatMenu = document.getElementById('chat-options-menu');
        if (chatMenu) chatMenu.style.display = 'none';
    });

    const customModal = document.getElementById('customModal');
    const btnOpenCustom = document.getElementById('btn-open-customisation');
    if (btnOpenCustom) {
        btnOpenCustom.onclick = async () => {
            if (settingsDropdown) settingsDropdown.style.display = 'none';
            const userDoc = await getDoc(doc(db, "users", curId));
            const data = userDoc.data() || {};
            const nickInput = document.getElementById('custom-nickname');
            const wallInput = document.getElementById('custom-wallpaper');
            
            if (nickInput) nickInput.value = data.nickname || currentUser.name || '';
            if (wallInput) wallInput.value = data.wallpaper || '';
            if (customModal) customModal.style.display = 'flex';
        };
    }

    const btnSaveCustom = document.getElementById('btn-save-custom');
    if (btnSaveCustom) {
        btnSaveCustom.onclick = async () => {
            const newNick = document.getElementById('custom-nickname')?.value.trim() || '';
            const newWall = document.getElementById('custom-wallpaper')?.value.trim() || '';
            
            await updateDoc(doc(db, "users", curId), {
                nickname: newNick,
                wallpaper: newWall
            });
            
            const chatMain = document.querySelector('.chat-main');
            if (newWall && chatMain) {
                chatMain.style.backgroundImage = `url(${newWall})`;
                chatMain.style.backgroundSize = "cover";
            } else if (chatMain) {
                chatMain.style.backgroundImage = "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')";
            }
            if (customModal) customModal.style.display = 'none';
            alert("Customisation saved!");
        };
    }
    
    const btnCloseCustom = document.getElementById('btn-close-custom');
    if (btnCloseCustom) btnCloseCustom.onclick = () => { if (customModal) customModal.style.display = 'none'; };

    const unblockModal = document.getElementById('unblockModal');
    const btnOpenUnblock = document.getElementById('btn-open-unblock');
    
    if (btnOpenUnblock) {
        btnOpenUnblock.onclick = async () => {
            if (settingsDropdown) settingsDropdown.style.display = 'none';
            const listDiv = document.getElementById('blocked-users-list');
            if (!listDiv) return;
            
            listDiv.innerHTML = '<p style="color:var(--text-muted); padding:10px;">Loading...</p>';
            if (unblockModal) unblockModal.style.display = 'flex';

            const userDoc = await getDoc(doc(db, "users", curId));
            const blocked = userDoc.data()?.blockedUsers || [];

            if (blocked.length === 0) {
                listDiv.innerHTML = '<p style="color:var(--text-muted); padding:10px;">No blocked users.</p>';
                return;
            }

            listDiv.innerHTML = '';
            for (const uid of blocked) {
                const uDoc = await getDoc(doc(db, "users", uid));
                const uName = uDoc.exists() ? (uDoc.data().fullName || uDoc.data().name || 'User') : 'Unknown User';
                
                const item = document.createElement('div');
                item.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);";
                item.innerHTML = `
                    <span style="color:var(--text-main); font-weight:500;">${uName}</span>
                    <button class="unblock-btn" style="padding:6px 12px; background:var(--primary); color:white; border:none; border-radius:6px; cursor:pointer;">Unblock</button>
                `;
                item.querySelector('.unblock-btn').onclick = async () => {
                    await updateDoc(doc(db, "users", curId), { blockedUsers: arrayRemove(uid) });
                    item.remove();
                    if (listDiv.children.length === 0) listDiv.innerHTML = '<p style="color:var(--text-muted); padding:10px;">No blocked users.</p>';
                };
                listDiv.appendChild(item);
            }
        };
    }
    
    const btnCloseUnblock = document.getElementById('btn-close-unblock');
    if (btnCloseUnblock) btnCloseUnblock.onclick = () => { if (unblockModal) unblockModal.style.display = 'none'; };
}


// ==========================================
// 2. ACTIVE CHAT LOGIC (3-Dot Menu)
// ==========================================
export function initChatOptions(currentUser, activeChatId, activeChatData) {
    const curId = currentUser?.id || currentUser?.uid;
    if (!activeChatId || !activeChatData || !curId) return;

    const optionsBtn = document.getElementById('btn-chat-options');
    const optionsMenu = document.getElementById('chat-options-menu');
    const isGroup = activeChatData.type === 'group' || activeChatId === 'global_channel' || activeChatId === 'aksh_help';
    const isCurrentOwner = currentUser?.isOwner || String(currentUser.email).toLowerCase().trim() === ownerEmail;
    
    let targetUid = null;
    let targetName = 'Unknown User';
    let isTargetOwner = window.isTargetOwner || false; 
    
    if (!isGroup) {
        const safeParticipants = Array.isArray(activeChatData.participants) ? activeChatData.participants : [];
        targetUid = safeParticipants.find(id => id !== curId);
        
        if (targetUid && activeChatData.names && activeChatData.names[targetUid]) {
            targetName = activeChatData.names[targetUid];
        }
    }

    if (optionsBtn) {
        optionsBtn.style.display = 'block';
        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            if (optionsMenu) {
                optionsMenu.style.display = optionsMenu.style.display === 'block' ? 'none' : 'block';
            }
        };
    }
    
    const hideHarshOptions = isGroup || isTargetOwner || isCurrentOwner;
    const reportBtn = document.getElementById('btn-opt-report');
    const blockBtn = document.getElementById('btn-opt-block');
    const leaveGroupBtn = document.getElementById('btn-opt-leave');
    
    if (reportBtn) reportBtn.style.display = hideHarshOptions ? 'none' : 'block';
    if (blockBtn) blockBtn.style.display = hideHarshOptions ? 'none' : 'block';
    
    // Show Leave Group only if it is a Custom Group
    if (leaveGroupBtn) {
        leaveGroupBtn.style.display = (isGroup && activeChatId !== 'global_channel' && activeChatId !== 'aksh_help') ? 'block' : 'none';
        leaveGroupBtn.onclick = async () => {
            if (!confirm("Are you sure you want to leave this group?")) return;
            try {
                await updateDoc(doc(db, "chats", activeChatId), {
                    participants: arrayRemove(curId),
                    admins: arrayRemove(curId)
                });
                window.location.reload();
            } catch(e) { alert("Failed to leave group."); }
        };
    }

    // 1. Export Chat
    const exportBtn = document.getElementById('btn-opt-export');
    if (exportBtn) {
        exportBtn.onclick = async () => {
            try {
                const q = query(collection(db, `chats/${activeChatId}/messages`), orderBy("timestamp", "asc"));
                const snapshot = await getDocs(q);
                let logOutput = `=== Chat Export Logs [Room: ${activeChatData.name || 'Chat'}] ===\n\n`;
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
                anchor.download = `Aksh-Chat_${String(activeChatData.name || 'Chat').replace(/\s+/g, '_')}.txt`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(fileUrl);
                if (optionsMenu) optionsMenu.style.display = 'none';
            } catch (err) {
                alert("Export processing failed.");
            }
        };
    }

    // 2. Report User
    if (reportBtn) {
        reportBtn.onclick = async () => {
            if (!targetUid) return;
            if (!confirm(`Are you sure you want to report ${targetName} to the Owner?`)) return;
            try {
                const q = query(collection(db, `chats/${activeChatId}/messages`), orderBy("timestamp", "desc"), limit(10));
                const snap = await getDocs(q);
                let historyStr = "";
                snap.forEach(d => {
                    const msg = d.data();
                    const time = new Date(msg.timestamp || Date.now()).toLocaleString();
                    const sender = msg.senderId === curId ? currentUser.name : targetName;
                    const decText = msg.text ? decryptMessage(msg.text) : "";
                    historyStr = `[${time}] ${sender}: ${decText}\n` + historyStr; 
                });
                const ticketId = `report_${Date.now()}`;
                await setDoc(doc(db, "help_complaints", ticketId), {
                    name: currentUser.name,
                    email: currentUser.email,
                    subject: `🚨 REPORT: ${currentUser.name} reported ${targetName}`,
                    details: `Target UID: ${targetUid}\n\n--- EVIDENCE (LAST 10 MESSAGES) ---\n${historyStr || 'No recent messages recorded.'}`,
                    date: Date.now(),
                    status: 'Unresolved'
                });
                alert("Report submitted successfully.");
                if (optionsMenu) optionsMenu.style.display = 'none';
            } catch (err) {
                alert("Failed to send report.");
            }
        };
    }

    // 3. Block User
    if (blockBtn) {
        blockBtn.onclick = async () => {
            if (!targetUid) return;
            if (!confirm(`Block ${targetName}? They will no longer be able to message you.`)) return;
            await updateDoc(doc(db, "users", curId), {
                blockedUsers: arrayUnion(targetUid)
            });
            alert("User blocked.");
            window.location.reload();
        };
    }

    // 4. Clear Chat
    const clearBtn = document.getElementById('btn-opt-clear');
    if (clearBtn) {
        clearBtn.onclick = async () => {
            if (!confirm("Clear your chat history? The chat will remain in your list.")) return;
            await updateDoc(doc(db, "chats", activeChatId), {
                [`clearedAt_${curId}`]: Date.now()
            });
            alert("Chat cleared.");
            window.location.reload(); 
        };
    }

    // 5. Delete Chat Options
    const delModal = document.getElementById('deleteChatModal');
    const deleteBtn = document.getElementById('btn-opt-delete');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (delModal) delModal.style.display = 'flex';
            if (optionsMenu) optionsMenu.style.display = 'none';
            
            const btnEveryone = document.getElementById('btn-del-chat-both');
            let canDeleteEveryone = false;
            if (isGroup) {
                const isAdmin = Array.isArray(activeChatData.admins) && activeChatData.admins.includes(curId);
                canDeleteEveryone = isCurrentOwner || isAdmin;
            } else {
                canDeleteEveryone = isCurrentOwner; 
            }
            if (btnEveryone) btnEveryone.style.display = canDeleteEveryone ? 'block' : 'none';
        };
    }
    
    const closeDelChat = document.getElementById('btn-close-del-chat');
    if (closeDelChat) closeDelChat.onclick = () => { if (delModal) delModal.style.display = 'none'; };

    const delMe = document.getElementById('btn-del-chat-me');
    if (delMe) {
        delMe.onclick = async () => {
            // Delete for Me removes you from participants so it drops out of the Sidebar network fetch completely
            await updateDoc(doc(db, "chats", activeChatId), {
                participants: arrayRemove(curId)
            });
            window.location.reload();
        };
    }

    const delBoth = document.getElementById('btn-del-chat-both');
    if (delBoth) {
        delBoth.onclick = async () => {
            if (!confirm("Permanently delete this chat and all messages for everyone?")) return;
            delBoth.textContent = "Deleting...";
            try {
                const snap = await getDocs(collection(db, `chats/${activeChatId}/messages`));
                const batch = writeBatch(db);
                snap.forEach(d => batch.delete(d.ref));
                await batch.commit();
                await deleteDoc(doc(db, "chats", activeChatId));
                window.location.reload();
            } catch (e) {
                alert("Failed to delete chat: Check database permissions.");
                delBoth.textContent = "Delete for Both";
            }
        };
    }
}
