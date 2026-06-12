import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- THEME SYNC ---
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
}

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

// --- Tab Controller ---
const tabs = ['scientific', 'algebra', 'trigonometry', 'calculus', 'graphing', 'financial', 'currency', 'unit', 'age', 'bmi', 'discount', 'data'];
tabs.forEach(t => {
    document.getElementById(`tab-${t}`).onclick = () => {
        tabs.forEach(x => {
            document.getElementById(`tab-${x}`).className = 'tab-btn';
            document.getElementById(`module-${x}`).style.display = 'none';
        });
        
        const btn = document.getElementById(`tab-${t}`);
        currentMode = t;
        
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

if(document.getElementById('ag-t')) document.getElementById('ag-t').valueAsDate = new Date();

// --- Universal Input Handler ---
function updateDisplay(txt, sub="") {
    dMain.innerText = txt;
    dHist.innerText = sub;
}

document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.onclick = () => {
        let val = btn.getAttribute('data-val');
        if(!val) return;
        
        if(val === 'AC') { currentEq = ""; updateDisplay(""); return; }
        if(val === 'DEL') { currentEq = currentEq.slice(0, -1); updateDisplay(currentEq); return; }
        
        if(val === '=') return solveScientific();
        if(val === 'SOLVE_ALG') return solveAlgebra();
        if(val === 'SOLVE_TRIG') return solveTrig();
        if(val === 'SOLVE_CALC') return solveCalculus();

        currentEq += val;
        updateDisplay(currentEq);
    };
});

// --- Solving Engines (Powered by Math.js) ---
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
            let res = math.simplify(eq).toString();
            updateDisplay(res, currentEq + " (Simplified)");
            saveHist(currentEq, res);
            currentEq = "";
        }
    } catch(e) { updateDisplay("Syntax Error", currentEq); currentEq=""; }
}

function solveTrig() {
    try {
        let parseEq = currentEq.replace(/deg/g, ' deg');
        let res = math.evaluate(parseEq);
        res = Math.round(res * 100000) / 100000;
        updateDisplay(res, currentEq + " =");
        saveHist(currentEq, res);
        currentEq = res.toString();
    } catch(e) { updateDisplay("Error", currentEq); currentEq=""; }
}

function solveCalculus() {
    try {
        if(currentEq.startsWith('d/dx(')) {
            let expr = currentEq.slice(5, -1);
            let res = math.derivative(expr, 'x').toString();
            updateDisplay(res, `d/dx [ ${expr} ] =`);
            saveHist(currentEq, res);
            currentEq = "";
        } else {
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
    if(!confirm("Clear History?")) return;
    const snap = await getDocs(collection(db, `users/${currentUser.uid}/calculatorHistory`));
    snap.forEach(async (d) => await deleteDoc(d.ref));
};

// --- Keyboard Support ---
window.addEventListener('keydown', (e) => {
    const valid = '0123456789.+-*/()xy=';
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

// --- Forms Logic ---
if(document.getElementById('btn-plot')) document.getElementById('btn-plot').onclick = () => {
    const canvas = document.getElementById('graph-canvas'); const ctx = canvas.getContext('2d');
    const xMin = parseFloat(document.getElementById('g-min').value); const xMax = parseFloat(document.getElementById('g-max').value);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const scaleX = canvas.width/(xMax-xMin); const scaleY = canvas.height/20;
    const originX = -xMin*scaleX; const originY = canvas.height/2;
    ctx.beginPath(); ctx.strokeStyle="#ddd"; ctx.moveTo(0,originY); ctx.lineTo(canvas.width,originY); ctx.moveTo(originX,0); ctx.lineTo(originX,canvas.height); ctx.stroke();
    let eq = document.getElementById('g-eq').value.replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos');
    ctx.beginPath(); ctx.strokeStyle="#128C7E"; ctx.lineWidth=2;
    for(let px=0; px<canvas.width; px++) {
        let x = xMin + (px/scaleX); let y = eval(eq); let py = originY - (y*scaleY);
        if(px===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    }
    ctx.stroke();
};

if(document.getElementById('fin-btn')) document.getElementById('fin-btn').onclick = () => {
    let p = parseFloat(document.getElementById('fin-p').value), r = parseFloat(document.getElementById('fin-r').value), y = parseFloat(document.getElementById('fin-y').value);
    let t = document.getElementById('fin-t').value;
    if(t==='emi') document.getElementById('fin-res').innerText = `EMI: ₹${((p*(r/1200)*Math.pow(1+(r/1200),y*12))/(Math.pow(1+(r/1200),y*12)-1)).toFixed(2)}`;
    else document.getElementById('fin-res').innerText = `Total: ₹${(p*Math.pow(1+(r/100),y)).toFixed(2)}`;
};

if(document.getElementById('cur-btn')) document.getElementById('cur-btn').onclick = async () => {
    let amt = parseFloat(document.getElementById('cur-v').value);
    let f = document.getElementById('cur-f').value, t = document.getElementById('cur-t').value;
    document.getElementById('cur-res').innerText = "Loading...";
    let req = await fetch(`https://api.exchangerate-api.com/v4/latest/${f}`); let data = await req.json();
    document.getElementById('cur-res').innerText = `${amt} ${f} = ${(amt * data.rates[t]).toFixed(2)} ${t}`;
};

if(document.getElementById('un-btn')) document.getElementById('un-btn').onclick = () => {
    let v = parseFloat(document.getElementById('un-v').value), c = document.getElementById('un-c').value;
    if(c==='l') document.getElementById('un-res').innerText = `${v}m = ${(v*3.28).toFixed(2)}ft`;
    if(c==='w') document.getElementById('un-res').innerText = `${v}kg = ${(v*2.204).toFixed(2)}lbs`;
    if(c==='t') document.getElementById('un-res').innerText = `${v}°C = ${((v*9/5)+32).toFixed(2)}°F`;
};

if(document.getElementById('ag-btn')) document.getElementById('ag-btn').onclick = () => {
    let d1 = new Date(document.getElementById('ag-d').value), d2 = new Date(document.getElementById('ag-t').value);
    let y = d2.getFullYear()-d1.getFullYear(); document.getElementById('ag-res').innerText = `Age: ${y} Years`;
};

if(document.getElementById('bm-btn')) document.getElementById('bm-btn').onclick = () => {
    let h = parseFloat(document.getElementById('bm-h').value)/100, w = parseFloat(document.getElementById('bm-w').value);
    let bmi = (w/(h*h)).toFixed(1); document.getElementById('bm-res').innerText = `BMI: ${bmi}`;
};

if(document.getElementById('di-btn')) document.getElementById('di-btn').onclick = () => {
    let p = parseFloat(document.getElementById('di-p').value), d = parseFloat(document.getElementById('di-d').value);
    document.getElementById('di-res').innerText = `Final Price: ₹${(p - (p*(d/100))).toFixed(2)}`;
};

if(document.getElementById('da-btn')) document.getElementById('da-btn').onclick = () => {
    let v = parseFloat(document.getElementById('da-v').value), f = document.getElementById('da-f').value, t = document.getElementById('da-t').value;
    let m = {'MB':1, 'GB':1024, 'TB':1048576}; document.getElementById('da-res').innerText = `${v} ${f} = ${(v * m[f]/m[t])} ${t}`;
};
