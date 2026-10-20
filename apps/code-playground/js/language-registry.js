/**
 * Aksh Code Playground — Modular Language Registry & Execution Engine
 * Manages language capabilities, execution badges, runtimes (Pyodide, In-Browser SQL, TypeScript, Markdown, CSV).
 * Zero server execution, 100% browser-contained.
 */

(function (window) {
  'use strict';

  // ==========================================================================
  // Language Capabilities & Badges
  // ==========================================================================
  const BADGES = {
    RUNNABLE: {
      id: 'runnable',
      label: 'Runnable in Browser',
      className: 'badge-runnable',
      tooltip: 'Executes safely inside the browser sandboxed environment. No server required.'
    },
    RUNTIME_REQ: {
      id: 'runtime_req',
      label: 'Browser Runtime Required',
      className: 'badge-runtime',
      tooltip: 'Runs entirely in your browser using a WebAssembly runtime (Pyodide / SQLite). Requires one-time download on first use.'
    },
    TRANSPILED: {
      id: 'transpiled',
      label: 'Transpiled in Browser',
      className: 'badge-transpiled',
      tooltip: 'Transpiled client-side into JavaScript and executed in the preview sandbox.'
    },
    EDITOR_ONLY: {
      id: 'editor_only',
      label: 'Editor and Validation Only',
      className: 'badge-editor-only',
      tooltip: 'Full editing, syntax analysis, and formatting. Execution requires a backend compiler or OS runtime.'
    },
    EXPERIMENTAL: {
      id: 'experimental',
      label: 'Experimental',
      className: 'badge-experimental',
      tooltip: 'Experimental browser-side execution.'
    }
  };

  const LANGUAGES = {
    html: {
      id: 'html',
      name: 'HTML5',
      extensions: ['html', 'htm'],
      badge: BADGES.RUNNABLE,
      canRun: true,
      runActionLabel: 'Run Preview',
      runActionTooltip: 'Render live HTML preview (Ctrl+Enter)'
    },
    css: {
      id: 'css',
      name: 'CSS3',
      extensions: ['css'],
      badge: BADGES.RUNNABLE,
      canRun: true,
      runActionLabel: 'Update Styles',
      runActionTooltip: 'Inject styles into preview (Ctrl+Enter)'
    },
    javascript: {
      id: 'javascript',
      name: 'JavaScript (ES6+)',
      extensions: ['js', 'mjs'],
      badge: BADGES.RUNNABLE,
      canRun: true,
      runActionLabel: 'Run Script',
      runActionTooltip: 'Execute JavaScript in sandboxed preview (Ctrl+Enter)'
    },
    typescript: {
      id: 'typescript',
      name: 'TypeScript',
      extensions: ['ts', 'tsx'],
      badge: BADGES.TRANSPILED,
      canRun: true,
      runActionLabel: 'Transpile & Run',
      runActionTooltip: 'Transpile to JS and execute in preview (Ctrl+Enter)'
    },
    python: {
      id: 'python',
      name: 'Python 3',
      extensions: ['py'],
      badge: BADGES.RUNTIME_REQ,
      canRun: true,
      runActionLabel: 'Run Python',
      runActionTooltip: 'Execute Python via Pyodide WebAssembly runtime'
    },
    sql: {
      id: 'sql',
      name: 'SQL (SQLite)',
      extensions: ['sql'],
      badge: BADGES.RUNTIME_REQ,
      canRun: true,
      runActionLabel: 'Execute Query',
      runActionTooltip: 'Execute query against in-memory browser database'
    },
    markdown: {
      id: 'markdown',
      name: 'Markdown',
      extensions: ['md', 'markdown'],
      badge: BADGES.RUNNABLE,
      canRun: true,
      runActionLabel: 'Render Markdown',
      runActionTooltip: 'Render Markdown document into preview'
    },
    svg: {
      id: 'svg',
      name: 'SVG',
      extensions: ['svg'],
      badge: BADGES.RUNNABLE,
      canRun: true,
      runActionLabel: 'Render SVG',
      runActionTooltip: 'Render vector SVG graphic into preview'
    },
    json: {
      id: 'json',
      name: 'JSON',
      extensions: ['json'],
      badge: BADGES.EDITOR_ONLY,
      canRun: true,
      runActionLabel: 'Format & Validate',
      runActionTooltip: 'Format and validate JSON syntax'
    },
    csv: {
      id: 'csv',
      name: 'CSV',
      extensions: ['csv'],
      badge: BADGES.RUNNABLE,
      canRun: true,
      runActionLabel: 'View Table',
      runActionTooltip: 'Render CSV data as an interactive table'
    },
    c: {
      id: 'c',
      name: 'C',
      extensions: ['c', 'h'],
      badge: BADGES.EDITOR_ONLY,
      canRun: false,
      runActionLabel: 'Editor Only',
      runActionTooltip: 'C requires a native GCC/Clang compiler or remote server not bundled.'
    },
    cpp: {
      id: 'cpp',
      name: 'C++',
      extensions: ['cpp', 'cc', 'cxx', 'hpp'],
      badge: BADGES.EDITOR_ONLY,
      canRun: false,
      runActionLabel: 'Editor Only',
      runActionTooltip: 'C++ compilation requires native toolchains or remote server.'
    },
    java: {
      id: 'java',
      name: 'Java',
      extensions: ['java'],
      badge: BADGES.EDITOR_ONLY,
      canRun: false,
      runActionLabel: 'Editor Only',
      runActionTooltip: 'Java requires a JVM and JDK compiler.'
    },
    rust: {
      id: 'rust',
      name: 'Rust',
      extensions: ['rs'],
      badge: BADGES.EDITOR_ONLY,
      canRun: false,
      runActionLabel: 'Editor Only',
      runActionTooltip: 'Rust requires rustc/cargo native toolchains.'
    },
    go: {
      id: 'go',
      name: 'Go',
      extensions: ['go'],
      badge: BADGES.EDITOR_ONLY,
      canRun: false,
      runActionLabel: 'Editor Only',
      runActionTooltip: 'Go execution requires the Go toolchain.'
    },
    php: {
      id: 'php',
      name: 'PHP',
      extensions: ['php'],
      badge: BADGES.EDITOR_ONLY,
      canRun: false,
      runActionLabel: 'Editor Only',
      runActionTooltip: 'PHP execution requires a PHP runtime engine.'
    }
  };

  function getLanguageByFilename(filename) {
    if (!filename) return LANGUAGES.html;
    const ext = filename.split('.').pop().toLowerCase();
    for (const key of Object.keys(LANGUAGES)) {
      if (LANGUAGES[key].extensions.includes(ext)) {
        return LANGUAGES[key];
      }
    }
    return {
      id: 'text',
      name: 'Plain Text',
      extensions: [ext],
      badge: BADGES.EDITOR_ONLY,
      canRun: false,
      runActionLabel: 'Editor Only',
      runActionTooltip: 'Plain text file editing.'
    };
  }

  // ==========================================================================
  // Python Pyodide WebAssembly Runtime Adapter
  // ==========================================================================
  let pyodideInstance = null;
  let pyodideLoadingPromise = null;
  const PYODIDE_CDN_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';

  async function initPyodide(onProgress) {
    if (pyodideInstance) return pyodideInstance;
    if (pyodideLoadingPromise) return pyodideLoadingPromise;

    pyodideLoadingPromise = (async () => {
      if (typeof window.loadPyodide !== 'function') {
        if (onProgress) onProgress('Downloading Pyodide WebAssembly engine from CDN (~10MB)...');
        await loadScriptAsync(PYODIDE_CDN_URL);
      }

      if (onProgress) onProgress('Initializing Python WebAssembly environment...');
      pyodideInstance = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
      });

      if (onProgress) onProgress('Pyodide ready.');
      return pyodideInstance;
    })();

    return pyodideLoadingPromise;
  }

  async function runPythonCode(code, onProgress) {
    const pyodide = await initPyodide(onProgress);

    // Redirect stdout and stderr using Python io.StringIO
    const runnerScript = `
import sys
import io

_py_stdout_io = io.StringIO()
_py_stderr_io = io.StringIO()
_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = _py_stdout_io
sys.stderr = _py_stderr_io

_py_result = None
_py_error = None

try:
    # Execute user code
    _user_code = ${JSON.stringify(code)}
    _compiled = compile(_user_code, '<input>', 'exec')
    exec(_compiled, globals())
except Exception as _e:
    import traceback
    _py_error = traceback.format_exc()
finally:
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr

_py_stdout_text = _py_stdout_io.getvalue()
_py_stderr_text = _py_stderr_io.getvalue()
`;

    try {
      await pyodide.runPythonAsync(runnerScript);
      const stdout = pyodide.globals.get('_py_stdout_text') || '';
      const stderr = pyodide.globals.get('_py_stderr_text') || '';
      const error = pyodide.globals.get('_py_error') || null;

      return {
        success: !error,
        stdout: stdout,
        stderr: stderr,
        error: error
      };
    } catch (err) {
      return {
        success: false,
        stdout: '',
        stderr: err.message,
        error: err.message
      };
    }
  }

  function resetPythonSession() {
    pyodideInstance = null;
    pyodideLoadingPromise = null;
  }

  // ==========================================================================
  // In-Browser SQL Relational Engine (SQLite-Compatible)
  // ==========================================================================
  class ClientSqlEngine {
    constructor() {
      this.tables = new Map();
      this.initSampleDatabase();
    }

    initSampleDatabase() {
      this.tables.clear();

      // Table: departments
      this.tables.set('departments', {
        columns: ['id', 'name', 'budget', 'location'],
        types: ['INTEGER', 'TEXT', 'INTEGER', 'TEXT'],
        rows: [
          [1, 'Engineering', 450000, 'San Francisco'],
          [2, 'Product Design', 180000, 'New York'],
          [3, 'Marketing', 220000, 'London'],
          [4, 'Customer Support', 95000, 'Austin'],
          [5, 'Research & Development', 380000, 'Berlin']
        ]
      });

      // Table: employees
      this.tables.set('employees', {
        columns: ['id', 'name', 'department_id', 'role', 'salary', 'hire_date'],
        types: ['INTEGER', 'TEXT', 'INTEGER', 'TEXT', 'INTEGER', 'TEXT'],
        rows: [
          [101, 'Alex Rivera', 1, 'Senior Frontend Engineer', 145000, '2021-03-15'],
          [102, 'Maya Lin', 1, 'Systems Architect', 168000, '2019-11-01'],
          [103, 'Liam Patel', 2, 'Lead UI/UX Designer', 125000, '2022-01-10'],
          [104, 'Sophia Chen', 3, 'Marketing Strategist', 98000, '2022-08-20'],
          [105, 'David Kim', 1, 'Full-Stack Developer', 115000, '2023-04-05'],
          [106, 'Elena Rostova', 5, 'AI Research Scientist', 185000, '2020-06-12'],
          [107, 'Marcus Aurelius', 4, 'Support Lead', 82000, '2023-09-01'],
          [108, 'Zoe Washington', 2, 'Product Designer', 95000, '2024-02-15']
        ]
      });

      // Table: projects
      this.tables.set('projects', {
        columns: ['id', 'title', 'department_id', 'status', 'budget'],
        types: ['INTEGER', 'TEXT', 'INTEGER', 'TEXT', 'INTEGER'],
        rows: [
          [1, 'Aksh Code Playground Pro', 1, 'In Progress', 75000],
          [2, 'Brand Design System 2.0', 2, 'Completed', 40000],
          [3, 'Global Developer Summit', 3, 'Planning', 60000],
          [4, 'Local Intelligence Engine', 5, 'In Progress', 120000]
        ]
      });
    }


    /**
     * Executes SQL statement(s).
     */
    execute(query) {
      const startTime = performance.now();
      // Strip line comments (-- ...) and block comments (/* ... */)
      let stripped = (query || '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/--[^\r\n]*/g, '');
      const clean = stripped.trim().replace(/;+$/, '');
      if (!clean) {
        throw new Error('Query is empty or contains only comments.');
      }

      // Check for multiple statements
      const statements = clean.split(';').map(s => s.trim()).filter(Boolean);
      let lastResult = null;

      for (const stmt of statements) {
        lastResult = this.executeSingleStatement(stmt);
      }

      const durationMs = (performance.now() - startTime).toFixed(2);
      return {
        ...lastResult,
        executionTimeMs: durationMs
      };
    }

    executeSingleStatement(stmt) {
      const cleanStmt = stmt.trim();
      const upper = cleanStmt.toUpperCase();

      if (upper.startsWith('SELECT')) {
        return this.handleSelect(cleanStmt);
      } else if (upper.startsWith('INSERT')) {
        return this.handleInsert(cleanStmt);
      } else if (upper.startsWith('CREATE TABLE')) {
        return this.handleCreateTable(cleanStmt);
      } else if (upper.startsWith('UPDATE')) {
        return this.handleUpdate(cleanStmt);
      } else if (upper.startsWith('DELETE')) {
        return this.handleDelete(cleanStmt);
      } else if (upper.startsWith('DROP TABLE')) {
        return this.handleDropTable(cleanStmt);
      } else {
        throw new Error(`Unsupported SQL command: "${cleanStmt.substring(0, 30)}..."`);
      }
    }

    handleSelect(stmt) {
      // Parse FROM table and optional alias: FROM table (AS)? alias
      const fromMatch = stmt.match(/FROM\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/i);
      if (!fromMatch) {
        throw new Error('Malformed SELECT: missing FROM clause.');
      }

      const primaryTableName = fromMatch[1].toLowerCase();
      const primaryTableAlias = fromMatch[2] ? fromMatch[2].toLowerCase() : primaryTableName;
      const primaryTable = this.tables.get(primaryTableName);
      if (!primaryTable) {
        throw new Error(`Table "${primaryTableName}" does not exist.`);
      }

      // Check for JOIN: JOIN table (AS)? alias ON leftKey = rightKey
      const joinMatch = stmt.match(/JOIN\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?\s+ON\s+([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)/i);
      let joinedRows = [];
      let allColumns = []; // [{ name, qual, aliasQual, idx }]

      if (joinMatch) {
        const joinTableName = joinMatch[1].toLowerCase();
        const joinTableAlias = joinMatch[2] ? joinMatch[2].toLowerCase() : joinTableName;
        const joinTable = this.tables.get(joinTableName);
        if (!joinTable) throw new Error(`Joined table "${joinTableName}" does not exist.`);

        const leftRaw = joinMatch[3].trim().toLowerCase();
        const rightRaw = joinMatch[4].trim().toLowerCase();

        // Determine which side belongs to primary table and which to join table
        const resolveKey = (keyStr) => {
          if (keyStr.includes('.')) {
            const [tbl, col] = keyStr.split('.');
            return { tbl, col };
          }
          return { tbl: null, col: keyStr };
        };

        const leftResolved = resolveKey(leftRaw);
        const rightResolved = resolveKey(rightRaw);

        let pColName = '';
        let jColName = '';

        if (leftResolved.tbl === primaryTableAlias || leftResolved.tbl === primaryTableName) {
          pColName = leftResolved.col;
          jColName = rightResolved.col;
        } else if (leftResolved.tbl === joinTableAlias || leftResolved.tbl === joinTableName) {
          jColName = leftResolved.col;
          pColName = rightResolved.col;
        } else {
          // Fallback by column existence
          if (primaryTable.columns.map(c => c.toLowerCase()).includes(leftResolved.col)) {
            pColName = leftResolved.col;
            jColName = rightResolved.col;
          } else {
            pColName = rightResolved.col;
            jColName = leftResolved.col;
          }
        }

        const pColIdx = primaryTable.columns.findIndex(c => c.toLowerCase() === pColName);
        const jColIdx = joinTable.columns.findIndex(c => c.toLowerCase() === jColName);

        if (pColIdx === -1) throw new Error(`Column "${pColName}" not found in table "${primaryTableName}".`);
        if (jColIdx === -1) throw new Error(`Column "${jColName}" not found in joined table "${joinTableName}".`);

        // Build combined columns list
        primaryTable.columns.forEach((c, idx) => {
          allColumns.push({ name: c, qual: `${primaryTableName}.${c}`, aliasQual: `${primaryTableAlias}.${c}`, idx: idx });
        });
        joinTable.columns.forEach((c, idx) => {
          allColumns.push({ name: c, qual: `${joinTableName}.${c}`, aliasQual: `${joinTableAlias}.${c}`, idx: primaryTable.columns.length + idx });
        });

        for (const pRow of primaryTable.rows) {
          for (const jRow of joinTable.rows) {
            if (pRow[pColIdx] == jRow[jColIdx]) {
              joinedRows.push([...pRow, ...jRow]);
            }
          }
        }
      } else {
        primaryTable.columns.forEach((c, idx) => {
          allColumns.push({ name: c, qual: `${primaryTableName}.${c}`, aliasQual: `${primaryTableAlias}.${c}`, idx: idx });
        });
        joinedRows = primaryTable.rows.map(r => r.slice());
      }

      // Parse WHERE clause: match between WHERE and (ORDER BY | GROUP BY | LIMIT | ;)
      const whereMatch = stmt.match(/WHERE\s+(.*?)(?:\s+(?:ORDER\s+BY|GROUP\s+BY|LIMIT)|;|$)/i);
      if (whereMatch) {
        const cond = whereMatch[1].trim();
        joinedRows = joinedRows.filter(row => this.evaluateCompoundCondition(row, allColumns, cond));
      }

      // Parse SELECT columns
      const selectColsMatch = stmt.match(/SELECT\s+(.*?)\s+FROM/i);
      const selectColsStr = selectColsMatch ? selectColsMatch[1].trim() : '*';

      let resultCols = [];
      let resultRows = [];

      if (selectColsStr === '*') {
        resultCols = allColumns.map(c => c.name);
        resultRows = joinedRows;
      } else if (/COUNT\(\*\)/i.test(selectColsStr)) {
        resultCols = ['COUNT(*)'];
        resultRows = [[joinedRows.length]];
      } else {
        const requestedCols = selectColsStr.split(',').map(c => c.trim()).filter(Boolean);
        const colIndices = [];

        for (const req of requestedCols) {
          let colExpr = req;
          let colHeader = req;
          const asMatch = req.match(/^(.*?)\s+AS\s+([a-zA-Z0-9_]+)$/i);
          if (asMatch) {
            colExpr = asMatch[1].trim();
            colHeader = asMatch[2].trim();
          }

          const lowerExpr = colExpr.toLowerCase();
          const cleanCol = lowerExpr.includes('.') ? lowerExpr.split('.').pop() : lowerExpr;

          const matchCol = allColumns.find(c =>
            c.qual.toLowerCase() === lowerExpr ||
            c.aliasQual.toLowerCase() === lowerExpr ||
            c.name.toLowerCase() === cleanCol
          );

          resultCols.push(colHeader);
          colIndices.push(matchCol ? matchCol.idx : -1);
        }

        resultRows = joinedRows.map(row => colIndices.map(i => i !== -1 ? row[i] : null));
      }

      // Parse ORDER BY
      const orderMatch = stmt.match(/ORDER\s+BY\s+([a-zA-Z0-9_.]+)(?:\s+(ASC|DESC))?/i);
      if (orderMatch) {
        const orderCol = orderMatch[1].trim().split('.').pop().toLowerCase();
        const isDesc = orderMatch[2] && orderMatch[2].trim().toUpperCase() === 'DESC';
        const colIdx = resultCols.findIndex(c => c.toLowerCase() === orderCol || c.toLowerCase().endsWith('.' + orderCol));
        if (colIdx !== -1) {
          resultRows.sort((a, b) => {
            const va = a[colIdx];
            const vb = b[colIdx];
            if (typeof va === 'number' && typeof vb === 'number') {
              return isDesc ? vb - va : va - vb;
            }
            const sa = String(va !== null && va !== undefined ? va : '').toLowerCase();
            const sb = String(vb !== null && vb !== undefined ? vb : '').toLowerCase();
            if (sa < sb) return isDesc ? 1 : -1;
            if (sa > sb) return isDesc ? -1 : 1;
            return 0;
          });
        }
      }

      // Parse LIMIT
      const limitMatch = stmt.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        const limitVal = parseInt(limitMatch[1], 10);
        resultRows = resultRows.slice(0, limitVal);
      }

      return {
        type: 'SELECT',
        columns: resultCols,
        rows: resultRows,
        rowCount: resultRows.length
      };
    }

    evaluateCompoundCondition(row, columns, conditionStr) {
      if (!conditionStr || !conditionStr.trim()) return true;
      // Check for OR
      if (/\s+OR\s+/i.test(conditionStr)) {
        const parts = conditionStr.split(/\s+OR\s+/i);
        return parts.some(p => this.evaluateCompoundCondition(row, columns, p.trim()));
      }
      // Check for AND
      if (/\s+AND\s+/i.test(conditionStr)) {
        const parts = conditionStr.split(/\s+AND\s+/i);
        return parts.every(p => this.evaluateRowCondition(row, columns, p.trim()));
      }
      return this.evaluateRowCondition(row, columns, conditionStr.trim());
    }

    evaluateRowCondition(row, columns, condition) {
      const match = condition.match(/([a-zA-Z0-9_.]+)\s*(=|!=|<>|>|<|>=|<=|LIKE)\s*['"]?(.*?)['"]?$/i);
      if (!match) return true;

      const colName = match[1].toLowerCase();
      const cleanCol = colName.includes('.') ? colName.split('.').pop() : colName;
      const op = match[2].toUpperCase();
      let targetVal = match[3].replace(/['"]/g, '').trim();

      const matched = columns.find(c =>
        c.name.toLowerCase() === cleanCol ||
        c.qual.toLowerCase() === colName ||
        (c.aliasQual && c.aliasQual.toLowerCase() === colName)
      );

      if (!matched) return true;
      const rowVal = row[matched.idx];

      if (!isNaN(targetVal) && targetVal !== '' && typeof rowVal === 'number') {
        const numTarget = Number(targetVal);
        if (op === '=') return rowVal === numTarget;
        if (op === '!=' || op === '<>') return rowVal !== numTarget;
        if (op === '>') return rowVal > numTarget;
        if (op === '<') return rowVal < numTarget;
        if (op === '>=') return rowVal >= numTarget;
        if (op === '<=') return rowVal <= numTarget;
      }

      const strRowVal = String(rowVal !== null && rowVal !== undefined ? rowVal : '').toLowerCase();
      const strTarget = String(targetVal).toLowerCase();

      if (op === '=') return strRowVal === strTarget;
      if (op === '!=' || op === '<>') return strRowVal !== strTarget;
      if (op === 'LIKE') {
        const cleanPattern = strTarget.replace(/%/g, '.*');
        return new RegExp(`^${cleanPattern}$`, 'i').test(strRowVal);
      }

      return true;
    }

    handleInsert(stmt) {
      const match = stmt.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*(?:\((.*?)\))?\s*VALUES\s*\((.*?)\)/i);
      if (!match) {
        throw new Error('Malformed INSERT statement. Expected: INSERT INTO <table> [(cols)] VALUES (vals)');
      }

      const tableName = match[1].toLowerCase();
      const table = this.tables.get(tableName);
      if (!table) throw new Error(`Table "${tableName}" does not exist.`);

      const rawCols = match[2] ? match[2].split(',').map(c => c.trim().toLowerCase()) : table.columns.map(c => c.toLowerCase());
      const rawVals = match[3].split(',').map(v => {
        const t = v.trim();
        if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
          return t.slice(1, -1);
        }
        if (!isNaN(t) && t !== '') return Number(t);
        if (t.toUpperCase() === 'NULL') return null;
        return t;
      });

      const newRow = new Array(table.columns.length).fill(null);
      rawCols.forEach((col, idx) => {
        const cIdx = table.columns.findIndex(tc => tc.toLowerCase() === col);
        if (cIdx !== -1) {
          newRow[cIdx] = rawVals[idx];
        }
      });

      table.rows.push(newRow);

      return {
        type: 'INSERT',
        columns: ['Status', 'Rows Affected'],
        rows: [['Success', 1]],
        rowCount: 1
      };
    }

    handleCreateTable(stmt) {
      const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\((.*?)\)/i);
      if (!match) throw new Error('Malformed CREATE TABLE statement.');

      const tableName = match[1].toLowerCase();
      const colDefs = match[2].split(',').map(c => c.trim()).filter(Boolean);

      const cols = [];
      const types = [];

      for (const def of colDefs) {
        const parts = def.split(/\s+/);
        cols.push(parts[0]);
        types.push(parts[1] ? parts[1].toUpperCase() : 'TEXT');
      }

      this.tables.set(tableName, {
        columns: cols,
        types: types,
        rows: []
      });

      return {
        type: 'CREATE TABLE',
        columns: ['Table Created', 'Columns'],
        rows: [[tableName, cols.join(', ')]],
        rowCount: 1
      };
    }

    handleUpdate(stmt) {
      // UPDATE <table> SET <assignments> (WHERE <cond>)?
      const match = stmt.match(/UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.*?)(?:\s+WHERE\s+(.*)|;|$)/i);
      if (!match) throw new Error('Malformed UPDATE statement.');

      const tableName = match[1].toLowerCase();
      const table = this.tables.get(tableName);
      if (!table) throw new Error(`Table "${tableName}" does not exist.`);

      const setClause = match[2].trim();
      const whereCond = match[3] ? match[3].trim().replace(/;+$/, '') : null;

      // Parse assignments: e.g. "salary = 150000, role = 'Architect'"
      const assignments = setClause.split(',').map(a => {
        const eqIdx = a.indexOf('=');
        if (eqIdx === -1) return null;
        const col = a.substring(0, eqIdx).trim().toLowerCase();
        let val = a.substring(eqIdx + 1).trim();
        if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
          val = val.slice(1, -1);
        } else if (!isNaN(val) && val !== '') {
          val = Number(val);
        }
        return { col, val };
      }).filter(Boolean);

      const tableCols = table.columns.map((c, idx) => ({ name: c, qual: `${tableName}.${c}`, idx }));
      let count = 0;

      for (const row of table.rows) {
        if (!whereCond || this.evaluateCompoundCondition(row, tableCols, whereCond)) {
          assignments.forEach(assign => {
            const colIdx = table.columns.findIndex(c => c.toLowerCase() === assign.col);
            if (colIdx !== -1) {
              row[colIdx] = assign.val;
            }
          });
          count++;
        }
      }

      return {
        type: 'UPDATE',
        columns: ['Status', 'Rows Updated'],
        rows: [['Success', count]],
        rowCount: count
      };
    }

    handleDelete(stmt) {
      const match = stmt.match(/DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.*)|;|$)/i);
      if (!match) throw new Error('Malformed DELETE statement.');

      const tableName = match[1].toLowerCase();
      const table = this.tables.get(tableName);
      if (!table) throw new Error(`Table "${tableName}" does not exist.`);

      const whereCond = match[2] ? match[2].trim().replace(/;+$/, '') : null;
      const initialCount = table.rows.length;
      const tableCols = table.columns.map((c, idx) => ({ name: c, qual: `${tableName}.${c}`, idx }));

      if (!whereCond) {
        table.rows = [];
      } else {
        table.rows = table.rows.filter(row => !this.evaluateCompoundCondition(row, tableCols, whereCond));
      }

      const deletedCount = initialCount - table.rows.length;
      return {
        type: 'DELETE',
        columns: ['Status', 'Rows Deleted'],
        rows: [['Success', deletedCount]],
        rowCount: deletedCount
      };
    }

    handleDropTable(stmt) {
      const match = stmt.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (!match) throw new Error('Malformed DROP TABLE statement.');
      const tableName = match[1].toLowerCase();
      const deleted = this.tables.delete(tableName);

      return {
        type: 'DROP TABLE',
        columns: ['Status'],
        rows: [[deleted ? `Table "${tableName}" dropped.` : `Table "${tableName}" not found.`]],
        rowCount: 1
      };
    }

    exportResultsToCsv(result) {
      if (!result || !result.columns || !result.rows) return '';
      const escapeField = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const header = result.columns.map(escapeField).join(',');
      const rows = result.rows.map(r => r.map(escapeField).join(',')).join('\n');
      return `${header}\n${rows}`;
    }

    getSchema() {
      const schema = [];
      for (const [tableName, table] of this.tables.entries()) {
        schema.push({
          table: tableName,
          name: tableName,
          columns: table.columns.map((col, idx) => ({
            name: col,
            type: table.types[idx] || 'TEXT'
          })),
          rowCount: table.rows.length
        });
      }
      return schema;
    }
  }

  const sqlEngineInstance = new ClientSqlEngine();

  // ==========================================================================
  // TypeScript In-Browser Transpiler
  // ==========================================================================
  function transpileTypeScript(tsCode) {
    let js = tsCode;

    // 1. Remove interfaces: interface Foo { ... }
    js = js.replace(/interface\s+[a-zA-Z0-9_]+(\s*<[^>]+>)?(\s+extends\s+[^{]+)?\s*\{[^}]*\}/g, '');

    // 2. Remove type aliases: type Foo = ...;
    js = js.replace(/type\s+[a-zA-Z0-9_]+(\s*<[^>]+>)?\s*=\s*[^;]+;/g, '');

    // 3. Remove `as Type` assertions
    js = js.replace(/\s+as\s+[a-zA-Z0-9_<>[\]|&]+/g, '');

    // 4. Remove `<Type>` type casts
    js = js.replace(/<[A-Za-z0-9_]+>\s*(?=[a-zA-Z0-9_])/g, '');

    // 5. Remove variable type annotations: let x: number = 5;
    js = js.replace(/(\b(?:const|let|var)\s+[a-zA-Z0-9_]+)\s*:\s*[a-zA-Z0-9_<>[\]|&?]+(\s*=)/g, '$1$2');

    // 6. Remove function return type annotations: function foo(): string {
    js = js.replace(/(\)\s*):\s*[a-zA-Z0-9_<>[\]|&?]+(\s*\{)/g, '$1$2');

    // 7. Remove parameter types: (a: string, b: number)
    js = js.replace(/\(([^)]*)\)/g, (match, args) => {
      if (!args.includes(':')) return match;
      const strippedArgs = args.split(',').map(arg => {
        const parts = arg.split(':');
        return parts[0].trim();
      }).join(', ');
      return `(${strippedArgs})`;
    });

    // 8. Remove access modifiers (public, private, protected, readonly)
    js = js.replace(/\b(public|private|protected|readonly)\s+/g, '');

    return js;
  }

  // ==========================================================================
  // Markdown In-Browser Parser
  // ==========================================================================
  function parseMarkdown(md) {
    if (!md) return '';
    let html = md
      // Escape HTML entities to prevent XSS
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks ```lang ... ```
    html = html.replace(/```([a-z0-9_+-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="md-code-block"><code class="lang-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

    // Bold & Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Unordered lists (- or *)
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/gi, '<ul>$1</ul>');

    // Paragraphs
    html = html.split('\n\n').map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<blockquote')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    return html;
  }

  // ==========================================================================
  // CSV In-Browser Parser
  // ==========================================================================
  function parseCsvToTable(csv) {
    if (!csv) return { columns: [], rows: [] };
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return { columns: [], rows: [] };

    function parseLine(line) {
      const res = [];
      let inQuote = false;
      let field = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuote && line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuote = !inQuote;
          }
        } else if (c === ',' && !inQuote) {
          res.push(field.trim());
          field = '';
        } else {
          field += c;
        }
      }
      res.push(field.trim());
      return res;
    }

    const columns = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { columns, rows };
  }

  // Helper
  function loadScriptAsync(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  // ==========================================================================
  // Client-Side Code Formatters
  // ==========================================================================
  function formatHtml(html, tabSize = 2) {
    const indent = ' '.repeat(tabSize);
    let formatted = '';
    let pad = 0;
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype']);
    
    const tokens = html.replace(/>\s*</g, '><').split(/(<[^>]+>)/g).filter(Boolean);
    tokens.forEach(token => {
      if (token.startsWith('<!--') && token.endsWith('-->')) {
        formatted += indent.repeat(pad) + token.trim() + '\n';
      } else if (token.startsWith('</')) {
        pad = Math.max(0, pad - 1);
        formatted += indent.repeat(pad) + token.trim() + '\n';
      } else if (token.startsWith('<')) {
        const tagName = (token.match(/<([a-zA-Z0-9_-]+)/) || [])[1];
        const isVoid = token.endsWith('/>') || (tagName && voidTags.has(tagName.toLowerCase()));
        formatted += indent.repeat(pad) + token.trim() + '\n';
        if (!isVoid && !token.startsWith('<!')) {
          pad++;
        }
      } else {
        const trimmed = token.trim();
        if (trimmed) {
          formatted += indent.repeat(pad) + trimmed + '\n';
        }
      }
    });
    return formatted.trim();
  }

  function formatCss(css, tabSize = 2) {
    const indent = ' '.repeat(tabSize);
    let clean = css.replace(/[ \t]+/g, ' ').replace(/\s*([\{\};:,])\s*/g, '$1');
    let formatted = '';
    let depth = 0;
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      if (char === '{') {
        formatted += ' {\n';
        depth++;
        formatted += indent.repeat(depth);
      } else if (char === '}') {
        formatted = formatted.trimEnd() + '\n';
        depth = Math.max(0, depth - 1);
        formatted += indent.repeat(depth) + '}\n\n';
      } else if (char === ';') {
        formatted += ';\n' + indent.repeat(depth);
      } else if (char === ':') {
        formatted += ': ';
      } else {
        formatted += char;
      }
    }
    return formatted.replace(/\n{3,}/g, '\n\n').trim();
  }

  function formatJs(code, tabSize = 2) {
    const indent = ' '.repeat(tabSize);
    const lines = code.split(/\r?\n/);
    let depth = 0;
    const formattedLines = [];

    lines.forEach(rawLine => {
      let line = rawLine.trim();
      if (!line) {
        formattedLines.push('');
        return;
      }
      const closeMatch = line.match(/^[\}\]\)]+/);
      let localDecrease = 0;
      if (closeMatch) {
        localDecrease = closeMatch[0].length;
      }
      const effectiveDepth = Math.max(0, depth - localDecrease);
      formattedLines.push(indent.repeat(effectiveDepth) + line);

      for (const ch of line) {
        if (ch === '{' || ch === '[' || ch === '(') depth++;
        if (ch === '}' || ch === ']' || ch === ')') depth = Math.max(0, depth - 1);
      }
    });

    return formattedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function formatSql(sql, tabSize = 2) {
    const indent = ' '.repeat(tabSize);
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'INSERT INTO', 'VALUES',
      'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'DROP TABLE', 'AND', 'OR',
      'AS', 'DESC', 'ASC', 'COUNT'
    ];
    let formatted = sql;
    keywords.forEach(kw => {
      const reg = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'gi');
      formatted = formatted.replace(reg, kw);
    });

    const majorClauses = ['SELECT', 'FROM', 'JOIN', 'LEFT JOIN', 'INNER JOIN', 'WHERE', 'ORDER BY', 'GROUP BY', 'LIMIT', 'SET', 'VALUES'];
    majorClauses.forEach(cl => {
      const reg = new RegExp(`\\s*\\b${cl}\\b\\s*`, 'g');
      formatted = formatted.replace(reg, `\n${cl} `);
    });

    return formatted.split('\n').map(l => {
      const t = l.trim();
      if (!t) return '';
      if (/^(SELECT|FROM|WHERE|UPDATE|DELETE|INSERT|CREATE|DROP)/.test(t)) {
        return t;
      }
      return indent + t;
    }).join('\n').trim();
  }

  function formatDocument(code, langId, tabSize = 2) {
    if (!code) return '';
    try {
      switch (langId) {
        case 'html': case 'htm': return formatHtml(code, tabSize);
        case 'css': return formatCss(code, tabSize);
        case 'javascript': case 'typescript': case 'js': case 'ts': return formatJs(code, tabSize);
        case 'json': return JSON.stringify(JSON.parse(code), null, tabSize);
        case 'sql': return formatSql(code, tabSize);
        case 'markdown': case 'md': return code.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
        default: return code.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
      }
    } catch (e) {
      return code.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    }
  }

  // ==========================================================================
  // Zero-Dependency Live Syntax Highlighting Tokenizer
  // ==========================================================================
  function highlightSyntax(rawCode, rawLangId) {
    if (typeof rawCode !== 'string') return '';
    const code = rawCode.replace(/\r\n/g, '\n');
    const lang = (rawLangId || 'text').toLowerCase();

    function escapeHtml(str) {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function wrapSpan(text, cls) {
      if (!text) return '';
      const lines = text.split('\n');
      return lines.map(line => `<span class="${cls}">${escapeHtml(line)}</span>`).join('\n');
    }

    function highlightJavaScript(src) {
      const tokenRegex = /(\/\*[\s\S]*?\*\/)|(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield|true|false)\b)|(\b(?:console|document|window|Array|Object|String|Number|Boolean|Function|Promise|Map|Set|JSON|Math|Date|RegExp|Error)\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([+\-*\/%=!&|^~?:<>]+)|([{}()\[\],;.])/g;

      let lastIndex = 0;
      let out = '';
      let match;
      while ((match = tokenRegex.exec(src)) !== null) {
        if (match.index > lastIndex) {
          out += escapeHtml(src.substring(lastIndex, match.index));
        }
        const [full, commentBlock, commentLine, templateStr, normalStr, keyword, builtin, func, num, op, punct] = match;
        if (commentBlock) out += wrapSpan(commentBlock, 'token-comment');
        else if (commentLine) out += wrapSpan(commentLine, 'token-comment');
        else if (templateStr) out += wrapSpan(templateStr, 'token-string');
        else if (normalStr) out += wrapSpan(normalStr, 'token-string');
        else if (keyword) out += wrapSpan(keyword, 'token-keyword');
        else if (builtin) out += wrapSpan(builtin, 'token-property');
        else if (func) out += wrapSpan(func, 'token-function');
        else if (num) out += wrapSpan(num, 'token-number');
        else if (op) out += wrapSpan(op, 'token-operator');
        else if (punct) out += wrapSpan(punct, 'token-punctuation');
        lastIndex = tokenRegex.lastIndex;
      }
      if (lastIndex < src.length) {
        out += escapeHtml(src.substring(lastIndex));
      }
      return out;
    }

    function highlightCss(src) {
      const cssRegex = /(\/\*[\s\S]*?\*\/)|(@[a-zA-Z0-9_-]+)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(#[0-9a-fA-F]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%|s|ms|deg|fr)?\b)|(\b[a-zA-Z_-]+(?=\s*:))|(:[a-zA-Z-]+)|(\b(?:rgb|rgba|hsl|hsla|calc|var|url|linear-gradient)\b)|([{}();:,])/g;

      let lastIndex = 0;
      let out = '';
      let match;
      while ((match = cssRegex.exec(src)) !== null) {
        if (match.index > lastIndex) {
          out += escapeHtml(src.substring(lastIndex, match.index));
        }
        const [full, comment, atRule, str, hexColor, numUnit, prop, pseudo, func, punct] = match;
        if (comment) out += wrapSpan(comment, 'token-comment');
        else if (atRule) out += wrapSpan(atRule, 'token-keyword');
        else if (str) out += wrapSpan(str, 'token-string');
        else if (hexColor) out += wrapSpan(hexColor, 'token-number');
        else if (numUnit) out += wrapSpan(numUnit, 'token-number');
        else if (prop) out += wrapSpan(prop, 'token-property');
        else if (pseudo) out += wrapSpan(pseudo, 'token-function');
        else if (func) out += wrapSpan(func, 'token-function');
        else if (punct) out += wrapSpan(punct, 'token-punctuation');
        lastIndex = cssRegex.lastIndex;
      }
      if (lastIndex < src.length) {
        out += escapeHtml(src.substring(lastIndex));
      }
      return out;
    }

    function highlightHtml(src) {
      const htmlRegex = /(<!--[\s\S]*?-->)|(<!DOCTYPE[^>]*>)|(<style[\s\S]*?<\/style>)|(<script[\s\S]*?<\/script>)|(<\/?[a-zA-Z0-9_-]+)|(\s+[a-zA-Z0-9_:-]+(?=\s*=))|(=(?:"[^"]*"|'[^']*'))|(\/?>)/gi;

      let lastIndex = 0;
      let out = '';
      let match;
      while ((match = htmlRegex.exec(src)) !== null) {
        if (match.index > lastIndex) {
          out += escapeHtml(src.substring(lastIndex, match.index));
        }
        const [full, comment, doctype, styleBlock, scriptBlock, tag, attr, attrVal, tagClose] = match;
        if (comment) {
          out += wrapSpan(comment, 'token-comment');
        } else if (doctype) {
          out += wrapSpan(doctype, 'token-keyword');
        } else if (styleBlock) {
          const openMatch = styleBlock.match(/^<style[^>]*>/i);
          const openTag = openMatch ? openMatch[0] : '<style>';
          const closeTag = '</style>';
          const cssContent = styleBlock.substring(openTag.length, styleBlock.length - closeTag.length);
          out += wrapSpan(openTag, 'token-tag') + highlightCss(cssContent) + wrapSpan(closeTag, 'token-tag');
        } else if (scriptBlock) {
          const openMatch = scriptBlock.match(/^<script[^>]*>/i);
          const openTag = openMatch ? openMatch[0] : '<script>';
          const closeTag = '</script>';
          const jsContent = scriptBlock.substring(openTag.length, scriptBlock.length - closeTag.length);
          out += wrapSpan(openTag, 'token-tag') + highlightJavaScript(jsContent) + wrapSpan(closeTag, 'token-tag');
        } else if (tag) {
          out += wrapSpan(tag, 'token-tag');
        } else if (attr) {
          out += wrapSpan(attr, 'token-attr');
        } else if (attrVal) {
          out += escapeHtml('=') + wrapSpan(attrVal.substring(1), 'token-string');
        } else if (tagClose) {
          out += wrapSpan(tagClose, 'token-tag');
        }
        lastIndex = htmlRegex.lastIndex;
      }
      if (lastIndex < src.length) {
        out += escapeHtml(src.substring(lastIndex));
      }
      return out;
    }

    function highlightPython(src) {
      const pyRegex = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?''')|([fFrRuUbB]?"(?:\\.|[^"\\])*"|[fFrRuUbB]?'(?:\\.|[^'\\])*')|(\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|True|False|None|self)\b)|(\b(?:print|len|range|int|str|float|list|dict|set|tuple|bool|open|type|sum|min|max|enumerate|zip|map|filter)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\())|(\b\d+(?:\.\d+)?\b)|(@[a-zA-Z0-9_.]+)|([+\-*\/%=!&|^~?:<>]+)|([{}()\[\],;:])/g;

      let lastIndex = 0;
      let out = '';
      let match;
      while ((match = pyRegex.exec(src)) !== null) {
        if (match.index > lastIndex) {
          out += escapeHtml(src.substring(lastIndex, match.index));
        }
        const [full, comment, tripleStr, str, keyword, builtin, func, num, decorator, op, punct] = match;
        if (comment) out += wrapSpan(comment, 'token-comment');
        else if (tripleStr) out += wrapSpan(tripleStr, 'token-string');
        else if (str) out += wrapSpan(str, 'token-string');
        else if (keyword) out += wrapSpan(keyword, 'token-keyword');
        else if (builtin) out += wrapSpan(builtin, 'token-property');
        else if (func) out += wrapSpan(func, 'token-function');
        else if (num) out += wrapSpan(num, 'token-number');
        else if (decorator) out += wrapSpan(decorator, 'token-function');
        else if (op) out += wrapSpan(op, 'token-operator');
        else if (punct) out += wrapSpan(punct, 'token-punctuation');
        lastIndex = pyRegex.lastIndex;
      }
      if (lastIndex < src.length) {
        out += escapeHtml(src.substring(lastIndex));
      }
      return out;
    }

    function highlightSql(src) {
      const sqlRegex = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')|(\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|ADD|COLUMN|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|AS|AND|OR|NOT|IN|BETWEEN|LIKE|IS|NULL|COUNT|SUM|AVG|MIN|MAX|DISTINCT|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|INTEGER|TEXT|REAL|BLOB|BOOLEAN|VARCHAR|DATETIME|ASC|DESC)\b)|(\b\d+(?:\.\d+)?\b)|([=<>!+\-*\/%]+)|([(),;])/gi;

      let lastIndex = 0;
      let out = '';
      let match;
      while ((match = sqlRegex.exec(src)) !== null) {
        if (match.index > lastIndex) {
          out += escapeHtml(src.substring(lastIndex, match.index));
        }
        const [full, comment, str, keyword, num, op, punct] = match;
        if (comment) out += wrapSpan(comment, 'token-comment');
        else if (str) out += wrapSpan(str, 'token-string');
        else if (keyword) out += wrapSpan(keyword, 'token-keyword');
        else if (num) out += wrapSpan(num, 'token-number');
        else if (op) out += wrapSpan(op, 'token-operator');
        else if (punct) out += wrapSpan(punct, 'token-punctuation');
        lastIndex = sqlRegex.lastIndex;
      }
      if (lastIndex < src.length) {
        out += escapeHtml(src.substring(lastIndex));
      }
      return out;
    }

    function highlightJson(src) {
      const jsonRegex = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([{}[\]:,])/g;

      let lastIndex = 0;
      let out = '';
      let match;
      while ((match = jsonRegex.exec(src)) !== null) {
        if (match.index > lastIndex) {
          out += escapeHtml(src.substring(lastIndex, match.index));
        }
        const [full, keyStr, valStr, boolNull, num, punct] = match;
        if (keyStr) out += wrapSpan(keyStr, 'token-property');
        else if (valStr) out += wrapSpan(valStr, 'token-string');
        else if (boolNull) out += wrapSpan(boolNull, 'token-keyword');
        else if (num) out += wrapSpan(num, 'token-number');
        else if (punct) out += wrapSpan(punct, 'token-punctuation');
        lastIndex = jsonRegex.lastIndex;
      }
      if (lastIndex < src.length) {
        out += escapeHtml(src.substring(lastIndex));
      }
      return out;
    }

    function highlightMarkdown(src) {
      const lines = src.split('\n');
      return lines.map(line => {
        if (/^#{1,6}\s/.test(line)) {
          return wrapSpan(line, 'token-keyword');
        }
        if (/^```/.test(line)) {
          return wrapSpan(line, 'token-comment');
        }
        if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
          const listPrefix = (line.match(/^\s*[-*+\d.]+\s/) || [''])[0];
          return wrapSpan(listPrefix, 'token-operator') + escapeHtml(line.substring(listPrefix.length));
        }
        if (/^\s*>/.test(line)) {
          return wrapSpan(line, 'token-comment');
        }
        return escapeHtml(line)
          .replace(/(`[^`]+`)/g, '<span class="token-string">$1</span>')
          .replace(/(\*\*[^*]+\*\*)/g, '<span class="token-function">$1</span>')
          .replace(/(\[[^\]]+\]\([^)]+\))/g, '<span class="token-property">$1</span>');
      }).join('\n');
    }

    let highlighted = '';

    if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(lang)) {
      highlighted = highlightJavaScript(code);
    } else if (['html', 'htm', 'svg', 'xml'].includes(lang)) {
      highlighted = highlightHtml(code);
    } else if (['css', 'scss', 'less'].includes(lang)) {
      highlighted = highlightCss(code);
    } else if (['python', 'py'].includes(lang)) {
      highlighted = highlightPython(code);
    } else if (['sql'].includes(lang)) {
      highlighted = highlightSql(code);
    } else if (['json'].includes(lang)) {
      highlighted = highlightJson(code);
    } else if (['markdown', 'md'].includes(lang)) {
      highlighted = highlightMarkdown(code);
    } else {
      highlighted = escapeHtml(code);
    }

    // Wrap each line in a <div class="highlight-line">
    const outputLines = highlighted.split('\n');
    return outputLines.map(line => `<div class="highlight-line">${line || '<br>'}</div>`).join('');
  }

  // Export
  window.AkshLanguages = {
    BADGES,
    LANGUAGES,
    getLanguageByFilename,
    runPythonCode,
    resetPythonSession,
    sqlEngine: sqlEngineInstance,
    transpileTypeScript,
    parseMarkdown,
    parseCsvToTable,
    formatDocument,
    highlightSyntax
  };

})(window);
