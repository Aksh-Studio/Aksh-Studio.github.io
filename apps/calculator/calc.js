import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// Import the authenticated engine and database from your root auth file
import { auth, db } from "../../auth.js";

// --- 1. DEVICE DETECTION ---
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// --- 2. TAB SWITCHING LOGIC ---
const tabs = document.querySelectorAll('.tab');
const modules = document.querySelectorAll('.app-module');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        modules.forEach(m => m.classList.remove('active-module'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-target');
        document.getElementById(target).classList.add('active-module');
    });
});

// --- 3. CLOUD SYNC & HISTORY LOGIC ---
const historyBtn = document.getElementById('history-toggle');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
let currentUser = null;

// Track Auth State and Load User's Cloud Data
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log(`Syncing data for user: ${user.email || user.uid}`);
        await loadCloudHistory();
    } else {
        currentUser = null;
        historyList.innerHTML = '<p style="padding:10px; color:#aaa;">Log in to sync history.</p>';
    }
});

historyBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('show');
    historyPanel.classList.remove('hidden');
});

// Fetch history from Firebase Firestore
async function loadCloudHistory() {
    if (!currentUser) return;
    try {
        const userDocRef = doc(db, "calculatorHistory", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        
        historyList.innerHTML = '';
        if (docSnap.exists() && docSnap.data().calculations) {
            const historyData = docSnap.data().calculations;
            // Render calculations from newest to oldest
            historyData.reverse().forEach(item => {
                const div = document.createElement('div');
                div.classList.add('history-item');
                div.innerHTML = `${item.eq} <span>= ${item.res}</span>`;
                historyList.appendChild(div);
            });
        } else {
            historyList.innerHTML = '<p style="padding:10px; color:#aaa;">No history recorded yet.</p>';
        }
    } catch (error) {
        console.error("Error loading history from cloud:", error);
    }
}

// Save a calculation to Firebase Firestore under user's unique ID
async function saveToCloud(equation, result) {
    if (!currentUser) return;
    try {
        const userDocRef = doc(db, "calculatorHistory", currentUser.uid);
        const newCalculation = { eq: equation, res: result, timestamp: new Date().toISOString() };
        
        // Check if doc exists to update it, otherwise create it fresh
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            await updateDoc(userDocRef, {
                calculations: arrayUnion(newCalculation)
            });
        } else {
            await setDoc(userDocRef, {
                calculations: [newCalculation]
            });
        }
        await loadCloudHistory(); // Refresh view
    } catch (error) {
        console.error("Error saving to cloud:", error);
    }
}

// Clear history from cloud
clearHistoryBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    if (confirm("Are you sure you want to permanently delete your cloud calculation history?")) {
        try {
            await setDoc(doc(db, "calculatorHistory", currentUser.uid), { calculations: [] });
            await loadCloudHistory();
            historyPanel.classList.remove('show');
        } catch (error) {
            console.error("Error clearing cloud history:", error);
        }
    }
});


// --- 4. CORE SCIENTIFIC CALCULATOR ---
class Calculator {
    constructor(previousText, currentText) {
        this.previousText = previousText;
        this.currentText = currentText;
        this.clear();
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
    }

    delete() {
        if (this.currentOperand === '0') return;
        this.currentOperand = this.currentOperand.toString().slice(0, -1);
        if (this.currentOperand === '') this.currentOperand = '0';
    }

    appendNumber(number) {
        if (number === '.' && this.currentOperand.includes('.')) return;
        if (this.currentOperand === '0' && number !== '.') {
            this.currentOperand = number.toString();
        } else {
            this.currentOperand = this.currentOperand.toString() + number.toString();
        }
    }

    chooseOperation(operation) {
        if (this.currentOperand === '0' && this.previousOperand === '') return;
        if (this.previousOperand !== '') this.compute();
        this.operation = operation;
        this.previousOperand = this.currentOperand;
        this.currentOperand = '0';
    }

    computeSingleOperand(operation) {
        let current = parseFloat(this.currentOperand);
        if (isNaN(current)) return;
        let equationString = `${operation}(${current})`;

        switch (operation) {
            case 'sin': current = Math.sin(current); break;
            case 'cos': current = Math.cos(current); break;
            case 'tan': current = Math.tan(current); break;
            case 'sqrt': current = Math.sqrt(current); break;
            case 'log': current = Math.log10(current); break;
            case 'ln': current = Math.log(current); break;
            case '1/x': current = 1 / current; break;
            case 'abs': current = Math.abs(current); break;
        }
        
        current = Math.round(current * 1e10) / 1e10;
        saveToCloud(equationString, current);
        this.currentOperand = current.toString();
    }

