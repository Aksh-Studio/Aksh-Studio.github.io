import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAmxOwGXgffYiEP0O4o_cWvP0lg2SbJfhw",
    authDomain: "aksh-studio.firebaseapp.com",
    projectId: "aksh-studio"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentEq = ""; 
let currentMode = "scientific";

const dMain = document.getElementById('display-main');
const dHist = document.getElementById('display-history');

onAuthStateChanged(auth, user => { if(user){ currentUser = user; loadHistory(); }});

// --- Tab Controller & Theme Switcher ---
const tabs = ['scientific', 'algebra', 'trigonometry', 'calculus', 'graphing', 'financial', 'currency', 'unit', 'age', 'bmi', 'discount', 'data'];
tabs.forEach(t => {
    document.getElementById(`tab-${t}`).onclick = () => {
        tabs.forEach(x => {
            document.getElementById(`tab-${x}`).className = 'tab-btn';
            document.getElementById(`module-${x}`).style.display = 'none';
        });
        
        const btn = document.getElementById(`tab-${t}`);
        currentMode = t;
        
        // Color active tabs based on screenshot themes
        if(t==='algebra') btn.classList.add('active-alg');
        else if(t==='trigonometry') btn.classList.add('active-trig');
        else if(t==='calculus') btn.classList.add('active-calc');
        else btn.classList.add('active');

        const mod = document.getElementById(`module-${t}`);
        if(['scientific','algebra','trigonometry','calculus'].includes(t)) {
            mod.style.display = 'grid';
        } else {
            mod.style.display = 'flex';
        }
    };
});

// --- Universal Input Handler ---
function updateDisplay(txt, sub="") {
    dMain.innerText = txt;
    dHist.innerText = sub;
}

document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.onclick = () => {
        let val = btn.getAttribute('data-val');
        if(!val) return;
        
        // Handle Action Keys
        if(val === 'AC') { currentEq = ""; updateDisplay(""); return; }
        if(val === 'DEL') { currentEq = currentEq.slice(0, -1); updateDisplay(currentEq); return; }
        
        // Handle Solve/Equals Keys
        if(val === '=') return solveScientific();
        if(val === 'SOLVE_ALG') return solveAlgebra();
        if(val === 'SOLVE_TRIG') return solveTrig();
        if(val === 'SOLVE_CALC') return solveCalculus();

        // Standard Key Press
        currentEq += val;
        updateDisplay(currentEq);
    };
});

// --- Solving Engines ---
function solveScientific() {
    try {
        let parseEq = currentEq.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/π/g,'Math.PI').replace(/e/g,'Math.E');
        let res = math.evaluate(parseEq);
        updateDisplay(res, currentEq + " =");
        saveHist(currentEq, res);
        currentEq = res.toString();
    } catch(e) { updateDisplay("Error", currentEq); currentEq = ""; }
}

function solveAlgebra() {
    try {
        // Basic symbolic solver for linear eq: "2*x + 5 = 15"
        let eq = currentEq.toLowerCase();
        if(eq.includes('=')) {
            let sides = eq.split('=');
            let f = (x) => math.evaluate(sides[0], {x:x}) - math.evaluate(sides[1], {x:x});
            let m = f(1) - f(0);
            let res = `x = ${-f(0)/m}`;
            updateDisplay(res, currentEq);
            saveHist(currentEq, res);
            currentEq = "";
        } else {
            // Simplify expression
            let res = math.simplify(eq).toString();
            updateDisplay(res, currentEq + " (Simplified)");
            saveHist(currentEq, res);
            currentEq = "";
        }
    } catch(e) { updateDisplay("Syntax Error", currentEq); currentEq=""; }
}

function solveTrig() {
    try {
        // e.g. "sin(45 deg)" or "cos(pi/2)"
        let parseEq = currentEq.replace(/deg/g, ' deg');
        let res = math.evaluate(parseEq);
        res = Math.round(res * 100000) / 100000; // Round float errors
        updateDisplay(res, currentEq + " =");
        saveHist(currentEq, res);
        currentEq = res.toString();
    } catch(e) { updateDisplay("Error", currentEq); currentEq=""; }
}

function solveCalculus() {
    try {
        // Derivative detection e.g. "d/dx(x^2)"
        if(currentEq.startsWith('d/dx(')) {
            let expr = currentEq.slice(5, -1);
            let res = math.derivative(expr, 'x').toString();
            updateDisplay(res, `d/dx [ ${expr} ] =`);
            saveHist(currentEq, res);
            currentEq = "";
        } else {
            // Treat as normal evaluate if not derivative
            let res = math.evaluate(currentEq);
            updateDisplay(res, currentEq + " =");
            currentEq = res.toString();
        }
    } catch(e) { updateDisplay("Calculus Error", currentEq); currentEq=""; }
}

// --- History Sync ---
async function saveHist(eq, res) {
    if(!currentUser) return;
    await addDoc(collection(db, `users/${currentUser.uid}/calculatorHistory`), { eq: eq, res: res, time: serverTimestamp() });
}
function loadHistory() {
    if(!currentUser) return;
    onSnapshot(query(collection(db, `users/${currentUser.uid}/calculatorHistory`), orderBy("time", "desc")), (snap) => {
        const list = document.getElementById('history-list');
        list.innerHTML = "";
        snap.forEach(d => {
            list.innerHTML += `<li class="history-item"><div class="eq">${d.data().eq}</div><div class="res">${d.data().res}</div></li>`;
        });
    });
}
document.getElementById('btn-clear-history').onclick = async () => {
    const snap = await getDocs(collection(db, `users/${currentUser.uid}/calculatorHistory`));
    snap.forEach(async (d) => await deleteDoc(d.ref));
};

// --- Keyboard Support ---
window.addEventListener('keydown', (e) => {
    const valid = '0123456789.+-*/()xy';
    if(valid.includes(e.key)) { e.preventDefault(); currentEq += e.key; updateDisplay(currentEq); }
    if(e.key === 'Backspace') { e.preventDefault(); currentEq = currentEq.slice(0,-1); updateDisplay(currentEq); }
    if(e.key === 'Enter') { 
        e.preventDefault(); 
        if(currentMode==='scientific') solveScientific();
        else if(currentMode==='algebra') solveAlgebra();
        else if(currentMode==='trigonometry') solveTrig();
        else if(currentMode==='calculus') solveCalculus();
    }
});

// Basic setups for the remaining forms
document.getElementById('ag-d').valueAsDate = new Date();
