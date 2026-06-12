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
// 1. TABS CONTROLLER
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
    
    // Show grid for all 4 maths solvers, otherwise show forms
    if (['scientific', 'algebra', 'trigonometry', 'calculus'].includes(activeTab)) {
        modules[activeTab].style.display = 'grid';
        displayContainer.style.display = 'flex';
    } else {
        modules[activeTab].style.display = 'flex';
        displayContainer.style.display = 'none';
    }
}
document.getElementById('age-target').valueAsDate = new Date();


// ==========================================
// 2. MATHS ENGINE (Handles all Grid Clicks & Sends)
// ==========================================
function updateDisplay(mainTxt, subTxt = "") {
    displayMain.innerText = mainTxt || "0";
    displayHistory.innerText = subTxt;
}

// Global Click Listener for ALL Maths Grid Buttons
document.querySelectorAll('.calc-grid .calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        const id = btn.id;

        // Handle AC and DEL
        if (id.includes('btn-ac') || id === 'btn-clear') {
            currentExpression = ""; updateDisplay("0"); return;
        }
        if (id.includes('btn-del')) {
            currentExpression = currentExpression.slice(0, -1);
            updateDisplay(currentExpression || "0"); return;
        }

        // Handle Evaluation (Send Buttons & Equals)
        if (id.includes('btn-send') || id === 'btn-equals') {
            return evaluateExpression();
        }

        // Append values to screen
        if (val) {
            currentExpression += val;
            updateDisplay(currentExpression);
        }
    });
});

// The Evaluation Logic
function evaluateExpression() {
    if (!currentExpression) return;
    try {
        let expr = currentExpression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi');
        let res = "";

        // ALGEBRA: Linear Solver e.g., 2*x+5=15
        if (expr.includes('=')) {
            let sides = expr.split('=');
            let f = (x) => math.evaluate(sides[0], {x:x}) - math.evaluate(sides[1], {x:x});
            let m = f(1) - f(0);
            res = (m === 0) ? "No Solution" : "x = " + (-f(0)/m);
        } 
        // CALCULUS: Derivative Solver e.g., d/dx(x^2)
        else if (expr.startsWith('d/dx(')) {
            let inner = expr.slice(5, -1);
            res = "f'(x) = " + math.derivative(inner, 'x').toString();
        } 
        // STANDARD / TRIGONOMETRY: e.g., sin(90 deg)
        else {
            res = math.evaluate(expr);
            if(typeof res === 'number') res = Math.round(res * 100000000) / 100000000;
        }

        updateDisplay(res, currentExpression + " =");
        saveToCloudHistory(currentExpression, res);
        currentExpression = res.toString();
    } catch (e) {
        updateDisplay("Format Error");
        currentExpression = "";
    }
}

// PC KEYBOARD BINDING (Only active when a grid is open)
window.addEventListener('keydown', (e) => {
    const activeGrid = document.querySelector('.calc-grid[style*="display: grid"]');
    if (!activeGrid) return; // Ignore if using forms
    
    const validKeys = ['0','1','2','3','4','5','6','7','8','9','.','+','-','*','/','(',')','x','y','='];
    
    if (validKeys.includes(e.key)) {
        e.preventDefault(); 
        currentExpression += e.key;
        updateDisplay(currentExpression);
    }
    if (e.key === 'Enter') { e.preventDefault(); evaluateExpression(); }
    if (e.key === 'Backspace') { e.preventDefault(); currentExpression = currentExpression.slice(0, -1); updateDisplay(currentExpression || "0"); }
    if (e.key === 'Escape') { e.preventDefault(); currentExpression = ""; updateDisplay("0"); }
});

// ==========================================
// 3. FIREBASE HISTORY
// ==========================================
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
// 4. FORMS (Finance, Currency, BMI, etc.)
// ==========================================
document.getElementById('fin-calc-btn').addEventListener('click', () => {
    const type = document.getElementById('fin-type').value; const p = parseFloat(document.getElementById('fin-principal').value);
    const r = parseFloat(document.getElementById('fin-rate').value); const t = parseFloat(document.getElementById('fin-time').value);
    const resDiv = document.getElementById('fin-result');
    if (isNaN(p) || isNaN(r) || isNaN(t)) return resDiv.innerText = "Enter valid numbers.";
    if (type === 'compound') resDiv.innerText = `Total: ₹${(p * Math.pow((1 + (r / 100)), t)).toFixed(2)}`;
    else { const mr = r/12/100; const m = t*12; resDiv.innerText = `EMI: ₹${((p*mr*Math.pow(1+mr,m))/(Math.pow(1+mr,m)-1)).toFixed(2)}`; }
});

document.getElementById('curr-calc-btn').addEventListener('click', async () => {
    const amt = parseFloat(document.getElementById('curr-amount').value); const from = document.getElementById('curr-from').value; const to = document.getElementById('curr-to').value;
    const resDiv = document.getElementById('curr-result');
    resDiv.innerText = "Fetching...";
    try { const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`); const data = await res.json(); resDiv.innerText = `${amt} ${from} = ${(amt * data.rates[to]).toFixed(2)} ${to}`; } catch(e) {}
});

document.getElementById('unit-calc-btn').addEventListener('click', () => {
    const cat = document.getElementById('unit-category').value; const val = parseFloat(document.getElementById('unit-val').value); const resDiv = document.getElementById('unit-result');
    if (cat === 'length') resDiv.innerText = `${val}m = ${(val * 3.28).toFixed(2)}ft`; else if (cat === 'weight') resDiv.innerText = `${val}kg = ${(val * 2.2).toFixed(2)}lbs`; else resDiv.innerText = `${val}°C = ${((val * 9/5) + 32).toFixed(2)}°F`;
});

document.getElementById('age-calc-btn').addEventListener('click', () => {
    const dob = new Date(document.getElementById('age-dob').value); const target = new Date(document.getElementById('age-target').value);
    let y = target.getFullYear() - dob.getFullYear(); let m = target.getMonth() - dob.getMonth();
    if (m < 0) { y--; m += 12; } document.getElementById('age-result').innerText = `Age: ${y} Yrs, ${m} Mos`;
});

document.getElementById('bmi-calc-btn').addEventListener('click', () => {
    const h = parseFloat(document.getElementById('bmi-height').value) / 100; const w = parseFloat(document.getElementById('bmi-weight').value);
    const bmi = w / (h * h); document.getElementById('bmi-result').innerText = `BMI: ${bmi.toFixed(1)}`;
});

document.getElementById('disc-calc-btn').addEventListener('click', () => {
    const p = parseFloat(document.getElementById('disc-price').value); const d = parseFloat(document.getElementById('disc-percent').value);
    document.getElementById('disc-result').innerText = `Final Price: ₹${(p - (p * (d / 100))).toFixed(2)}`;
});

document.getElementById('data-calc-btn').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('data-val').value); const from = document.getElementById('data-from').value; const to = document.getElementById('data-to').value;
    const m = { 'KB': 1, 'MB': 1024, 'GB': 1048576, 'TB': 1073741824 }; document.getElementById('data-result').innerText = `${val} ${from} = ${(val * m[from] / m[to])} ${to}`;
});
