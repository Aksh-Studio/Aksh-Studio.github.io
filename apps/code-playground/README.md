# Aksh Code Playground Pro

A professional, browser-native development studio built for the [Aksh Studio](https://aksh-studio.github.io/) application ecosystem.

Live URL: `https://aksh-studio.github.io/apps/code-playground/`

## Key Capabilities & Pro Features

- **VS Code-Grade Editor Architecture**:
  - **Live Syntax Highlighting Overlay**: Synchronized transparent editing textarea over a syntax-tokenized `<pre><code>` highlight layer, matching font metrics, line heights, scroll offsets, and margins pixel-for-pixel.
  - **Smart Auto-Indentation & Bracket Handling**: Preserves indentation on Enter, auto-indents after `{`, `[`, `(`, and Python `:`, auto-closes quote and bracket pairs, allows closing character overtyping, and deletes matching pairs on Backspace.
  - **VS Code Command Palette (`Ctrl+Shift+P` / `F1`)**: Searchable overlay for instant fuzzy-matching and execution of all IDE actions (Run, Format, Theme Toggle, Word Wrap, Export ZIP, Open Folder, Find, etc.).
  - **Breadcrumbs Navigation**: Clean hierarchical breadcrumb trail (`Project Name > [folder] > filename`) with dynamic project renaming and file tracking.
  - **Find & Replace (`Ctrl+F`)**: Non-intrusive find bar with real-time match counter (`X of Y`), forward/backward navigation (`Enter` / `Shift+Enter`), Replace One, and Replace All across the active document.
  - **Multi-File Tab Management**: Unsaved change indicators (`.tab-dirty-dot`), middle-click tab closure, active tab preservation, and persistent tab order across sessions.

- **Dual Storage Architecture**:
  - **Mode A (Browser Storage)**: Uses IndexedDB as the primary storage for projects, files, virtual folders, and open tabs, with localStorage for lightweight preferences. Debounced auto-save with persistent local recovery.
  - **Mode B (Open Local Folder)**: Direct device folder editing using the modern File System Access API (`window.showDirectoryPicker`). Real-time file tree, direct disk write on `Ctrl+S`, atomic streams, and strict permission verification.

- **Aksh Code Assistant (Local-First Engine)**:
  - 100% client-side coding assistant with zero external AI APIs, zero telemetry, and complete code privacy.
  - Context-aware code analysis, bug detection, responsive layout optimization, accessibility checks, test case generation, and refactoring.
  - Side-by-side or line-by-line **Diff View Preview** before applying any proposed changes, with multi-level Undo history.

- **Real ZIP Export & Import**:
  - Pure client-side PKWARE ZIP generator and extractor (`js/zip-engine.js`).
  - Downloads genuine `.zip` archives preserving directory structures and nested paths.
  - Safely imports external ZIP archives with directory traversal protection (`../`), file size quotas, and confirmation summaries.

- **Browser-Only Language Execution**:
  - **HTML5, CSS3 & JavaScript (ES6+)**: Live sandboxed preview with postMessage console and error diagnostics bridge.
  - **TypeScript**: In-browser client-side transpilation and preview execution.
  - **Python 3**: WebAssembly runtime powered by Pyodide (lazy-loaded on first run) with standard output, error tracebacks, and session reset.
  - **SQL (SQLite)**: In-browser relational engine with table viewer, sample database (`departments`, `employees`, `projects`), schema browser, and CSV export.
  - **CSV**: Client-side tabular parser rendering interactive formatted HTML data tables with row/column counts and search.
  - **JSON**: In-browser validation, automatic beautification, and structured collapsible inspection.
  - **Markdown & SVG**: Real-time rendering and preview.
  - **Honest Capability Badges**: Distinct badges for Runnable in Browser, Browser Runtime Required, Transpiled in Browser, and Editor/Validation Only.

- **Advanced Diagnostics & Problems Panel**:
  - Real-time syntax validation for HTML, CSS, JavaScript, JSON, and Python.
  - Accessibility audit with WCAG 2.1 relative luminance color contrast calculator and semantic HTML rule IDs (`[HTML-LANG]`, `[IMG-ALT]`, `[VIEWPORT]`, etc.).
  - One-click navigation: clicking a problem opens the file and jumps directly to that line.
  - Direct integration with Aksh Code Assistant: "Explain with Assistant" button sends error context to local engine.

- **Code Metrics & Test Runner**:
  - Cyclomatic complexity estimator, line breakdown, and readability ratings.
  - Built-in assertion test runner supporting `describe`, `it`, and `expect`.

- **Rich Templates & Snippets Catalog**:
  - 20 starter templates across web, Python, SQL, and documentation.
  - 19 reusable production-ready code snippets with one-click insertion.

## Local Development & Testing

Run locally using Python's built-in static HTTP server:

```bash
python -m http.server 8000
# Open http://localhost:8000/apps/code-playground/
```
