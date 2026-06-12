import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio",
    storageBucket: "aksh-studio.firebasestorage.app",
    messagingSenderId: "349325785973",
    appId: "1:349325785973:web:86d5a15bcb700bfc15b13c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentExpression = ""; 

const displayContainer = document.getElementById('main-display-container');
const displayMain = document.getElementById('display-main');
const displayHistory = document.getElementById('display-history');
const historyList = document.getElementById('history-list');

onAuthStateChanged(auth, (user) => {
    if (user) { currentUser = user; loadCloudHistory(); } 
    else { window.location.href = "../../index.html"; }
});

// ==========================================
// 1. MODULE TABS CONTROLLER (12 Modules)
// ==========================================
const tabNames = ['scientific', 'financial', 'graphing', 'algebra', 'trigonometry', 'calculus', 'currency', 'unit', 'age', 'bmi', 'discount', 'data'];
const tabs = {}; const modules = {};

tabNames.forEach(name => {
    tabs[name] = document.getElementById(`tab-${name}`);
    modules[name] = document.getElementById(`module-${name}`);
    tabs[name].onclick = () => switchTab(name);
});

function switchTab(activeTab) {
    tabNames.forEach(name => {
        tabs[name].classList.remove('active');
        modules[name].style.display = 'none';
    });
    tabs[activeTab].classList.add('active');
    modules[activeTab].style.display = (activeTab === 'scientific') ? 'grid' : 'flex';
    displayContainer.style.display = (activeTab === 'scientific') ? 'flex' : 'none';
}

document.getElementById('age-target').valueAsDate = new Date();

// ==========================================
// 2. CORE SCIENTIFIC LOGIC & KEYBOARD
// ==========================================
function updateDisplay(mainTxt, subTxt = "") {
    displayMain.innerText = mainTxt || "0";
    displayHistory.innerText = subTxt;
}

function calculateResult() {
    if (!currentExpression) return;
    try {
        let parseEq = currentExpression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'Math.PI').replace(/e/g, 'Math.E').replace(/sin\(/g, 'Math.sin(').replace(/cos\(/g, 'Math.cos(').replace(/tan\(/g, 'Math.tan(').replace(/log\(/g, 'Math.log10(').replace(/sqrt\(/g, 'Math.sqrt(').replace(/x2/g, '**2');
        let result = Math.round(eval(parseEq) * 100000000) / 100000000; 
        updateDisplay(result, currentExpression + " =");
        saveToCloudHistory(currentExpression, result);
        currentExpression = result.toString();
    } catch (e) { updateDisplay("Error"); currentExpression = ""; }
}

// Mouse Click Listeners
document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        if (btn.id === 'btn-clear') { currentExpression = ""; return updateDisplay("0", ""); }
        if (btn.id === 'btn-equals') return calculateResult();
        if (['sin', 'cos', 'tan', 'log', 'sqrt'].includes(val)) currentExpression += val + '(';
        else if (val) currentExpression += val;
        updateDisplay(currentExpression);
    });
});

// MISSING KEYBOARD LOGIC RESTORED HERE
window.addEventListener('keydown', (e) => {
    // Only hijack the keyboard if the Scientific tab is active
    if (!tabs['scientific'].classList.contains('active')) return;
    
    const validKeys = ['0','1','2','3','4','5','6','7','8','9','.','+','-','*','/','(',')'];
    
    if (validKeys.includes(e.key)) {
        e.preventDefault(); 
        if (currentExpression === "Error") currentExpression = "";
        currentExpression += e.key;
        updateDisplay(currentExpression);
    }
    
    if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        calculateResult();
    }
    
    if (e.key === 'Backspace') {
        e.preventDefault();
        currentExpression = currentExpression.slice(0, -1);
        updateDisplay(currentExpression || "0");
    }
    
    if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        currentExpression = "";
        updateDisplay("0", "");
    }
});

async function saveToCloudHistory(eq, res) {
    if (!currentUser) return;
    await addDoc(collection(db, `users/${currentUser.uid}/calculatorHistory`), { equation: eq, result: res, timestamp: serverTimestamp() });
}

