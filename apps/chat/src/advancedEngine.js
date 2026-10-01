import { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, orderBy, limit, getDocs, arrayUnion, arrayRemove, writeBatch } from "./firebase.js";
import { decryptMessage } from "./siteCipher.js";

const ownerEmail = 'akshat124.am12@gmail.com';

export function initGlobalSettings(currentUser) {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    // 1. Profile Dropdown Click Toggle
    const profilePic = document.getElementById('nav-profile-pic');
    const profileDropdown = document.getElementById('profile-dropdown-menu');
    
    if (profilePic && !window.profileMenuAttached) {
        profilePic.addEventListener('click', (e) => {
            e.stopPropagation();
            if (profileDropdown) {
                profileDropdown.style.display = profileDropdown.style.display === 'block' ? 'none' : 'block';
            }
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
            if (chatsPanel) chatsPanel.style.display = 'none';
            if (settingsPanel) settingsPanel.style.display = 'flex';
        };
    }
    if (settingsBack) {
        settingsBack.onclick = () => {
            if (settingsPanel) settingsPanel.style.display = 'none';
            if (chatsPanel) chatsPanel.style.display = 'flex';
        };
    }

    // 3. Global Click Listener
    window.addEventListener('click', () => {
        if (profileDropdown) profileDropdown.style.display = 'none';
        const chatMenu = document.getElementById('chat-options-menu');
        if (chatMenu) chatMenu.style.display = 'none';
    });

    // 4. Customisation Modal
    const customModal = document.getElementById('customModal');
    const btnOpenCustom = document.getElementById('btn-open-customisation');
    if (btnOpenCustom) {
        btnOpenCustom.onclick = async () => {
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

    // 5. Unblock Users Modal
    const unblockModal = document.getElementById('unblockModal');
    const btnOpenUnblock = document.getElementById('btn-open-unblock');
    
    if (btnOpenUnblock) {
        btnOpenUnblock.onclick = async () => {
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

export function initChatOptions(currentUser, activeChatId, activeChatData) {
    const curId = currentUser?.id || currentUser?.uid;
    if (!activeChatId || !activeChatData || !curId) return;

    const optionsBtn = document.getElementById('btn-chat-options');
    const optionsMenu = document.getElementById('chat-options-menu');
    const isGroup = activeChatData.type === 'group';
    const isCurrentOwner = String(currentUser.email).toLowerCase().trim() === ownerEmail;
    
    let targetUid = null;
    let targetName = 'Unknown User';
    let isTargetOwner = false;
    
    if (!isGroup) {
        const safeParticipants = Array.isArray(activeChatData.participants) ? activeChatData.participants : [];
        targetUid = safeParticipants.find(id => id !== curId);
        
        if (targetUid) {
            if (activeChatData.names && activeChatData.names[targetUid]) {
                targetName = activeChatData.names[targetUid];
            }
            const safeParticipantsData = Array.isArray(activeChatData.participantsData) ? activeChatData.participantsData : [];
            const targetData = safeParticipantsData.find(p => p.uid === targetUid);
            if (targetData) {
                targetName = targetData.name || targetName;
                if (String(targetData.email).toLowerCase().trim() === ownerEmail) isTargetOwner = true;
            }
        }
    }

    if (optionsBtn) {
        optionsBtn.style.display = isGroup ? 'none' : 'block';
        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            if (optionsMenu) {
                optionsMenu.style.display = optionsMenu.style.display === 'block' ? 'none' : 'block';
            }
        };
    }
    
    const hideHarshOptions = isGroup || isTargetOwner || activeChatId === 'global_channel' || isCurrentOwner;
    const reportBtn = document.getElementById('btn-opt-report');
    const blockBtn = document.getElementById('btn-opt-block');
    
    if (reportBtn) reportBtn.style.display = hideHarshOptions ? 'none' : 'block';
    if (blockBtn) blockBtn.style.display = hideHarshOptions ? 'none' : 'block';

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

    // 2. Report User (Submits history natively to help_complaints)
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
                    details: `Target UID: ${targetUid}\n\n--- EVIDENCE ---\n${historyStr || 'No recent messages recorded.'}`,
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

    // 3. Block User (WhatsApp Style)
    if (blockBtn) {
        blockBtn.onclick = async () => {
            if (!targetUid) return;
            if (!confirm(`Block ${targetName}? You will no longer be able to message each other.`)) return;
            await updateDoc(doc(db, "users", curId), {
                blockedUsers: arrayUnion(targetUid)
            });
            alert("User blocked.");
            window.location.reload();
        };
    }

    // 4. Clear Chat (Updates clearedAt metadata)
    const clearBtn = document.getElementById('btn-opt-clear');
    if (clearBtn) {
        clearBtn.onclick = async () => {
            if (!confirm("Clear your chat history?")) return;
            await updateDoc(doc(db, "chats", activeChatId), {
                [`clearedAt_${curId}`]: Date.now()
            });
            alert("Chat cleared.");
            window.location.reload(); 
        };
    }

    // 5. Delete Chat ("Delete for me" vs "Delete for both")
    const delModal = document.getElementById('deleteChatModal');
    const deleteBtn = document.getElementById('btn-opt-delete');
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            if (delModal) delModal.style.display = 'flex';
            if (optionsMenu) optionsMenu.style.display = 'none';
        };
    }
    
    const closeDelChat = document.getElementById('btn-close-del-chat');
    if (closeDelChat) closeDelChat.onclick = () => { if (delModal) delModal.style.display = 'none'; };

    const delMe = document.getElementById('btn-del-chat-me');
    if (delMe) {
        delMe.onclick = async () => {
            await updateDoc(doc(db, "chats", activeChatId), {
                participants: arrayRemove(curId)
            });
            window.location.reload();
        };
    }

    const delBoth = document.getElementById('btn-del-chat-both');
    if (delBoth) {
        delBoth.onclick = async () => {
            if (!isCurrentOwner && !activeChatData.admins?.includes(curId) && activeChatData.type === 'group') {
                alert("Only admins can delete group chats for everyone.");
                return;
            }
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
