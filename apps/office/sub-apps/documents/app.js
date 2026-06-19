// apps/office/sub-apps/documents/app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. SYSTEM INITIALIZATION & AUTH
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio",
    storageBucket: "aksh-studio.firebasestorage.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Dark Mode Sync
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "../../../../index.html"; 
        return;
    }
    const userDoc = await getDoc(doc(db, "users", user.uid));
    let picUrl = user.photoURL;
    if (userDoc.exists() && userDoc.data().customProfilePic) {
        picUrl = userDoc.data().customProfilePic;
    }
    if (picUrl) document.getElementById('profile-pic').src = picUrl;
});

// ==========================================
// 2. TEXT EDITOR & MARKDOWN PARSER LOGIC
// ==========================================
const editor = document.getElementById('editor');
const toolBtns = document.querySelectorAll('.tool-btn');

// Toolbar actions
toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-command');
        const val = btn.getAttribute('data-value') || null;
        document.execCommand(cmd, false, val);
        editor.focus();
    });
});

// Basic Markdown Shortcut Parser (Triggers on Space or Enter)
editor.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
        const selection = window.getSelection();
        const node = selection.focusNode;
        if (node && node.nodeType === 3) {
            const text = node.textContent;
            
            // # creates H1
            if (text.startsWith('# ')) {
                document.execCommand('formatBlock', false, 'H1');
                node.textContent = text.substring(2);
            }
            // ## creates H2
            else if (text.startsWith('## ')) {
                document.execCommand('formatBlock', false, 'H2');
                node.textContent = text.substring(3);
            }
            // * creates Bullet List
            else if (text.startsWith('* ') || text.startsWith('- ')) {
                document.execCommand('delete');
                document.execCommand('insertUnorderedList');
                node.textContent = text.substring(2);
            }
        }
    }
});

// ==========================================
// 3. FILE LIFECYCLE & AUTOSAVE STATE MACHINE
// ==========================================
let fileHandle = null; 
let isDirty = false;
let isAutosaveEnabled = false;
let autosaveInterval = null;

const titleInput = document.getElementById('document-title');
const statusDisplay = document.getElementById('save-status');
const autosaveWrapper = document.getElementById('autosave-wrapper');
const autosaveToggle = document.getElementById('autosave-toggle');
const btnSave = document.getElementById('btn-save');
const btnOpen = document.getElementById('btn-open');
const fileInputFallback = document.getElementById('file-input');

// Mark Document as "Dirty" (Unsaved) when typed in
editor.addEventListener('input', () => {
    if (!isDirty) {
        isDirty = true;
        updateStatusIndicator();
    }
});
titleInput.addEventListener('input', () => {
    isDirty = true;
    updateStatusIndicator();
});

function updateStatusIndicator() {
    if (isDirty) {
        document.title = `* ${titleInput.value} - Aksh Documents`;
        statusDisplay.innerHTML = `<span class="material-symbols-rounded" style="font-size: 14px; color: #f59e0b;">error</span> Unsaved Changes`;
    } else {
        document.title = `${titleInput.value} - Aksh Documents`;
        statusDisplay.innerHTML = `<span class="material-symbols-rounded" style="font-size: 14px; color: #10b981;">check_circle</span> Saved to Device`;
    }
}

// ------------------------------------------
// SAVE LOGIC (File System Access API)
// ------------------------------------------
btnSave.addEventListener('click', async () => {
    await executeSave();
});

async function executeSave() {
    const fileData = JSON.stringify({
        title: titleInput.value,
        content: editor.innerHTML,
        lastModified: new Date().toISOString()
    });

    try {
        if (!fileHandle) {
            // First time saving: Show Save As Dialog
            if (window.showSaveFilePicker) {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: `${titleInput.value || 'Document'}.aksh`,
                    types: [{
                        description: 'Aksh Document Format',
                        accept: {'application/json': ['.aksh']}
                    }]
                });
            } else {
                // Fallback for older browsers / mobile: Force Download
                return triggerFallbackDownload(fileData);
            }
        }

        // Write to established file handle
        const writable = await fileHandle.createWritable();
        await writable.write(fileData);
        await writable.close();

        // Save Successful State
        isDirty = false;
        updateStatusIndicator();
        
        // Unlock Autosave UI
        autosaveWrapper.classList.add('active');

    } catch (err) {
        if (err.name === 'NotFoundError' || err.name === 'NotAllowedError') {
            alert("FILE NOT FOUND OR PERMISSION DENIED: The file was moved, deleted, or access was revoked. Please Save As a new file.");
            fileHandle = null; 
            disableAutosave();
        } else if (err.name !== 'AbortError') {
            console.error("Save failed:", err);
            alert("Failed to save the file.");
        }
    }
}

function triggerFallbackDownload(data) {
    const blob = new Blob([data], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titleInput.value}.aksh`;
    a.click();
    URL.revokeObjectURL(url);
    
    isDirty = false;
    updateStatusIndicator();
    // Cannot reliably autosave using fallback download technique
    alert("Saved via Download. Note: Autosave requires modern desktop browser file system access.");
}

// ------------------------------------------
// OPEN LOGIC 
// ------------------------------------------
btnOpen.addEventListener('click', async () => {
    // Check for unsaved work before opening new file
    if (isDirty) {
        if (!confirm("You have unsaved work. Are you sure you want to open a new file and discard changes?")) return;
    }

    try {
        if (window.showOpenFilePicker) {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Aksh Documents', accept: {'application/json': ['.aksh']} }]
            });
            fileHandle = handle;
            const file = await fileHandle.getFile();
            const contents = await file.text();
            loadDocumentData(contents);
            
            // Unlock Autosave UI
            autosaveWrapper.classList.add('active');
        } else {
            fileInputFallback.click(); // Fallback trigger
        }
    } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
    }
});

fileInputFallback.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => loadDocumentData(event.target.result);
    reader.readAsText(file);
});

function loadDocumentData(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        titleInput.value = data.title || "Untitled Document";
        editor.innerHTML = data.content || "";
        isDirty = false;
        updateStatusIndicator();
    } catch (e) {
        alert("Error reading .aksh file. The file may be corrupted.");
    }
}

// ------------------------------------------
// AUTOSAVE ENGINE
// ------------------------------------------
autosaveToggle.addEventListener('click', () => {
    if (!fileHandle) {
        alert("You must Save the document locally to your computer first before enabling Autosave.");
        return;
    }
    
    isAutosaveEnabled = !isAutosaveEnabled;
    autosaveToggle.classList.toggle('on', isAutosaveEnabled);

    if (isAutosaveEnabled) {
        // Runs every 30 seconds
        autosaveInterval = setInterval(() => {
            if (isDirty && fileHandle) {
                executeSave();
            }
        }, 30000); 
    } else {
        disableAutosave();
    }
});

function disableAutosave() {
    isAutosaveEnabled = false;
    autosaveToggle.classList.remove('on');
    if (autosaveInterval) clearInterval(autosaveInterval);
}

// ------------------------------------------
// EXIT PROTECTION (Unsaved Work Warning)
// ------------------------------------------
window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
        // Standard browser warning for unsaved changes when trying to close tab
        e.preventDefault();
        e.returnValue = ''; 
    }
});