function loadCloudHistory() {
    if (!currentUser) return;
    onSnapshot(query(collection(db, `users/${currentUser.uid}/calculatorHistory`), orderBy("timestamp", "desc")), (snapshot) => {
        historyList.innerHTML = snapshot.empty ? '<li style="color:#888; text-align:center;">No history yet.</li>' : "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            historyList.innerHTML += `<li class="history-item"><div class="eq">${data.equation} =</div><div class="res">${data.result}</div></li>`;
        });
    });
}
document.getElementById('btn-clear-history').addEventListener('click', async () => {
    if (confirm("Clear history?")) {
        const snap = await getDocs(collection(db, `users/${currentUser.uid}/calculatorHistory`));
        snap.forEach(async (docSnap) => await deleteDoc(docSnap.ref));
    }
});

// ==========================================
// 3. ALGEBRA CALCULATOR
// ==========================================
document.getElementById('alg-solve-btn').addEventListener('click', () => {
    let eq = document.getElementById('alg-eq').value.toLowerCase();
    const resDiv = document.getElementById('alg-eq-result');
    if (!eq.includes('=')) return resDiv.innerText = "Error: Equation must contain an '=' sign.";
    try {
        let sides = eq.split('=');
        let f = (x) => eval(sides[0].replace(/x/g, `(${x})`)) - eval(sides[1].replace(/x/g, `(${x})`));
        let m = f(1) - f(0); 
        if (m === 0) resDiv.innerText = (f(0) === 0) ? "Infinite solutions (Identity)" : "No solution";
        else resDiv.innerText = `x = ${-f(0) / m}`;
    } catch(e) { resDiv.innerText = "Invalid format. Use JS math (e.g., 2*x + 5 = 15)."; }
});

document.getElementById('alg-quad-btn').addEventListener('click', () => {
    const a = parseFloat(document.getElementById('alg-a').value);
    const b = parseFloat(document.getElementById('alg-b').value);
    const c = parseFloat(document.getElementById('alg-c').value);
    const resDiv = document.getElementById('alg-quad-result');
    if(isNaN(a) || isNaN(b) || isNaN(c)) return resDiv.innerText = "Enter a, b, and c.";
    if(a === 0) return resDiv.innerText = "Not a quadratic equation.";
    
    let d = (b*b) - (4*a*c);
    if (d > 0) {
        resDiv.innerHTML = `x₁ = ${((-b + Math.sqrt(d))/(2*a)).toFixed(4)}<br>x₂ = ${((-b - Math.sqrt(d))/(2*a)).toFixed(4)}`;
    } else if (d === 0) {
        resDiv.innerHTML = `x = ${(-b / (2*a)).toFixed(4)}`;
    } else {
        let real = (-b / (2*a)).toFixed(4); let imag = (Math.sqrt(-d) / (2*a)).toFixed(4);
        resDiv.innerHTML = `x₁ = ${real} + ${imag}i<br>x₂ = ${real} - ${imag}i`;
    }
});

// ==========================================
// 4. TRIGONOMETRY CALCULATOR
// ==========================================
document.getElementById('trig-calc-btn').addEventListener('click', () => {
    let val = parseFloat(document.getElementById('trig-angle').value);
    let unit = document.getElementById('trig-unit').value;
    const resDiv = document.getElementById('trig-result');
    if(isNaN(val)) return resDiv.innerText = "Enter a valid angle.";
    
    let rad = (unit === 'deg') ? val * (Math.PI / 180) : val;
    let s = Math.sin(rad); let c = Math.cos(rad); let t = Math.tan(rad);
    
    const fmt = (n) => Math.abs(n) < 1e-10 ? "0.0000" : (Math.abs(n) > 1e10 ? "Undefined" : n.toFixed(4));
    const fmtI = (n) => Math.abs(n) < 1e-10 ? "Undefined" : (1/n).toFixed(4);
    
    resDiv.innerHTML = `
        <div><strong>sin(θ):</strong> ${fmt(s)}</div><div><strong>csc(θ):</strong> ${fmtI(s)}</div>
        <div><strong>cos(θ):</strong> ${fmt(c)}</div><div><strong>sec(θ):</strong> ${fmtI(c)}</div>
        <div><strong>tan(θ):</strong> ${fmt(t)}</div><div><strong>cot(θ):</strong> ${fmtI(t)}</div>
    `;
});

