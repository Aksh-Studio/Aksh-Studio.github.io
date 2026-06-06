import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { auth, db } from "../../auth.js";

// --- 1. TAB SWITCHING LOGIC ---
const tabs = document.querySelectorAll('.tab');
const modules = document.querySelectorAll('.app-module');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        modules.forEach(m => m.classList.remove('active-module'));
        tab.classList.add('active');
        document.getElementById(tab.getAttribute('data-target')).classList.add('active-module');
    });
});

// --- 2. HYBRID HISTORY LOGIC (INSTANT UI + CLOUD SYNC) ---
const historyBtn = document.getElementById('history-toggle');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');

let currentUser = null;
let localHistory = []; // Instant UI update array

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadCloudHistory();
    } else {
        currentUser = null;
        renderHistory();
    }
});

historyBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('show');
    historyPanel.classList.remove('hidden');
});

function renderHistory() {
    historyList.innerHTML = '';
    if (localHistory.length === 0) {
        historyList.innerHTML = '<p style="padding:10px; color:#aaa;">No history recorded yet.</p>';
        return;
    }
    localHistory.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('history-item');
        div.innerHTML = `${item.eq} <span>= ${item.res}</span>`;
        historyList.appendChild(div);
    });
}

async function loadCloudHistory() {
    if (!currentUser) return;
    try {
        const docSnap = await getDoc(doc(db, "calculatorHistory", currentUser.uid));
        if (docSnap.exists() && docSnap.data().calculations) {
            // Load cloud data and reverse it so newest is on top
            localHistory = docSnap.data().calculations.reverse();
            renderHistory();
        }
    } catch (error) { console.error("Cloud load failed:", error); }
}

async function handleNewCalculation(equation, result) {
    // 1. Update UI Instantly
    localHistory.unshift({ eq: equation, res: result });
    if (localHistory.length > 20) localHistory.pop();
    renderHistory();

    // 2. Sync to Cloud silently in background
    if (currentUser) {
        try {
            const userRef = doc(db, "calculatorHistory", currentUser.uid);
            const docSnap = await getDoc(userRef);
            const newCalc = { eq: equation, res: result, timestamp: new Date().toISOString() };
            if (docSnap.exists()) {
                await updateDoc(userRef, { calculations: arrayUnion(newCalc) });
            } else {
                await setDoc(userRef, { calculations: [newCalc] });
            }
        } catch (e) { console.error("Cloud sync failed:", e); }
    }
}

clearHistoryBtn.addEventListener('click', async () => {
    localHistory = [];
    renderHistory();
    if (currentUser) {
        await setDoc(doc(db, "calculatorHistory", currentUser.uid), { calculations: [] });
    }
    historyPanel.classList.remove('show');
});


// --- 3. CORE SCIENTIFIC CALCULATOR ---
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

    appendConstant(constant) {
        // Appends exact values for Pi and E
        if (constant === 'pi') this.currentOperand = Math.PI.toString();
        if (constant === 'e') this.currentOperand = Math.E.toString();
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

        // Convert degrees to radians for standard trig UX
        const toRad = (deg) => deg * (Math.PI / 180);

        switch (operation) {
            case 'sin': current = Math.sin(toRad(current)); break;
            case 'cos': current = Math.cos(toRad(current)); break;
            case 'tan': current = Math.tan(toRad(current)); break;
            case 'sqrt': current = Math.sqrt(current); break;
            case 'log': current = Math.log10(current); break;
            case 'ln': current = Math.log(current); break;
            case '1/x': current = 1 / current; break;
            case 'abs': current = Math.abs(current); break;
            case 'square': 
                current = Math.pow(current, 2); 
                equationString = `(${this.currentOperand})²`; 
                break;
        }
        
        current = Math.round(current * 1e10) / 1e10; // Fix floating point issues
        handleNewCalculation(equationString, current);
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
            default: return;
        }
        
        computation = Math.round(computation * 1e10) / 1e10;
        handleNewCalculation(equationString, computation);
        
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

const calculator = new Calculator(document.querySelector('[data-previous-operand]'), document.querySelector('[data-current-operand]'));

