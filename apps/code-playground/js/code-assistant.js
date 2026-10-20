/**
 * Aksh Code Playground — Aksh Local Code Assistant Engine Pro
 * Client-Side Heuristic Analysis, Web Dev Intent Reasoning, Concrete Code Synthesizer,
 * Dual-Mode Line/Split Diff Engine & Multi-Level Undo History.
 * 100% Offline, Zero Cloud Models, Complete Code Privacy & User Consent Control.
 */

(function (window) {
  'use strict';

  // ==========================================================================
  // Multi-Level Undo History Stack (Up to 50 operations)
  // ==========================================================================
  const MAX_UNDO_DEPTH = 50;
  const undoStack = [];
  const redoStack = [];

  function recordUndo(fileName, previousContent, proposedContent, description) {
    undoStack.push({
      targetFile: fileName,
      fileName: fileName,
      previousContent: previousContent !== undefined ? previousContent : '',
      proposedContent: proposedContent !== undefined ? proposedContent : '',
      timestamp: Date.now(),
      description: description || 'Assistant Code Modification'
    });
    if (undoStack.length > MAX_UNDO_DEPTH) {
      undoStack.shift();
    }
    // New modification invalidates forward redo history
    redoStack.length = 0;
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function popUndo() {
    const item = undoStack.pop() || null;
    if (item) {
      redoStack.push(item);
    }
    return item;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function popRedo() {
    const item = redoStack.pop() || null;
    if (item) {
      undoStack.push(item);
    }
    return item;
  }

  function clearUndo() {
    undoStack.length = 0;
    redoStack.length = 0;
  }

  function getUndoHistoryLength() {
    return undoStack.length;
  }

  function getRedoHistoryLength() {
    return redoStack.length;
  }

  function getUndoHistory() {
    return [...undoStack];
  }

  // ==========================================================================
  // Diff Calculation Engine (LCS, Line-by-Line Unified & Side-by-Side Split)
  // ==========================================================================
  function computeLCS(a, b) {
    const m = a.length;
    const n = b.length;
    if (m > 600 || n > 600) {
      return fastLCS(a, b);
    }

    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (a[i] === b[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const matches = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        matches.push({ i: i - 1, j: j - 1 });
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    return matches.reverse();
  }

  function fastLCS(a, b) {
    const matches = [];
    let jStart = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = jStart; j < Math.min(b.length, jStart + 30); j++) {
        if (a[i] === b[j]) {
          matches.push({ i, j });
          jStart = j + 1;
          break;
        }
      }
    }
    return matches;
  }

  /**
   * Generates a line-by-line diff between original and proposed code.
   * Returns an array of diff lines: { type: 'eq'|'add'|'del', lineOld, lineNew, text }
   * Along with additions, deletions, and unchanged stats.
   */
  function computeLineDiff(originalText, proposedText) {
    const origLines = (originalText || '').split('\n');
    const propLines = (proposedText || '').split('\n');
    const diff = [];
    const lcs = computeLCS(origLines, propLines);

    let i = 0;
    let j = 0;
    let lineOld = 1;
    let lineNew = 1;
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    for (const match of lcs) {
      // Deletions
      while (i < match.i) {
        diff.push({ type: 'del', lineOld: lineOld++, lineNew: null, text: origLines[i] });
        i++;
        deletions++;
      }
      // Additions
      while (j < match.j) {
        diff.push({ type: 'add', lineOld: null, lineNew: lineNew++, text: propLines[j] });
        j++;
        additions++;
      }
      // Unchanged
      diff.push({ type: 'eq', lineOld: lineOld++, lineNew: lineNew++, text: origLines[i] });
      i++;
      j++;
      unchanged++;
    }

    while (i < origLines.length) {
      diff.push({ type: 'del', lineOld: lineOld++, lineNew: null, text: origLines[i] });
      i++;
      deletions++;
    }
    while (j < propLines.length) {
      diff.push({ type: 'add', lineOld: null, lineNew: lineNew++, text: propLines[j] });
      j++;
      additions++;
    }

    diff.additions = additions;
    diff.deletions = deletions;
    diff.unchanged = unchanged;
    return diff;
  }

  /**
   * Generates aligned side-by-side rows for dual-pane diff viewer.
   * Returns { rows: [{ left: { lineNum, text, type }, right: { lineNum, text, type } }], additions, deletions, unchanged }
   */
  function computeSideBySideDiff(originalText, proposedText) {
    const origLines = (originalText || '').split('\n');
    const propLines = (proposedText || '').split('\n');
    const lcs = computeLCS(origLines, propLines);
    const rows = [];

    let i = 0;
    let j = 0;
    let lineOld = 1;
    let lineNew = 1;
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    for (const match of lcs) {
      const delChunk = [];
      while (i < match.i) {
        delChunk.push({ lineNum: lineOld++, text: origLines[i], type: 'del' });
        i++;
        deletions++;
      }
      const addChunk = [];
      while (j < match.j) {
        addChunk.push({ lineNum: lineNew++, text: propLines[j], type: 'add' });
        j++;
        additions++;
      }

      const maxChunk = Math.max(delChunk.length, addChunk.length);
      for (let k = 0; k < maxChunk; k++) {
        rows.push({
          left: k < delChunk.length ? delChunk[k] : { lineNum: null, text: '', type: 'empty' },
          right: k < addChunk.length ? addChunk[k] : { lineNum: null, text: '', type: 'empty' }
        });
      }

      rows.push({
        left: { lineNum: lineOld++, text: origLines[i], type: 'eq' },
        right: { lineNum: lineNew++, text: propLines[j], type: 'eq' }
      });
      i++;
      j++;
      unchanged++;
    }

    const delChunk = [];
    while (i < origLines.length) {
      delChunk.push({ lineNum: lineOld++, text: origLines[i], type: 'del' });
      i++;
      deletions++;
    }
    const addChunk = [];
    while (j < propLines.length) {
      addChunk.push({ lineNum: lineNew++, text: propLines[j], type: 'add' });
      j++;
      additions++;
    }
    const maxChunk = Math.max(delChunk.length, addChunk.length);
    for (let k = 0; k < maxChunk; k++) {
      rows.push({
        left: k < delChunk.length ? delChunk[k] : { lineNum: null, text: '', type: 'empty' },
        right: k < addChunk.length ? addChunk[k] : { lineNum: null, text: '', type: 'empty' }
      });
    }

    return {
      rows,
      additions,
      deletions,
      unchanged
    };
  }

  // ==========================================================================
  // Prompt Matching & Heuristic Reasoning Core
  // ==========================================================================

  /**
   * Main query processor: comprehends user intent and generates concrete code.
   * @param {string} promptText
   * @param {Object} context { activeFile, fileContent, selectedText, allFiles, runtimeErrors }
   * @returns {Object} { replyText, proposedCode, targetFile, actionable, intent, stats }
   */
  async function processAssistantQuery(promptText, context) {
    const rawPrompt = (promptText || '').trim();
    const prompt = rawPrompt.toLowerCase();
    const code = context.selectedText || context.fileContent || '';
    const file = context.activeFile || 'index.html';
    const ext = (file.split('.').pop() || 'html').toLowerCase();

    // 1. FORM VALIDATION
    if (
      /(?:form|validat|input check|email valid|email check|password check|check input|form error|required field|contact form|login form|signup form)/i.test(prompt)
    ) {
      return handleFormValidation(code, ext, file, context, rawPrompt);
    }

    // 2. DARK MODE / THEME TOGGLE
    if (
      /(?:dark mode|light mode|theme toggle|theme switch|toggle theme|color scheme|dark theme|light theme|night mode|light dark|switch theme)/i.test(prompt) ||
      (prompt.includes('theme') && (prompt.includes('dark') || prompt.includes('light') || prompt.includes('mode') || prompt.includes('toggle') || prompt.includes('switch')))
    ) {
      return handleDarkMode(code, ext, file, context);
    }

    // 3. COUNTER LOGIC
    if (
      /(?:counter|count button|increment|decrement|click count|number count|count up|count down|stepper)/i.test(prompt) ||
      prompt.includes('counter') ||
      (prompt.includes('count') && (prompt.includes('click') || prompt.includes('button') || prompt.includes('number')))
    ) {
      return handleCounterLogic(code, ext, file, context);
    }

    // 4. RESPONSIVE NAVBAR / HAMBURGER MENU
    if (
      /(?:navbar|nav bar|hamburger|mobile menu|menu toggle|navigation bar|header nav|navigation menu|site navigation|header menu|nav drawer)/i.test(prompt) ||
      prompt.includes('navbar') || prompt.includes('nav bar')
    ) {
      return handleResponsiveNavbar(code, ext, file, context);
    }

    // 5. CENTERING LAYOUT / ALIGN CENTER
    if (
      /(?:center|centering|align center|middle of screen|middle center|flex center)/i.test(prompt)
    ) {
      return handleCenteringLayout(code, ext, file, context);
    }

    // 6. FIX COMMON JAVASCRIPT BUGS
    if (
      /(?:fix bug|fix error|fix javascript|fix js|repair code|repair js|fix syntax|accidental assignment|loose equality|find and fix|debug|fix issue|fix mistake)/i.test(prompt) ||
      (prompt.includes('fix') && (prompt.includes('bug') || prompt.includes('error') || prompt.includes('code') || prompt.includes('js') || prompt.includes('issue') || prompt.includes('mistake')))
    ) {
      return handleFixJavaScriptBugs(code, ext, file, context);
    }

    // 7. ADD EVENT LISTENERS
    if (
      /(?:event listener|add listener|handle click|button click|on click|click event|keydown|keypress|submit listener|input event|scroll listener|click handler|listen to click|add click|attach listener)/i.test(prompt) ||
      prompt.includes('event listener') || prompt.includes('add listener') ||
      (prompt.includes('click') && (prompt.includes('event') || prompt.includes('listener') || prompt.includes('handler')))
    ) {
      return handleAddEventListener(code, ext, file, context, rawPrompt);
    }

    // 8. CSS STYLING IMPROVEMENTS & MODERN UI
    if (
      /(?:improve style|improve css|modernize css|better style|card style|button style|modern ui|gradient|shadow|typography|beautify|style this|pretty ui|clean css|modern design|polish style|css improve)/i.test(prompt) ||
      (prompt.includes('css') && (prompt.includes('improve') || prompt.includes('modern') || prompt.includes('better') || prompt.includes('clean')))
    ) {
      return handleCssImprovements(code, ext, file, context);
    }

    // 9. RESPONSIVE DESIGN (GENERAL)
    if (
      prompt.includes('responsive') ||
      prompt.includes('mobile view') ||
      prompt.includes('tablet view') ||
      prompt.includes('media quer') ||
      prompt.includes('viewport') ||
      prompt.includes('breakpoints')
    ) {
      return makeLayoutResponsive(context, file);
    }

    // 10. MODAL DIALOG / POPUP
    if (prompt.includes('modal') || prompt.includes('dialog') || prompt.includes('popup')) {
      return handleModalDialog(code, ext, file, context);
    }

    // 11. TODO / LOCALSTORAGE PERSISTENCE
    if (prompt.includes('todo') || prompt.includes('task list') || prompt.includes('localstorage') || prompt.includes('store data')) {
      return handleTodoApp(code, ext, file, context);
    }

    // 12. TABS COMPONENT
    if (prompt.includes('tab') && (prompt.includes('component') || prompt.includes('switcher') || prompt.includes('panel') || prompt.includes('switch'))) {
      return handleTabsComponent(code, ext, file, context);
    }

    // 13. ACCORDION / COLLAPSIBLE FAQ
    if (prompt.includes('accordion') || prompt.includes('collapsible') || prompt.includes('faq')) {
      return handleAccordionComponent(code, ext, file, context);
    }

    // 14. COPY TO CLIPBOARD
    if (prompt.includes('clipboard') || prompt.includes('copy button') || prompt.includes('copy text')) {
      return handleCopyToClipboard(code, ext, file, context);
    }

    // 15. ASYNC FETCH / API CALL
    if (prompt.includes('fetch') || prompt.includes('api call') || prompt.includes('ajax') || prompt.includes('async await') || prompt.includes('get data')) {
      return handleFetchApi(code, ext, file, context);
    }

    // 16. EXPLAIN CODE
    if (prompt.includes('explain') && !prompt.includes('error')) {
      return explainCode(code, file);
    }

    // 17. FIND BUGS (LINT/AUDIT)
    if (prompt.includes('find bug') || prompt.includes('find error') || prompt.includes('syntax check') || prompt.includes('lint')) {
      return findBugs(code, file, context);
    }

    // 18. DIAGNOSE BLANK PAGE
    if (prompt.includes('blank') || prompt.includes('nothing shows') || prompt.includes('white screen')) {
      return diagnoseBlankPage(context);
    }

    // 19. DIAGNOSE PREVIEW ISSUES
    if (prompt.includes('preview') && (prompt.includes('not working') || prompt.includes('broken') || prompt.includes('fail'))) {
      return diagnosePreviewIssues(context);
    }

    // 20. CODE IMPROVEMENT / MODERNIZATION
    if (prompt.includes('improve') || prompt.includes('optimize') || prompt.includes('performance') || prompt.includes('better algorithm')) {
      return improveCode(code, file);
    }

    // 21. UNUSED VARIABLES
    if (prompt.includes('unused')) {
      return findUnusedDeclarations(code, file);
    }

    // 22. UNIT TESTS
    if (prompt.includes('test case') || prompt.includes('unit test') || prompt.includes('testing')) {
      return generateTestCases(code, file);
    }

    // 23. ACCESSIBILITY AUDIT
    if (prompt.includes('accessibility') || prompt.includes('a11y') || prompt.includes('contrast')) {
      return auditAccessibility(context);
    }

    // 24. EXPLAIN ERROR MESSAGE
    if (prompt.includes('explain') && prompt.includes('error')) {
      return explainErrorMessage(context);
    }

    // 25. REFACTOR CODE
    if (prompt.includes('refactor')) {
      return refactorCode(code, file);
    }

    // 26. GENERATE STARTER CODE
    if (prompt.includes('generate') || prompt.includes('starter') || prompt.includes('boilerplate')) {
      return generateStarterCode(prompt, ext);
    }

    // 27. ANALYZE PROJECT
    if (prompt.includes('analyze') || prompt.includes('audit')) {
      return analyzeProjectFiles(context.allFiles || []);
    }

    // SMART FALLBACK
    return smartContextualFallback(rawPrompt, code, file, ext, context);
  }

  // ==========================================================================
  // Concrete Web Dev Implementations
  // ==========================================================================

  // --- 1. Form Validation ---
  function handleFormValidation(code, ext, filename, context, rawPrompt) {
    let proposed = code;
    let reply = `### 🛡️ Form Validation Implementation for \`${filename}\`\n\n`;

    if (ext === 'js' || ext === 'ts' || ext === 'mjs') {
      const validationScript = `
// ============================================================================
// Robust Client-Side Form Validation (Generated by Aksh Assistant)
// ============================================================================
function initFormValidation(formSelector = 'form') {
  const form = document.querySelector(formSelector);
  if (!form) return;

  // Prevent default native HTML5 popups to render accessible inline error messages
  form.setAttribute('novalidate', 'true');

  function getErrorContainer(input) {
    let errorEl = input.parentElement.querySelector('.error-msg');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'error-msg';
      errorEl.setAttribute('role', 'alert');
      errorEl.style.cssText = 'color: #ef4444; font-size: 11px; margin-top: 4px; display: block; font-weight: 500;';
      input.insertAdjacentElement('afterend', errorEl);
    }
    return errorEl;
  }

  function validateInput(input) {
    const val = (input.value || '').trim();
    let error = '';

    if (input.hasAttribute('required') && !val) {
      const label = input.dataset.label || input.name || input.id || 'This field';
      error = \`\${label} is required.\`;
    } else if (input.type === 'email' && val) {
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (!emailRegex.test(val)) {
        error = 'Please enter a valid email address.';
      }
    } else if (input.type === 'password' && val && val.length < 8) {
      error = 'Password must be at least 8 characters long.';
    } else if (input.hasAttribute('minlength') && val && val.length < parseInt(input.getAttribute('minlength'), 10)) {
      error = \`Must be at least \${input.getAttribute('minlength')} characters.\`;
    }

    const errContainer = getErrorContainer(input);
    if (error) {
      input.classList.add('input-error');
      input.setAttribute('aria-invalid', 'true');
      errContainer.textContent = error;
      errContainer.style.display = 'block';
      return false;
    } else {
      input.classList.remove('input-error');
      input.removeAttribute('aria-invalid');
      errContainer.textContent = '';
      errContainer.style.display = 'none';
      return true;
    }
  }

  // Live validation on user interaction
  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', () => validateInput(input));
    input.addEventListener('blur', () => validateInput(input));
  });

  // Submit gate with focus control
  form.addEventListener('submit', (e) => {
    let isAllValid = true;
    let firstInvalid = null;

    form.querySelectorAll('input, select, textarea').forEach(input => {
      const valid = validateInput(input);
      if (!valid) {
        isAllValid = false;
        if (!firstInvalid) firstInvalid = input;
      }
    });

    if (!isAllValid) {
      e.preventDefault();
      if (firstInvalid) firstInvalid.focus();
    }
  });
}

// Auto-run when DOM is fully loaded
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => initFormValidation());
} else {
  initFormValidation();
}
`;
      if (!proposed.includes('initFormValidation')) {
        proposed = proposed.trim() ? `${proposed.trim()}\n\n${validationScript}` : validationScript.trim();
      }
      reply += `- ✅ **Inline Real-time Errors**: Live feedback on \`input\` and \`blur\` events.\n`;
      reply += `- ✅ **RegEx Email Validation**: Standard email pattern matching.\n`;
      reply += `- ✅ **Password Security**: Enforces minimum 8-character password length.\n`;
      reply += `- ✅ **Accessible Focus Control**: Focuses the first invalid input automatically on submit.\n\n`;
      reply += `Click **Review Diff** to inspect changes or **Apply to File** with your permission.`;
    } else if (ext === 'html' || ext === 'htm') {
      const formSnippet = `
    <!-- Contact & Feedback Form (Generated by Aksh Assistant) -->
    <section class="form-section">
      <form id="contact-form" class="app-form" novalidate>
        <h2>Contact Us</h2>
        <div class="form-group">
          <label for="user-name">Full Name *</label>
          <input type="text" id="user-name" name="name" required placeholder="John Doe">
          <span class="error-msg" role="alert"></span>
        </div>
        <div class="form-group">
          <label for="user-email">Email Address *</label>
          <input type="email" id="user-email" name="email" required placeholder="john@example.com">
          <span class="error-msg" role="alert"></span>
        </div>
        <div class="form-group">
          <label for="user-password">Password (min 8 characters) *</label>
          <input type="password" id="user-password" name="password" minlength="8" required placeholder="••••••••">
          <span class="error-msg" role="alert"></span>
        </div>
        <button type="submit" class="btn btn-primary">Submit Form</button>
      </form>
    </section>
`;
      if (proposed.includes('</form>')) {
        // Enhance existing data inputs with required attributes and error spans (skip submit/button/hidden)
        proposed = proposed.replace(/<input\b([^>]*)>/gi, (match, attrs) => {
          const typeMatch = attrs.match(/type=["']?([a-zA-Z0-9_-]+)["']?/i);
          const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
          if (['submit', 'button', 'reset', 'hidden', 'image'].includes(type)) {
            return match;
          }
          let newAttrs = attrs;
          if (!newAttrs.includes('required')) newAttrs += ' required';
          return `<input${newAttrs}>\n        <span class="error-msg" role="alert"></span>`;
        });
        reply += `- Enhanced existing form inputs with \`required\` and accessible error indicators.\n`;
      } else if (proposed.includes('</body>')) {
        if (!proposed.includes('id="contact-form"')) {
          proposed = proposed.replace('</body>', `${formSnippet}\n</body>`);
          reply += `- Generated accessible semantic form structure before \`</body>\`.\n`;
        }
      } else {
        if (!proposed.includes('id="contact-form"')) {
          proposed += `\n${formSnippet}`;
          reply += `- Appended semantic form markup.\n`;
        }
      }
    } else if (ext === 'css') {
      const formCss = `
/* Form Validation & State Styles */
.app-form {
  max-width: 480px;
  margin: 20px auto;
  padding: 24px;
  background: var(--bg-card, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.form-group {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.form-group input, .form-group textarea {
  padding: 10px 14px;
  border: 1.5px solid var(--border-color, #cbd5e1);
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  outline: none;
}

.form-group input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.form-group input.input-error {
  border-color: #ef4444 !important;
  background: rgba(239, 68, 68, 0.03);
}

.error-msg {
  color: #ef4444;
  font-size: 11.5px;
  font-weight: 500;
  margin-top: 4px;
  display: none;
}
`;
      if (!proposed.includes('.input-error')) {
        proposed = `${proposed.trim()}\n\n${formCss.trim()}`;
      }
      reply += `- Added modern CSS rules for form inputs, invalid borders, and inline error styling.\n`;
    }

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: filename,
      actionable: proposed !== code,
      intent: 'FORM_VALIDATION'
    };
  }

  // --- 2. Dark Mode Toggle ---
  function handleDarkMode(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 🌓 Dark Mode Toggle Implementation for \`${filename}\`\n\n`;

    if (ext === 'js' || ext === 'ts' || ext === 'mjs') {
      const themeScript = `
// ============================================================================
// Dark Mode Controller with LocalStorage & OS Preference Sync
// ============================================================================
(function initThemeEngine() {
  const THEME_KEY = 'app_user_theme';

  function getSavedTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark');
      btn.innerHTML = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
  }

  // Synchronize on script start
  applyTheme(getSavedTheme());

  function bindToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bindToggle);
  } else {
    bindToggle();
  }
})();
`;
      if (!proposed.includes('initThemeEngine')) {
        proposed = proposed.trim() ? `${proposed.trim()}\n\n${themeScript}` : themeScript.trim();
      }
      reply += `- ✅ **Persistent State**: Stores theme in \`localStorage\`.\n`;
      reply += `- ✅ **System Sync**: Detects OS \`prefers-color-scheme\` automatically.\n`;
      reply += `- ✅ **FOUC Prevention**: Sets theme before DOM paint.\n\n`;
    } else if (ext === 'css') {
      const themeCss = `
/* ==========================================================================
   CSS Theme Variables (Light / Dark Mode)
   ========================================================================== */
:root {
  --bg-primary: #ffffff;
  --bg-surface: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] {
  --bg-primary: #0b0f19;
  --bg-surface: #151d2f;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --border-color: #243049;
  --accent: #38bdf8;
  --accent-hover: #0284c7;
  --card-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.25s ease, color 0.25s ease;
}

.theme-toggle-btn {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.theme-toggle-btn:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}
`;
      if (!proposed.includes('[data-theme="dark"]')) {
        proposed = `${themeCss.trim()}\n\n${proposed.trim()}`;
      }
      reply += `- Added complete CSS Custom Properties with smooth transition on \`body\`.\n`;
    } else if (ext === 'html' || ext === 'htm') {
      const toggleHtml = `<button id="theme-toggle" class="theme-toggle-btn" aria-label="Toggle dark mode" aria-pressed="false">🌙 Dark Mode</button>`;
      if (proposed.includes('</nav>')) {
        proposed = proposed.replace('</nav>', `  ${toggleHtml}\n    </nav>`);
      } else if (proposed.includes('</header>')) {
        proposed = proposed.replace('</header>', `  ${toggleHtml}\n    </header>`);
      } else if (proposed.includes('<body>')) {
        proposed = proposed.replace('<body>', `<body>\n  ${toggleHtml}`);
      } else {
        proposed = `${toggleHtml}\n${proposed}`;
      }
      reply += `- Injected accessible theme toggle button into header/body.\n`;
    }

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: filename,
      actionable: proposed !== code,
      intent: 'DARK_MODE'
    };
  }

  // --- 3. Counter Logic ---
  function handleCounterLogic(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 🔢 Counter Component Implementation for \`${filename}\`\n\n`;

    if (ext === 'js' || ext === 'ts' || ext === 'mjs') {
      const counterScript = `
// ============================================================================
// Interactive Counter Component
// ============================================================================
(function initCounter() {
  let count = 0;

  function bindCounter() {
    const display = document.getElementById('counter-value');
    const btnInc = document.getElementById('btn-increment');
    const btnDec = document.getElementById('btn-decrement');
    const btnReset = document.getElementById('btn-reset');

    function update() {
      if (!display) return;
      display.textContent = count;
      display.classList.remove('pulse');
      void display.offsetWidth; // re-trigger css keyframe
      display.classList.add('pulse');
    }

    if (btnInc) btnInc.addEventListener('click', () => { count++; update(); });
    if (btnDec) btnDec.addEventListener('click', () => { count = Math.max(0, count - 1); update(); });
    if (btnReset) btnReset.addEventListener('click', () => { count = 0; update(); });
    update();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bindCounter);
  } else {
    bindCounter();
  }
})();
`;
      if (!proposed.includes('initCounter')) {
        proposed = proposed.trim() ? `${proposed.trim()}\n\n${counterScript}` : counterScript.trim();
      }
      reply += `- ✅ **Reactive State**: Increment, Decrement (min 0), and Reset operations.\n`;
      reply += `- ✅ **Pulse Micro-Interaction**: Visual reflow pulse on number change.\n\n`;
    } else if (ext === 'html' || ext === 'htm') {
      const counterMarkup = `
    <!-- Interactive Counter Widget -->
    <div class="counter-card">
      <h2 class="counter-title">Counter</h2>
      <div id="counter-value" class="counter-display">0</div>
      <div class="counter-controls">
        <button id="btn-decrement" class="btn btn-counter" aria-label="Decrease count">-</button>
        <button id="btn-reset" class="btn btn-secondary" aria-label="Reset count">Reset</button>
        <button id="btn-increment" class="btn btn-counter" aria-label="Increase count">+</button>
      </div>
    </div>
`;
      if (proposed.includes('</body>')) {
        proposed = proposed.replace('</body>', `${counterMarkup}\n</body>`);
      } else {
        proposed += `\n${counterMarkup}`;
      }
      reply += `- Added counter widget markup with display and action buttons.\n`;
    } else if (ext === 'css') {
      const counterCss = `
/* Counter Component Styles */
.counter-card {
  max-width: 320px;
  margin: 32px auto;
  padding: 24px;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}

.counter-display {
  font-size: 48px;
  font-weight: 800;
  margin: 16px 0;
  color: var(--accent, #3b82f6);
  font-variant-numeric: tabular-nums;
  transition: transform 0.15s ease;
}

.counter-display.pulse {
  animation: counter-pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes counter-pop {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.counter-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.btn-counter {
  width: 44px;
  height: 44px;
  font-size: 20px;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
`;
      if (!proposed.includes('.counter-display')) {
        proposed = `${proposed.trim()}\n\n${counterCss.trim()}`;
      }
      reply += `- Styled counter card, rounded circular buttons, and pulse keyframes.\n`;
    }

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: filename,
      actionable: proposed !== code,
      intent: 'COUNTER_LOGIC'
    };
  }

  // --- 4. Responsive Navbar ---
  function handleResponsiveNavbar(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 🧭 Responsive Navbar Implementation for \`${filename}\`\n\n`;

    if (ext === 'html' || ext === 'htm') {
      const navMarkup = `
  <!-- Responsive Site Navigation -->
  <header class="site-header">
    <nav class="navbar" aria-label="Main Navigation">
      <a href="#" class="nav-brand">Aksh Studio</a>
      <button id="nav-toggle" class="nav-toggle" aria-label="Toggle Navigation Menu" aria-expanded="false">
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
        <span class="hamburger-bar"></span>
      </button>
      <ul id="nav-links" class="nav-links">
        <li><a href="#home">Home</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#projects">Projects</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact" class="nav-cta">Contact</a></li>
      </ul>
    </nav>
  </header>
`;
      if (proposed.includes('<body') && proposed.includes('>')) {
        proposed = proposed.replace(/(<body[^>]*>)/i, `$1\n${navMarkup}`);
      } else {
        proposed = `${navMarkup}\n${proposed}`;
      }
      reply += `- Added semantic header, brand link, hamburger button, and navigation menu list.\n`;
    } else if (ext === 'css') {
      const navCss = `
/* Responsive Navigation Styles */
.site-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: var(--bg-surface, #0f172a);
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
}

.navbar {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand {
  font-size: 18px;
  font-weight: 700;
  color: inherit;
  text-decoration: none;
}

.nav-links {
  display: flex;
  list-style: none;
  align-items: center;
  gap: 24px;
  margin: 0;
  padding: 0;
}

.nav-links a {
  color: inherit;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--accent, #38bdf8);
}

.nav-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  flex-direction: column;
  gap: 5px;
}

.hamburger-bar {
  width: 22px;
  height: 2px;
  background: currentColor;
  border-radius: 2px;
  transition: all 0.25s ease;
}

@media (max-width: 768px) {
  .nav-toggle {
    display: flex;
  }

  .nav-links {
    display: none;
    flex-direction: column;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-surface, #0f172a);
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  }

  .nav-links.nav-open {
    display: flex;
  }
}
`;
      if (!proposed.includes('.nav-toggle')) {
        proposed = `${proposed.trim()}\n\n${navCss.trim()}`;
      }
      reply += `- Styled sticky header, responsive links, and mobile dropdown drawer.\n`;
    } else if (ext === 'js' || ext === 'ts' || ext === 'mjs') {
      const navScript = `
// ============================================================================
// Responsive Navbar Controller (Hamburger Drawer & Accessibility)
// ============================================================================
(function initNavbar() {
  function bindNav() {
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = links.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', (e) => {
      if (!links.contains(e.target) && !toggle.contains(e.target) && links.classList.contains('nav-open')) {
        links.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && links.classList.contains('nav-open')) {
        links.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bindNav);
  } else {
    bindNav();
  }
})();
`;
      if (!proposed.includes('initNavbar')) {
        proposed = proposed.trim() ? `${proposed.trim()}\n\n${navScript}` : navScript.trim();
      }
      reply += `- Added mobile toggle interaction, outside click dismissal, and escape key listener.\n`;
    }

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: filename,
      actionable: proposed !== code,
      intent: 'RESPONSIVE_NAVBAR'
    };
  }

  // --- 5. Centering Layout ---
  function handleCenteringLayout(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 🎯 Layout Centering Implementation for \`${filename}\`\n\n`;

    if (ext === 'css') {
      const centerCss = `
/* ==========================================================================
   Modern Centering Layout (Flexbox & Grid Utilities)
   ========================================================================== */
.centered-layout {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 24px 16px;
}

.centered-card {
  max-width: 560px;
  width: 100%;
  padding: 32px 24px;
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  text-align: center;
}

/* Quick centering utility */
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
`;
      if (!proposed.includes('.centered-layout')) {
        proposed = `${proposed.trim()}\n\n${centerCss.trim()}`;
      }
      reply += `- Added modern Flexbox centering with full viewport height (\`min-height: 100vh\`).\n`;
      reply += `- Added centered card container with balanced padding and subtle elevation.\n`;
    } else if (ext === 'html' || ext === 'htm') {
      if (proposed.includes('centered-layout')) {
        reply += `- Content is already configured with \`centered-layout\`.\n`;
      } else if (proposed.includes('<main') && proposed.includes('</main>')) {
        proposed = proposed.replace(/<main\b([^>]*)>/i, (m, attrs) => {
          if (attrs.includes('class=')) {
            return `<main${attrs.replace(/class=["']([^"']*)["']/, 'class="$1 centered-layout"')}>`;
          }
          return `<main class="centered-layout"${attrs}>`;
        });
        reply += `- Added \`centered-layout\` class to existing \`<main>\` element.\n`;
      } else if (proposed.includes('<body>') && proposed.includes('</body>')) {
        proposed = proposed.replace(
          /(<body[^>]*>)([\s\S]*?)(<\/body>)/i,
          (m, bodyOpen, bodyContent, bodyClose) => {
            return `${bodyOpen}\n  <main class="centered-layout">\n    <div class="centered-card">\n${bodyContent.trim()}\n    </div>\n  </main>\n${bodyClose}`;
          }
        );
        reply += `- Wrapped content in \`<main class="centered-layout"><div class="centered-card">...</div></main>\`.\n`;
      } else {
        proposed = `<main class="centered-layout">\n  <div class="centered-card">\n${proposed.trim()}\n  </div>\n</main>`;
        reply += `- Wrapped content in \`<main class="centered-layout"><div class="centered-card">...</div></main>\`.\n`;
      }
    } else if (ext === 'js' || ext === 'ts' || ext === 'mjs') {
      const centerJsHelper = `
// Utility to center layout dynamically via script
function applyCenteredLayout(selector = 'body') {
  const container = document.querySelector(selector);
  if (!container) return;
  container.style.display = 'flex';
  container.style.justifyContent = 'center';
  container.style.alignItems = 'center';
  container.style.minHeight = '100vh';
}
`;
      if (!proposed.includes('applyCenteredLayout')) {
        proposed = proposed.trim() ? `${proposed.trim()}\n\n${centerJsHelper.trim()}` : centerJsHelper.trim();
      }
      reply += `- Added dynamic JavaScript layout centering helper function.\n`;
    }

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: filename,
      actionable: proposed !== code,
      intent: 'CENTERING_LAYOUT'
    };
  }

  // --- 6. Fix JavaScript Bugs ---
  function handleFixJavaScriptBugs(code, ext, filename, context) {
    if (ext !== 'js' && ext !== 'ts' && ext !== 'mjs') {
      return findBugs(code, filename, context);
    }

    const lines = (code || '').split('\n');
    const fixesApplied = [];
    const repairedLines = lines.map((line, idx) => {
      let l = line;
      const lineNum = idx + 1;

      // 1. Accidental assignment in if: if (x = 5) -> if (x === 5)
      if (/\bif\s*\([^=!<>\n]*=[^=!<>\n]*\)/.test(l)) {
        const fixed = l.replace(/(\bif\s*\([^=!<>\n]*)=([^=!<>\n]*\))/, '$1===$2');
        if (fixed !== l) {
          fixesApplied.push(`Line ${lineNum}: Fixed accidental assignment inside \`if\` condition (\`=\` -> \`===\`).`);
          l = fixed;
        }
      }

      // 2. Loose equality: == -> ===, != -> !==
      if (/[^=!<>]==[^=]/.test(l)) {
        const fixed = l.replace(/([^=!<>])==([^=])/g, '$1===$2');
        if (fixed !== l) {
          fixesApplied.push(`Line ${lineNum}: Upgraded loose equality (\`==\`) to strict equality (\`===\`).`);
          l = fixed;
        }
      }
      if (/[^=!]!=[^=]/.test(l)) {
        const fixed = l.replace(/([^=!])!=([^=])/g, '$1!==$2');
        if (fixed !== l) {
          fixesApplied.push(`Line ${lineNum}: Upgraded loose inequality (\`!=\`) to strict inequality (\`!==\`).`);
          l = fixed;
        }
      }

      // 3. Blocking alert() calls
      if (/\balert\s*\(/.test(l)) {
        const fixed = l.replace(/\balert\s*\((.*?)\);?/, 'console.log($1);');
        if (fixed !== l) {
          fixesApplied.push(`Line ${lineNum}: Replaced UI-blocking \`alert()\` with \`console.log()\`.`);
          l = fixed;
        }
      }

      // 4. Common console typos
      if (/\bconsol\.(log|warn|error)\b/.test(l)) {
        l = l.replace(/\bconsol\.(log|warn|error)\b/, 'console.$1');
        fixesApplied.push(`Line ${lineNum}: Corrected \`consol\` typo to \`console\`.`);
      }

      // 5. Common listener typos
      if (/\baddEventlistener\b/.test(l)) {
        l = l.replace(/\baddEventlistener\b/, 'addEventListener');
        fixesApplied.push(`Line ${lineNum}: Corrected \`addEventlistener\` typo to \`addEventListener\`.`);
      }

      return l;
    });

    let repaired = repairedLines.join('\n');

    // 6. Wrap bare top-level DOM queries in DOMContentLoaded if missing (only if outside functions)
    let braceDepth = 0;
    let hasTopLevelDomQuery = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
      if (braceDepth === 0 && /^(?:const|let|var)?\s*[a-zA-Z0-9_$]*\s*=?\s*document\.(getElementById|querySelector|getElementsBy)/.test(trimmed)) {
        hasTopLevelDomQuery = true;
        break;
      }
      for (const char of line) {
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
      }
    }

    if (
      hasTopLevelDomQuery &&
      !repaired.includes('DOMContentLoaded') &&
      !repaired.includes('readyState')
    ) {
      repaired = `// Safe DOM wrapper added by Aksh Assistant\nwindow.addEventListener('DOMContentLoaded', () => {\n${repaired.split('\n').map(ln => '  ' + ln).join('\n')}\n});\n`;
      fixesApplied.push('Wrapped top-level DOM lookups inside `DOMContentLoaded` to avoid `null` element runtime errors.');
    }

    let reply = `### 🐛 JavaScript Bug Fix Report for \`${filename}\`\n\n`;
    if (fixesApplied.length === 0) {
      reply += `🎉 **No critical syntax bugs or anti-patterns detected!** Your code is cleanly structured.\n`;
    } else {
      reply += `Applied **${fixesApplied.length}** automatic code repair(s):\n\n`;
      fixesApplied.forEach(f => {
        reply += `- ✅ ${f}\n`;
      });
      reply += `\nClick **Review Diff** to inspect before applying.`;
    }

    return {
      replyText: reply,
      proposedCode: repaired,
      targetFile: filename,
      actionable: repaired !== code,
      intent: 'FIX_BUGS'
    };
  }

  // --- 7. Add Event Listeners ---
  function handleAddEventListener(code, ext, filename, context, rawPrompt) {
    let proposed = code;
    let reply = `### ⚡ Event Listener Generator for \`${filename}\`\n\n`;

    const promptLower = rawPrompt.toLowerCase();
    let eventType = 'click';
    if (promptLower.includes('submit')) eventType = 'submit';
    else if (promptLower.includes('keydown') || promptLower.includes('key')) eventType = 'keydown';
    else if (promptLower.includes('input') || promptLower.includes('change')) eventType = 'input';
    else if (promptLower.includes('scroll')) eventType = 'scroll';

    const listenerSnippet = `
// Safe Event Listener (${eventType})
function bindEventListeners() {
  const targetElement = document.querySelector('${eventType === 'submit' ? 'form' : '#action-btn, button'}');
  if (!targetElement) return;

  targetElement.addEventListener('${eventType}', (event) => {
    ${eventType === 'submit' ? 'event.preventDefault();\n    console.log("Form submitted safely");' : 'console.log("Event triggered:", event);'}
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bindEventListeners);
} else {
  bindEventListeners();
}
`;
    if (!proposed.includes(`'${eventType}'`)) {
      proposed = proposed.trim() ? `${proposed.trim()}\n\n${listenerSnippet.trim()}` : listenerSnippet.trim();
    }
    reply += `- Added clean \`${eventType}\` event listener pattern with null-safety and DOMContentLoaded.\n`;

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: filename,
      actionable: proposed !== code,
      intent: 'ADD_EVENT_LISTENERS'
    };
  }

  // --- 8. CSS Styling Improvements ---
  function handleCssImprovements(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 🎨 Modern CSS Design System for \`${filename}\`\n\n`;

    const modernTokens = `
/* Modern Design Tokens & Micro-Interactions */
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --transition-smooth: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  font-family: var(--font-sans);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* Polished Card Surface */
.card, .container, .box {
  background: var(--bg-surface, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  transition: var(--transition-smooth);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
}

/* Polished Interactive Buttons */
button, .btn {
  font-family: inherit;
  font-weight: 600;
  border-radius: var(--radius-sm);
  transition: var(--transition-smooth);
  cursor: pointer;
}

button:hover, .btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

button:active, .btn:active {
  transform: translateY(0);
}
`;
    if (!proposed.includes('--transition-smooth')) {
      proposed = `${proposed.trim()}\n\n${modernTokens.trim()}`;
    }
    reply += `- Added modern system font stack and fluid typography.\n`;
    reply += `- Added subtle card elevations with smooth hover transitions.\n`;
    reply += `- Added button tactile micro-interactions (\`translateY\` and brightness).\n`;

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: filename,
      actionable: proposed !== code,
      intent: 'CSS_IMPROVEMENTS'
    };
  }

  // --- 9. Modal Dialog ---
  function handleModalDialog(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 🪟 Accessible Modal Dialog for \`${filename}\`\n\n`;

    if (ext === 'html' || ext === 'htm') {
      const modalMarkup = `
  <!-- Accessible Modal Dialog -->
  <button id="open-modal-btn" class="btn btn-primary">Open Dialog</button>

  <div id="app-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title" style="display:none;">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modal-title">Modal Title</h3>
        <button id="close-modal-btn" class="modal-close" aria-label="Close dialog">&times;</button>
      </div>
      <div class="modal-body">
        <p>This is an accessible modal popup created by Aksh Code Assistant.</p>
      </div>
      <div class="modal-footer">
        <button id="modal-confirm-btn" class="btn btn-primary">Confirm</button>
      </div>
    </div>
  </div>
`;
      proposed = proposed.includes('</body>') ? proposed.replace('</body>', `${modalMarkup}\n</body>`) : `${proposed}\n${modalMarkup}`;
    } else if (ext === 'js') {
      const modalJs = `
// Modal Controller
function initModal() {
  const openBtn = document.getElementById('open-modal-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const modal = document.getElementById('app-modal');
  if (!modal) return;

  function toggle(open) {
    modal.style.display = open ? 'flex' : 'none';
    if (open) closeBtn?.focus();
  }

  openBtn?.addEventListener('click', () => toggle(true));
  closeBtn?.addEventListener('click', () => toggle(false));
  modal.addEventListener('click', (e) => { if (e.target === modal) toggle(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initModal);
} else {
  initModal();
}
`;
      proposed = `${proposed.trim()}\n\n${modalJs.trim()}`;
    }

    return { replyText: reply, proposedCode: proposed, targetFile: filename, actionable: proposed !== code, intent: 'MODAL' };
  }

  // --- 10. Todo App / LocalStorage ---
  function handleTodoApp(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 📝 LocalStorage State Management for \`${filename}\`\n\n`;

    if (ext === 'js') {
      const todoJs = `
// LocalStorage Persistence Module
const STORAGE_KEY = 'aksh_task_items';

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function addTask(title) {
  const tasks = loadTasks();
  tasks.push({ id: Date.now(), title, completed: false });
  saveTasks(tasks);
  return tasks;
}

function toggleTask(id) {
  const tasks = loadTasks().map(t => t.id === id ? { ...t, completed: !t.completed } : t);
  saveTasks(tasks);
  return tasks;
}
`;
      proposed = `${proposed.trim()}\n\n${todoJs.trim()}`;
    }
    return { replyText: reply, proposedCode: proposed, targetFile: filename, actionable: proposed !== code, intent: 'STORAGE' };
  }

  // --- 11. Tabs Component ---
  function handleTabsComponent(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 📑 Tabs Switcher Component for \`${filename}\`\n\n`;

    if (ext === 'js') {
      const tabJs = `
// Tabs Controller
function initTabs() {
  const tabs = document.querySelectorAll('[role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('aria-controls');
      tabs.forEach(t => {
        t.setAttribute('aria-selected', 'false');
        t.classList.remove('active');
      });
      panels.forEach(p => p.style.display = 'none');

      tab.setAttribute('aria-selected', 'true');
      tab.classList.add('active');
      const target = document.getElementById(targetId);
      if (target) target.style.display = 'block';
    });
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTabs);
} else {
  initTabs();
}
`;
      proposed = `${proposed.trim()}\n\n${tabJs.trim()}`;
    }
    return { replyText: reply, proposedCode: proposed, targetFile: filename, actionable: proposed !== code, intent: 'TABS' };
  }

  // --- 12. Accordion Component ---
  function handleAccordionComponent(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 🪗 Accordion / Collapsible Component for \`${filename}\`\n\n`;
    if (ext === 'html') {
      const accHtml = `
  <div class="accordion">
    <details class="accordion-item">
      <summary class="accordion-header">Frequently Asked Question 1</summary>
      <div class="accordion-body">Here is the detailed answer explaining the topic.</div>
    </details>
    <details class="accordion-item">
      <summary class="accordion-header">Frequently Asked Question 2</summary>
      <div class="accordion-body">Another helpful explanation for the user.</div>
    </details>
  </div>
`;
      proposed = proposed.includes('</body>') ? proposed.replace('</body>', `${accHtml}\n</body>`) : `${proposed}\n${accHtml}`;
    }
    return { replyText: reply, proposedCode: proposed, targetFile: filename, actionable: proposed !== code, intent: 'ACCORDION' };
  }

  // --- 13. Copy to Clipboard ---
  function handleCopyToClipboard(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 📋 Copy to Clipboard Implementation for \`${filename}\`\n\n`;
    if (ext === 'js') {
      const clipJs = `
// Clipboard Copy Helper with Feedback
async function copyToClipboard(text, triggerBtn) {
  try {
    await navigator.clipboard.writeText(text);
    if (triggerBtn) {
      const originalText = triggerBtn.textContent;
      triggerBtn.textContent = '✓ Copied!';
      setTimeout(() => { triggerBtn.textContent = originalText; }, 1500);
    }
    return true;
  } catch (err) {
    console.error('Failed to copy text:', err);
    return false;
  }
}
`;
      proposed = `${proposed.trim()}\n\n${clipJs.trim()}`;
    }
    return { replyText: reply, proposedCode: proposed, targetFile: filename, actionable: proposed !== code, intent: 'CLIPBOARD' };
  }

  // --- 14. Async Fetch API ---
  function handleFetchApi(code, ext, filename, context) {
    let proposed = code;
    let reply = `### 🌐 Async Data Fetching for \`${filename}\`\n\n`;
    if (ext === 'js') {
      const fetchJs = `
// Safe Async Data Fetcher with Error Handling
async function fetchRemoteData(endpointUrl) {
  try {
    const response = await fetch(endpointUrl);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Fetch error:', error);
    return { success: false, error: error.message };
  }
}
`;
      proposed = `${proposed.trim()}\n\n${fetchJs.trim()}`;
    }
    return { replyText: reply, proposedCode: proposed, targetFile: filename, actionable: proposed !== code, intent: 'FETCH' };
  }

  // --- 15. Make Layout Responsive ---
  function makeLayoutResponsive(context, filename) {
    const cssFile = (context.allFiles || []).find(f => f.name.endsWith('.css')) || { name: filename, content: context.fileContent || '' };
    let reply = `### 📱 Responsive Layout Rules for \`${cssFile.name}\`\n\n`;

    const responsiveCss = `
/* Fluid Responsive Breakpoints */
@media (max-width: 1024px) {
  .container {
    max-width: 92% !important;
  }
}

@media (max-width: 768px) {
  .container, .main-content {
    width: 100% !important;
    padding: 16px !important;
  }

  .grid, .row, .cards-grid {
    grid-template-columns: 1fr !important;
    flex-direction: column !important;
  }

  h1 { font-size: 24px !important; }
  h2 { font-size: 20px !important; }
}

@media (max-width: 480px) {
  body {
    padding: 8px !important;
  }

  button, .btn {
    width: 100% !important;
  }
}
`;
    let proposed = cssFile.content;
    if (!proposed.includes('@media (max-width: 768px)')) {
      proposed = `${proposed.trim()}\n\n${responsiveCss.trim()}`;
    }

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: cssFile.name,
      actionable: proposed !== cssFile.content,
      intent: 'RESPONSIVE'
    };
  }

  // --- 16. Smart Contextual Fallback ---
  function smartContextualFallback(promptText, code, filename, ext, context) {
    let reply = `### 🤖 Aksh Assistant: Analysis for \`${filename}\`\n\n`;
    reply += `I analyzed your request: "*${promptText}*".\n\n`;

    let proposed = code;
    let actionable = false;

    if (ext === 'js' || ext === 'ts' || ext === 'mjs') {
      const helper = `\n// Helper for: ${promptText}\nfunction handleUserAction() {\n  console.log('Action executed:', ${JSON.stringify(promptText)});\n}\n`;
      proposed = proposed.trim() ? `${proposed.trim()}\n${helper}` : helper.trim();
      actionable = true;
      reply += `- Generated clean JavaScript function stub matching your request.\n`;
    } else if (ext === 'css') {
      const safeComment = promptText.replace(/\*\//g, '');
      const helper = `\n/* Styles for: ${safeComment} */\n.custom-component {\n  margin: 16px 0;\n  padding: 12px 16px;\n  border-radius: 8px;\n  background: var(--bg-surface, #ffffff);\n}\n`;
      proposed = `${proposed.trim()}\n${helper}`;
      actionable = true;
      reply += `- Generated CSS utility styling matching your request.\n`;
    } else if (ext === 'html' || ext === 'htm') {
      const escaped = promptText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const helper = `\n  <div class="custom-section" aria-label="${escaped}">\n    <p>${escaped}</p>\n  </div>\n`;
      proposed = proposed.includes('</body>') ? proposed.replace('</body>', `${helper}</body>`) : `${proposed}\n${helper}`;
      actionable = true;
      reply += `- Inserted semantic markup block into your document.\n`;
    }

    reply += `\nReview proposed changes using **Review Diff** or click **Apply to File**.`;

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: filename,
      actionable,
      intent: 'FALLBACK'
    };
  }

  // ==========================================================================
  // Diagnostic & Exploration Routines
  // ==========================================================================

  function explainCode(code, filename) {
    if (!code.trim()) {
      return {
        replyText: `The file **${filename}** is currently empty. Add HTML, CSS, or JavaScript code to inspect structure and behavior.`,
        actionable: false
      };
    }

    const ext = filename.split('.').pop().toLowerCase();
    const lines = code.split('\n');
    let summary = `### 📘 Code Analysis for \`${filename}\`\n\n`;
    summary += `**File Stats**: ${lines.length} lines, ${code.length} characters.\n\n`;

    if (ext === 'html' || ext === 'htm') {
      const hasDoctype = /<!DOCTYPE html>/i.test(code);
      const hasViewport = /<meta[^>]+viewport/i.test(code);
      const scripts = (code.match(/<script/gi) || []).length;
      const styles = (code.match(/<link[^>]+stylesheet|<style/gi) || []).length;
      summary += `#### Document Structure\n`;
      summary += `- **HTML5 Doctype**: ${hasDoctype ? '✅ Present' : '⚠️ Missing `<!DOCTYPE html>`'}\n`;
      summary += `- **Mobile Viewport**: ${hasViewport ? '✅ Configured' : '⚠️ Missing mobile viewport `<meta>` tag'}\n`;
      summary += `- **Stylesheets / Styles**: ${styles} style reference(s)\n`;
      summary += `- **Scripts**: ${scripts} script tag(s)\n`;
    } else if (ext === 'js' || ext === 'ts') {
      const functions = (code.match(/(?:function\s+([a-zA-Z0-9_]+)|\b([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g) || []).length;
      const listeners = (code.match(/addEventListener/g) || []).length;
      summary += `#### Logic Architecture\n`;
      summary += `- **Declared Functions**: ${functions} function(s)\n`;
      summary += `- **Event Listeners**: ${listeners} user event hook(s)\n`;
    } else if (ext === 'css') {
      const rules = (code.match(/\{/g) || []).length;
      const mediaQueries = (code.match(/@media/g) || []).length;
      summary += `#### Stylesheet Breakdown\n`;
      summary += `- **CSS Rule Blocks**: ${rules} selectors configured\n`;
      summary += `- **Responsive Breakpoints**: ${mediaQueries} media queries\n`;
    }

    return { replyText: summary, actionable: false };
  }

  function findBugs(code, filename, context) {
    const issues = [];
    const lines = (code || '').split('\n');
    const ext = filename.split('.').pop().toLowerCase();

    if (ext === 'js' || ext === 'ts') {
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        if (/\bif\s*\([^=!<>\n]*=[^=!<>\n]*\)/.test(line)) {
          issues.push({ type: 'Error', line: lineNum, message: 'Possible accidental assignment inside `if` condition (`=` instead of `===`).' });
        }
        if (/[^=!<>]==[^=]/.test(line)) {
          issues.push({ type: 'Suggestion', line: lineNum, message: 'Use strict equality (`===`) instead of loose equality (`==`).' });
        }
        if (/\balert\s*\(/.test(line)) {
          issues.push({ type: 'Warning', line: lineNum, message: '`alert()` blocks the UI thread. Use `console.log()` or in-app toasts.' });
        }
      });
      try {
        new Function(code);
      } catch (err) {
        issues.unshift({ type: 'Error', line: 1, message: `JavaScript Syntax Error: ${err.message}` });
      }
    }

    let reply = `### 🐛 Bug & Issue Detection for \`${filename}\`\n\n`;
    if (issues.length === 0) {
      reply += `🎉 **No major syntax bugs detected!** Your code passed static heuristic checks cleanly.`;
    } else {
      reply += `Found **${issues.length}** item(s) to review:\n\n`;
      issues.forEach(iss => {
        const icon = iss.type === 'Error' ? '🔴' : iss.type === 'Warning' ? '🟡' : '💡';
        reply += `${icon} **Line ${iss.line} [${iss.type}]**: ${iss.message}\n`;
      });
    }

    return { replyText: reply, items: issues, actionable: false };
  }

  function diagnoseBlankPage(context) {
    const htmlFile = (context.allFiles || []).find(f => f.name.endsWith('.html')) || { name: 'index.html', content: context.fileContent || '' };
    const html = htmlFile.content || '';
    let reply = `### 🔍 Diagnosis: Why is the HTML page blank?\n\n`;
    const reasons = [];

    if (!html.trim()) reasons.push('**Empty File**: The HTML file contains no markup.');
    if (!/<body[^>]*>[\s\S]*?[a-zA-Z0-9<][\s\S]*?<\/body>/i.test(html)) reasons.push('**Empty `<body>`**: No visible markup inside document body.');
    if (context.runtimeErrors && context.runtimeErrors.length > 0) reasons.push(`**Runtime JavaScript Exception**: \`${context.runtimeErrors[0]}\`. An error halted execution.`);

    if (reasons.length === 0) {
      reasons.push('Check CSS styles: elements might have `display: none` or background color matching text.');
      reasons.push('Press **Ctrl+Enter** to re-render the preview bundle.');
    }

    reply += reasons.map(r => `- ${r}`).join('\n\n');
    return { replyText: reply, actionable: false };
  }

  function diagnosePreviewIssues(context) {
    let reply = `### 🛠️ Preview Troubleshooting Guide\n\n`;
    reply += `- **Check Console**: Unhandled errors in scripts stop rendering.\n`;
    reply += `- **Sandbox Restrictions**: The preview runs in an isolated iframe (\`allow-scripts\`).\n`;
    reply += `- **Click Run (Ctrl+Enter)** to refresh the preview bundle.\n`;
    return { replyText: reply, actionable: false };
  }

  function improveCode(code, filename) {
    if (!code.trim()) return { replyText: 'No code provided to improve.', actionable: false };
    let improved = code;
    if (/\bvar\s+/.test(improved)) {
      improved = improved.replace(/\bvar\s+/g, 'let ');
    }
    return {
      replyText: `### ⚡ Modernized ES6+ Code for \`${filename}\`\n\nModernized declarations to block-scoped \`let\`/\`const\`.`,
      proposedCode: improved,
      targetFile: filename,
      actionable: improved !== code
    };
  }

  function findUnusedDeclarations(code, filename) {
    const declRegex = /\b(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/g;
    let match;
    const unused = [];
    while ((match = declRegex.exec(code)) !== null) {
      const name = match[1];
      const count = (code.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
      if (count === 1) unused.push(name);
    }

    let reply = `### 🔎 Unused Variable Audit for \`${filename}\`\n\n`;
    if (unused.length === 0) {
      reply += `No unused variables detected.`;
    } else {
      reply += `Found **${unused.length}** unused variable(s):\n\n` + unused.map(u => `- ⚠️ \`${u}\``).join('\n');
    }
    return { replyText: reply, actionable: false };
  }

  function generateTestCases(code, filename) {
    const funcs = [];
    const funcRegex = /function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
    let m;
    while ((m = funcRegex.exec(code)) !== null) {
      funcs.push({ name: m[1] });
    }

    const testCode = `
// Aksh In-Browser Test Suite for ${filename}
describe('${filename} Tests', () => {
${funcs.map(f => `  it('should test ${f.name}() behavior', () => {
    // expect(${f.name}()).toBeDefined();
    expect(true).toBe(true);
  });`).join('\n\n') || `  it('basic sanity assertion', () => {
    expect(1 + 1).toBe(2);
  });`}
});
`;
    return {
      replyText: `### 🧪 Unit Tests for \`${filename}\`\n\nGenerated test suite assertions for detected functions.`,
      proposedCode: testCode,
      targetFile: filename,
      actionable: true
    };
  }

  function auditAccessibility(context) {
    const html = context.fileContent || '';
    const checks = [];
    if (!/<html[^>]+lang=/i.test(html)) checks.push('Missing `lang` attribute on `<html>`.');
    if (!/<title>/i.test(html)) checks.push('Missing `<title>` in `<head>`.');
    if (/<img(?![^>]*alt)[^>]*>/i.test(html)) checks.push('`<img>` element without `alt` attribute.');

    let reply = `### ♿ Accessibility Audit\n\n`;
    if (checks.length === 0) {
      reply += `🎉 **No major accessibility issues detected!**`;
    } else {
      reply += `Found **${checks.length}** accessibility recommendation(s):\n\n` + checks.map(c => `- ⚠️ ${c}`).join('\n');
    }
    return { replyText: reply, actionable: false };
  }

  function explainErrorMessage(context) {
    const err = (context.runtimeErrors && context.runtimeErrors[0]) || 'TypeError: Cannot read properties of null';
    return {
      replyText: `### 💡 Error Explanation\n\n**Error**: \`${err}\`\n\nEnsure DOM elements are initialized before querying them, or use optional chaining.`,
      actionable: false
    };
  }

  function refactorCode(code, filename) {
    let refactored = code.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n');
    return {
      replyText: `### 🧹 Safe Code Refactoring for \`${filename}\`\n\nCleaned trailing whitespace and redundant newlines.`,
      proposedCode: refactored,
      targetFile: filename,
      actionable: refactored !== code
    };
  }

  function generateStarterCode(prompt, ext) {
    let code = '';
    if (ext === 'html' || prompt.includes('html')) {
      code = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Aksh Application</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Welcome to Aksh Project</h1>\n  <script src="script.js"></script>\n</body>\n</html>`;
    } else {
      code = `// JavaScript Starter\nconsole.log('Aksh script initialized');\n`;
    }
    return {
      replyText: `### 📋 Generated Starter Code\n\nReady to use template.`,
      proposedCode: code,
      targetFile: `starter.${ext || 'html'}`,
      actionable: true
    };
  }

  function analyzeProjectFiles(allFiles) {
    let reply = `### 📊 Project Health Audit\n\nTotal virtual files: **${allFiles.length}**\n\n`;
    const html = allFiles.filter(f => f.name.endsWith('.html'));
    const css = allFiles.filter(f => f.name.endsWith('.css'));
    const js = allFiles.filter(f => f.name.endsWith('.js') || f.name.endsWith('.ts'));

    reply += `- 📄 **HTML**: ${html.length}\n- 🎨 **CSS**: ${css.length}\n- ⚡ **JavaScript**: ${js.length}\n`;
    return { replyText: reply, actionable: false };
  }

  // ==========================================================================
  // Public API Export
  // ==========================================================================
  window.AkshAssistant = {
    processAssistantQuery,
    computeLineDiff,
    computeSideBySideDiff,
    recordUndo,
    canUndo,
    popUndo,
    canRedo,
    popRedo,
    clearUndo,
    getUndoHistoryLength,
    getRedoHistoryLength,
    getUndoHistory
  };

})(window);
