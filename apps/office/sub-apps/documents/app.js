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

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "../../../../index.html"; return; }
    const userDoc = await getDoc(doc(db, "users", user.uid));
    let picUrl = user.photoURL;
    if (userDoc.exists() && userDoc.data().customProfilePic) { picUrl = userDoc.data().customProfilePic; }
    if (picUrl) document.getElementById('profile-pic').src = picUrl;
});

// ==========================================
// 2. ADVANCED TEXT EDITOR LOGIC
// ==========================================
const editor = document.getElementById('editor');
const toolBtns = document.querySelectorAll('.tool-btn');

// Basic Formatting
toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-command');
        if(cmd) {
            document.execCommand(cmd, false, null);
            editor.focus();
        }
    });
});

// Font Family & Size
document.getElementById('font-family').addEventListener('change', function() {
    document.execCommand('fontName', false, this.value);
    editor.focus();
});
document.getElementById('font-size').addEventListener('change', function() {
    document.execCommand('fontSize', false, this.value);
    editor.focus();
});

// Color Pickers
const textColorPicker = document.getElementById('text-color');
const bgColorPicker = document.getElementById('bg-color');

textColorPicker.addEventListener('input', function() {
    document.getElementById('text-color-icon').style.borderBottomColor = this.value;
    document.execCommand('foreColor', false, this.value);
    editor.focus();
});

bgColorPicker.addEventListener('input', function() {
    document.getElementById('bg-color-icon').style.borderBottomColor = this.value;
    document.execCommand('hiliteColor', false, this.value); // hiliteColor works in most browsers
    editor.focus();
});

// Insert Image
const imageInput = document.getElementById('image-input');
document.getElementById('btn-insert-image').addEventListener('click', () => imageInput.click());

imageInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgHtml = `<img src="${e.target.result}" style="max-width: 100%; height: auto;" />`;
            document.execCommand('insertHTML', false, imgHtml);
        };
        reader.readAsDataURL(file);
    }
});

// Insert Table (Basic 3x3)
document.getElementById('btn-insert-table').addEventListener('click', () => {
    const tableHTML = `
        <table border="1" style="width:100%; border-collapse: collapse;">
            <tbody>
                <tr><td>Cell 1</td><td>Cell 2</td><td>Cell 3</td></tr>
                <tr><td>Cell 4</td><td>Cell 5</td><td>Cell 6</td></tr>
                <tr><td>Cell 7</td><td>Cell 8</td><td>Cell 9</td></tr>
            </tbody>
        </table><p><br></p>
    `;
    document.execCommand('insertHTML', false, tableHTML);
});

// ==========================================
// 3. FILE LIFECYCLE (.AD SAVING)
// ==========================================
let fileHandle = null; 
let isDirty = false;
const titleInput = document.getElementById('document-title');
const statusDisplay = document.getElementById('save-status');

function updateStatusIndicator() {
    if (isDirty) {
        document.title = `* ${titleInput.value} - Aksh Documents`;
        statusDisplay.innerHTML = `<span class="material-symbols-rounded" style="font-size: 14px; color: #f59e0b;">error</span> Unsaved Changes`;
    } else {
        document.title = `${titleInput.value} - Aksh Documents`;
        statusDisplay.innerHTML = `<span class="material-symbols-rounded" style="font-size: 14px; color: #10b981;">check_circle</span> Saved to Device`;
    }
}

editor.addEventListener('input', () => { isDirty = true; updateStatusIndicator(); });
titleInput.addEventListener('input', () => { isDirty = true; updateStatusIndicator(); });