// Event Listeners for Scientific Keys
document.querySelectorAll('[data-number]').forEach(btn => btn.addEventListener('click', () => { calculator.appendNumber(btn.innerText); calculator.updateDisplay(); }));
document.querySelectorAll('[data-operation]').forEach(btn => btn.addEventListener('click', () => { calculator.chooseOperation(btn.dataset.operation); calculator.updateDisplay(); }));
document.querySelectorAll('[data-single-op]').forEach(btn => btn.addEventListener('click', () => { calculator.computeSingleOperand(btn.dataset.singleOp); calculator.updateDisplay(); }));
// FIX: Restored Constant bindings
document.querySelectorAll('[data-constant]').forEach(btn => btn.addEventListener('click', () => { calculator.appendConstant(btn.dataset.constant); calculator.updateDisplay(); }));

document.querySelector('[data-equals]').addEventListener('click', () => { calculator.compute(); calculator.updateDisplay(); });
document.querySelector('[data-all-clear]').addEventListener('click', () => { calculator.clear(); calculator.updateDisplay(); });
document.querySelector('[data-delete]').addEventListener('click', () => { calculator.delete(); calculator.updateDisplay(); });

document.addEventListener('keydown', e => {
    if(!document.getElementById('scientific').classList.contains('active-module')) return;
    if ((e.key >= '0' && e.key <= '9') || e.key === '.') calculator.appendNumber(e.key);
    if (e.key === '=' || e.key === 'Enter') { e.preventDefault(); calculator.compute(); }
    if (e.key === 'Backspace') calculator.delete();
    if (e.key === 'Escape') calculator.clear();
    if (['+', '-', '*', '/'].includes(e.key)) {
        let op = e.key;
        if (op === '*') op = '×';
        if (op === '/') op = '÷';
        if (op === '-') op = '−';
        calculator.chooseOperation(op);
    }
    calculator.updateDisplay();
});


// --- 4. ENHANCED FINANCIAL MODULE ---
document.getElementById('calc-fin-btn').addEventListener('click', () => {
    const P = parseFloat(document.getElementById('fin-principal').value) || 0;
    const PMT = parseFloat(document.getElementById('fin-pmt').value) || 0; // Monthly contribution
    const r = parseFloat(document.getElementById('fin-rate').value) / 100;
    const t = parseFloat(document.getElementById('fin-years').value);
    const n = parseFloat(document.getElementById('fin-compound').value);

    if (isNaN(r) || isNaN(t)) {
        alert("Please enter Rate and Time values.");
        return;
    }

    // Compound Interest with Regular Contributions (Future Value)
    // Formula: A = P(1+r/n)^(nt) + PMT * [((1+r/n)^(nt) - 1) / (r/n)]
    let amount = P * Math.pow((1 + r/n), (n*t));
    
    // If they contribute monthly, we must align the PMT compound math
    if (PMT > 0) {
        // Approximate calculation for continuous monthly payments
        const ratePerPeriod = r / 12;
        const totalPeriods = t * 12;
        const pmtValue = PMT * ((Math.pow(1 + ratePerPeriod, totalPeriods) - 1) / ratePerPeriod);
        amount += pmtValue;
    }

    const totalInvested = P + (PMT * 12 * t);
    const interestEarned = amount - totalInvested;

    document.getElementById('fin-fv').innerText = `$${amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
    document.getElementById('fin-interest').innerText = `$${interestEarned.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
});


// --- 5. ENHANCED GRAPHING MODULE ---
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
let graphScale = 20; // Default zoom

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.beginPath();
    ctx.strokeStyle = "#eee";
    for(let i=0; i<canvas.width; i+=graphScale) { ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); }
    for(let i=0; i<canvas.height; i+=graphScale) { ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height);
    ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2);
    ctx.stroke();

    const eqStr = document.getElementById('graph-equation').value;
    ctx.beginPath();
    ctx.strokeStyle = "#128C7E";
    ctx.lineWidth = 2;

    try {
        for(let px = 0; px < canvas.width; px++) {
            let x = (px - canvas.width/2) / graphScale; 
            let y = eval(eqStr); 
            let py = canvas.height/2 - (y * graphScale);
            
            if (px === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    } catch(e) { } // Ignore partial math typing errors
}

drawGraph();
document.getElementById('plot-btn').addEventListener('click', drawGraph);
document.getElementById('zoom-in').addEventListener('click', () => { graphScale += 10; drawGraph(); });
document.getElementById('zoom-out').addEventListener('click', () => { if(graphScale > 10) graphScale -= 10; drawGraph(); });