// ==========================================
// 5. CALCULUS CALCULATOR
// ==========================================
document.getElementById('calc-deriv-btn').addEventListener('click', () => {
    let f = document.getElementById('calc-deriv-func').value;
    const resDiv = document.getElementById('calc-deriv-result');
    if(!f) return resDiv.innerText = "Enter a function.";
    try {
        let d = math.derivative(f, 'x').toString();
        resDiv.innerText = `f'(x) = ${d}`;
    } catch(e) { resDiv.innerText = "Use explicit math (e.g., 2*x)."; }
});

document.getElementById('calc-int-btn').addEventListener('click', () => {
    let fStr = document.getElementById('calc-int-func').value;
    let a = parseFloat(document.getElementById('calc-int-a').value);
    let b = parseFloat(document.getElementById('calc-int-b').value);
    const resDiv = document.getElementById('calc-int-result');
    if(!fStr || isNaN(a) || isNaN(b)) return resDiv.innerText = "Enter function and limits.";
    
    try {
        const code = math.compile(fStr);
        const f = (x) => code.evaluate({x: x});
        let n = 1000; let h = (b - a) / n; let sum = f(a) + f(b);
        for(let i=1; i<n; i+=2) sum += 4 * f(a + i*h);
        for(let i=2; i<n-1; i+=2) sum += 2 * f(a + i*h);
        resDiv.innerText = `∫ f(x) dx ≈ ${((h / 3) * sum).toFixed(6)}`;
    } catch(e) { resDiv.innerText = "Math error. Check format."; }
});

// ==========================================
// 6. ALL OTHER EXISTING CALCULATORS
// ==========================================
// Financial
document.getElementById('fin-calc-btn').addEventListener('click', () => {
    const type = document.getElementById('fin-type').value;
    const p = parseFloat(document.getElementById('fin-principal').value);
    const r = parseFloat(document.getElementById('fin-rate').value);
    const t = parseFloat(document.getElementById('fin-time').value);
    const resDiv = document.getElementById('fin-result');
    if (isNaN(p) || isNaN(r) || isNaN(t)) return resDiv.innerText = "Enter valid numbers.";
    if (type === 'compound') resDiv.innerText = `Total Value: ₹${(p * Math.pow((1 + (r / 100)), t)).toFixed(2)}`;
    else { const mr = r/12/100; const m = t*12; resDiv.innerText = `Monthly EMI: ₹${((p*mr*Math.pow(1+mr,m))/(Math.pow(1+mr,m)-1)).toFixed(2)}`; }
});