// NATIVE NATIVE SAVE (.AD)
document.getElementById('btn-save').addEventListener('click', async () => {
    const fileData = JSON.stringify({
        title: titleInput.value,
        content: editor.innerHTML,
        lastModified: new Date().toISOString()
    });

    try {
        if (!fileHandle) {
            if (window.showSaveFilePicker) {
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: `${titleInput.value || 'Document'}.ad`,
                    types: [{ description: 'Aksh Document Format', accept: {'application/json': ['.ad']} }]
                });
            } else {
                return triggerFallbackDownload(fileData, '.ad', 'application/json');
            }
        }
        const writable = await fileHandle.createWritable();
        await writable.write(fileData);
        await writable.close();

        isDirty = false; updateStatusIndicator();
    } catch (err) {
        if (err.name === 'NotFoundError' || err.name === 'NotAllowedError') {
            alert("FILE NOT FOUND: Access was lost. Please Save As a new file.");
            fileHandle = null; 
        } else if (err.name !== 'AbortError') { alert("Save failed."); }
    }
});

// NATIVE OPEN (.AD)
document.getElementById('btn-open-ad').addEventListener('click', async () => {
    if (isDirty && !confirm("Discard unsaved changes?")) return;
    try {
        if (window.showOpenFilePicker) {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'Aksh Documents', accept: {'application/json': ['.ad']} }]
            });
            fileHandle = handle;
            const file = await fileHandle.getFile();
            const contents = await file.text();
            
            const data = JSON.parse(contents);
            titleInput.value = data.title || "Untitled Document";
            editor.innerHTML = data.content || "";
            isDirty = false; updateStatusIndicator();
        } else {
            document.getElementById('file-input').click();
        }
    } catch (err) { if (err.name !== 'AbortError') console.error(err); }
});

// ==========================================
// 4. MICROSOFT WORD & PDF INTEROPERABILITY
// ==========================================

// EXPORT TO MS WORD (.DOCX)
document.getElementById('btn-export-docx').addEventListener('click', () => {
    // Requires html-docx-js
    const htmlContent = `
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>${titleInput.value}</title></head>
        <body>${editor.innerHTML}</body></html>
    `;
    const converted = htmlDocx.asBlob(htmlContent, {orientation: 'portrait'});
    
    // Trigger download
    const url = URL.createObjectURL(converted);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titleInput.value}.docx`;
    a.click();
    URL.revokeObjectURL(url);
});

// EXPORT TO PDF (.PDF)
document.getElementById('btn-export-pdf').addEventListener('click', () => {
    // Requires html2pdf.js
    const element = document.getElementById('editor');
    const opt = {
      margin:       10,
      filename:     `${titleInput.value}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
});

// IMPORT MS WORD (.DOCX)
document.getElementById('btn-open-docx').addEventListener('click', () => {
    if (isDirty && !confirm("Discard unsaved changes?")) return;
    
    // Create a temporary input to select the .docx file
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = '.docx';
    
    tempInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if(!file) return;

        titleInput.value = file.name.replace('.docx', '');
        fileHandle = null; // Unbind .ad handle since this is an imported .docx

        const reader = new FileReader();
        reader.onload = function(event) {
            const arrayBuffer = event.target.result;
            // Use Mammoth.js to parse the word document
            mammoth.convertToHtml({arrayBuffer: arrayBuffer})
                .then(function(result) {
                    editor.innerHTML = result.value;
                    isDirty = true;
                    updateStatusIndicator();
                })
                .catch(function(err) {
                    alert("Error converting Word document: " + err.message);
                });
        };
        reader.readAsArrayBuffer(file);
    });
    
    tempInput.click();
});

// Fallback for older browsers for .ad files
document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            titleInput.value = data.title;
            editor.innerHTML = data.content;
            isDirty = false; updateStatusIndicator();
        } catch(e) { alert("Invalid file."); }
    };
    reader.readAsText(file);
});

function triggerFallbackDownload(data, ext, type) {
    const blob = new Blob([data], {type: type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${titleInput.value}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    isDirty = false; updateStatusIndicator();
}

// Unsaved Work Warning
window.addEventListener('beforeunload', (e) => {
    if (isDirty) { e.preventDefault(); e.returnValue = ''; }
});