    compute() {
        let computation;
        const prev = parseFloat(this.previousOperand);
        const current = parseFloat(this.currentOperand);
        if (isNaN(prev) || isNaN(current)) return;
        
        const equationString = `${prev} ${this.operation} ${current}`;

        switch (this.operation) {
            case '+': computation = prev + current; break;
            case '−': computation = prev - current; break;
            case '×': computation = prev * current; break;
            case '÷': 
                if (current === 0) { alert("Cannot divide by zero"); return this.clear(); }
                computation = prev / current; break;
            case '^': computation = Math.pow(prev, current); break;
            default: return;
        }
        
        computation = Math.round(computation * 1e10) / 1e10;
        saveToCloud(equationString, computation);
        
        this.currentOperand = computation.toString();
        this.operation = undefined;
        this.previousOperand = '';
    }

    updateDisplay() {
        this.currentText.innerText = this.currentOperand;
        if (this.operation != null) {
            this.previousText.innerText = `${this.previousOperand} ${this.operation}`;
        } else {
            this.previousText.innerText = '';
        }
    }
}

const calculator = new Calculator(
    document.querySelector('[data-previous-operand]'),
    document.querySelector('[data-current-operand]')
);

// Click Listeners
document.querySelectorAll('[data-number]').forEach(btn => btn.addEventListener('click', () => { calculator.appendNumber(btn.innerText); calculator.updateDisplay(); }));
document.querySelectorAll('[data-operation]').forEach(btn => btn.addEventListener('click', () => { calculator.chooseOperation(btn.dataset.operation); calculator.updateDisplay(); }));
document.querySelectorAll('[data-single-op]').forEach(btn => btn.addEventListener('click', () => { calculator.computeSingleOperand(btn.dataset.singleOp); calculator.updateDisplay(); }));
document.querySelector('[data-equals]').addEventListener('click', () => { calculator.compute(); calculator.updateDisplay(); });
document.querySelector('[data-all-clear]').addEventListener('click', () => { calculator.clear(); calculator.updateDisplay(); });
document.querySelector('[data-delete]').addEventListener('click', () => { calculator.delete(); calculator.updateDisplay(); });

// --- 5. KEYBOARD INTEGRATION (PC Support) ---
document.addEventListener('keydown', e => {
    if(!document.getElementById('scientific').classList.contains('active-module')) return;

    if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
        calculator.appendNumber(e.key);
    }
    if (e.key === '=' || e.key === 'Enter') {
        e.preventDefault();
        calculator.compute();
    }
    if (e.key === 'Backspace') calculator.delete();
    if (e.key === 'Escape') calculator.clear();
    
    if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
        let op = e.key;
        if (op === '*') op = '×';
        if (op === '/') op = '÷';
        if (op === '-') op = '−';
        calculator.chooseOperation(op);
    }
    calculator.updateDisplay();
});


// --- 6. FINANCIAL MODULE LOGIC ---
document.getElementById('calc-fin-btn').addEventListener('click', () => {
    const p = parseFloat(document.getElementById('fin-principal').value);
    const r = parseFloat(document.getElementById('fin-rate').value) / 100;
    const t = parseFloat(document.getElementById('fin-years').value);
    const n = 12;

    if (isNaN(p) || isNaN(r) || isNaN(t)) {
        alert("Please fill out all Financial fields.");
        return;
    }

    const amount = p * Math.pow((1 + r/n), (n*t));
    const interest = amount - p;

    document.getElementById('fin-fv').innerText = `$${amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
    document.getElementById('fin-interest').innerText = `$${interest.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
});


// --- 7. GRAPHING MODULE LOGIC ---
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.beginPath();
    ctx.strokeStyle = "#ddd";
    for(let i=0; i<canvas.width; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); }
    for(let i=0; i<canvas.height; i+=40) { ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height);
    ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2);
    ctx.stroke();

    const eqStr = document.getElementById('graph-equation').value;
    ctx.beginPath();
    ctx.strokeStyle = "#128C7E";
    ctx.lineWidth = 3;

    try {
        for(let px = 0; px < canvas.width; px++) {
            let x = (px - canvas.width/2) / 20; 
            let y = eval(eqStr); 
            let py = canvas.height/2 - (y * 20);
            
            if (px === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    } catch(e) {
        console.error("Invalid math equation format");
    }
}

drawGraph();
document.getElementById('plot-btn').addEventListener('click', drawGraph);
