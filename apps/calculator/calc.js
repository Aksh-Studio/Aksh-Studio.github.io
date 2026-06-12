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
const displayMain = document.getElementById('display-main');
const displayHistory = document.getElementById('display-history');
const historyList = document.getElementById('history-list');

// Auth Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadCloudHistory();
    } else {
        window.location.href = "../../index.html"; // Protect route
    }
});

// ==========================================
// 1. MODULE TABS CONTROLLER
// ==========================================
const tabs = {
    scientific: document.getElementById('tab-scientific'),
    financial: document.getElementById('tab-financial'),
    graphing: document.getElementById('tab-graphing')
};
const modules = {
    scientific: document.getElementById('module-scientific'),
    financial: document.getElementById('module-financial'),
    graphing: document.getElementById('module-graphing')
};

function switchTab(tabName) {
    Object.values(tabs).forEach(t => t.classList.remove('active'));
    Object.values(modules).forEach(m => m.style.display = 'none');
    tabs[tabName].classList.add('active');
    modules[tabName].style.display = (tabName === 'scientific') ? 'grid' : 'flex';
}

tabs.scientific.onclick = () => switchTab('scientific');
tabs.financial.onclick = () => switchTab('financial');
tabs.graphing.onclick = () => switchTab('graphing');


// ==========================================
// 2. CORE CALCULATOR LOGIC & KEYBOARD
// ==========================================
function updateDisplay(mainTxt, subTxt = "") {
    displayMain.innerText = mainTxt || "0";
    displayHistory.innerText = subTxt;
}

function appendToExpression(val) {
    if (currentExpression === "Error") currentExpression = "";
    currentExpression += val;
    updateDisplay(currentExpression);
}

function calculateResult() {
    if (!currentExpression) return;
    try {
        // Safely map visual math symbols to JS executable math
        let parseEq = currentExpression
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/−/g, '-')
            .replace(/π/g, 'Math.PI')
            .replace(/e/g, 'Math.E')
            .replace(/sin\(/g, 'Math.sin(')
            .replace(/cos\(/g, 'Math.cos(')
            .replace(/tan\(/g, 'Math.tan(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/sqrt\(/g, 'Math.sqrt(')
            .replace(/x2/g, '**2');

        // Evaluate and format
        let result = eval(parseEq);
        
        // Handle JS floating point weirdness (e.g. 0.1 + 0.2)
        result = Math.round(result * 100000000) / 100000000; 

        updateDisplay(result, currentExpression + " =");
        saveToCloudHistory(currentExpression, result);
        currentExpression = result.toString();
        
    } catch (error) {
        updateDisplay("Error");
        currentExpression = "";
    }
}

function clearCalculator() {
    currentExpression = "";
    updateDisplay("0", "");
}

// Map Mouse Clicks
document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        if (btn.id === 'btn-clear') return clearCalculator();
        if (btn.id === 'btn-equals') return calculateResult();
        
        // Handle function parenthesis
        if (['sin', 'cos', 'tan', 'log', 'sqrt'].includes(val)) {
            appendToExpression(val + '(');
        } else if (val) {
            appendToExpression(val);
        }
    });
});

// Map PC Keyboard Typing
window.addEventListener('keydown', (e) => {
    if (modules.scientific.style.display === 'none') return; // Only apply if in calculator tab
    
    const validKeys = ['0','1','2','3','4','5','6','7','8','9','.','+','-','*','/','(',')'];
    if (validKeys.includes(e.key)) {
        let mappedKey = e.key;
        if (e.key === '*') mappedKey = '×';
        if (e.key === '/') mappedKey = '÷';
        if (e.key === '-') mappedKey = '−';
        appendToExpression(mappedKey);
    }
    
    if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault(); // Stop forms from submitting
        calculateResult();
    }
    
    if (e.key === 'Backspace') {
        currentExpression = currentExpression.slice(0, -1);
        updateDisplay(currentExpression || "0");
    }
    
    if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        clearCalculator();
    }
});


