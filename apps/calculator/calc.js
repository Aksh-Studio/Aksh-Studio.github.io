// --- 1. DEVICE DETECTION ---
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    console.log("Mobile device detected: Optimizing touch targets.");
} else {
    console.log("PC detected: Keyboard input fully active.");
}

// --- 2. TAB SWITCHING LOGIC ---
const tabs = document.querySelectorAll('.tab');
const modules = document.querySelectorAll('.app-module');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all
        tabs.forEach(t => t.classList.remove('active'));
        modules.forEach(m => m.classList.remove('active-module'));
        
        // Add active class to clicked tab and corresponding module
        tab.classList.add('active');
        const target = tab.getAttribute('data-target');
        document.getElementById(target).classList.add('active-module');
    });
});

// --- 3. HISTORY PANEL LOGIC ---
const historyBtn = document.getElementById('history-toggle');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
let calculationHistory = [];

historyBtn.addEventListener('click', () => {
    historyPanel.classList.toggle('show');
    historyPanel.classList.remove('hidden');
});

function saveToHistory(equation, result) {
    calculationHistory.unshift({ eq: equation, res: result }); // Add to top
    if (calculationHistory.length > 20) calculationHistory.pop(); // Keep last 20
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = '';
    calculationHistory.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('history-item');
        div.innerHTML = `${item.eq} <span>= ${item.res}</span>`;
        historyList.appendChild(div);
    });
}

clearHistoryBtn.addEventListener('click', () => {
    calculationHistory = [];
    renderHistory();
    historyPanel.classList.remove('show');
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
        
        current = Math.round(current * 1e10) / 1e10; // Fix float precision
        saveToHistory(equationString, current);
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
        saveToHistory(equationString, computation);
        
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
    // Only capture keys if the scientific calculator is active
    if(!document.getElementById('scientific').classList.contains('active-module')) return;

    if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
        calculator.appendNumber(e.key);
    }
    if (e.key === '=' || e.key === 'Enter') {
        e.preventDefault(); // Prevent form submission
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
    const r = parseFloat(document.getElementById('fin-rate').value) / 100; // convert to decimal
    const t = parseFloat(document.getElementById('fin-years').value);
    const n = 12; // Compounded monthly default

    if (isNaN(p) || isNaN(r) || isNaN(t)) {
        alert("Please fill out all Financial fields.");
        return;
    }

    // Compound Interest Formula: A = P(1 + r/n)^(nt)
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
    
    // Draw grid & axes
    ctx.beginPath();
    ctx.strokeStyle = "#ddd";
    for(let i=0; i<canvas.width; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); }
    for(let i=0; i<canvas.height; i+=40) { ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.moveTo(canvas.width/2, 0); ctx.lineTo(canvas.width/2, canvas.height); // Y axis
    ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2); // X axis
    ctx.stroke();

    // Plot Equation
    const eqStr = document.getElementById('graph-equation').value;
    ctx.beginPath();
    ctx.strokeStyle = "#128C7E"; // Brand color
    ctx.lineWidth = 3;

    try {
        for(let px = 0; px < canvas.width; px++) {
            // Map pixel to math coordinates (-10 to 10 scale approx)
            let x = (px - canvas.width/2) / 20; 
            
            // Unsafe Eval for math string, acceptable for local client-side portfolio
            let y = eval(eqStr); 
            
            // Map math y back to pixel y
            let py = canvas.height/2 - (y * 20);
            
            if (px === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    } catch(e) {
        console.error("Invalid math equation format");
    }
}

// Initial draw and button bind
drawGraph();
document.getElementById('plot-btn').addEventListener('click', drawGraph);
