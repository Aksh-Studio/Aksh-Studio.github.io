import { db, doc, getDoc, updateDoc, arrayRemove } from "./firebase.js";

export function initGlobalSettings(currentUser) {
    const curId = currentUser?.id || currentUser?.uid;
    if (!curId) return;

    // 1. Profile Dropdown Click Toggle
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

    // 2. Customisation Modal
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

    // 3. Unblock Users Modal
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