// Graphing
document.getElementById('plot-btn').addEventListener('click', () => {
    const canvas = document.getElementById('graph-canvas'); const ctx = canvas.getContext('2d');
    const xMin = parseFloat(document.getElementById('g-xmin').value); const xMax = parseFloat(document.getElementById('g-xmax').value);
    const yMin = parseFloat(document.getElementById('g-ymin').value); const yMax = parseFloat(document.getElementById('g-ymax').value);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scaleX = canvas.width / (xMax - xMin); const scaleY = canvas.height / (yMax - yMin);
    const originX = -xMin * scaleX; const originY = yMax * scaleY;
    ctx.beginPath(); ctx.strokeStyle = "#e1e4e8"; ctx.moveTo(originX, 0); ctx.lineTo(originX, canvas.height); ctx.moveTo(0, originY); ctx.lineTo(canvas.width, originY); ctx.stroke();
    let eqStr = document.getElementById('graph-equation').value.replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan');
    ctx.beginPath(); ctx.strokeStyle = "#128C7E"; ctx.lineWidth = 2.5;
    try {
        let first = true;
        for (let px = 0; px < canvas.width; px++) {
            let x = xMin + (px / scaleX); let y = eval(eqStr); let py = originY - (y * scaleY);
            if (isNaN(y) || !isFinite(y)) { first = true; continue; }
            if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
    } catch(e) {}
});

// Currency
document.getElementById('curr-calc-btn').addEventListener('click', async () => {
    const amt = parseFloat(document.getElementById('curr-amount').value);
    const from = document.getElementById('curr-from').value;
    const to = document.getElementById('curr-to').value;
    const resDiv = document.getElementById('curr-result');
    if (isNaN(amt)) return resDiv.innerText = "Enter valid amount.";
    resDiv.innerText = "Fetching live rates...";
    try {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
        const data = await response.json();
        resDiv.innerText = `${amt} ${from} = ${(amt * data.rates[to]).toFixed(2)} ${to}`;
    } catch (e) { resDiv.innerText = "Error fetching live rates."; }
});

// Unit
document.getElementById('unit-calc-btn').addEventListener('click', () => {
    const cat = document.getElementById('unit-category').value;
    const val = parseFloat(document.getElementById('unit-val').value);
    const resDiv = document.getElementById('unit-result');
    if (isNaN(val)) return resDiv.innerText = "Enter valid number.";
    if (cat === 'length') resDiv.innerText = `${val} Meters = ${(val * 3.28084).toFixed(2)} Feet\n${val} Feet = ${(val / 3.28084).toFixed(2)} Meters`;
    else if (cat === 'weight') resDiv.innerText = `${val} Kg = ${(val * 2.20462).toFixed(2)} Lbs\n${val} Lbs = ${(val / 2.20462).toFixed(2)} Kg`;
    else if (cat === 'temp') resDiv.innerText = `${val}°C = ${((val * 9/5) + 32).toFixed(2)}°F\n${val}°F = ${((val - 32) * 5/9).toFixed(2)}°C`;
});

// Age
document.getElementById('age-calc-btn').addEventListener('click', () => {
    const dob = new Date(document.getElementById('age-dob').value);
    const target = new Date(document.getElementById('age-target').value);
    const resDiv = document.getElementById('age-result');
    if (!dob || isNaN(dob)) return resDiv.innerText = "Enter valid DOB.";
    let years = target.getFullYear() - dob.getFullYear();
    let months = target.getMonth() - dob.getMonth();
    if (months < 0 || (months === 0 && target.getDate() < dob.getDate())) { years--; months += 12; }
    resDiv.innerText = `Age: ${years} Years, ${months} Months`;
});

// BMI
document.getElementById('bmi-calc-btn').addEventListener('click', () => {
    const h = parseFloat(document.getElementById('bmi-height').value) / 100;
    const w = parseFloat(document.getElementById('bmi-weight').value);
    const resDiv = document.getElementById('bmi-result');
    if (isNaN(h) || isNaN(w) || h <= 0) return resDiv.innerText = "Enter valid height/weight.";
    const bmi = w / (h * h);
    let cat = bmi < 18.5 ? "Underweight" : (bmi < 29.9 ? (bmi < 25 ? "Normal Weight" : "Overweight") : "Obese");
    resDiv.innerHTML = `BMI: ${bmi.toFixed(1)}<br><span style="font-size: 14px; color: #555;">Category: ${cat}</span>`;
});

// Discount
document.getElementById('disc-calc-btn').addEventListener('click', () => {
    const p = parseFloat(document.getElementById('disc-price').value);
    const d = parseFloat(document.getElementById('disc-percent').value);
    const resDiv = document.getElementById('disc-result');
    if (isNaN(p) || isNaN(d)) return resDiv.innerText = "Enter valid numbers.";
    const save = p * (d / 100);
    resDiv.innerHTML = `Final Price: ₹${(p - save).toFixed(2)}<br><span style="font-size: 14px; color: #27ae60;">You saved: ₹${save.toFixed(2)}</span>`;
});

// Data
document.getElementById('data-calc-btn').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('data-val').value);
    const from = document.getElementById('data-from').value;
    const to = document.getElementById('data-to').value;
    const resDiv = document.getElementById('data-result');
    if (isNaN(val)) return resDiv.innerText = "Enter valid amount.";
    const m = { 'KB': 1, 'MB': 1024, 'GB': 1048576, 'TB': 1073741824 };
    resDiv.innerText = `${val} ${from} = ${(val * m[from] / m[to])} ${to}`;
});
