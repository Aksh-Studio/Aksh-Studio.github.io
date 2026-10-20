/**
 * Aksh Code Playground — Diagnostics, Linting, Metrics & Testing Engine
 * Real-time static analysis for HTML, CSS, JavaScript, JSON, and Python.
 * Includes Problems collection, Code Complexity Metrics, and Test Runner.
 */

(function (window) {
  'use strict';

  let diagnosticsList = [];
  let ignoredRules = new Set();

  /**
   * Scans a single file or entire project for issues.
   * @param {Array<{name: string, content: string, type: string}>} files
   * @returns {Array<Diagnostic>}
   */
  function scanProject(files) {
    diagnosticsList = [];
    if (!Array.isArray(files)) return [];

    const fileMap = new Map();
    files.forEach(f => fileMap.set(f.name, f));

    files.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'js' || ext === 'mjs' || ext === 'ts') {
        scanJavaScript(file);
      } else if (ext === 'html' || ext === 'htm') {
        scanHtml(file, fileMap);
      } else if (ext === 'css') {
        scanCss(file);
      } else if (ext === 'json') {
        scanJson(file);
      }
    });

    return diagnosticsList;
  }

  function addDiagnostic(file, line, col, severity, message, ruleId, fixAction) {
    if (ignoredRules.has(ruleId)) return;
    diagnosticsList.push({
      id: `diag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      file: file.name,
      line: line || 1,
      col: col || 1,
      severity: severity, // 'error' | 'warning' | 'info'
      message: message,
      ruleId: ruleId,
      fixAction: fixAction || null
    });
  }

  function scanJavaScript(file) {
    const code = file.content || '';
    const lines = code.split('\n');

    // 1. Syntax check via Function constructor
    try {
      new Function(code);
    } catch (err) {
      // Parse line from error if possible
      let line = 1;
      const match = err.stack ? err.stack.match(/<anonymous>:(\d+):(\d+)/) : null;
      if (match) line = parseInt(match[1], 10);
      addDiagnostic(file, line, 1, 'error', `Syntax Error: ${err.message}`, 'js-syntax-error', null);
    }

    // 2. Line by line heuristics
    lines.forEach((line, i) => {
      const lineNum = i + 1;

      // Accidental assignment in condition: if (a = b)
      if (/\bif\s*\([^=!<>\n]*=[^=!<>\n]*\)/.test(line)) {
        addDiagnostic(file, lineNum, line.indexOf('='), 'error', 'Conditional statement contains assignment `=` instead of equality `===`.', 'js-no-cond-assign', {
          label: 'Change = to ===',
          replacement: line.replace(/(\bif\s*\([^=!<>\n]*)=([^=!<>\n]*\))/, '$1===$2')
        });
      }

      // Loose equality ==
      if (/[^=!<>]==[^=]/.test(line)) {
        addDiagnostic(file, lineNum, line.indexOf('=='), 'warning', 'Loose equality `==` can cause unexpected type coercion. Use strict `===`.', 'js-eqeqeq', {
          label: 'Change == to ===',
          replacement: line.replace(/([^=!<>])==([^=])/g, '$1===$2')
        });
      }

      // alert() usage
      if (/\balert\s*\(/.test(line)) {
        addDiagnostic(file, lineNum, line.indexOf('alert'), 'warning', '`alert()` pauses script execution. Use a UI modal or toast.', 'js-no-alert', null);
      }

      // debugger keyword
      if (/\bdebugger\b/.test(line)) {
        addDiagnostic(file, lineNum, line.indexOf('debugger'), 'warning', '`debugger` breakpoint should be removed in production code.', 'js-no-debugger', null);
      }

      // innerHTML assignment
      if (/\.innerHTML\s*=/.test(line)) {
        addDiagnostic(file, lineNum, line.indexOf('innerHTML'), 'warning', 'Direct `innerHTML` assignment may introduce XSS vulnerabilities. Use `textContent`.', 'js-no-innerhtml', null);
      }
    });
  }

  function scanHtml(file, fileMap) {
    const html = file.content || '';
    const lines = html.split('\n');

    // 1. Check DOCTYPE
    if (!/<!DOCTYPE html>/i.test(html)) {
      addDiagnostic(file, 1, 1, 'warning', 'Missing `<!DOCTYPE html>` declaration.', 'html-doctype', null);
    }

    // 2. Check title
    if (!/<title>/i.test(html)) {
      addDiagnostic(file, 1, 1, 'warning', 'Missing `<title>` tag in HTML head.', 'html-title', null);
    }

    // 3. Check mobile viewport
    if (!/<meta[^>]+viewport/i.test(html)) {
      addDiagnostic(file, 1, 1, 'info', 'Missing mobile `<meta name="viewport">` tag.', 'html-viewport', null);
    }

    // 4. Missing alt on img
    lines.forEach((line, i) => {
      const lineNum = i + 1;
      if (/<img(?![^>]*alt=)[^>]*>/i.test(line)) {
        addDiagnostic(file, lineNum, line.indexOf('<img'), 'warning', 'Image missing `alt` attribute for accessibility.', 'html-img-alt', null);
      }

      // Duplicate or empty IDs
      const idMatch = line.match(/\bid=["']([^"']+)["']/i);
      if (idMatch && !idMatch[1].trim()) {
        addDiagnostic(file, lineNum, line.indexOf('id='), 'error', 'Element has empty `id` attribute.', 'html-empty-id', null);
      }

      // Broken virtual references: e.g. <link rel="stylesheet" href="style.css">
      const cssLinkMatch = line.match(/<link[^>]+href=["'](\.\/)?([^"']+\.css)["']/i);
      if (cssLinkMatch) {
        const referencedFile = cssLinkMatch[2];
        if (!fileMap.has(referencedFile)) {
          addDiagnostic(file, lineNum, line.indexOf(referencedFile), 'warning', `Referenced stylesheet "${referencedFile}" does not exist in project.`, 'html-missing-asset', null);
        }
      }

      const jsLinkMatch = line.match(/<script[^>]+src=["'](\.\/)?([^"']+\.js)["']/i);
      if (jsLinkMatch) {
        const referencedFile = jsLinkMatch[2];
        if (!fileMap.has(referencedFile)) {
          addDiagnostic(file, lineNum, line.indexOf(referencedFile), 'warning', `Referenced script "${referencedFile}" does not exist in project.`, 'html-missing-asset', null);
        }
      }
    });
  }

  function scanCss(file) {
    const css = file.content || '';
    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      addDiagnostic(file, 1, 1, 'error', `Mismatched CSS braces: ${openBraces} opened, ${closeBraces} closed.`, 'css-brace-mismatch', null);
    }

    // Check for fixed pixel widths exceeding standard viewport
    const lines = css.split('\n');
    lines.forEach((line, i) => {
      const lineNum = i + 1;
      const widthMatch = line.match(/\bwidth:\s*(\d+)px/i);
      if (widthMatch) {
        const val = parseInt(widthMatch[1], 10);
        if (val > 1000) {
          addDiagnostic(file, lineNum, line.indexOf('width:'), 'info', `Fixed width (${val}px) may overflow mobile screens. Consider \`max-width: 100%\`.`, 'css-fixed-width', null);
        }
      }
    });
  }

  function scanJson(file) {
    const content = file.content || '';
    if (!content.trim()) return;

    try {
      JSON.parse(content);
    } catch (err) {
      let line = 1;
      const match = err.message.match(/at position (\d+)/);
      if (match) {
        const pos = parseInt(match[1], 10);
        line = content.substring(0, pos).split('\n').length;
      }
      addDiagnostic(file, line, 1, 'error', `Invalid JSON: ${err.message}`, 'json-syntax-error', null);
    }
  }

  /**
   * Adds an external runtime exception (e.g. from preview iframe) into diagnostics.
   */
  function addRuntimeError(filename, line, message) {
    diagnosticsList.unshift({
      id: `runtime-${Date.now()}`,
      file: filename || 'preview',
      line: line || 1,
      col: 1,
      severity: 'error',
      message: `[Runtime Exception] ${message}`,
      ruleId: 'runtime-error',
      fixAction: null
    });
  }

  function clearDiagnostics() {
    diagnosticsList = [];
  }

  function ignoreRule(ruleId) {
    if (ruleId) {
      ignoredRules.add(ruleId);
      diagnosticsList = diagnosticsList.filter(d => d.ruleId !== ruleId);
    }
  }

  // ==========================================================================
  // Code Complexity & Readability Metrics
  // ==========================================================================
  function analyzeComplexity(code, filename) {
    if (!code) code = '';
    const lines = code.split('\n');
    const totalLines = lines.length;
    let blankLines = 0;
    let commentLines = 0;
    let codeLines = 0;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        blankLines++;
      } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('#') || trimmed.startsWith('<!--')) {
        commentLines++;
      } else {
        codeLines++;
      }
    });

    // Count functions
    const funcMatches = code.match(/(?:function\s+[a-zA-Z0-9_]+|\b[a-zA-Z0-9_]+\s*=\s*(?:function|\([^)]*\)\s*=>)|\bdef\s+[a-zA-Z0-9_]+)/g) || [];
    const functionCount = funcMatches.length;

    // Estimate Cyclomatic Complexity (branching keywords: if, else, for, while, case, &&, ||, ?)
    const branchMatches = code.match(/\b(if|else\s+if|for|while|case|catch)\b|\&\&|\|\||\?/g) || [];
    const complexityScore = branchMatches.length + 1;

    let rating = 'Clean & Readable';
    let ratingColor = '#10b981';
    if (complexityScore > 15) {
      rating = 'Complex — Consider Refactoring';
      ratingColor = '#ef4444';
    } else if (complexityScore > 8) {
      rating = 'Moderate Complexity';
      ratingColor = '#f59e0b';
    }

    return {
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      functionCount,
      complexityScore,
      rating,
      ratingColor,
      charsCount: code.length
    };
  }

  // ==========================================================================
  // In-Browser Test Runner
  // ==========================================================================
  class TestRunner {
    constructor() {
      this.suites = [];
      this.currentSuite = null;
    }

    reset() {
      this.suites = [];
      this.currentSuite = null;
    }

    describe(name, fn) {
      const suite = { name, tests: [], passed: 0, failed: 0 };
      this.suites.push(suite);
      this.currentSuite = suite;
      try {
        fn();
      } catch (err) {
        suite.error = err.message;
      }
      this.currentSuite = null;
    }

    it(name, fn) {
      if (!this.currentSuite) return;
      const test = { name, passed: false, error: null, durationMs: 0 };
      const start = performance.now();

      try {
        fn();
        test.passed = true;
        this.currentSuite.passed++;
      } catch (err) {
        test.passed = false;
        test.error = err.message || String(err);
        this.currentSuite.failed++;
      }

      test.durationMs = (performance.now() - start).toFixed(2);
      this.currentSuite.tests.push(test);
    }

    expect(actual) {
      return {
        toBe: (expected) => {
          if (actual !== expected) {
            throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
          }
        },
        toEqual: (expected) => {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected deep equality with ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
          }
        },
        toBeTruthy: () => {
          if (!actual) throw new Error(`Expected truthy but got ${actual}`);
        },
        toBeFalsy: () => {
          if (actual) throw new Error(`Expected falsy but got ${actual}`);
        },
        toBeDefined: () => {
          if (actual === undefined) throw new Error(`Expected defined but got undefined`);
        },
        toContain: (item) => {
          if (!actual || !actual.includes(item)) {
            throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
          }
        }
      };
    }

    runUserTests(testCode) {
      this.reset();
      const describe = this.describe.bind(this);
      const it = this.it.bind(this);
      const expect = this.expect.bind(this);

      try {
        const testFn = new Function('describe', 'it', 'expect', testCode);
        testFn(describe, it, expect);
      } catch (err) {
        return {
          success: false,
          error: `Test Execution Error: ${err.message}`,
          suites: []
        };
      }

      let totalPassed = 0;
      let totalFailed = 0;
      this.suites.forEach(s => {
        totalPassed += s.passed;
        totalFailed += s.failed;
      });

      return {
        success: totalFailed === 0,
        totalTests: totalPassed + totalFailed,
        passed: totalPassed,
        failed: totalFailed,
        suites: this.suites
      };
    }
  }

  // ==========================================================================
  // Color Contrast Calculator & WCAG Utilities
  // ==========================================================================
  function parseHexColor(hex) {
    let c = hex.replace('#', '').trim();
    if (c.length === 3) {
      c = c.split('').map(ch => ch + ch).join('');
    }
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function getLuminance(rgb) {
    const a = [rgb.r, rgb.g, rgb.b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function calculateContrastRatio(hex1, hex2) {
    try {
      const rgb1 = parseHexColor(hex1);
      const rgb2 = parseHexColor(hex2);
      const l1 = getLuminance(rgb1);
      const l2 = getLuminance(rgb2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      const ratio = (lighter + 0.05) / (darker + 0.05);
      const rounded = Math.round(ratio * 100) / 100;

      return {
        ratio: rounded,
        aaNormal: ratio >= 4.5,
        aaLarge: ratio >= 3.0,
        aaaNormal: ratio >= 7.0,
        aaaLarge: ratio >= 4.5,
        rating: ratio >= 7.0 ? 'AAA (Enhanced)' : ratio >= 4.5 ? 'AA (Standard)' : ratio >= 3.0 ? 'AA (Large Text Only)' : 'Fail'
      };
    } catch (e) {
      return { ratio: 1.0, aaNormal: false, aaLarge: false, aaaNormal: false, aaaLarge: false, rating: 'Invalid Color' };
    }
  }

  function auditHtmlAccessibility(html) {
    const issues = [];
    if (!/<!DOCTYPE html>/i.test(html)) {
      issues.push({ severity: 'warning', ruleId: 'DOCTYPE', rule: 'DOCTYPE', message: 'Missing <!DOCTYPE html> declaration. Browsers may enter quirks mode.' });
    }
    if (!/<html[^>]+lang=["'][a-z]{2}/i.test(html)) {
      issues.push({ severity: 'error', ruleId: 'HTML-LANG', rule: 'HTML-LANG', message: 'Missing or empty lang attribute on <html> element (e.g. <html lang="en">).' });
    }
    if (!/<title>[^<]+<\/title>/i.test(html)) {
      issues.push({ severity: 'error', ruleId: 'TITLE', rule: 'TITLE', message: 'Missing descriptive <title> tag in <head>.' });
    }
    if (!/<meta[^>]+viewport/i.test(html)) {
      issues.push({ severity: 'warning', ruleId: 'VIEWPORT', rule: 'VIEWPORT', message: 'Missing mobile viewport meta tag for responsive scaling.' });
    }

    const imgMatches = html.match(/<img[^>]*>/gi) || [];
    imgMatches.forEach(img => {
      if (!/\balt=["'][^"']*["']/i.test(img)) {
        issues.push({ severity: 'error', ruleId: 'IMG-ALT', rule: 'IMG-ALT', message: `Image tag missing alt text: ${img.substring(0, 40)}...` });
      }
    });

    const btnMatches = html.match(/<button(?![^>]*aria-label)[^>]*>\s*<\/button>/gi) || [];
    if (btnMatches.length > 0) {
      issues.push({ severity: 'error', ruleId: 'EMPTY-BTN', rule: 'EMPTY-BTN', message: `Found ${btnMatches.length} empty button(s) without visible text or aria-label.` });
    }

    return issues;
  }

  const testRunnerInstance = new TestRunner();

  // Export
  window.AkshDiagnostics = {
    scanProject,
    addRuntimeError,
    clearDiagnostics,
    ignoreRule,
    analyzeComplexity,
    testRunner: testRunnerInstance,
    calculateContrastRatio,
    auditHtmlAccessibility,
    getDiagnostics: () => diagnosticsList
  };

})(window);
