/**
 * Aksh Code Playground — Aksh Local Code Assistant Engine
 * Pure client-side static analysis, heuristic reasoning, and code refactoring.
 * 100% offline, zero external AI APIs, complete code privacy.
 */

(function (window) {
  'use strict';

  // History of applied changes for safe Undo
  const undoHistory = [];

  // ==========================================================================
  // Diff Calculation Engine
  // ==========================================================================
  /**
   * Generates a line-by-line diff between original and proposed code.
   * Returns an array of diff lines: { type: 'eq'|'add'|'del', lineOld, lineNew, text }
   */
  function computeLineDiff(originalText, proposedText) {
    const origLines = (originalText || '').split('\n');
    const propLines = (proposedText || '').split('\n');
    const diff = [];

    // Simple Myers/LCS diff algorithm for clean visualization
    const lcs = computeLCS(origLines, propLines);
    let i = 0;
    let j = 0;
    let lineOld = 1;
    let lineNew = 1;

    for (const match of lcs) {
      // Deletions
      while (i < match.i) {
        diff.push({ type: 'del', lineOld: lineOld++, lineNew: null, text: origLines[i] });
        i++;
      }
      // Additions
      while (j < match.j) {
        diff.push({ type: 'add', lineOld: null, lineNew: lineNew++, text: propLines[j] });
        j++;
      }
      // Equal
      diff.push({ type: 'eq', lineOld: lineOld++, lineNew: lineNew++, text: origLines[i] });
      i++;
      j++;
    }

    while (i < origLines.length) {
      diff.push({ type: 'del', lineOld: lineOld++, lineNew: null, text: origLines[i] });
      i++;
    }
    while (j < propLines.length) {
      diff.push({ type: 'add', lineOld: null, lineNew: lineNew++, text: propLines[j] });
      j++;
    }

    return diff;
  }

  function computeLCS(a, b) {
    const m = a.length;
    const n = b.length;
    // For large files (> 600 lines), use fast windowed heuristic
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
      for (let j = jStart; j < Math.min(b.length, jStart + 20); j++) {
        if (a[i] === b[j]) {
          matches.push({ i, j });
          jStart = j + 1;
          break;
        }
      }
    }
    return matches;
  }

  // ==========================================================================
  // Prompt Matching & Heuristic Handlers
  // ==========================================================================

  /**
   * Processes a user request with context.
   * @param {string} promptText
   * @param {Object} context { activeFile, fileContent, selectedText, allFiles, runtimeErrors }
   * @returns {Object} { replyText, proposedCode, category, items, actionable }
   */
  async function processAssistantQuery(promptText, context) {
    const prompt = (promptText || '').trim().toLowerCase();
    const code = context.selectedText || context.fileContent || '';
    const file = context.activeFile || 'index.html';
    const ext = file.split('.').pop().toLowerCase();

    // 1. "Explain this code" / "Explain this function"
    if (prompt.includes('explain') && !prompt.includes('error')) {
      return explainCode(code, file);
    }

    // 2. "Find bugs" / "Check for errors"
    if (prompt.includes('find bug') || prompt.includes('find error') || prompt.includes('syntax check') || prompt.includes('lint')) {
      return findBugs(code, file, context);
    }

    // 3. "Why is my HTML page blank?" / "Why blank"
    if (prompt.includes('blank') || prompt.includes('page is blank') || prompt.includes('nothing shows')) {
      return diagnoseBlankPage(context);
    }

    // 4. "Why is the preview not working?"
    if (prompt.includes('preview') && (prompt.includes('not working') || prompt.includes('broken') || prompt.includes('fail'))) {
      return diagnosePreviewIssues(context);
    }

    // 5. "Improve this function" / "Improve this code" / "Better algorithm"
    if (prompt.includes('improve') || prompt.includes('better algorithm') || prompt.includes('optimize') || prompt.includes('performance')) {
      return improveCode(code, file);
    }

    // 6. "Make this layout responsive" / "Responsive"
    if (prompt.includes('responsive') || prompt.includes('mobile') || prompt.includes('viewport')) {
      return makeLayoutResponsive(context);
    }

    // 7. "Find unused variables" / "Unused"
    if (prompt.includes('unused')) {
      return findUnusedDeclarations(code, file);
    }

    // 8. "Add input validation" / "Validation"
    if (prompt.includes('validation') || prompt.includes('validate')) {
      return addInputValidation(context);
    }

    // 9. "Create a test case" / "Unit test"
    if (prompt.includes('test case') || prompt.includes('unit test') || prompt.includes('testing')) {
      return generateTestCases(code, file);
    }

    // 10. "Find accessibility problems" / "a11y"
    if (prompt.includes('accessibility') || prompt.includes('a11y') || prompt.includes('contrast')) {
      return auditAccessibility(context);
    }

    // 11. "Explain this error message" / "Error"
    if (prompt.includes('explain') && prompt.includes('error')) {
      return explainErrorMessage(context);
    }

    // 12. "Refactor this file without changing its behavior" / "Refactor"
    if (prompt.includes('refactor')) {
      return refactorCode(code, file);
    }

    // 13. "Generate starter HTML page" / "Generate example"
    if (prompt.includes('generate') || prompt.includes('starter') || prompt.includes('boilerplate')) {
      return generateStarterCode(prompt, ext);
    }

    // 14. "Analyze Project" / Default broad analysis
    if (prompt.includes('analyze') || prompt.includes('audit')) {
      return analyzeProjectFiles(context.allFiles || []);
    }

    // Fallback: Smart keyword-directed inspection
    return fallbackResponse(promptText, code, file, context);
  }

  // ==========================================================================
  // Detailed Analysis Implementations
  // ==========================================================================

  function explainCode(code, filename) {
    if (!code.trim()) {
      return {
        replyText: `The file **${filename}** is currently empty. Add HTML, CSS, or JavaScript code, and I will break down its structure, dependencies, and logic.`,
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
      const headings = (code.match(/<h[1-6]/gi) || []).length;
      const forms = (code.match(/<form/gi) || []).length;
      const buttons = (code.match(/<button/gi) || []).length;

      summary += `#### Document Structure\n`;
      summary += `- **HTML5 Doctype**: ${hasDoctype ? '✅ Present' : '⚠️ Missing `<!DOCTYPE html>`'}\n`;
      summary += `- **Mobile Viewport**: ${hasViewport ? '✅ Configured' : '⚠️ Missing mobile viewport `<meta>` tag'}\n`;
      summary += `- **Stylesheets / Styles**: ${styles} style reference(s)\n`;
      summary += `- **Scripts**: ${scripts} script tag(s)\n`;
      summary += `- **Interactive Elements**: ${headings} headings, ${buttons} buttons, ${forms} forms.\n\n`;
      summary += `#### Behavior Summary\nThis HTML document defines the structural markup and visual layout for your application. It mounts the visual DOM tree and binds linked assets into the sandboxed live preview.`;
    } else if (ext === 'js' || ext === 'mjs' || ext === 'ts') {
      const functions = (code.match(/(?:function\s+([a-zA-Z0-9_]+)|\b([a-zA-Z0-9_]+)\s*=\s*(?:function|\([^)]*\)\s*=>))/g) || []).length;
      const listeners = (code.match(/addEventListener/g) || []).length;
      const fetches = (code.match(/\bfetch\(|axios|ajax/g) || []).length;
      const domQueries = (code.match(/document\.(getElementById|querySelector|querySelectorAll|getElementsByClassName)/g) || []).length;

      summary += `#### Logic Architecture\n`;
      summary += `- **Declared Functions**: ${functions} function(s)\n`;
      summary += `- **Event Listeners**: ${listeners} user event hook(s)\n`;
      summary += `- **DOM Queries**: ${domQueries} element lookup(s)\n`;
      summary += `- **Network Requests**: ${fetches} HTTP/fetch call(s)\n\n`;
      summary += `#### Purpose & Execution\nThis script runs in the preview browser context. It attaches event handlers to UI components, manages state in memory, and manipulates the document DOM.`;
    } else if (ext === 'css') {
      const rules = (code.match(/\{/g) || []).length;
      const mediaQueries = (code.match(/@media/g) || []).length;
      const flexboxes = (code.match(/display:\s*flex/g) || []).length;
      const grids = (code.match(/display:\s*grid/g) || []).length;

      summary += `#### Stylesheet Breakdown\n`;
      summary += `- **CSS Rule Blocks**: ${rules} selectors configured\n`;
      summary += `- **Responsive Media Queries**: ${mediaQueries} breakpoints\n`;
      summary += `- **Modern Layouts**: ${flexboxes} Flexbox container(s), ${grids} CSS Grid container(s)\n\n`;
      summary += `#### Design Purpose\nDefines color palettes, typography, spacing, and responsive layout behavior across desktop, tablet, and mobile viewport widths.`;
    } else if (ext === 'py') {
      summary += `#### Python Module Breakdown\n`;
      summary += `- **Language**: Python 3 (Pyodide WebAssembly)\n`;
      summary += `- **Execution**: In-browser client-side execution via WASM\n`;
      summary += `- **Standard Output**: Redirects to the execution console\n`;
    } else if (ext === 'sql') {
      summary += `#### SQL Script Breakdown\n`;
      summary += `- **Engine**: In-Browser Relational SQLite Engine\n`;
      summary += `- **Operations**: Data definition and querying against local browser tables\n`;
    } else {
      summary += `Text file containing configuration, documentation, or structured data.`;
    }

    return {
      replyText: summary,
      actionable: false
    };
  }

  function findBugs(code, filename, context) {
    const issues = [];
    const lines = (code || '').split('\n');
    const ext = filename.split('.').pop().toLowerCase();

    if (ext === 'js' || ext === 'ts') {
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        // Accidental assignment in if statement: if (x = 5)
        if (/\bif\s*\([^=!<>\n]*=[^=!<>\n]*\)/.test(line)) {
          issues.push({
            type: 'Error',
            line: lineNum,
            message: 'Possible accidental assignment inside `if` condition (`=` instead of `===` or `==`).',
            suggestedFix: line.replace(/(\bif\s*\([^=!<>\n]*)=([^=!<>\n]*\))/, '$1===$2')
          });
        }
        // Loose equality ==
        if (/[^=!<>]==[^=]/.test(line)) {
          issues.push({
            type: 'Suggestion',
            line: lineNum,
            message: 'Use strict equality (`===`) instead of loose equality (`==`) to avoid unexpected type coercion.',
            suggestedFix: line.replace(/([^=!<>])==([^=])/g, '$1===$2')
          });
        }
        // Alert statement left in code
        if (/\balert\s*\(/.test(line)) {
          issues.push({
            type: 'Warning',
            line: lineNum,
            message: '`alert()` blocks the browser UI thread. Consider using an in-app toast or modal.',
            suggestedFix: line.replace(/\balert\s*\((.*?)\);?/, 'console.log($1);')
          });
        }
        // Unsafe innerHTML
        if (/\.innerHTML\s*=/.test(line)) {
          issues.push({
            type: 'Security',
            line: lineNum,
            message: 'Direct assignment to `innerHTML` may be vulnerable to XSS if input contains untrusted data. Prefer `textContent` or sanitized DOM nodes.',
            suggestedFix: line.replace(/\.innerHTML\s*=/, '.textContent =')
          });
        }
      });

      // Syntax check
      try {
        new Function(code);
      } catch (err) {
        issues.unshift({
          type: 'Error',
          line: 1,
          message: `JavaScript Syntax Error: ${err.message}`,
          suggestedFix: null
        });
      }
    } else if (ext === 'html' || ext === 'htm') {
      if (!/<!DOCTYPE html>/i.test(code)) {
        issues.push({
          type: 'Warning',
          line: 1,
          message: 'Missing `<!DOCTYPE html>`. Modern browsers may enter Quirks Mode.',
          suggestedFix: `<!DOCTYPE html>\n${code}`
        });
      }
      if (!/<meta[^>]+viewport/i.test(code)) {
        issues.push({
          type: 'Accessibility',
          line: 2,
          message: 'Missing `<meta name="viewport" content="width=device-width, initial-scale=1.0">`. Page will not render responsively on mobile devices.',
          suggestedFix: null
        });
      }
      // Missing alt attributes
      lines.forEach((line, idx) => {
        if (/<img(?![^>]*alt=)[^>]*>/i.test(line)) {
          issues.push({
            type: 'Accessibility',
            line: idx + 1,
            message: '`<img>` tag is missing an `alt` attribute for screen reader accessibility.',
            suggestedFix: line.replace(/<img/i, '<img alt="Image description"')
          });
        }
      });
    }

    let reply = `### 🐛 Bug & Issue Detection for \`${filename}\`\n\n`;
    if (issues.length === 0) {
      reply += `🎉 **No major syntax bugs detected!** Your code passed static heuristic checks cleanly.\n\n`;
      reply += `Run the code (Ctrl+Enter) to verify runtime behavior in the sandboxed preview.`;
      return { replyText: reply, items: [], actionable: false };
    }

    reply += `Found **${issues.length}** item(s) to review:\n\n`;
    issues.forEach(iss => {
      const badgeIcon = iss.type === 'Error' ? '🔴' : iss.type === 'Warning' ? '🟡' : iss.type === 'Security' ? '🛡️' : '💡';
      reply += `${badgeIcon} **Line ${iss.line} [${iss.type}]**: ${iss.message}\n`;
    });

    return {
      replyText: reply,
      items: issues,
      actionable: issues.some(i => i.suggestedFix !== null)
    };
  }

  function diagnoseBlankPage(context) {
    const htmlFile = (context.allFiles || []).find(f => f.name.endsWith('.html')) || { name: 'index.html', content: context.fileContent || '' };
    const html = htmlFile.content || '';
    let reply = `### 🔍 Diagnosis: Why is the HTML page blank?\n\n`;

    const reasons = [];

    if (!html.trim()) {
      reasons.push('**Empty File**: The HTML file is completely blank. Add HTML content to render visual elements.');
    }
    if (!/<body[^>]*>[\s\S]*?[a-zA-Z0-9<][\s\S]*?<\/body>/i.test(html)) {
      reasons.push('**Empty `<body>`**: Your document body contains no visible markup or text.');
    }
    if (html.includes('<script') && !html.includes('defer') && !html.includes('DOMContentLoaded') && /document\.getElementById|document\.querySelector/.test(context.fileContent || '')) {
      reasons.push('**Script Blocking / Early DOM Access**: A script might be trying to query elements before the DOM has finished parsing. Ensure scripts are placed before `</body>` or wrapped in `DOMContentLoaded`.');
    }
    if (context.runtimeErrors && context.runtimeErrors.length > 0) {
      reasons.push(`**Runtime JavaScript Exception**: The preview reported: \`${context.runtimeErrors[0]}\`. An unhandled error can abort script execution.`);
    }

    if (reasons.length === 0) {
      reasons.push('Check CSS styles: elements might have `display: none`, `opacity: 0`, or color matching the background.');
      reasons.push('Click **Run (Ctrl+Enter)** to refresh the preview iframe bundle.');
    }

    reply += reasons.map(r => `- ${r}`).join('\n\n');
    return { replyText: reply, actionable: false };
  }

  function diagnosePreviewIssues(context) {
    let reply = `### 🛠️ Preview Troubleshooting Guide\n\n`;
    reply += `- **Check JavaScript Errors**: Open the **Console** tab below. If an unhandled exception occurred, preview execution stops.\n`;
    reply += `- **Verify File Links**: If using external fonts or CDNs, ensure the URL uses \`https://\` and permits cross-origin framing.\n`;
    reply += `- **Browser Security Restrictions**: The preview runs inside an isolated iframe with \`sandbox="allow-scripts allow-modals"\`. Cookies, parent localStorage, and top-level navigation are blocked by design for your safety.\n`;
    reply += `- **Infinite Loops**: If code enters \`while(true)\` without a break, the preview thread will freeze. Click **Stop** in the top bar to terminate execution.\n`;
    return { replyText: reply, actionable: false };
  }

  function improveCode(code, filename) {
    if (!code.trim()) return { replyText: 'No code provided to improve.', actionable: false };

    let improved = code;
    const suggestions = [];

    // 1. Convert var to const/let
    if (/\bvar\s+/.test(improved)) {
      improved = improved.replace(/\bvar\s+/g, 'let ');
      suggestions.push('Modernized legacy `var` declarations to `let` / `const` for block scoping.');
    }

    // 2. String concatenation to template literals
    if (/['"]\s*\+\s*[a-zA-Z0-9_.]+\s*\+\s*['"]/.test(improved)) {
      suggestions.push('Recommended template literals (`${var}`) instead of string concatenation.');
    }

    // 3. Arrow function syntax
    if (/function\s*\(([^)]*)\)\s*\{/.test(improved)) {
      suggestions.push('Consider modern arrow functions `(args) => { ... }` for cleaner callback syntax.');
    }

    let reply = `### ⚡ Code Improvements & Modernization for \`${filename}\`\n\n`;
    if (suggestions.length === 0) {
      reply += `Your code already follows modern ES6+ conventions! No immediate algorithmic refactoring required.`;
      return { replyText: reply, actionable: false };
    }

    reply += suggestions.map(s => `- ✅ ${s}`).join('\n');
    reply += `\n\nClick **Preview Changes (Diff)** below to review and apply the modernized version.`;

    return {
      replyText: reply,
      proposedCode: improved,
      actionable: improved !== code
    };
  }

  function makeLayoutResponsive(context) {
    const cssFile = (context.allFiles || []).find(f => f.name.endsWith('.css')) || { name: 'style.css', content: '' };
    const htmlFile = (context.allFiles || []).find(f => f.name.endsWith('.html')) || { name: 'index.html', content: '' };

    let reply = `### 📱 Responsive Layout Guide & Proposed Enhancements\n\n`;
    reply += `To ensure your layout looks great on Mobile (375px), Tablet (768px), and Desktop (1200px):\n\n`;
    reply += `1. **Mobile Viewport Tag**: Ensure your \`<head>\` contains:\n`;
    reply += `\`\`\`html\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n\`\`\`\n\n`;
    reply += `2. **Fluid Media Query Snippet** (Add to your CSS):\n`;

    const responsiveCssSnippet = `
/* Responsive Mobile & Tablet Rules */
@media (max-width: 768px) {
  .container {
    width: 100% !important;
    max-width: 100% !important;
    padding: 16px !important;
  }

  .grid, .row, .cards-grid {
    grid-template-columns: 1fr !important;
    flex-direction: column !important;
  }

  h1 {
    font-size: 22px !important;
  }
}
`;

    reply += `\`\`\`css${responsiveCssSnippet}\`\`\`\n`;

    let proposed = cssFile.content;
    if (!proposed.includes('@media (max-width: 768px)')) {
      proposed = `${proposed.trim()}\n${responsiveCssSnippet}`;
    }

    return {
      replyText: reply,
      proposedCode: proposed,
      targetFile: cssFile.name,
      actionable: true
    };
  }

  function findUnusedDeclarations(code, filename) {
    const lines = (code || '').split('\n');
    const unused = [];

    // Simple heuristic parser for declared variables
    const declRegex = /\b(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/g;
    let match;
    const declared = [];

    while ((match = declRegex.exec(code)) !== null) {
      declared.push({ name: match[1], index: match.index });
    }

    declared.forEach(d => {
      // Count occurrences
      const name = d.name;
      const occRegex = new RegExp(`\\b${name}\\b`, 'g');
      const count = (code.match(occRegex) || []).length;
      if (count === 1) {
        unused.push(name);
      }
    });

    let reply = `### 🔎 Unused Variable Audit for \`${filename}\`\n\n`;
    if (unused.length === 0) {
      reply += `No unused local variables detected. All declared variables are referenced.`;
    } else {
      reply += `Found **${unused.length}** variable(s) declared but never read:\n\n`;
      reply += unused.map(u => `- ⚠️ \`${u}\``).join('\n');
      reply += `\n\n*Removing unused declarations reduces bundle size and memory usage.*`;
    }

    return { replyText: reply, actionable: false };
  }

  function addInputValidation(context) {
    let reply = `### 🛡️ Client-Side Form Validation Snippet\n\n`;
    reply += `Here is a robust, safe form validation pattern that validates required fields, email format, and prevents default submission on error:\n\n`;

    const validationJs = `
function validateForm(formElement) {
  const inputs = formElement.querySelectorAll('input, textarea');
  let isValid = true;

  inputs.forEach(input => {
    // Check required
    if (input.hasAttribute('required') && !input.value.trim()) {
      showInputError(input, 'This field is required.');
      isValid = false;
    } else if (input.type === 'email' && input.value) {
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      if (!emailRegex.test(input.value.trim())) {
        showInputError(input, 'Please enter a valid email address.');
        isValid = false;
      } else {
        clearInputError(input);
      }
    } else {
      clearInputError(input);
    }
  });

  return isValid;
}

function showInputError(input, message) {
  input.classList.add('input-error');
  let errorEl = input.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains('error-msg')) {
    errorEl = document.createElement('span');
    errorEl.className = 'error-msg';
    errorEl.style.color = '#ef4444';
    errorEl.style.fontSize = '12px';
    input.parentNode.insertBefore(errorEl, input.nextSibling);
  }
  errorEl.textContent = message;
}

function clearInputError(input) {
  input.classList.remove('input-error');
  const errorEl = input.nextElementSibling;
  if (errorEl && errorEl.classList.contains('error-msg')) {
    errorEl.remove();
  }
}
`;

    reply += `\`\`\`javascript${validationJs}\`\`\`\n`;
    return {
      replyText: reply,
      proposedCode: (context.fileContent || '') + '\n' + validationJs,
      actionable: true
    };
  }

  function generateTestCases(code, filename) {
    let reply = `### 🧪 Unit Test Cases for \`${filename}\`\n\n`;

    // Extract function names
    const funcs = [];
    const funcRegex = /function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g;
    let m;
    while ((m = funcRegex.exec(code)) !== null) {
      funcs.push({ name: m[1], args: m[2] });
    }

    if (funcs.length === 0) {
      reply += `No standalone named functions found in this file to test. Here is a generic browser test suite pattern using the Aksh Test Runner:\n\n`;
    } else {
      reply += `Generated test assertions for detected functions: **${funcs.map(f => f.name).join(', ')}**:\n\n`;
    }

    const testCode = `
// Aksh In-Browser Test Suite
describe('${filename} Test Suite', () => {
${funcs.map(f => `  it('should test ${f.name}() behavior', () => {
    // Arrange & Act
    // const result = ${f.name}();
    // Assert
    // expect(result).toBeDefined();
  });`).join('\n\n') || `  it('should run basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect(true).toBe(true);
  });`}
});
`;

    reply += `\`\`\`javascript${testCode}\`\`\`\n`;
    reply += `You can run these tests in the **Tests & QA** panel!`;

    return {
      replyText: reply,
      proposedCode: testCode,
      actionable: true
    };
  }

  function auditAccessibility(context) {
    const html = context.fileContent || '';
    const checks = [];

    if (!/<html[^>]+lang=/i.test(html)) {
      checks.push('Missing `lang` attribute on `<html>` tag (e.g. `<html lang="en">`).');
    }
    if (!/<title>/i.test(html)) {
      checks.push('Missing `<title>` element in `<head>`.');
    }
    if (/<button(?![^>]*aria-label)[^>]*>\s*<\/button>/i.test(html)) {
      checks.push('Empty `<button>` tag found with no text content and no `aria-label`.');
    }
    if (/<img(?![^>]*alt)[^>]*>/i.test(html)) {
      checks.push('`<img>` element without `alt` attribute.');
    }

    let reply = `### ♿ WCAG 2.1 Accessibility Audit\n\n`;
    if (checks.length === 0) {
      reply += `🎉 **No major accessibility issues found!** Clean semantic tags, titles, and image alts detected.`;
    } else {
      reply += `Found **${checks.length}** accessibility recommendation(s):\n\n`;
      reply += checks.map(c => `- ⚠️ ${c}`).join('\n');
    }

    return { replyText: reply, actionable: false };
  }

  function explainErrorMessage(context) {
    const err = (context.runtimeErrors && context.runtimeErrors[0]) || 'TypeError: Cannot read properties of null';
    let reply = `### 💡 Error Explanation\n\n`;
    reply += `**Captured Error**: \`${err}\`\n\n`;

    if (err.includes('Cannot read properties of null') || err.includes('Cannot read property')) {
      reply += `#### Cause\nYour JavaScript is attempting to access a property (like \`.value\`, \`.addEventListener\`, or \`.style\`) on a variable that evaluated to \`null\` or \`undefined\`.\n\n`;
      reply += `#### Common Fix\n1. Check if the element ID or selector in \`document.getElementById('id')\` matches your HTML exactly.\n2. Ensure the script runs after the DOM is rendered, or use optional chaining: \`element?.addEventListener(...)\`.`;
    } else if (err.includes('is not defined')) {
      reply += `#### Cause\nA variable or function was called before being declared, or is out of scope.\n\n`;
      reply += `#### Common Fix\nVerify spelling and ensure the variable is declared with \`const\` or \`let\` before usage.`;
    } else {
      reply += `Inspect the line indicated in the stack trace, check types, and verify that parameters are initialized.`;
    }

    return { replyText: reply, actionable: false };
  }

  function refactorCode(code, filename) {
    let refactored = code;
    // Format spacing, remove multiple blank lines, clean trailing spaces
    refactored = refactored.replace(/[ \t]+$/gm, '');
    refactored = refactored.replace(/\n{3,}/g, '\n\n');

    let reply = `### 🧹 Safe Code Refactoring for \`${filename}\`\n\n`;
    reply += `- Cleaned trailing whitespace\n`;
    reply += `- Consolidated redundant blank lines\n`;
    reply += `- Preserved exact behavioral logic\n\n`;
    reply += `Review the proposed changes using **Preview Changes (Diff)** below.`;

    return {
      replyText: reply,
      proposedCode: refactored,
      actionable: refactored !== code
    };
  }

  function generateStarterCode(prompt, ext) {
    let reply = `### 📋 Generated Starter Template\n\n`;
    let code = '';

    if (ext === 'html' || prompt.includes('html')) {
      code = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aksh Application</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>Welcome to Aksh Project</h1>
  </header>
  <main>
    <p>This is a starter web page generated locally by Aksh Code Assistant.</p>
  </main>
  <script src="script.js"></script>
</body>
</html>`;
    } else if (ext === 'py' || prompt.includes('python')) {
      code = `# Python Starter Module
def calculate_summary(numbers):
    return {
        "count": len(numbers),
        "total": sum(numbers),
        "mean": sum(numbers) / len(numbers) if numbers else 0
    }

data = [12, 45, 68, 23, 91, 54]
summary = calculate_summary(data)
print("Data Summary:", summary)
`;
    } else if (ext === 'sql' || prompt.includes('sql')) {
      code = `-- SQL Query Starter
SELECT e.name, e.role, d.name AS department, e.salary
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE e.salary > 100000
ORDER BY e.salary DESC;
`;
    } else {
      code = `// JavaScript Starter
console.log('Aksh script initialized');

function init() {
  console.log('App ready');
}

window.addEventListener('DOMContentLoaded', init);
`;
    }

    reply += `\`\`\`${ext}\n${code}\n\`\`\`\n`;
    return {
      replyText: reply,
      proposedCode: code,
      actionable: true
    };
  }

  function analyzeProjectFiles(allFiles) {
    let reply = `### 📊 Aksh Project-Wide Health Audit\n\n`;
    reply += `**Total Virtual Files**: ${allFiles.length}\n\n`;

    const htmlFiles = allFiles.filter(f => f.name.endsWith('.html'));
    const cssFiles = allFiles.filter(f => f.name.endsWith('.css'));
    const jsFiles = allFiles.filter(f => f.name.endsWith('.js') || f.name.endsWith('.ts'));

    reply += `- 📄 **HTML Pages**: ${htmlFiles.length} (${htmlFiles.map(f => f.name).join(', ') || 'none'})\n`;
    reply += `- 🎨 **Stylesheets**: ${cssFiles.length} (${cssFiles.map(f => f.name).join(', ') || 'none'})\n`;
    reply += `- ⚡ **Scripts**: ${jsFiles.length} (${jsFiles.map(f => f.name).join(', ') || 'none'})\n\n`;

    // Check entry point
    if (!htmlFiles.some(f => f.name === 'index.html')) {
      reply += `⚠️ **Warning**: No \`index.html\` entry file found in project root. The preview bundle looks for \`index.html\` by default.\n\n`;
    } else {
      reply += `✅ **Entry Point**: \`index.html\` found.\n\n`;
    }

    reply += `**Storage Status**: Stored locally in your device/browser session. 100% private.`;
    return { replyText: reply, actionable: false };
  }

  function fallbackResponse(promptText, code, filename, context) {
    let reply = `### 🤖 Aksh Local Assistant\n\n`;
    reply += `I analyzed your request: "*${promptText}*" for file \`${filename}\`.\n\n`;
    reply += `As a **Local-First Code Assistant**, I analyze and refactor code directly inside your browser without sending source code to external cloud APIs.\n\n`;
    reply += `**Available Actions**:\n`;
    reply += `- 🔍 Click **Analyze Project** for a health audit\n`;
    reply += `- 💡 Click **Explain Code** for an architecture breakdown\n`;
    reply += `- 🐛 Click **Find Bugs** for static linter checks\n`;
    reply += `- ⚡ Click **Improve Code** to modernize ES6+ syntax\n`;
    reply += `- 📱 Ask "*Make this layout responsive*"\n`;
    reply += `- 🛡️ Ask "*Add input validation*"\n`;
    reply += `- ♿ Ask "*Find accessibility problems*"`;

    return { replyText: reply, actionable: false };
  }

  // ==========================================================================
  // Undo & Change Management
  // ==========================================================================
  function recordUndo(fileName, previousContent) {
    undoHistory.push({
      targetFile: fileName,
      fileName: fileName,
      previousContent: previousContent,
      content: previousContent,
      timestamp: new Date()
    });
    // Keep max 20 undos
    if (undoHistory.length > 20) undoHistory.shift();
  }

  function canUndo() {
    return undoHistory.length > 0;
  }

  function popUndo() {
    return undoHistory.pop() || null;
  }

  function clearUndo() {
    undoHistory.length = 0;
  }

  function getUndoHistoryLength() {
    return undoHistory.length;
  }

  // Export
  window.AkshAssistant = {
    processAssistantQuery,
    computeLineDiff,
    recordUndo,
    canUndo,
    popUndo,
    clearUndo,
    getUndoHistoryLength
  };

})(window);
