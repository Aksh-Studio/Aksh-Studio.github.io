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

// --- 2. CLOUD SYNC & OPTIMISTIC HISTORY LOGIC ---
const historyBtn = document.getElementById('history-toggle');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
let currentUser = null;
let localHistoryQueue = []; // Holds history instantly before cloud confirms

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
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

function renderHistoryUI(dataArray) {
    historyList.innerHTML = '';
    if (dataArray.length === 0) {
        historyList.innerHTML = '<p style="padding:10px; color:#aaa;">No history recorded yet.</p>';
        return;
    }
    // Render from newest to oldest
    [...dataArray].reverse().forEach(item => {
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
            localHistoryQueue = docSnap.data().calculations;
        } else {
            localHistoryQueue = [];
        }
        renderHistoryUI(localHistoryQueue);
    } catch (error) {
        console.error("Error loading cloud history:", error);
    }
}

async function saveToCloud(equation, result) {
    // 1. Optimistic UI Update: Show it immediately without waiting for Firebase
    const newCalculation = { eq: equation, res: result, timestamp: new Date().toISOString() };
    localHistoryQueue.push(newCalculation);
    renderHistoryUI(localHistoryQueue);

    // 2. Background Sync
    if (!currentUser) return;
    try {
        const userDocRef = doc(db, "calculatorHistory", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            await updateDoc(userDocRef, { calculations: arrayUnion(newCalculation) });
        } else {
            await setDoc(userDocRef, { calculations: [newCalculation] });
        }
    } catch (error) {
        console.error("Error saving to cloud:", error);
    }
}

clearHistoryBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    if (confirm("Permanently delete your calculation history?")) {
        localHistoryQueue = [];
        renderHistoryUI(localHistoryQueue);
        await setDoc(doc(db, "calculatorHistory", currentUser.uid), { calculations: [] });
        historyPanel.classList.remove('show');
    }
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

        switch (operation) {
            case 'sin': current = Math.sin(current); break;
            case 'cos': current = Math.cos(current); break;
            case 'tan': current = Math.tan(current); break;
            case 'sqrt': current = Math.sqrt(current); break;
            case 'log': current = Math.log10(current); break;
            case 'ln': current = Math.log(current); break;
            case 'inv': current = 1 / current; equationString = `1/(${this.currentOperand})`; break;
            case 'abs': current = Math.abs(current); break;
            case 'square': current = Math.pow(current, 2); equationString = `(${this.currentOperand})²`; break;
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

// Event Listeners (BUG FIX: Added Constant Listener)
document.querySelectorAll('[data-number]').forEach(btn => btn.addEventListener('click', () => { calculator.appendNumber(btn.innerText); calculator.updateDisplay(); }));
document.querySelectorAll('[data-operation]').forEach(btn => btn.addEventListener('click', () => { calculator.chooseOperation(btn.dataset.operation); calculator.updateDisplay(); }));
document.querySelectorAll('[data-single-op]').forEach(btn => btn.addEventListener('click', () => { calculator.computeSingleOperand(btn.dataset.singleOp); calculator.updateDisplay(); }));
document.querySelectorAll('[data-constant]').forEach(btn => btn.addEventListener('click', () => { calculator.appendConstant(btn.dataset.constant); calculator.updateDisplay(); }));
document.querySelector('[data-equals]').addEventListener('click', () => { calculator.compute(); calculator.updateDisplay(); });
document.querySelector('[data-all-clear]').addEventListener('click', () => { calculator.clear(); calculator.updateDisplay(); });
document.querySelector('[data-delete]').addEventListener('click', () => { calculator.delete(); calculator.updateDisplay(); });

// Keyboard PC Input
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

// --- 4. ADVANCED FINANCIAL MODULE ---
const finTypeSel = document.getElementById('fin-type');
finTypeSel.addEventListener('change', (e) => {
    if(e.target.value === 'loan') {
        document.getElementById('label-principal').innerText = "Total Loan Amount ($)";
        document.getElementById('label-time').innerText = "Loan Term (Years)";
        document.getElementById('calc-fin-btn').innerText = "Calculate Monthly EMI";
    } else {
        document.getElementById('label-principal').innerText = "Principal Investment ($)";
        document.getElementById('label-time').innerText = "Time (Years)";
        document.getElementById('calc-fin-btn').innerText = "Calculate Compound Interest";
    }
});

document.getElementById('calc-fin-btn').addEventListener('click', () => {
    const p = parseFloat(document.getElementById('fin-principal').value);
    const annualRate = parseFloat(document.getElementById('fin-rate').value);
    const t = parseFloat(document.getElementById('fin-time').value);

    if (isNaN(p) || isNaN(annualRate) || isNaN(t)) {
        alert("Please fill out all Financial fields.");
        return;
    }

    const type = finTypeSel.value;
    
    if(type === 'compound') {
        const r = annualRate / 100;
        const n = 12; // Compounded monthly
        const amount = p * Math.pow((1 + r/n), (n*t));
        const interest = amount - p;
        document.getElementById('res-line-1').innerHTML = `Future Value: <span id="fin-val-1">$${amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</span>`;
        document.getElementById('res-line-2').innerHTML = `Interest Earned: <span id="fin-val-2">$${interest.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</span>`;
    } 
    else if(type === 'loan') {
        const r = (annualRate / 100) / 12; // Monthly interest rate
        const n = t * 12; // Total number of months
        // EMI Formula: P x R x (1+R)^N / [(1+R)^N-1]
        let emi = 0;
        if(r === 0) emi = p / n;
        else emi = p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        
        const totalPaid = emi * n;
        const totalInterest = totalPaid - p;
        
        document.getElementById('res-line-1').innerHTML = `Monthly EMI Payment: <span id="fin-val-1">$${emi.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</span>`;
        document.getElementById('res-line-2').innerHTML = `Total Interest Paid: <span id="fin-val-2">$${totalInterest.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}</span>`;
    }
});

// --- 5. ADVANCED GRAPHING MODULE ---
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const xMin = parseFloat(document.getElementById('g-xmin').value) || -10;
    const xMax = parseFloat(document.getElementById('g-xmax').value) || 10;
    const yMin = parseFloat(document.getElementById('g-ymin').value) || -10;
    const yMax = parseFloat(document.getElementById('g-ymax').value) || 10;
    
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;
    
    // Scale factors: pixels per math unit
    const scaleX = canvas.width / xRange;
    const scaleY = canvas.height / yRange;
    
    // Find origin pixel coordinates
    const originX = -xMin * scaleX;
    const originY = canvas.height + (yMin * scaleY); // Canvas Y goes down

    // Draw grid
    ctx.beginPath();
    ctx.strokeStyle = "#eee";
    for(let i=0; i<canvas.width; i+= (scaleX)) { ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); }
    for(let i=0; i<canvas.height; i+= (scaleY)) { ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); }
    ctx.stroke();

    // Draw Axis lines
    ctx.beginPath();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.moveTo(originX, 0); ctx.lineTo(originX, canvas.height); // Y axis
    ctx.moveTo(0, originY); ctx.lineTo(canvas.width, originY); // X axis
    ctx.stroke();

    // Plot Equation
    const eqStr = document.getElementById('graph-equation').value;
    ctx.beginPath();
    ctx.strokeStyle = "#128C7E";
    ctx.lineWidth = 2.5;

    try {
        let firstPoint = true;
        for(let px = 0; px < canvas.width; px += 2) {
            // Map pixel to math X coordinate
            let x = xMin + (px / scaleX); 
            // Unsafe Eval for local string processing
            let y = eval(eqStr); 
            // Map math Y back to pixel Y coordinate
            let py = originY - (y * scaleY);
            
            if (isNaN(y) || !isFinite(y)) {
                firstPoint = true;
                continue;
            }
            
            if (firstPoint) { ctx.moveTo(px, py); firstPoint = false; } 
            else { ctx.lineTo(px, py); }
        }
        ctx.stroke();
    } catch(e) {
        console.error("Invalid math equation");
    }
}

// Initial draw and listeners
setTimeout(drawGraph, 100); // slight delay to ensure DOM layout
document.getElementById('plot-btn').addEventListener('click', drawGraph);
['g-xmin', 'g-xmax', 'g-ymin', 'g-ymax'].forEach(id => {
    document.getElementById(id).addEventListener('change', drawGraph);
});