// ==========================================
// 3. FIREBASE CLOUD HISTORY
// ==========================================
async function saveToCloudHistory(eq, res) {
    if (!currentUser) return;
    try {
        const historyRef = collection(db, `users/${currentUser.uid}/calculatorHistory`);
        await addDoc(historyRef, {
            equation: eq,
            result: res,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving history:", error);
    }
}

function loadCloudHistory() {
    if (!currentUser) return;
    const historyRef = collection(db, `users/${currentUser.uid}/calculatorHistory`);
    const q = query(historyRef, orderBy("timestamp", "desc"));

    // Real-time listener
    onSnapshot(q, (snapshot) => {
        historyList.innerHTML = "";
        if (snapshot.empty) {
            historyList.innerHTML = '<li style="color: #888; text-align: center; font-size: 13px;">No history yet.</li>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const li = document.createElement("li");
            li.className = "history-item";
            li.innerHTML = `
                <div class="eq">${data.equation} =</div>
                <div class="res">${data.result}</div>
            `;
            historyList.appendChild(li);
        });
    });
}

document.getElementById('btn-clear-history').addEventListener('click', async () => {
    if (!currentUser) return;
    if (!confirm("Are you sure you want to clear your entire history?")) return;
    
    const historyRef = collection(db, `users/${currentUser.uid}/calculatorHistory`);
    const snap = await getDocs(historyRef);
    snap.forEach(async (docSnap) => {
        await deleteDoc(docSnap.ref);
    });
});


// ==========================================
// 4. FINANCIAL CALCULATOR
// ==========================================
document.getElementById('fin-calc-btn').addEventListener('click', () => {
    const type = document.getElementById('fin-type').value;
    const p = parseFloat(document.getElementById('fin-principal').value);
    const r = parseFloat(document.getElementById('fin-rate').value);
    const t = parseFloat(document.getElementById('fin-time').value);
    const resultDiv = document.getElementById('fin-result');

    if (isNaN(p) || isNaN(r) || isNaN(t)) {
        return resultDiv.innerText = "Please fill all fields with valid numbers.";
    }

    if (type === 'compound') {
        const amount = p * Math.pow((1 + (r / 100)), t);
        resultDiv.innerText = `Total Value: ₹${amount.toFixed(2)}`;
    } else if (type === 'emi') {
        const monthlyRate = r / 12 / 100;
        const months = t * 12;
        const emi = (p * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
        resultDiv.innerText = `Monthly EMI: ₹${emi.toFixed(2)}`;
    }
});


// ==========================================
// 5. GRAPHING CALCULATOR (CANVAS)
// ==========================================
function drawGraph() {
    const canvas = document.getElementById('graph-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Bounds
    const xMin = parseFloat(document.getElementById('g-xmin').value) || -10;
    const xMax = parseFloat(document.getElementById('g-xmax').value) || 10;
    const yMin = parseFloat(document.getElementById('g-ymin').value) || -10;
    const yMax = parseFloat(document.getElementById('g-ymax').value) || 10;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scaleX = canvas.width / (xMax - xMin);
    const scaleY = canvas.height / (yMax - yMin);
    const originX = -xMin * scaleX;
    const originY = yMax * scaleY;

    // Draw Axes
    ctx.beginPath();
    ctx.strokeStyle = "#e1e4e8";
    ctx.lineWidth = 1;
    ctx.moveTo(originX, 0); ctx.lineTo(originX, canvas.height); 
    ctx.moveTo(0, originY); ctx.lineTo(canvas.width, originY); 
    ctx.stroke();

    // Plot Equation
    let eqStr = document.getElementById('graph-equation').value;
    if (!eqStr) return;

    // Auto format standard math inputs
    eqStr = eqStr.replace(/sin/g, 'Math.sin').replace(/cos/g, 'Math.cos').replace(/tan/g, 'Math.tan');

    ctx.beginPath();
    ctx.strokeStyle = "#128C7E";
    ctx.lineWidth = 2.5;

    try {
        let firstPoint = true;
        for (let px = 0; px < canvas.width; px += 2) {
            let x = xMin + (px / scaleX);
            let y = eval(eqStr); // Unsafe eval purely for local graph plotting
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
        // Invalid formula typed, wait for correction
    }
}

document.getElementById('plot-btn').addEventListener('click', drawGraph);
