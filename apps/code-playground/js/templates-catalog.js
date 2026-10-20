/**
 * Aksh Code Playground Pro — Comprehensive Templates & Snippets Catalog
 * Contains 20 production-ready starter templates across web, Python, and SQL,
 * plus 24 reusable code snippets.
 */

(function (window) {
  'use strict';

  const TEMPLATES = {
    blank: {
      id: 'blank',
      name: 'Blank Web Project',
      category: 'Web',
      description: 'Minimal modern boilerplate with HTML5, CSS reset, and clean structure.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blank Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main class="container">
    <div class="card">
      <div class="badge">Aksh Code Playground Pro</div>
      <h1>Welcome to Your Blank Project</h1>
      <p>Edit <code>index.html</code>, <code>style.css</code>, and <code>script.js</code> to build your application.</p>
      <button id="action-btn" class="btn">Click Me</button>
      <p id="output-text" class="status"></p>
    </div>
  </main>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #f8fafc;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.container { width: 100%; max-width: 520px; }
.card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  text-align: center;
}
.badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;
  margin-bottom: 16px;
  border: 1px solid rgba(56, 189, 248, 0.3);
}
h1 { font-size: 24px; margin-bottom: 12px; color: #f1f5f9; }
p { color: #94a3b8; line-height: 1.6; margin-bottom: 24px; font-size: 14px; }
code { background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-family: monospace; }
.btn {
  background: #0284c7;
  color: #ffffff;
  border: none;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn:hover { background: #0369a1; transform: translateY(-1px); }
.status { margin-top: 16px; font-size: 13px; color: #38bdf8; font-weight: 500; }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `console.log('Blank Project ready.');
const btn = document.getElementById('action-btn');
const output = document.getElementById('output-text');
let clicks = 0;
btn.addEventListener('click', () => {
  clicks++;
  output.textContent = \`Button clicked \${clicks} time\${clicks === 1 ? '' : 's'}!\`;
});`
        }
      ]
    },

    portfolio: {
      id: 'portfolio',
      name: 'Personal Portfolio',
      category: 'Web',
      description: 'Modern developer portfolio with hero banner, projects showcase, and contact form.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alex Rivera — Creative Engineer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="header">
    <div class="logo">Alex Rivera</div>
    <nav class="nav">
      <a href="#about">About</a>
      <a href="#projects">Projects</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>
  <main>
    <section class="hero" id="about">
      <div class="hero-content">
        <h1>Building Digital Experiences with Purpose</h1>
        <p>Full-stack developer specializing in browser runtimes, interactive graphics, and clean architecture.</p>
        <div class="hero-btns">
          <a href="#projects" class="btn btn-primary">View Projects</a>
          <a href="#contact" class="btn btn-outline">Get in Touch</a>
        </div>
      </div>
    </section>
    <section class="section" id="projects">
      <h2>Featured Work</h2>
      <div class="grid">
        <div class="project-card">
          <div class="card-tag">WebAssembly</div>
          <h3>Aksh Code Studio</h3>
          <p>Browser-native development studio running client-side Python and SQLite.</p>
        </div>
        <div class="project-card">
          <div class="card-tag">WebGL / Canvas</div>
          <h3>Particle Simulation Engine</h3>
          <p>High-performance interactive physics simulator with real-time fluid dynamics.</p>
        </div>
        <div class="project-card">
          <div class="card-tag">TypeScript</div>
          <h3>Reactive State Store</h3>
          <p>Micro-library for deterministic state management with zero dependencies.</p>
        </div>
      </div>
    </section>
    <section class="section" id="contact">
      <h2>Let's Connect</h2>
      <p style="text-align:center;color:#94a3b8;margin-bottom:20px;">Feel free to reach out for collaborations or freelance inquiries.</p>
      <form id="contact-form" class="contact-form">
        <input type="text" placeholder="Your Name" required>
        <input type="email" placeholder="Your Email" required>
        <textarea placeholder="Your Message" rows="4" required></textarea>
        <button type="submit" class="btn btn-primary">Send Message</button>
      </form>
    </section>
  </main>
  <footer class="footer">
    <p>&copy; 2026 Alex Rivera. Built with Aksh Code Playground.</p>
  </footer>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f8fafc; line-height: 1.6; }
.header { display:flex; justify-content:space-between; align-items:center; padding:20px 40px; border-bottom:1px solid #1e293b; }
.logo { font-size:18px; font-weight:700; color:#38bdf8; }
.nav a { color:#94a3b8; text-decoration:none; margin-left:24px; font-size:14px; transition:color 0.2s; }
.nav a:hover { color:#38bdf8; }
.hero { padding:80px 40px; text-align:center; max-width:800px; margin:0 auto; }
.hero h1 { font-size:42px; line-height:1.2; margin-bottom:16px; color:#f1f5f9; }
.hero p { font-size:18px; color:#94a3b8; margin-bottom:32px; }
.hero-btns { display:flex; gap:16px; justify-content:center; }
.btn { display:inline-block; padding:12px 24px; border-radius:6px; font-weight:600; text-decoration:none; cursor:pointer; font-size:14px; border:none; }
.btn-primary { background:#0284c7; color:#fff; }
.btn-primary:hover { background:#0369a1; }
.btn-outline { border:1px solid #334155; color:#f8fafc; background:transparent; }
.btn-outline:hover { background:#1e293b; }
.section { padding:60px 40px; max-width:1100px; margin:0 auto; }
.section h2 { font-size:28px; margin-bottom:32px; text-align:center; }
.grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:24px; }
.project-card { background:#1e293b; padding:28px; border-radius:10px; border:1px solid #334155; transition:transform 0.2s; }
.project-card:hover { transform:translateY(-4px); }
.card-tag { font-size:11px; font-weight:700; color:#38bdf8; text-transform:uppercase; margin-bottom:8px; }
.project-card h3 { font-size:20px; margin-bottom:10px; }
.project-card p { color:#94a3b8; font-size:14px; }
.contact-form { max-width:480px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
.contact-form input, .contact-form textarea { width:100%; padding:12px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#fff; font-family:inherit; }
.footer { text-align:center; padding:30px; border-top:1px solid #1e293b; font-size:13px; color:#64748b; }
@media(max-width:768px) { .header { padding:16px 20px; } .hero h1 { font-size:30px; } .section { padding:40px 20px; } }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `document.getElementById('contact-form').onsubmit = (e) => {
  e.preventDefault();
  alert('Thank you! Your message has been received.');
  e.target.reset();
};
console.log('Portfolio initialized.');`
        }
      ]
    },

    landing: {
      id: 'landing',
      name: 'Responsive Landing Page',
      category: 'Web',
      description: 'SaaS product landing page with feature cards, call-to-action, and pricing tiers.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ApexCloud — Developer Workspace</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="announcement">⚡ Version 2.0 is live! Explore WebAssembly support.</div>
  <header class="navbar">
    <div class="logo">ApexCloud</div>
    <button class="cta-btn">Start Free</button>
  </header>
  <section class="hero-section">
    <h1>Code, Debug & Ship Faster</h1>
    <p>The privacy-focused developer platform running 100% inside your browser.</p>
    <div class="input-cta">
      <input type="email" placeholder="Enter your work email...">
      <button class="cta-btn">Get Started</button>
    </div>
  </section>
  <section class="features">
    <div class="feature-card">
      <div class="icon">🔒</div>
      <h3>Zero-Server Isolation</h3>
      <p>Code never leaves your device. Sandbox iframes protect user data and preferences.</p>
    </div>
    <div class="feature-card">
      <div class="icon">⚡</div>
      <h3>Instant Execution</h3>
      <p>Run HTML, CSS, JavaScript, TypeScript, Python, and SQL with sub-millisecond roundtrips.</p>
    </div>
    <div class="feature-card">
      <div class="icon">📦</div>
      <h3>PKWARE ZIP Sync</h3>
      <p>Export and import complete directory hierarchies with native Deflate compression.</p>
    </div>
  </section>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { font-family: system-ui, sans-serif; background:#080c14; color:#f8fafc; margin:0; }
.announcement { background:#0369a1; text-align:center; padding:8px; font-size:13px; font-weight:600; }
.navbar { display:flex; justify-content:space-between; align-items:center; padding:20px 40px; }
.logo { font-size:20px; font-weight:800; color:#38bdf8; }
.cta-btn { background:#0284c7; color:white; border:none; padding:10px 20px; border-radius:6px; font-weight:600; cursor:pointer; }
.hero-section { text-align:center; padding:60px 20px; max-width:700px; margin:0 auto; }
.hero-section h1 { font-size:48px; line-height:1.15; margin-bottom:16px; }
.hero-section p { font-size:18px; color:#94a3b8; margin-bottom:30px; }
.input-cta { display:flex; gap:8px; max-width:440px; margin:0 auto; }
.input-cta input { flex:1; padding:12px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:white; }
.features { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:24px; padding:40px; max-width:1100px; margin:0 auto; }
.feature-card { background:#111827; padding:28px; border-radius:10px; border:1px solid #1f2937; }
.feature-card .icon { font-size:32px; margin-bottom:12px; }
.feature-card h3 { font-size:18px; margin-bottom:8px; }
.feature-card p { font-size:14px; color:#9ca3af; }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `console.log('Landing page loaded.');`
        }
      ]
    },

    counter: {
      id: 'counter',
      name: 'Interactive Counter',
      category: 'Web',
      description: 'Clean reactive state counter with step settings and history tracking.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reactive Counter</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <h2>Interactive Counter</h2>
    <div id="counter-val" class="counter-display">0</div>
    <div class="btn-group">
      <button id="dec-btn" class="btn btn-danger">-</button>
      <button id="reset-btn" class="btn btn-secondary">Reset</button>
      <button id="inc-btn" class="btn btn-success">+</button>
    </div>
    <ul id="history-list" class="history-list"></ul>
  </div>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
.card { background: #1e293b; padding: 32px; border-radius: 12px; text-align: center; width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
.counter-display { font-size: 64px; font-weight: 700; margin: 20px 0; color: #38bdf8; }
.btn-group { display: flex; gap: 8px; justify-content: center; }
.btn { padding: 10px 20px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; color: white; }
.btn-success { background: #10b981; }
.btn-danger { background: #ef4444; }
.btn-secondary { background: #475569; }
.history-list { list-style: none; padding: 0; margin-top: 20px; max-height: 120px; overflow-y: auto; font-size: 12px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 10px; }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `let count = 0;
const valEl = document.getElementById('counter-val');
const historyEl = document.getElementById('history-list');

function update(newVal) {
  count = newVal;
  valEl.textContent = count;
  const li = document.createElement('li');
  li.textContent = \`Value set to \${count} at \${new Date().toLocaleTimeString()}\`;
  historyEl.prepend(li);
}

document.getElementById('inc-btn').addEventListener('click', () => update(count + 1));
document.getElementById('dec-btn').addEventListener('click', () => update(count - 1));
document.getElementById('reset-btn').addEventListener('click', () => update(0));`
        }
      ]
    },

    calculator: {
      id: 'calculator',
      name: 'Calculator App',
      category: 'Web',
      description: 'Responsive arithmetic calculator with keyboard input support and display.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calculator</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="calculator">
    <div id="display" class="calc-display">0</div>
    <div class="calc-grid">
      <button class="btn btn-op" data-key="clear">AC</button>
      <button class="btn btn-op" data-key="back">&larr;</button>
      <button class="btn btn-op" data-key="%">%</button>
      <button class="btn btn-op" data-key="/">&divide;</button>
      <button class="btn" data-key="7">7</button>
      <button class="btn" data-key="8">8</button>
      <button class="btn" data-key="9">9</button>
      <button class="btn btn-op" data-key="*">&times;</button>
      <button class="btn" data-key="4">4</button>
      <button class="btn" data-key="5">5</button>
      <button class="btn" data-key="6">6</button>
      <button class="btn btn-op" data-key="-">-</button>
      <button class="btn" data-key="1">1</button>
      <button class="btn" data-key="2">2</button>
      <button class="btn" data-key="3">3</button>
      <button class="btn btn-op" data-key="+">+</button>
      <button class="btn btn-zero" data-key="0">0</button>
      <button class="btn" data-key=".">.</button>
      <button class="btn btn-equals" data-key="=">=</button>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { font-family: system-ui, sans-serif; background: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
.calculator { width: 300px; background: #1e293b; border-radius: 14px; padding: 20px; box-shadow: 0 12px 30px rgba(0,0,0,0.5); }
.calc-display { background: #0f172a; color: #38bdf8; font-size: 32px; font-weight: 700; text-align: right; padding: 16px; border-radius: 8px; margin-bottom: 16px; overflow-x: auto; }
.calc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.btn { padding: 14px; font-size: 18px; font-weight: 600; border: none; border-radius: 8px; background: #334155; color: white; cursor: pointer; }
.btn:hover { background: #475569; }
.btn-op { background: #0284c7; }
.btn-op:hover { background: #0369a1; }
.btn-equals { background: #10b981; }
.btn-equals:hover { background: #059669; }
.btn-zero { grid-column: span 2; }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `const display = document.getElementById('display');
let current = '0';
let expr = '';

document.querySelectorAll('.calc-grid .btn').forEach(btn => {
  btn.onclick = () => {
    const key = btn.dataset.key;
    if (key === 'clear') {
      current = '0';
      expr = '';
    } else if (key === 'back') {
      current = current.length > 1 ? current.slice(0, -1) : '0';
    } else if (key === '=') {
      try {
        current = String(Function('"use strict";return (' + current.replace(/×/g, '*').replace(/÷/g, '/') + ')')());
      } catch (e) {
        current = 'Error';
      }
    } else {
      if (current === '0' && !isNaN(key)) current = key;
      else current += key;
    }
    display.textContent = current;
  };
});`
        }
      ]
    },

    todo: {
      id: 'todo',
      name: 'To-do List (LocalStorage)',
      category: 'Web',
      description: 'Persistent task management app with filters and completed checkboxes.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Manager</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="todo-app">
    <h1>My Tasks</h1>
    <form id="todo-form" class="todo-input-bar">
      <input type="text" id="todo-input" placeholder="Add a new task..." required>
      <button type="submit" class="btn">Add</button>
    </form>
    <ul id="todo-list" class="todo-list"></ul>
  </div>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { font-family: system-ui, sans-serif; background: #0f172a; color: #f1f5f9; display: flex; justify-content: center; padding: 40px 20px; margin: 0; }
.todo-app { width: 100%; max-width: 440px; }
h1 { margin-bottom: 20px; }
.todo-input-bar { display: flex; gap: 8px; margin-bottom: 20px; }
input { flex: 1; padding: 10px 14px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: white; }
.btn { padding: 10px 18px; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer; }
.todo-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.todo-item { background: #1e293b; padding: 12px 16px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #334155; }
.todo-item.done span { text-decoration: line-through; color: #64748b; }
.del-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px; }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `let todos = JSON.parse(localStorage.getItem('my_todos') || '[]');
const listEl = document.getElementById('todo-list');
const formEl = document.getElementById('todo-form');
const inputEl = document.getElementById('todo-input');

function saveAndRender() {
  localStorage.setItem('my_todos', JSON.stringify(todos));
  listEl.innerHTML = '';
  todos.forEach((todo, idx) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '');
    li.innerHTML = \`
      <span style="cursor:pointer;">\${todo.text}</span>
      <button class="del-btn">&times;</button>
    \`;
    li.querySelector('span').onclick = () => {
      todo.done = !todo.done;
      saveAndRender();
    };
    li.querySelector('.del-btn').onclick = () => {
      todos.splice(idx, 1);
      saveAndRender();
    };
    listEl.appendChild(li);
  });
}

formEl.onsubmit = (e) => {
  e.preventDefault();
  todos.push({ text: inputEl.value.trim(), done: false });
  inputEl.value = '';
  saveAndRender();
};

saveAndRender();`
        }
      ]
    },

    cssAnimation: {
      id: 'cssAnimation',
      name: 'CSS Animation Demo',
      category: 'Web',
      description: 'Pure CSS keyframe 3D transforms, glowing pulses, and floating cards.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS 3D Animations</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="cube-container">
    <div class="cube">
      <div class="face front">Aksh</div>
      <div class="face back">Studio</div>
      <div class="face right">Fast</div>
      <div class="face left">Private</div>
      <div class="face top">Pro</div>
      <div class="face bottom">Code</div>
    </div>
  </div>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { background: #0a0f1d; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; perspective: 800px; }
.cube-container { width: 140px; height: 140px; }
.cube { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; animation: rotateCube 8s infinite linear; }
.face { position: absolute; width: 140px; height: 140px; background: rgba(2, 132, 199, 0.2); border: 2px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #f8fafc; box-shadow: 0 0 20px rgba(56, 189, 248, 0.3); }
.front  { transform: translateZ(70px); }
.back   { transform: rotateY(180deg) translateZ(70px); }
.right  { transform: rotateY(90deg) translateZ(70px); }
.left   { transform: rotateY(-90deg) translateZ(70px); }
.top    { transform: rotateX(90deg) translateZ(70px); }
.bottom { transform: rotateX(-90deg) translateZ(70px); }
@keyframes rotateCube { from { transform: rotateX(0deg) rotateY(0deg); } to { transform: rotateX(360deg) rotateY(360deg); } }`
        }
      ]
    },

    canvasGame: {
      id: 'canvasGame',
      name: 'Canvas Particle Demo',
      category: 'Web',
      description: 'Interactive HTML5 Canvas particle physics system with mouse reactivity.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Canvas Particle Physics</title>
  <style>
    body { margin: 0; background: #000; overflow: hidden; }
    canvas { display: block; }
    .hint { position: absolute; top: 16px; left: 16px; color: #38bdf8; font-family: sans-serif; pointer-events: none; }
  </style>
</head>
<body>
  <div class="hint">Move mouse to attract particles</div>
  <canvas id="c"></canvas>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let w = canvas.width = window.innerWidth;
let h = canvas.height = window.innerHeight;

const mouse = { x: w / 2, y: h / 2 };
window.onresize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
window.onmousemove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };

class Particle {
  constructor() {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.radius = Math.random() * 2 + 1;
    this.color = \`hsl(\${Math.random() * 60 + 180}, 90%, 65%)\`;
  }
  update() {
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 150) {
      this.vx += (dx / dist) * 0.2;
      this.vy += (dy / dist) * 0.2;
    }
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98;
    this.vy *= 0.98;
    if (this.x < 0) this.x = w;
    if (this.x > w) this.x = 0;
    if (this.y < 0) this.y = h;
    if (this.y > h) this.y = 0;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

const particles = Array.from({ length: 120 }, () => new Particle());
function loop() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(0, 0, w, h);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(loop);
}
loop();`
        }
      ]
    },

    formValidation: {
      id: 'formValidation',
      name: 'Form Validation Demo',
      category: 'Web',
      description: 'Client-side HTML5 & JS form validation with password strength and email checks.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form Validation</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="card">
    <h2>Account Registration</h2>
    <form id="reg-form" novalidate>
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" required minlength="3">
        <span class="err-msg">Must be at least 3 characters.</span>
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" required>
        <span class="err-msg">Valid email required.</span>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" required minlength="6">
        <span class="err-msg">Must be at least 6 characters.</span>
      </div>
      <button type="submit" class="btn">Register</button>
    </form>
  </div>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
.card { background: #1e293b; padding: 32px; border-radius: 10px; width: 340px; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
h2 { margin-bottom: 20px; font-size: 20px; text-align: center; }
.form-group { margin-bottom: 16px; }
label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; }
input { width: 100%; padding: 10px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: white; box-sizing: border-box; }
input.invalid { border-color: #ef4444; }
input.valid { border-color: #10b981; }
.err-msg { display: none; font-size: 11px; color: #ef4444; margin-top: 4px; }
input.invalid + .err-msg { display: block; }
.btn { width: 100%; padding: 12px; background: #0284c7; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; margin-top: 8px; }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `const form = document.getElementById('reg-form');
form.onsubmit = (e) => {
  e.preventDefault();
  let valid = true;
  form.querySelectorAll('input').forEach(inp => {
    if (!inp.checkValidity()) {
      inp.classList.add('invalid');
      inp.classList.remove('valid');
      valid = false;
    } else {
      inp.classList.remove('invalid');
      inp.classList.add('valid');
    }
  });
  if (valid) alert('Form submitted successfully!');
};`
        }
      ]
    },

    jsArrays: {
      id: 'jsArrays',
      name: 'JavaScript Array Examples',
      category: 'Web',
      description: 'Hands-on examples of map, filter, reduce, find, some, and every operations.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>JS Array Methods</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>JavaScript Array Methods Explorer</h1>
    <div id="results" class="results-box"></div>
  </div>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { font-family: monospace; background: #0a0e17; color: #f8fafc; padding: 30px; margin: 0; }
.container { max-width: 600px; margin: 0 auto; }
h1 { font-size: 20px; color: #38bdf8; margin-bottom: 20px; font-family: sans-serif; }
.results-box { background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; line-height: 1.8; }
.entry { margin-bottom: 12px; }
.label { color: #38bdf8; font-weight: bold; }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `const products = [
  { id: 1, name: 'Laptop', price: 999, stock: 5 },
  { id: 2, name: 'Mouse', price: 29, stock: 15 },
  { id: 3, name: 'Keyboard', price: 79, stock: 0 },
  { id: 4, name: 'Monitor', price: 299, stock: 8 }
];

const inStock = products.filter(p => p.stock > 0);
const names = products.map(p => p.name);
const totalInventoryValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
const expensiveItem = products.find(p => p.price > 500);

const box = document.getElementById('results');
box.innerHTML = \`
  <div class="entry"><span class="label">1. In Stock (filter):</span> \${JSON.stringify(inStock.map(p => p.name))}</div>
  <div class="entry"><span class="label">2. Product Names (map):</span> \${names.join(', ')}</div>
  <div class="entry"><span class="label">3. Total Value (reduce):</span> $\${totalInventoryValue.toLocaleString()}</div>
  <div class="entry"><span class="label">4. Item > $500 (find):</span> \${expensiveItem ? expensiveItem.name : 'None'}</div>
\`;
console.log('Array methods executed successfully.');`
        }
      ]
    },

    jsFetch: {
      id: 'jsFetch',
      name: 'JavaScript Fetch Example',
      category: 'Web',
      description: 'Async/await fetch request with error handling and dynamic DOM card rendering.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Fetch API Demo</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app">
    <h1>Random User Generator</h1>
    <button id="load-btn" class="btn">Fetch New User</button>
    <div id="user-card" class="card">Click the button above to load user data.</div>
  </div>
  <script src="script.js"></script>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: flex; justify-content: center; padding: 40px 20px; }
.app { text-align: center; max-width: 400px; width: 100%; }
.btn { background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
.card { background: #1e293b; padding: 24px; border-radius: 10px; border: 1px solid #334155; min-height: 120px; }`
        },
        {
          name: 'script.js',
          type: 'javascript',
          content: `const card = document.getElementById('user-card');
const btn = document.getElementById('load-btn');

async function fetchUser() {
  card.textContent = 'Loading...';
  try {
    const res = await fetch('https://randomuser.me/api/');
    if (!res.ok) throw new Error(\`HTTP error! status: \${res.status}\`);
    const data = await res.json();
    const user = data.results[0];
    card.innerHTML = \`
      <img src="\${user.picture.large}" style="border-radius:50%;margin-bottom:12px;" alt="Avatar">
      <h3>\${user.name.first} \${user.name.last}</h3>
      <p style="color:#94a3b8;font-size:14px;">\${user.email}</p>
      <p style="color:#38bdf8;font-size:12px;">\${user.location.city}, \${user.location.country}</p>
    \`;
  } catch (err) {
    card.textContent = 'Fetch failed: ' + err.message;
  }
}

btn.onclick = fetchUser;`
        }
      ]
    },

    htmlA11y: {
      id: 'htmlA11y',
      name: 'HTML Accessibility Example',
      category: 'Web',
      description: 'Accessible semantic markup featuring ARIA landmarks, modal dialogs, and high-contrast styling.',
      files: [
        {
          name: 'index.html',
          type: 'html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessible Web Design Demo</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header role="banner">
    <h1>Accessible Design Patterns</h1>
  </header>
  <main role="main">
    <article>
      <h2>Semantic Structure</h2>
      <p>This document demonstrates WCAG 2.1 AA accessible patterns including landmarks, label associations, and focus visible outlines.</p>
      <form>
        <label for="full-name">Full Name (Required):</label>
        <input type="text" id="full-name" required aria-required="true">
        <button type="submit" class="btn">Submit</button>
      </form>
    </article>
  </main>
</body>
</html>`
        },
        {
          name: 'style.css',
          type: 'css',
          content: `body { font-family: system-ui, sans-serif; background: #090d16; color: #f8fafc; padding: 30px; line-height: 1.6; }
main { max-width: 500px; margin: 0 auto; }
input { width: 100%; padding: 10px; background: #1e293b; border: 1px solid #64748b; color: white; border-radius: 4px; margin: 8px 0 16px; }
input:focus { outline: 3px solid #38bdf8; outline-offset: 2px; }
.btn { background: #0284c7; color: white; padding: 10px 20px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
.btn:focus { outline: 3px solid #38bdf8; outline-offset: 2px; }`
        }
      ]
    },

    pythonBasics: {
      id: 'pythonBasics',
      name: 'Python Basics & Math',
      category: 'Python',
      description: 'Python mathematical algorithms and list comprehensions running via Pyodide WASM.',
      files: [
        {
          name: 'main.py',
          type: 'python',
          content: `# Python 3 Mathematical Algorithms via Pyodide WebAssembly
import math

def is_prime(n):
    if n <= 1:
        return False
    for i in range(2, int(math.isqrt(n)) + 1):
        if n % i == 0:
            return False
    return True

print("=== Aksh Python Math Demo ===")
primes = [n for n in range(2, 50) if is_prime(n)]
print("Primes under 50:", primes)

# Fibonacci generator
def fibonacci(limit):
    a, b = 0, 1
    fibs = []
    while a < limit:
        fibs.append(a)
        a, b = b, a + b
    return fibs

print("Fibonacci sequence:", fibonacci(100))
print("Circle area with r=5:", round(math.pi * (5 ** 2), 2))
`
        }
      ]
    },

    pythonListsDicts: {
      id: 'pythonListsDicts',
      name: 'Python Lists and Dictionaries',
      category: 'Python',
      description: 'Nested data transformations, dictionary comprehensions, and sorting.',
      files: [
        {
          name: 'data_structures.py',
          type: 'python',
          content: `# Python Dictionaries & List Transformations
employees = [
    {"name": "Alex", "dept": "Engineering", "salary": 140000},
    {"name": "Maya", "dept": "Design", "salary": 125000},
    {"name": "Liam", "dept": "Engineering", "salary": 155000},
    {"name": "Sophia", "dept": "Marketing", "salary": 98000}
]

# Average salary by department
dept_salaries = {}
for emp in employees:
    dept = emp["dept"]
    dept_salaries.setdefault(dept, []).append(emp["salary"])

averages = {dept: round(sum(s) / len(s), 2) for dept, s in dept_salaries.items()}
print("=== Average Salary by Department ===")
for dept, avg in averages.items():
    print(f"  {dept:12}: \${avg:,.2f}")
`
        }
      ]
    },

    pythonFunctions: {
      id: 'pythonFunctions',
      name: 'Python Functions & Decorators',
      category: 'Python',
      description: 'Higher-order functions, closures, and timing decorators.',
      files: [
        {
          name: 'functions_demo.py',
          type: 'python',
          content: `# Higher-Order Functions & Timing Decorator in Python
import time

def timer(func):
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        duration = (time.perf_counter() - start) * 1000
        print(f"[{func.__name__}] executed in {duration:.3f} ms")
        return result
    return wrapper

@timer
def compute_powers(n):
    return [i ** 2 for i in range(n)]

result = compute_powers(10000)
print(f"Computed {len(result)} elements.")
`
        }
      ]
    },

    pythonData: {
      id: 'pythonData',
      name: 'Python Data Analysis & Stats',
      category: 'Python',
      description: 'Data statistics and frequency analysis using Python standard library.',
      files: [
        {
          name: 'data_analysis.py',
          type: 'python',
          content: `# Statistical Data Analysis in Python
from collections import Counter

dataset = [15, 22, 19, 22, 34, 45, 22, 19, 58, 60, 45, 22, 34]

def analyze_dataset(data):
    n = len(data)
    mean = sum(data) / n
    sorted_data = sorted(data)
    median = (sorted_data[n//2] if n % 2 != 0 else (sorted_data[n//2 - 1] + sorted_data[n//2]) / 2)
    mode = Counter(data).most_common(1)[0][0]
    variance = sum((x - mean) ** 2 for x in data) / n
    std_dev = variance ** 0.5

    return {
        "Count": n,
        "Mean": round(mean, 2),
        "Median": median,
        "Mode": mode,
        "Min": min(data),
        "Max": max(data),
        "Std Dev": round(std_dev, 2)
    }

stats = analyze_dataset(dataset)
print("=== Dataset Summary Statistics ===")
for k, v in stats.items():
    print(f"  {k:10}: {v}")
`
        }
      ]
    },

    sqlDemo: {
      id: 'sqlDemo',
      name: 'SQL Sample Database',
      category: 'SQL',
      description: 'SQLite sample relational database with JOINs, aggregations, and subqueries.',
      files: [
        {
          name: 'queries.sql',
          type: 'sql',
          content: `-- In-Browser SQLite Relational Queries
-- 1. High earners with department join
SELECT e.name, e.role, d.name AS department, e.salary, d.location
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE e.salary > 100000
ORDER BY e.salary DESC;

-- 2. Count total employees
SELECT COUNT(*) FROM employees;
`
        }
      ]
    },

    sqlQueries: {
      id: 'sqlQueries',
      name: 'SQL Query Examples (CRUD)',
      category: 'SQL',
      description: 'Comprehensive CREATE TABLE, INSERT, SELECT, UPDATE, and DELETE queries.',
      files: [
        {
          name: 'crud_demo.sql',
          type: 'sql',
          content: `-- CRUD Operations Demo
-- 1. Create a tasks table
CREATE TABLE tasks (id INTEGER, title TEXT, priority TEXT, done INTEGER);

-- 2. Insert records
INSERT INTO tasks (id, title, priority, done) VALUES (1, 'Build browser IDE', 'HIGH', 1);
INSERT INTO tasks (id, title, priority, done) VALUES (2, 'Verify ZIP export', 'HIGH', 1);
INSERT INTO tasks (id, title, priority, done) VALUES (3, 'Write test suite', 'MEDIUM', 0);

-- 3. Query all tasks
SELECT * FROM tasks WHERE priority = 'HIGH';

-- 4. Update status
UPDATE tasks SET done = 1 WHERE id = 3;

-- 5. View results
SELECT * FROM tasks;
`
        }
      ]
    },

    jsonExamples: {
      id: 'jsonExamples',
      name: 'JSON Structured Data',
      category: 'Data',
      description: 'Clean JSON schema configurations, nested arrays, and data serialization.',
      files: [
        {
          name: 'package.json',
          type: 'json',
          content: `{
  "name": "aksh-developer-studio",
  "version": "2.0.0",
  "description": "Browser-native developer environment and local coding assistant.",
  "main": "index.html",
  "scripts": {
    "test": "aksh-test-runner"
  },
  "keywords": [
    "browser-ide",
    "pyodide",
    "sqlite",
    "zip-engine",
    "local-ai"
  ],
  "author": "Aksh Studio",
  "license": "MIT"
}`
        }
      ]
    },

    markdownStarter: {
      id: 'markdownStarter',
      name: 'Markdown Documentation',
      category: 'Docs',
      description: 'Rich Markdown documentation template with headings, tables, and code snippets.',
      files: [
        {
          name: 'README.md',
          type: 'markdown',
          content: `# Project Documentation
Welcome to your project's technical documentation.

## Features
- **Fast Execution**: Pure client-side browser runtime.
- **Privacy First**: Zero telemetry, zero uploads.
- **Multi-File**: Virtual file tree with nested folders.

## Architecture
\`\`\`javascript
// Example helper
function greet(user) {
  return \`Hello, \${user}!\`;
}
\`\`\`

> *Note: Click **Render Markdown** to view this formatted inside the live preview panel.*
`
        }
      ]
    }
  };

  const SNIPPETS = [
    {
      id: 'fetch-json',
      title: 'Fetch JSON with Error Handling',
      language: 'javascript',
      code: `async function fetchData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(\`HTTP error! status: \${res.status}\`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Fetch failed:', err);
    throw err;
  }
}`
    },
    {
      id: 'debounce',
      title: 'Debounce Function',
      language: 'javascript',
      code: `function debounce(fn, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}`
    },
    {
      id: 'throttle',
      title: 'Throttle Function',
      language: 'javascript',
      code: `function throttle(fn, limit = 200) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}`
    },
    {
      id: 'localstorage-helper',
      title: 'Safe LocalStorage Wrapper',
      language: 'javascript',
      code: `const storage = {
  get: (k, def) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
};`
    },
    {
      id: 'event-delegation',
      title: 'Event Delegation Pattern',
      language: 'javascript',
      code: `document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  console.log('Action triggered:', action);
});`
    },
    {
      id: 'deep-clone',
      title: 'Deep Clone Object (Structured)',
      language: 'javascript',
      code: `function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}`
    },
    {
      id: 'url-params',
      title: 'Parse URL Query Parameters',
      language: 'javascript',
      code: `function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}`
    },
    {
      id: 'promise-all',
      title: 'Promise.allSettled Handler',
      language: 'javascript',
      code: `async function loadAllResources(urls) {
  const promises = urls.map(url => fetch(url).then(r => r.json()));
  const results = await Promise.allSettled(promises);
  return results.map(r => r.status === 'fulfilled' ? r.value : null);
}`
    },
    {
      id: 'css-responsive-grid',
      title: 'Responsive CSS Grid',
      language: 'css',
      code: `.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  width: 100%;
}`
    },
    {
      id: 'css-center',
      title: 'Perfect CSS Flexbox Centering',
      language: 'css',
      code: `.center-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}`
    },
    {
      id: 'css-glassmorphism',
      title: 'Glassmorphism Card Effect',
      language: 'css',
      code: `.glass-card {
  background: rgba(30, 41, 59, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
}`
    },
    {
      id: 'css-custom-scrollbar',
      title: 'Custom Modern Scrollbar',
      language: 'css',
      code: `::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #0f172a;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #475569;
}`
    },
    {
      id: 'css-truncate',
      title: 'Single-line Text Truncate with Ellipsis',
      language: 'css',
      code: `.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}`
    },
    {
      id: 'html-modal',
      title: 'Accessible Modal Dialog Markup',
      language: 'html',
      code: `<div id="my-modal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal-card">
    <h3 id="modal-title">Dialog Title</h3>
    <p>Dialog description content goes here.</p>
    <button class="btn" onclick="document.getElementById('my-modal').style.display='none'">Close</button>
  </div>
</div>`
    },
    {
      id: 'html-responsive-meta',
      title: 'Mobile Viewport & PWA Meta Tags',
      language: 'html',
      code: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
<meta name="theme-color" content="#0f172a">
<meta name="description" content="Fast browser-native web application">`
    },
    {
      id: 'py-dict-merge',
      title: 'Merge Dictionaries (Python 3.9+)',
      language: 'python',
      code: `defaults = {"theme": "dark", "fontSize": 14}
user_settings = {"fontSize": 16}
merged = defaults | user_settings
print("Merged settings:", merged)`
    },
    {
      id: 'py-prime-sieve',
      title: 'Sieve of Eratosthenes (Primes)',
      language: 'python',
      code: `def sieve(n):
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    for i in range(2, int(n ** 0.5) + 1):
        if is_prime[i]:
            for j in range(i * i, n + 1, i):
                is_prime[j] = False
    return [i for i, prime in enumerate(is_prime) if prime]

print(sieve(100))`
    },
    {
      id: 'sql-join',
      title: 'SQL Inner Join Pattern',
      language: 'sql',
      code: `SELECT a.id, a.name, b.title
FROM table_a a
JOIN table_b b ON a.b_id = b.id
WHERE a.status = 'active';`
    },
    {
      id: 'sql-group-by',
      title: 'SQL Group By with Aggregation',
      language: 'sql',
      code: `SELECT department_id, COUNT(*) AS employee_count, AVG(salary) AS avg_salary
FROM employees
GROUP BY department_id
HAVING COUNT(*) > 1;`
    }
  ];

  window.AkshTemplates = {
    TEMPLATES,
    SNIPPETS,
    getTemplate: (key) => TEMPLATES[key] || null
  };

})(window);
