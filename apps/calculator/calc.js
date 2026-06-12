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

// DOM Elements
const displayContainer = document.getElementById('main-display-container');
const displayMain = document.getElementById('display-main');
const displayHistory = document.getElementById('display-history');
const historyList = document.getElementById('history-list');

onAuthStateChanged(auth, (user) => {
    if (user) { currentUser = user; loadCloudHistory(); } 
    else { window.location.href = "../../index.html"; }
});

// ==========================================
// 1. MODULE TABS CONTROLLER (Fixes Stacking Bug)
// ==========================================
const tabNames = ['scientific', 'financial', 'graphing', 'currency', 'unit', 'age', 'bmi', 'discount', 'data'];
const tabs = {}; const modules = {};

tabNames.forEach(name => {
    tabs[name] = document.getElementById(`tab-${name}`);
    modules[name] = document.getElementById(`module-${name}`);
    
    tabs[name].onclick = () => switchTab(name);
});

function switchTab(activeTab) {
    // 1. Completely hide every module and deactivate every tab
    tabNames.forEach(name => {
        tabs[name].classList.remove('active');
        modules[name].style.display = 'none';
    });

    // 2. Show only the active one
    tabs[activeTab].classList.add('active');
    modules[activeTab].style.display = (activeTab === 'scientific') ? 'grid' : 'flex';
    
    // Hide the black scientific screen if we aren't using the scientific calculator
    displayContainer.style.display = (activeTab === 'scientific') ? 'flex' : 'none';
}

// Set default target date for Age Calculator
document.getElementById('age-target').valueAsDate = new Date();


// ==========================================
// 2. CORE SCIENTIFIC LOGIC & HISTORY
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
    } catch (e) {
        updateDisplay("Error"); currentExpression = "";
    }
}

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
// 3. FINANCIAL CALCULATOR
// ==========================================
document.getElementById('fin-calc-btn').addEventListener('click', () => {
    const type = document.getElementById('fin-type').value;
    const p = parseFloat(document.getElementById('fin-principal').value);
    const r = parseFloat(document.getElementById('fin-rate').value);
    const t = parseFloat(document.getElementById('fin-time').value);
    const resDiv = document.getElementById('fin-result');
    if (isNaN(p) || isNaN(r) || isNaN(t)) return resDiv.innerText = "Enter valid numbers.";

    if (type === 'compound') resDiv.innerText = `Total Value: ₹${(p * Math.pow((1 + (r / 100)), t)).toFixed(2)}`;
    else {
        const mr = r / 12 / 100; const m = t * 12;
        resDiv.innerText = `Monthly EMI: ₹${((p * mr * Math.pow(1 + mr, m)) / (Math.pow(1 + mr, m) - 1)).toFixed(2)}`;
    }
});

// ==========================================
// 4. GRAPHING CALCULATOR
// ==========================================
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

// ==========================================
// 5. CURRENCY CONVERTER (Real-time API)
// ==========================================
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
        const rate = data.rates[to];
        resDiv.innerText = `${amt} ${from} = ${(amt * rate).toFixed(2)} ${to}`;
    } catch (e) {
        resDiv.innerText = "Error checking live rates. Check internet.";
    }
});

// ==========================================
// 6. UNIT CONVERTER
// ==========================================
document.getElementById('unit-calc-btn').addEventListener('click', () => {
    const cat = document.getElementById('unit-category').value;
    const val = parseFloat(document.getElementById('unit-val').value);
    const resDiv = document.getElementById('unit-result');
    if (isNaN(val)) return resDiv.innerText = "Enter valid number.";

    if (cat === 'length') resDiv.innerText = `${val} Meters = ${(val * 3.28084).toFixed(2)} Feet\n${val} Feet = ${(val / 3.28084).toFixed(2)} Meters`;
    else if (cat === 'weight') resDiv.innerText = `${val} Kg = ${(val * 2.20462).toFixed(2)} Lbs\n${val} Lbs = ${(val / 2.20462).toFixed(2)} Kg`;
    else if (cat === 'temp') resDiv.innerText = `${val}°C = ${((val * 9/5) + 32).toFixed(2)}°F\n${val}°F = ${((val - 32) * 5/9).toFixed(2)}°C`;
});

// ==========================================
// 7. AGE CALCULATOR
// ==========================================
document.getElementById('age-calc-btn').addEventListener('click', () => {
    const dob = new Date(document.getElementById('age-dob').value);
    const target = new Date(document.getElementById('age-target').value);
    const resDiv = document.getElementById('age-result');
    
    if (!dob || isNaN(dob)) return resDiv.innerText = "Enter valid DOB.";
    
    let years = target.getFullYear() - dob.getFullYear();
    let months = target.getMonth() - dob.getMonth();
    
    if (months < 0 || (months === 0 && target.getDate() < dob.getDate())) {
        years--;
        months += 12;
    }
    resDiv.innerText = `Age: ${years} Years, ${months} Months`;
});

// ==========================================
// 8. BMI CALCULATOR
// ==========================================
document.getElementById('bmi-calc-btn').addEventListener('click', () => {
    const h = parseFloat(document.getElementById('bmi-height').value) / 100; // cm to meters
    const w = parseFloat(document.getElementById('bmi-weight').value);
    const resDiv = document.getElementById('bmi-result');
    
    if (isNaN(h) || isNaN(w) || h <= 0) return resDiv.innerText = "Enter valid height/weight.";
    
    const bmi = w / (h * h);
    let cat = "Normal Weight";
    if (bmi < 18.5) cat = "Underweight";
    else if (bmi >= 25 && bmi < 29.9) cat = "Overweight";
    else if (bmi >= 30) cat = "Obese";
    
    resDiv.innerHTML = `BMI: ${bmi.toFixed(1)}<br><span style="font-size: 14px; color: #555;">Category: ${cat}</span>`;
});

// ==========================================
// 9. DISCOUNT & DATA CONVERTERS
// ==========================================
document.getElementById('disc-calc-btn').addEventListener('click', () => {
    const p = parseFloat(document.getElementById('disc-price').value);
    const d = parseFloat(document.getElementById('disc-percent').value);
    const resDiv = document.getElementById('disc-result');
    if (isNaN(p) || isNaN(d)) return resDiv.innerText = "Enter valid numbers.";
    const save = p * (d / 100);
    resDiv.innerHTML = `Final Price: ₹${(p - save).toFixed(2)}<br><span style="font-size: 14px; color: #27ae60;">You saved: ₹${save.toFixed(2)}</span>`;
});

document.getElementById('data-calc-btn').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('data-val').value);
    const from = document.getElementById('data-from').value;
    const to = document.getElementById('data-to').value;
    const resDiv = document.getElementById('data-result');
    if (isNaN(val)) return resDiv.innerText = "Enter valid amount.";
    
    const multipliers = { 'KB': 1, 'MB': 1024, 'GB': 1048576, 'TB': 1073741824 };
    const valInKb = val * multipliers[from];
    const finalVal = valInKb / multipliers[to];
    
    resDiv.innerText = `${val} ${from} = ${finalVal} ${to}`;
});
