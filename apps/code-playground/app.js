/**
 * Aksh Code Playground Pro — Core Application Controller
 * Pure Vanilla JavaScript (ES6+), Zero External Dependencies.
 * Integrates IndexedDB (Mode A), File System Access API (Mode B),
 * Pure Client-Side ZIP Engine, Local Code Assistant, Language Registry,
 * and In-Browser Runtimes (Pyodide Python WASM, In-Memory SQL, TypeScript).
 */

(function () {
  'use strict';

  // ==========================================================================
  // Storage & State Keys
  // ==========================================================================
  const SETTINGS_KEY = 'aksh_code_playground_settings_v2';
  const STORAGE_KEY = 'aksh_code_playground_v1';

  // ==========================================================================
  // Application State
  // ==========================================================================
  const state = {
    project: {
      id: 'proj-' + Date.now(),
      name: 'Aksh Project',
      activeFile: 'index.html',
      files: [
        { name: 'index.html', path: 'index.html', type: 'html', content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Aksh Project</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <h1>Welcome to Aksh Code Playground</h1>\n  <p>Start editing to see live preview.</p>\n  <script src="script.js"></script>\n</body>\n</html>', isDirty: false },
        { name: 'styles.css', path: 'styles.css', type: 'css', content: 'body {\n  font-family: sans-serif;\n  background: #0f172a;\n  color: #f8fafc;\n  padding: 24px;\n}\nh1 {\n  color: #38bdf8;\n}', isDirty: false },
        { name: 'script.js', path: 'script.js', type: 'javascript', content: 'console.log("Aksh Code Playground active!");', isDirty: false }
      ],
      folders: []
    },
    openTabs: ['index.html', 'styles.css', 'script.js'],
    dirty: false,
    autoRun: false,
    autoRunTimer: null,
    autoSaveTimer: null,
    autoLint: true,
    autoLintTimer: null,
    editorFontSize: 14,
    wordWrap: true,
    tabSize: 2,
    theme: 'dark',
    currentPreset: 'responsive',
    consoleLogs: [],
    consoleFilter: 'all',
    mobileView: 'code',
    activeSidePanel: 'explorer',
    storageMode: 'browser', // 'browser' | 'device'
    lastSqlResult: null,
    findReplace: {
      isOpen: false,
      matches: [],
      currentIndex: -1
    },
    commandPalette: {
      isOpen: false,
      query: '',
      items: [],
      selectedIndex: 0
    }
  };

  // Helper for unsaved changes across files
  function hasUnsavedChanges() {
    return state.dirty || state.project.files.some(f => f.isDirty);
  }

  // ==========================================================================
  // DOM Elements Cache
  // ==========================================================================
  let dom = {};

  function initDomElements() {
    dom = {
      body: document.body,
      projectTitleInput: document.getElementById('project-title-input'),
      saveStatusBadge: document.getElementById('save-status-badge'),
      saveStatusText: document.getElementById('save-status-text'),
      storageModeBadge: document.getElementById('storage-mode-badge'),
      storageModeText: document.getElementById('storage-mode-text'),
      langCapabilityBadge: document.getElementById('lang-capability-badge'),

      // Top Bar Buttons
      btnRun: document.getElementById('btn-run'),
      btnRunLabel: document.getElementById('btn-run-label'),
      btnStop: document.getElementById('btn-stop'),
      btnSave: document.getElementById('btn-save'),
      btnSaveAll: document.getElementById('btn-save-all'),
      btnRecentProjects: document.getElementById('btn-recent-projects'),
      btnOpenFolder: document.getElementById('btn-open-folder'),
      btnNewProject: document.getElementById('btn-new-project'),
      btnTemplates: document.getElementById('btn-templates'),
      btnExport: document.getElementById('btn-export'),
      exportZipBtn: document.getElementById('export-zip-btn'),
      exportJsonBtn: document.getElementById('export-json-btn'),
      exportHtmlBtn: document.getElementById('export-html-btn'),
      exportMenu: document.getElementById('export-menu'),
      btnImport: document.getElementById('btn-import'),
      btnResetLayout: document.getElementById('btn-reset-layout'),
      btnShortcuts: document.getElementById('btn-shortcuts'),
      btnSettings: document.getElementById('btn-settings'),
      themeToggle: document.getElementById('theme-toggle'),

      // Activity Bar & Navigation
      activityBtns: document.querySelectorAll('.activity-btn'),
      sidePanels: document.querySelectorAll('.side-panel'),
      problemsBadgeCount: document.getElementById('problems-badge-count'),

      // Side Panels
      explorerPanel: document.getElementById('explorer-panel'),
      explorerHeading: document.getElementById('explorer-heading'),
      explorerStorageTypeLabel: document.getElementById('explorer-storage-type-label'),
      fileTreeList: document.getElementById('file-tree-list'),
      btnNewFile: document.getElementById('btn-new-file'),
      btnNewFolder: document.getElementById('btn-new-folder'),
      btnSearchProject: document.getElementById('btn-search-project'),
      btnRefreshExplorer: document.getElementById('btn-refresh-explorer'),
      storageNoticeBox: document.getElementById('storage-notice-box'),

      // Assistant Panel
      assistantPanel: document.getElementById('assistant-panel'),
      assistantContextSelect: document.getElementById('assistant-context-select'),
      assistantMessages: document.getElementById('assistant-messages'),
      assistantForm: document.getElementById('assistant-form'),
      assistantInput: document.getElementById('assistant-input'),
      btnSendAssistant: document.getElementById('btn-send-assistant'),
      btnClearChat: document.getElementById('btn-clear-chat'),
      btnUndoAssistant: document.getElementById('btn-undo-assistant'),
      quickActionBtns: document.querySelectorAll('.quick-action-btn'),

      // Problems Panel
      problemsPanel: document.getElementById('problems-panel'),
      problemsList: document.getElementById('problems-list'),
      btnRescanProblems: document.getElementById('btn-rescan-problems'),
      btnClearProblems: document.getElementById('btn-clear-problems'),
      probFilterBtns: document.querySelectorAll('[data-prob-filter]'),
      probCountAll: document.getElementById('prob-count-all'),
      probCountError: document.getElementById('prob-count-error'),
      probCountWarn: document.getElementById('prob-count-warn'),

      // Templates & Snippets Panels
      templatesPanel: document.getElementById('templates-panel'),
      templatesListContainer: document.getElementById('templates-list-container'),
      templatesSearchInput: document.getElementById('templates-search-input'),
      snippetsPanel: document.getElementById('snippets-panel'),
      snippetsListContainer: document.getElementById('snippets-list-container'),
      snippetsSearchInput: document.getElementById('snippets-search-input'),

      // QA & Metrics Panel
      qaPanel: document.getElementById('qa-panel'),
      metricLoc: document.getElementById('metric-loc'),
      metricFuncs: document.getElementById('metric-funcs'),
      metricComplexity: document.getElementById('metric-complexity'),
      metricRating: document.getElementById('metric-rating'),
      btnRunTests: document.getElementById('btn-run-tests'),
      testResultsContainer: document.getElementById('test-results-container'),
      btnRunA11y: document.getElementById('btn-run-a11y'),
      a11yResultsContainer: document.getElementById('a11y-results-container'),
      contrastFgPicker: document.getElementById('contrast-fg-picker'),
      contrastFgText: document.getElementById('contrast-fg-text'),
      contrastBgPicker: document.getElementById('contrast-bg-picker'),
      contrastBgText: document.getElementById('contrast-bg-text'),
      contrastRatioValue: document.getElementById('contrast-ratio-value'),
      badgeAa: document.getElementById('badge-aa'),
      badgeAaa: document.getElementById('badge-aaa'),
      btnGenReadme: document.getElementById('btn-gen-readme'),
      qaTotalFiles: document.getElementById('qa-total-files'),
      qaTotalSize: document.getElementById('qa-total-size'),

      // Editor
      editorWrapper: document.getElementById('editor-wrapper'),
      editorTabsList: document.getElementById('editor-tabs-list'),
      btnFormatCode: document.getElementById('btn-format-code'),
      btnFindOpen: document.getElementById('btn-find-open'),
      btnGotoLine: document.getElementById('btn-goto-line'),
      btnToggleWrap: document.getElementById('btn-toggle-wrap'),
      gotoLineBar: document.getElementById('goto-line-bar'),
      gotoLineInput: document.getElementById('goto-line-input'),
      btnGotoLineSubmit: document.getElementById('btn-goto-line-submit'),
      btnCloseGoto: document.getElementById('btn-close-goto'),
      projectSearchContainer: document.getElementById('project-search-container'),
      projectSearchInput: document.getElementById('project-search-input'),
      projectSearchCount: document.getElementById('project-search-count'),
      projectSearchResults: document.getElementById('project-search-results'),
      btnCloseProjectSearch: document.getElementById('btn-close-project-search'),
      lineGutter: document.getElementById('line-gutter'),
      codeTextarea: document.getElementById('code-textarea'),
      codeHighlightLayer: document.getElementById('code-highlight-layer'),
      codeHighlightContent: document.getElementById('code-highlight-content'),
      cursorPosInfo: document.getElementById('cursor-pos-info'),
      docStatsInfo: document.getElementById('doc-stats-info'),
      tabSizeStatusInfo: document.getElementById('tab-size-status-info'),
      fileTypeTag: document.getElementById('file-type-tag'),
      editorBreadcrumbs: document.getElementById('editor-breadcrumbs'),
      breadcrumbProject: document.getElementById('breadcrumb-project'),
      breadcrumbFile: document.getElementById('breadcrumb-file'),

      // Command Palette
      btnCommandPalette: document.getElementById('btn-command-palette'),
      commandPaletteBackdrop: document.getElementById('command-palette-backdrop'),
      commandPaletteInput: document.getElementById('command-palette-input'),
      commandPaletteList: document.getElementById('command-palette-list'),

      // Find & Replace
      findReplaceBar: document.getElementById('find-replace-bar'),
      findInput: document.getElementById('find-input'),
      replaceInput: document.getElementById('replace-input'),
      btnFindPrev: document.getElementById('btn-find-prev'),
      btnFindNext: document.getElementById('btn-find-next'),
      btnReplaceOne: document.getElementById('btn-replace-one'),
      btnReplaceAll: document.getElementById('btn-replace-all'),
      btnCloseFind: document.getElementById('btn-close-find'),
      findCountText: document.getElementById('find-count-text'),

      // Preview
      previewPanel: document.getElementById('preview-panel'),
      previewFrameContainer: document.getElementById('preview-frame-container'),
      previewIframe: document.getElementById('preview-iframe'),
      btnRefreshPreview: document.getElementById('btn-refresh-preview'),
      btnFullscreenPreview: document.getElementById('btn-fullscreen-preview'),
      autoRunSwitch: document.getElementById('auto-run-switch'),
      presetBtns: document.querySelectorAll('.device-preset-btn'),
      viewportInfoTag: document.getElementById('viewport-info-tag'),

      // Console & Execution Output
      consolePanel: document.getElementById('console-panel'),
      consoleLogsList: document.getElementById('console-logs-list'),
      btnClearConsole: document.getElementById('btn-clear-console'),
      btnToggleConsole: document.getElementById('btn-toggle-console'),
      btnResetRuntime: document.getElementById('btn-reset-runtime'),
      filterChips: document.querySelectorAll('.filter-chip'),

      // SQL Studio Elements
      sqlResultsPanel: document.getElementById('sql-results-panel'),
      sqlQueryStats: document.getElementById('sql-query-stats'),
      sqlTableHead: document.getElementById('sql-table-head'),
      sqlTableBody: document.getElementById('sql-table-body'),
      btnToggleSqlSchema: document.getElementById('btn-toggle-sql-schema'),
      sqlSchemaContainer: document.getElementById('sql-schema-container'),
      btnExportSqlCsv: document.getElementById('btn-export-sql-csv'),
      btnResetSampleDb: document.getElementById('btn-reset-sample-db'),

      // Gutters & Modals
      gutterSidebar: document.getElementById('gutter-sidebar'),
      gutterEditor: document.getElementById('gutter-editor'),
      gutterConsole: document.getElementById('gutter-console'),
      dragOverlay: document.getElementById('drag-overlay'),

      modalBackdrop: document.getElementById('modal-backdrop'),
      modalTitle: document.getElementById('modal-title'),
      modalBody: document.getElementById('modal-body'),
      modalFooter: document.getElementById('modal-footer'),
      modalCloseBtn: document.getElementById('modal-close-btn'),

      toastContainer: document.getElementById('toast-container'),
      hiddenFileInput: document.getElementById('hidden-file-input'),
      mobileViewTabs: document.querySelectorAll('.mobile-view-tab')
    };
  }

  // ==========================================================================
  // Toast Notifications
  // ==========================================================================
  function showToast(message, type = 'info', duration = 3000) {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-message toast-${type} ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
      <button class="toast-close-btn" aria-label="Close notification">&times;</button>
    `;

    toast.querySelector('.toast-close-btn').onclick = () => removeToast(toast);
    dom.toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('visible'), 10);
    const timer = setTimeout(() => removeToast(toast), duration);
    toast._timer = timer;
  }

  function removeToast(toast) {
    if (!toast) return;
    clearTimeout(toast._timer);
    toast.classList.remove('visible');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }

  // ==========================================================================
  // Storage & State Persistence (Mode A: IndexedDB / Mode B: Device Folder)
  // ==========================================================================
  async function loadSavedState() {
    // 1. Preferences from localStorage
    const prefs = window.AkshStorage.loadPreferences();
    state.theme = prefs.theme || 'dark';
    state.editorFontSize = prefs.editorFontSize || 14;
    state.wordWrap = prefs.wordWrap !== undefined ? prefs.wordWrap : true;
    state.tabSize = prefs.tabSize || 2;
    state.autoRun = prefs.autoRun || false;
    state.autoLint = prefs.autoLint !== undefined ? prefs.autoLint : true;

    if (dom.autoRunSwitch) dom.autoRunSwitch.checked = state.autoRun;

    // 2. Load Project from IndexedDB (or fallback to blank template)
    try {
      updateSaveBadge('saving');
      const activeProjId = localStorage.getItem('aksh_active_project_id_v2');
      let project = await window.AkshStorage.getProjectFromIdb(activeProjId);

      if (project && project.files && project.files.length > 0) {
        state.project = {
          id: project.id || 'proj-' + Date.now(),
          name: project.name || 'Aksh Project',
          activeFile: project.activeFile || project.files[0].path || project.files[0].name,
          files: project.files.map(f => ({ ...f, isDirty: false })),
          folders: project.folders || []
        };
        const existingPaths = new Set(state.project.files.map(f => f.path || f.name));
        const validOpenTabs = (project.openTabs || []).filter(p => existingPaths.has(p));
        if (!validOpenTabs.includes(state.project.activeFile) && existingPaths.has(state.project.activeFile)) {
          validOpenTabs.push(state.project.activeFile);
        }
        state.openTabs = validOpenTabs.length > 0 ? validOpenTabs : [state.project.activeFile];
        state.dirty = false;
        updateSaveBadge('saved');
        return;
      }
    } catch (err) {
      console.warn('IDB load error:', err);
    }

    // Default: Load Blank Starter Template
    loadTemplate('blank', false);
  }

  function loadProjectObject(project) {
    if (!project || !project.files || project.files.length === 0) return;
    if (state.storageMode === 'device') {
      window.AkshStorage.closeLocalFolder();
      state.storageMode = 'browser';
      updateStorageModeBadge();
    }
    state.project = {
      id: project.id || 'proj-' + Date.now(),
      name: project.name || 'Aksh Project',
      activeFile: project.activeFile || project.files[0].path || project.files[0].name,
      files: project.files.map(f => ({ ...f, isDirty: false })),
      folders: project.folders ? JSON.parse(JSON.stringify(project.folders)) : []
    };
    state.openTabs = project.openTabs || state.project.files.slice(0, 4).map(f => f.path || f.name);
    state.dirty = false;
    if (dom.projectTitleInput) dom.projectTitleInput.value = state.project.name;
    localStorage.setItem('aksh_active_project_id_v2', state.project.id);
    renderTabs();
    renderFileTree();
    loadActiveFileIntoEditor();
    updateLanguageStatus();
    updateProjectStats();
    updateSaveBadge('saved');
    runCode();
  }

  async function saveProjectToStorage(silent = false) {
    syncActiveFileFromEditor();
    updateSaveBadge('saving');

    const activeFile = getActiveFileObj();

    if (state.storageMode === 'device') {
      // Mode B: Save active file to local folder handle on disk
      try {
        if (activeFile) {
          await window.AkshStorage.saveFileToDisk(activeFile.path || activeFile.name, activeFile.content);
          activeFile.isDirty = false;
        }
        state.dirty = hasUnsavedChanges();
        renderTabs();
        updateSaveBadge(state.dirty ? 'unsaved' : 'saved');
        if (!silent) showToast(`Saved "${activeFile ? activeFile.name : 'file'}" to device folder`, 'success');
      } catch (err) {
        console.error('Disk save error:', err);
        updateSaveBadge('unsaved');
        showToast('Failed to save to device folder: ' + err.message, 'error');
      }
    } else {
      // Mode A: Save to IndexedDB (Browser Storage)
      try {
        state.project.openTabs = [...state.openTabs];
        state.project.folders = state.project.folders || [];
        await window.AkshStorage.saveProjectToIdb(state.project);
        if (activeFile) activeFile.isDirty = false;
        state.dirty = hasUnsavedChanges();
        renderTabs();
        updateSaveBadge(state.dirty ? 'unsaved' : 'saved');
        if (!silent) showToast('Project saved locally in browser (IndexedDB)', 'success');
      } catch (err) {
        console.error('Storage save error:', err);
        updateSaveBadge('unsaved');
        showToast('Failed to save to browser storage: ' + err.message, 'error');
      }
    }
  }

  async function saveAllFiles() {
    syncActiveFileFromEditor();
    updateSaveBadge('saving');

    try {
      if (state.storageMode === 'device') {
        let savedCount = 0;
        for (const file of state.project.files) {
          if (file.isDirty) {
            await window.AkshStorage.saveFileToDisk(file.path || file.name, file.content);
            file.isDirty = false;
            savedCount++;
          }
        }
        state.dirty = false;
        renderTabs();
        updateSaveBadge('saved');
        showToast(`Saved ${savedCount} modified file(s) to device folder`, 'success');
      } else {
        state.project.openTabs = [...state.openTabs];
        state.project.folders = state.project.folders || [];
        await window.AkshStorage.saveProjectToIdb(state.project);
        state.project.files.forEach(f => f.isDirty = false);
        state.dirty = false;
        renderTabs();
        updateSaveBadge('saved');
        showToast('All files saved to browser storage (IndexedDB)', 'success');
      }
    } catch (err) {
      console.error('Save all error:', err);
      updateSaveBadge('unsaved');
      showToast('Save all failed: ' + err.message, 'error');
    }
  }

  function updateSaveBadge(status) {
    if (!dom.saveStatusBadge || !dom.saveStatusText) return;
    dom.saveStatusBadge.classList.remove('unsaved', 'saving');

    if (status === 'saved') {
      dom.saveStatusText.textContent = state.storageMode === 'device' ? 'Saved to Disk' : 'Saved Locally';
    } else if (status === 'unsaved') {
      dom.saveStatusBadge.classList.add('unsaved');
      dom.saveStatusText.textContent = 'Unsaved Changes';
    } else if (status === 'saving') {
      dom.saveStatusBadge.classList.add('saving');
      dom.saveStatusText.textContent = 'Saving...';
    }
  }

  function updateStorageModeBadge() {
    if (!dom.storageModeBadge || !dom.storageModeText) return;
    if (state.storageMode === 'device') {
      dom.storageModeBadge.className = 'storage-mode-pill mode-device';
      dom.storageModeBadge.innerHTML = `<span>📁</span> <span>Local: ${escapeHtml(window.AkshStorage.getLocalDirName() || 'Device Folder')}</span>`;
      if (dom.explorerHeading) dom.explorerHeading.textContent = `📁 ${window.AkshStorage.getLocalDirName()}`;
      if (dom.explorerStorageTypeLabel) dom.explorerStorageTypeLabel.textContent = 'Device Files (Direct Disk Access)';
      if (dom.storageNoticeBox) dom.storageNoticeBox.innerHTML = `<strong>Device Mode:</strong> Edits save directly to your computer on Ctrl+S via the File System Access API.`;
    } else {
      dom.storageModeBadge.className = 'storage-mode-pill mode-browser';
      dom.storageModeBadge.innerHTML = `<span>🌐</span> <span>Browser Storage</span>`;
      if (dom.explorerHeading) dom.explorerHeading.textContent = 'Project Explorer';
      if (dom.explorerStorageTypeLabel) dom.explorerStorageTypeLabel.textContent = 'Virtual Project Files';
      if (dom.storageNoticeBox) dom.storageNoticeBox.innerHTML = `<strong>Virtual Storage:</strong> Saved locally in browser IndexedDB. Stays on your machine.`;
    }
  }

  function setDirty(isDirty = true) {
    const active = getActiveFileObj();
    if (active) {
      active.isDirty = isDirty;
    }
    if (!isDirty) {
      state.project.files.forEach(f => f.isDirty = false);
    }
    state.dirty = hasUnsavedChanges();
    updateSaveBadge(state.dirty ? 'unsaved' : 'saved');
    renderTabs();
  }

  function setFileDirty(file, isDirty) {
    if (!file) return;
    file.isDirty = isDirty;
    state.dirty = hasUnsavedChanges();
    updateSaveBadge(state.dirty ? 'unsaved' : 'saved');
    renderTabs();
  }

  // ==========================================================================
  // File & Tab Management
  // ==========================================================================
  function getActiveFileObj() {
    return state.project.files.find(f => (f.path || f.name) === state.project.activeFile) || state.project.files[0];
  }

  function syncActiveFileFromEditor() {
    const active = getActiveFileObj();
    if (active && dom.codeTextarea) {
      active.content = dom.codeTextarea.value;
    }
  }

  function openFileInEditor(filePath) {
    if (!state.openTabs) state.openTabs = [];
    if (!state.openTabs.includes(filePath)) {
      state.openTabs.push(filePath);
    }
    switchActiveFile(filePath);
  }

  function closeTab(filePath) {
    const file = state.project.files.find(f => (f.path || f.name) === filePath);
    if (file && file.isDirty) {
      if (!confirm(`"${file.name}" has unsaved changes. Close tab anyway?`)) {
        return;
      }
    }

    state.openTabs = (state.openTabs || []).filter(p => p !== filePath);

    if (state.project.activeFile === filePath) {
      if (state.openTabs.length > 0) {
        switchActiveFile(state.openTabs[state.openTabs.length - 1]);
      } else if (state.project.files.length > 0) {
        openFileInEditor(state.project.files[0].path || state.project.files[0].name);
      }
    } else {
      renderTabs();
    }
  }

  function switchActiveFile(filePathOrName) {
    if (state.project.activeFile === filePathOrName) return;
    syncActiveFileFromEditor();

    const target = state.project.files.find(f => (f.path || f.name) === filePathOrName);
    if (!target) return;

    state.project.activeFile = filePathOrName;
    if (!state.openTabs.includes(filePathOrName)) {
      state.openTabs.push(filePathOrName);
    }

    loadActiveFileIntoEditor();
    renderTabs();
    renderFileTree();
    updateLanguageStatus();

    // Trigger diagnostics for active file
    triggerDiagnosticsScan();
  }

  function loadActiveFileIntoEditor() {
    const file = getActiveFileObj();
    if (!file || !dom.codeTextarea) return;

    dom.codeTextarea.value = file.content || '';
    dom.fileTypeTag.textContent = (file.type || 'text').toUpperCase();
    updateHighlightLayer();
    updateLineNumbers();
    updateCursorStats();
    updateComplexityMetrics();
    updateBreadcrumbs();
    dom.codeTextarea.focus();
  }

  function updateLanguageStatus() {
    const file = getActiveFileObj();
    if (!file) return;

    const lang = window.AkshLanguages.getLanguageByFilename(file.path || file.name);

    // Update capability badge
    if (dom.langCapabilityBadge) {
      dom.langCapabilityBadge.className = `lang-capability-badge ${lang.badge.className}`;
      dom.langCapabilityBadge.textContent = lang.badge.label;
      dom.langCapabilityBadge.title = lang.badge.tooltip;
    }

    // Update Run button
    if (dom.btnRunLabel) {
      dom.btnRunLabel.textContent = lang.runActionLabel || 'Run';
    }
    if (dom.btnRun) {
      dom.btnRun.setAttribute('data-tooltip', lang.runActionTooltip || 'Execute (Ctrl+Enter)');
      dom.btnRun.disabled = !lang.canRun;
    }
  }

  function createFile(name, content = '') {
    const cleanName = window.AkshZip.sanitizePath(name.trim());
    if (!cleanName) {
      showToast('File name cannot be empty or invalid', 'error');
      return false;
    }
    if (state.project.files.some(f => (f.path || f.name).toLowerCase() === cleanName.toLowerCase())) {
      showToast(`A file named "${cleanName}" already exists`, 'error');
      return false;
    }

    const type = window.AkshStorage.detectFileType(cleanName);
    const newFileObj = {
      name: cleanName.split('/').pop(),
      path: cleanName,
      type: type,
      content: content,
      isBinary: false,
      isDirty: false
    };

    state.project.files.push(newFileObj);
    if (!state.openTabs) state.openTabs = [];
    state.openTabs.push(cleanName);
    state.project.activeFile = cleanName;

    if (state.storageMode === 'device') {
      window.AkshStorage.createFileOnDisk(cleanName, content).catch(e => console.warn(e));
    }

    renderTabs();
    renderFileTree();
    loadActiveFileIntoEditor();
    updateLanguageStatus();
    updateProjectStats();
    saveProjectToStorage(true);
    showToast(`Created "${cleanName}"`, 'success');
    return true;
  }

  function renameFile(oldPath) {
    const file = state.project.files.find(f => (f.path || f.name) === oldPath);
    if (!file) return;

    const currentDisplay = file.path || file.name;
    const newPath = prompt(`Rename "${currentDisplay}" to:`, currentDisplay);
    if (!newPath || newPath.trim() === '' || newPath.trim() === currentDisplay) return;

    const cleanPath = window.AkshZip.sanitizePath(newPath.trim());
    if (!cleanPath) {
      showToast('Invalid file name or path.', 'error');
      return;
    }

    if (state.project.files.some(f => (f.path || f.name).toLowerCase() === cleanPath.toLowerCase())) {
      showToast(`A file named "${cleanPath}" already exists.`, 'error');
      return;
    }

    const oldName = file.name;
    file.path = cleanPath;
    file.name = cleanPath.split('/').pop();
    file.type = window.AkshStorage.detectFileType(cleanPath);

    // Update openTabs
    if (state.openTabs) {
      const tabIdx = state.openTabs.indexOf(oldPath);
      if (tabIdx !== -1) {
        state.openTabs[tabIdx] = cleanPath;
      }
    }

    if (state.project.activeFile === oldPath) {
      state.project.activeFile = cleanPath;
      if (dom.fileTypeTag) dom.fileTypeTag.textContent = (file.type || 'text').toUpperCase();
      updateLanguageStatus();
    }

    if (state.storageMode === 'device') {
      window.AkshStorage.renameFileOnDisk(oldPath, cleanPath, file.content).catch(e => console.warn(e));
    }

    renderTabs();
    renderFileTree();
    saveProjectToStorage(true);
    showToast(`Renamed "${oldName}" to "${file.name}"`, 'success');
  }

  function createFolder(suggestedPath = '') {
    const folderInput = prompt('Enter new folder name or path (e.g. "components" or "assets/icons"):', suggestedPath);
    if (!folderInput || !folderInput.trim()) return;

    const cleanFolder = window.AkshZip.sanitizePath(folderInput.trim()).replace(/^\/+|\/+$/g, '');
    if (!cleanFolder) {
      showToast('Invalid folder path.', 'error');
      return;
    }

    if (!state.project.folders) state.project.folders = [];
    if (state.project.folders.includes(cleanFolder)) {
      showToast(`Folder "${cleanFolder}" already exists.`, 'warning');
      return;
    }

    state.project.folders.push(cleanFolder);

    if (state.storageMode === 'device') {
      window.AkshStorage.createFolderOnDisk(cleanFolder).catch(e => console.warn(e));
    }

    renderFileTree();
    saveProjectToStorage(true);
    showToast(`Created folder "${cleanFolder}"`, 'success');
  }

  function deleteFolder(folderPath) {
    showConfirmModal(
      'Delete Folder',
      `Are you sure you want to delete folder "${folderPath}" and all files inside it? This cannot be undone.`,
      () => {
        const prefix = folderPath + '/';
        state.project.files = state.project.files.filter(f => !(f.path || f.name).startsWith(prefix));
        if (state.openTabs) {
          state.openTabs = state.openTabs.filter(p => !p.startsWith(prefix));
        }
        if (state.project.folders) {
          state.project.folders = state.project.folders.filter(f => f !== folderPath && !f.startsWith(prefix));
        }

        if (state.project.activeFile.startsWith(prefix)) {
          state.project.activeFile = state.openTabs[0] || (state.project.files[0] ? (state.project.files[0].path || state.project.files[0].name) : 'index.html');
          loadActiveFileIntoEditor();
        }

        if (state.storageMode === 'device') {
          window.AkshStorage.deleteFolderOnDisk(folderPath).catch(e => console.warn(e));
        }

        renderTabs();
        renderFileTree();
        updateProjectStats();
        saveProjectToStorage(true);
        showToast(`Deleted folder "${folderPath}"`, 'info');
      }
    );
  }

  function deleteFile(filePathOrName) {
    if (state.project.files.length <= 1) {
      showToast('Cannot delete the only remaining file in the project.', 'warning');
      return;
    }

    const file = state.project.files.find(f => (f.path || f.name) === filePathOrName);
    if (!file) return;

    showConfirmModal(
      'Delete File',
      `Are you sure you want to permanently delete "${file.path || file.name}"? This action cannot be undone.`,
      () => {
        state.project.files = state.project.files.filter(f => (f.path || f.name) !== filePathOrName);
        if (state.openTabs) {
          state.openTabs = state.openTabs.filter(p => p !== filePathOrName);
        }

        if (state.project.activeFile === filePathOrName) {
          const next = (state.openTabs && state.openTabs[0]) || (state.project.files[0] ? (state.project.files[0].path || state.project.files[0].name) : null);
          if (next) switchActiveFile(next);
        }

        if (state.storageMode === 'device') {
          window.AkshStorage.deleteFileOnDisk(filePathOrName).catch(e => console.warn(e));
        }

        renderTabs();
        renderFileTree();
        loadActiveFileIntoEditor();
        updateLanguageStatus();
        updateProjectStats();
        saveProjectToStorage(true);
        showToast(`Deleted "${file.name}"`, 'info');
      }
    );
  }

  function renderTabs() {
    if (!dom.editorTabsList) return;
    dom.editorTabsList.innerHTML = '';

    if (!state.openTabs || state.openTabs.length === 0) {
      state.openTabs = state.project.files.length > 0 ? [state.project.activeFile || state.project.files[0].path || state.project.files[0].name] : [];
    }

    state.openTabs.forEach(filePath => {
      const file = state.project.files.find(f => (f.path || f.name) === filePath);
      if (!file) return;

      const isActive = filePath === state.project.activeFile;
      const isDirty = !!file.isDirty;
      const tab = document.createElement('div');
      tab.className = `editor-tab ${isActive ? 'active' : ''} ${isDirty ? 'dirty' : ''}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.title = filePath;

      const icon = getFileIcon(file.name);
      tab.innerHTML = `
        <span class="tab-icon">${icon}</span>
        <span class="tab-name">${escapeHtml(file.name)}</span>
        <span class="tab-dirty-dot" title="Unsaved changes"></span>
        <button class="tab-close-btn" title="Close tab" aria-label="Close tab">&times;</button>
      `;

      tab.onclick = (e) => {
        if (e.target.classList.contains('tab-close-btn')) {
          e.stopPropagation();
          closeTab(filePath);
        } else {
          switchActiveFile(filePath);
        }
      };

      tab.onmousedown = (e) => {
        if (e.button === 1) e.preventDefault();
      };

      tab.onauxclick = (e) => {
        if (e.button === 1) { // Middle click
          e.preventDefault();
          e.stopPropagation();
          closeTab(filePath);
        }
      };

      dom.editorTabsList.appendChild(tab);
    });

    updateBreadcrumbs();
  }

  function renderFileTree() {
    if (!dom.fileTreeList) return;
    dom.fileTreeList.innerHTML = '';

    // Build hierarchical tree structure
    const root = { name: '', isDir: true, path: '', folders: {}, files: [] };

    // Explicit folders
    if (state.project.folders) {
      state.project.folders.forEach(fPath => {
        const parts = fPath.split('/');
        let cur = root;
        let built = '';
        for (const p of parts) {
          built = built ? `${built}/${p}` : p;
          if (!cur.folders[p]) {
            cur.folders[p] = { name: p, isDir: true, path: built, folders: {}, files: [] };
          }
          cur = cur.folders[p];
        }
      });
    }

    // Place files into folders
    state.project.files.forEach(file => {
      const p = file.path || file.name;
      const parts = p.split('/');
      const fileName = parts.pop();
      let cur = root;
      let built = '';
      for (const part of parts) {
        built = built ? `${built}/${part}` : part;
        if (!cur.folders[part]) {
          cur.folders[part] = { name: part, isDir: true, path: built, folders: {}, files: [] };
        }
        cur = cur.folders[part];
      }
      cur.files.push(file);
    });

    function renderFolderNode(folderObj, parentEl) {
      const subFolderNames = Object.keys(folderObj.folders).sort();
      const files = folderObj.files.sort((a, b) => a.name.localeCompare(b.name));

      subFolderNames.forEach(fName => {
        const sub = folderObj.folders[fName];
        const folderLi = document.createElement('li');
        folderLi.className = 'tree-folder';

        const header = document.createElement('div');
        header.className = 'folder-header';
        header.innerHTML = `
          <span class="folder-arrow">▼</span>
          <span class="folder-icon">📂</span>
          <span class="folder-name" title="${escapeHtml(sub.path)}">${escapeHtml(sub.name)}</span>
          <div class="folder-actions">
            <button class="tree-action-btn btn-add-in-folder" title="New file in this folder">+</button>
            <button class="tree-action-btn btn-del-folder" title="Delete folder">&times;</button>
          </div>
        `;

        header.onclick = (e) => {
          if (e.target.classList.contains('btn-add-in-folder')) {
            e.stopPropagation();
            const fn = prompt(`New file inside "${sub.path}":`, `${sub.path}/`);
            if (fn) createFile(fn);
          } else if (e.target.classList.contains('btn-del-folder')) {
            e.stopPropagation();
            deleteFolder(sub.path);
          } else {
            folderLi.classList.toggle('collapsed');
            const icon = folderLi.querySelector('.folder-icon');
            if (icon) icon.textContent = folderLi.classList.contains('collapsed') ? '📁' : '📂';
          }
        };

        const childrenUl = document.createElement('ul');
        childrenUl.className = 'folder-children';

        renderFolderNode(sub, childrenUl);

        folderLi.appendChild(header);
        folderLi.appendChild(childrenUl);
        parentEl.appendChild(folderLi);
      });

      files.forEach(file => {
        const filePath = file.path || file.name;
        const isActive = filePath === state.project.activeFile;
        const fileLi = document.createElement('li');
        fileLi.className = `file-tree-item ${isActive ? 'active' : ''}`;
        fileLi.setAttribute('role', 'treeitem');
        fileLi.setAttribute('aria-selected', isActive ? 'true' : 'false');

        const icon = getFileIcon(file.name);
        fileLi.innerHTML = `
          <span class="file-icon">${icon}</span>
          <span class="file-title" title="${escapeHtml(filePath)}">${escapeHtml(file.name)}</span>
          <div class="tree-actions-group">
            <button class="tree-action-btn item-rename-btn" title="Rename file">✏️</button>
            <button class="tree-action-btn item-delete-btn" title="Delete file">&times;</button>
          </div>
        `;

        fileLi.onclick = (e) => {
          if (e.target.classList.contains('item-delete-btn')) {
            e.stopPropagation();
            deleteFile(filePath);
          } else if (e.target.classList.contains('item-rename-btn')) {
            e.stopPropagation();
            renameFile(filePath);
          } else {
            openFileInEditor(filePath);
          }
        };

        parentEl.appendChild(fileLi);
      });
    }

    renderFolderNode(root, dom.fileTreeList);
  }

  function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'html': case 'htm': return '🌐';
      case 'css': return '🎨';
      case 'js': case 'mjs': return '⚡';
      case 'ts': case 'tsx': return '🔷';
      case 'py': return '🐍';
      case 'sql': return '🗄️';
      case 'json': return '📋';
      case 'md': return '📝';
      case 'svg': return '🖼️';
      case 'csv': return '📊';
      default: return '📄';
    }
  }

  // ==========================================================================
  // Editor Behavior, Cursor Stats, Line Numbers & Syntax Highlighting
  // ==========================================================================
  function getCursorLineNumber() {
    if (!dom.codeTextarea) return 1;
    const pos = dom.codeTextarea.selectionStart;
    return dom.codeTextarea.value.substring(0, pos).split('\n').length;
  }

  function updateLineNumbers() {
    if (!dom.lineGutter || !dom.codeTextarea) return;
    const lines = dom.codeTextarea.value.split('\n');
    const totalLines = lines.length;
    const activeLine = getCursorLineNumber();
    let gutterHtml = '';
    for (let i = 1; i <= totalLines; i++) {
      const isActive = i === activeLine;
      gutterHtml += `<div class="line-gutter-number${isActive ? ' active-line' : ''}" data-line="${i}">${i}</div>`;
    }
    dom.lineGutter.innerHTML = gutterHtml;
    dom.lineGutter.scrollTop = dom.codeTextarea.scrollTop;
    syncGutterHeights();
  }

  function updateActiveLineGutter() {
    if (!dom.lineGutter) return;
    const activeLine = getCursorLineNumber();
    const prevActive = dom.lineGutter.querySelector('.line-gutter-number.active-line');
    if (prevActive) {
      if (parseInt(prevActive.getAttribute('data-line'), 10) === activeLine) return;
      prevActive.classList.remove('active-line');
    }
    const cur = dom.lineGutter.querySelector(`.line-gutter-number[data-line="${activeLine}"]`);
    if (cur) cur.classList.add('active-line');
  }

  function syncGutterHeights() {
    if (!state.wordWrap || !dom.lineGutter || !dom.codeHighlightContent) return;
    const lineEls = dom.codeHighlightContent.querySelectorAll('.highlight-line');
    const gutterEls = dom.lineGutter.querySelectorAll('.line-gutter-number');
    if (lineEls.length === gutterEls.length) {
      for (let i = 0; i < lineEls.length; i++) {
        const h = lineEls[i].offsetHeight;
        if (h > 0) {
          gutterEls[i].style.height = `${h}px`;
        }
      }
    }
  }

  function updateHighlightLayer() {
    if (!dom.codeHighlightContent || !dom.codeTextarea) return;
    const active = getActiveFileObj();
    const ext = active ? (active.path || active.name).split('.').pop().toLowerCase() : 'html';
    const code = dom.codeTextarea.value;
    if (window.AkshLanguages && window.AkshLanguages.highlightSyntax) {
      dom.codeHighlightContent.innerHTML = window.AkshLanguages.highlightSyntax(code, ext);
    } else {
      dom.codeHighlightContent.textContent = code;
    }
    if (dom.codeHighlightLayer) {
      const scrollbarW = dom.codeTextarea.offsetWidth - dom.codeTextarea.clientWidth;
      dom.codeHighlightLayer.style.right = `${scrollbarW}px`;
      dom.codeHighlightLayer.scrollTop = dom.codeTextarea.scrollTop;
      dom.codeHighlightLayer.scrollLeft = dom.codeTextarea.scrollLeft;
    }
    syncGutterHeights();
  }

  function applyEditorFontSize(fontSize) {
    state.editorFontSize = fontSize;
    document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
    if (dom.codeTextarea) dom.codeTextarea.style.fontSize = `${fontSize}px`;
    if (dom.codeHighlightLayer) dom.codeHighlightLayer.style.fontSize = `${fontSize}px`;
    if (dom.lineGutter) dom.lineGutter.style.fontSize = `${fontSize}px`;
    syncGutterHeights();
  }

  function updateBreadcrumbs() {
    if (!dom.breadcrumbProject || !dom.breadcrumbFile) return;
    dom.breadcrumbProject.textContent = state.project.name || 'Aksh Project';
    const activeFile = state.project.activeFile || 'index.html';
    const parts = activeFile.split('/');
    if (parts.length > 1) {
      const folder = parts.slice(0, -1).join('/');
      const file = parts[parts.length - 1];
      dom.breadcrumbFile.innerHTML = `<span style="color:var(--text-muted);">${escapeHtml(folder)} &rsaquo; </span><span style="color:var(--accent-electric);">${escapeHtml(file)}</span>`;
    } else {
      dom.breadcrumbFile.textContent = activeFile;
    }
  }

  function updateTabSizeStatus() {
    const el = dom.tabSizeStatusInfo || document.getElementById('tab-size-status-info');
    if (el) el.textContent = `${state.tabSize} Spaces`;
    if (dom.codeTextarea) {
      dom.codeTextarea.style.tabSize = state.tabSize;
      dom.codeTextarea.style.MozTabSize = state.tabSize;
    }
    if (dom.codeHighlightLayer) {
      dom.codeHighlightLayer.style.tabSize = state.tabSize;
      dom.codeHighlightLayer.style.MozTabSize = state.tabSize;
    }
  }

  function triggerAutoRun() {
    if (!state.autoRun) return;
    clearTimeout(state.autoRunTimer);
    state.autoRunTimer = setTimeout(() => {
      runCode();
    }, 600);
  }

  function updateCursorStats() {
    if (!dom.codeTextarea) return;
    const text = dom.codeTextarea.value;
    const pos = dom.codeTextarea.selectionStart;
    const lines = text.substring(0, pos).split('\n');
    const curLine = lines.length;
    const curCol = lines[lines.length - 1].length + 1;

    if (dom.cursorPosInfo) dom.cursorPosInfo.textContent = `Ln ${curLine}, Col ${curCol}`;
    if (dom.docStatsInfo) dom.docStatsInfo.textContent = `${text.split('\n').length} lines, ${text.length} chars`;
    updateActiveLineGutter();
  }

  function updateComplexityMetrics() {
    if (!window.AkshDiagnostics || !dom.codeTextarea) return;
    const active = getActiveFileObj();
    const metrics = window.AkshDiagnostics.analyzeComplexity(dom.codeTextarea.value, active ? active.name : '');

    if (dom.metricLoc) dom.metricLoc.textContent = metrics.codeLines;
    if (dom.metricFuncs) dom.metricFuncs.textContent = metrics.functionCount;
    if (dom.metricComplexity) dom.metricComplexity.textContent = metrics.complexityScore;
    if (dom.metricRating) {
      dom.metricRating.textContent = metrics.rating;
      dom.metricRating.style.color = metrics.ratingColor;
    }
  }

  function triggerDiagnosticsScan() {
    if (!state.autoLint || !window.AkshDiagnostics) return;
    clearTimeout(state.autoLintTimer);
    state.autoLintTimer = setTimeout(() => {
      syncActiveFileFromEditor();
      const diags = window.AkshDiagnostics.scanProject(state.project.files);
      renderProblemsList(diags);
    }, 400);
  }

  function renderProblemsList(diags) {
    if (!dom.problemsList) return;
    dom.problemsList.innerHTML = '';

    const errors = diags.filter(d => d.severity === 'error');
    const warnings = diags.filter(d => d.severity === 'warning');

    if (dom.probCountAll) dom.probCountAll.textContent = diags.length;
    if (dom.probCountError) dom.probCountError.textContent = errors.length;
    if (dom.probCountWarn) dom.probCountWarn.textContent = warnings.length;

    // Synchronize VS Code-style status bar error & warning indicators
    const statusErrCount = document.getElementById('status-err-count');
    const statusWarnCount = document.getElementById('status-warn-count');
    if (statusErrCount) statusErrCount.textContent = errors.length;
    if (statusWarnCount) statusWarnCount.textContent = warnings.length;

    if (dom.problemsBadgeCount) {
      dom.problemsBadgeCount.textContent = diags.length;
      dom.problemsBadgeCount.style.display = diags.length > 0 ? 'inline-block' : 'none';
    }

    if (diags.length === 0) {
      dom.problemsList.innerHTML = `
        <li style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:12px;">
          🎉 No problems detected in your project files!
        </li>
      `;
      return;
    }

    diags.forEach(diag => {
      const li = document.createElement('li');
      li.className = 'problem-item';
      const icon = diag.severity === 'error' ? '🔴' : diag.severity === 'warning' ? '🟡' : 'ℹ️';

      li.innerHTML = `
        <span class="problem-icon">${icon}</span>
        <div class="problem-content">
          <div class="problem-message">${escapeHtml(diag.message)}</div>
          <div class="problem-meta">
            <span class="problem-loc-badge">${escapeHtml(diag.file)}:${diag.line}</span>
            <span>Rule: ${escapeHtml(diag.ruleId)}</span>
          </div>
          <div class="problem-actions">
            <button class="btn btn-secondary btn-jump" style="padding:2px 6px;font-size:10.5px;">Jump to Line</button>
            <button class="btn btn-secondary btn-ask-ai" style="padding:2px 6px;font-size:10.5px;">Explain with Assistant</button>
          </div>
        </div>
      `;

      li.querySelector('.btn-jump').onclick = () => {
        switchActiveFile(diag.file);
        jumpToLine(diag.line);
      };

      li.querySelector('.btn-ask-ai').onclick = () => {
        switchSidePanel('assistant');
        if (dom.assistantInput) {
          dom.assistantInput.value = `Explain this problem in ${diag.file} at line ${diag.line}: "${diag.message}"`;
          handleAssistantSubmit();
        }
      };

      dom.problemsList.appendChild(li);
    });
  }


  // ==========================================================================
  // Execution Engine (Web, Python Pyodide, SQL SQLite, TypeScript, Markdown)
  // ==========================================================================
  async function runCode() {
    syncActiveFileFromEditor();
    const activeFile = getActiveFileObj();
    if (!activeFile) return;

    const ext = (activeFile.path || activeFile.name).split('.').pop().toLowerCase();

    // 1. Python Execution via Pyodide
    if (ext === 'py') {
      await runPythonExecution(activeFile.content);
      return;
    }

    // 2. SQL Execution via In-Browser SQLite Engine
    if (ext === 'sql') {
      runSqlExecution(activeFile.content);
      return;
    }

    // 3. Markdown Preview
    if (ext === 'md' || ext === 'markdown') {
      runMarkdownPreview(activeFile.content);
      return;
    }

    // 4. SVG Preview
    if (ext === 'svg') {
      runSvgPreview(activeFile.content);
      return;
    }

    // 5. CSV Data Table Viewer
    if (ext === 'csv') {
      runCsvPreview(activeFile.content);
      return;
    }

    // 6. JSON Formatting, Validation & Tree Inspector
    if (ext === 'json') {
      runJsonPreview(activeFile.content);
      return;
    }

    // 7. Standard Web Project (HTML, CSS, JS, TS)
    clearConsole();
    if (dom.sqlResultsPanel) dom.sqlResultsPanel.style.display = 'none';
    if (dom.consoleLogsList) dom.consoleLogsList.style.display = 'flex';

    const htmlFile = state.project.files.find(f => f.name.endsWith('.html')) || activeFile;
    let htmlContent = htmlFile ? htmlFile.content : '<!DOCTYPE html><html><body></body></html>';

    const cssFiles = state.project.files.filter(f => f.name.endsWith('.css'));
    const jsFiles = state.project.files.filter(f => f.name.endsWith('.js') || f.name.endsWith('.mjs'));
    const tsFiles = state.project.files.filter(f => f.name.endsWith('.ts') || f.name.endsWith('.tsx'));

    // Transpile TypeScript files client-side into JS
    const transpiledTsFiles = tsFiles.map(f => ({
      name: f.name.replace(/\.tsx?$/, '.js'),
      content: window.AkshLanguages.transpileTypeScript(f.content)
    }));

    const allJsFiles = [...jsFiles, ...transpiledTsFiles];
    const bundledDocument = buildSandboxedDocument(htmlContent, cssFiles, allJsFiles);

    if (dom.previewIframe) {
      dom.previewIframe.srcdoc = bundledDocument;
      dom.previewIframe.setAttribute('srcdoc', bundledDocument);
      addConsoleEntry('system', 'info', ['Preview bundle updated and executed.']);
    }
  }

  async function runPythonExecution(pythonCode) {
    clearConsole();
    if (dom.sqlResultsPanel) dom.sqlResultsPanel.style.display = 'none';
    if (dom.consoleLogsList) dom.consoleLogsList.style.display = 'flex';
    if (dom.btnResetRuntime) dom.btnResetRuntime.style.display = 'inline-block';

    addConsoleEntry('system', 'info', ['Starting Python WebAssembly execution...']);

    const result = await window.AkshLanguages.runPythonCode(pythonCode, (progress) => {
      addConsoleEntry('system', 'info', [progress]);
    });

    if (result.stdout) {
      result.stdout.trim().split('\n').forEach(line => {
        addConsoleEntry('system', 'log', [line]);
      });
    }

    if (result.stderr || result.error) {
      const err = result.error || result.stderr;
      addConsoleEntry('system', 'error', [err]);
      window.AkshDiagnostics.addRuntimeError(state.project.activeFile, 1, err);
      triggerDiagnosticsScan();
    } else {
      addConsoleEntry('system', 'info', ['Python script finished with exit status 0']);
    }
  }

  function runSqlExecution(sqlQuery) {
    clearConsole();
    if (dom.consoleLogsList) dom.consoleLogsList.style.display = 'none';
    if (dom.sqlResultsPanel) dom.sqlResultsPanel.style.display = 'flex';

    try {
      const result = window.AkshLanguages.sqlEngine.execute(sqlQuery);
      state.lastSqlResult = result;

      if (dom.sqlQueryStats) {
        dom.sqlQueryStats.textContent = `Query executed: ${result.rowCount} row(s) in ${result.executionTimeMs}ms (${result.type})`;
      }

      // Render Table Head
      if (dom.sqlTableHead && dom.sqlTableBody) {
        dom.sqlTableHead.innerHTML = `<tr>${result.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>`;
        dom.sqlTableBody.innerHTML = result.rows.map(row => {
          return `<tr>${row.map(cell => `<td>${cell === null ? '<em style="color:#64748b;">NULL</em>' : escapeHtml(String(cell))}</td>`).join('')}</tr>`;
        }).join('');
      }

      showToast(`SQL executed successfully (${result.rowCount} rows)`, 'success');
    } catch (err) {
      if (dom.sqlQueryStats) {
        dom.sqlQueryStats.textContent = `SQL Error: ${err.message}`;
      }
      if (dom.sqlTableHead && dom.sqlTableBody) {
        dom.sqlTableHead.innerHTML = '';
        dom.sqlTableBody.innerHTML = `<tr><td style="color:#ef4444;padding:12px;">${escapeHtml(err.message)}</td></tr>`;
      }
      showToast('SQL Error: ' + err.message, 'error');
    }
  }

  function runMarkdownPreview(markdownText) {
    const html = window.AkshLanguages.parseMarkdown(markdownText);
    const doc = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px 32px; line-height: 1.6; }
    h1, h2, h3 { color: #38bdf8; margin-top: 18px; margin-bottom: 8px; }
    code { background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    pre { background: #1e293b; border: 1px solid #334155; padding: 12px; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 3px solid #38bdf8; padding-left: 12px; margin: 12px 0; color: #94a3b8; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
    if (dom.previewIframe) dom.previewIframe.srcdoc = doc;
  }

  function runSvgPreview(svgContent) {
    const doc = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    svg { max-width: 90%; max-height: 90%; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;
    if (dom.previewIframe) dom.previewIframe.srcdoc = doc;
  }

  function runCsvPreview(csvText) {
    clearConsole();
    const parsed = window.AkshLanguages && window.AkshLanguages.parseCsvToTable ?
      window.AkshLanguages.parseCsvToTable(csvText) : { columns: [], rows: [] };
    const colCount = parsed.columns.length;
    const rowCount = parsed.rows.length;
    const doc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; padding: 16px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .title { font-size: 14px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
    .badge { background: #1e293b; color: #94a3b8; font-size: 11px; padding: 2px 8px; border-radius: 12px; border: 1px solid #334155; }
    .search-box { background: #111827; border: 1px solid #334155; color: #f8fafc; padding: 5px 10px; border-radius: 4px; font-size: 12px; outline: none; width: 180px; }
    .table-container { overflow: auto; max-height: calc(100vh - 70px); border: 1px solid #1e293b; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: 'Cascadia Code', Consolas, monospace; }
    th { background: #1e293b; color: #f8fafc; text-align: left; padding: 8px 12px; position: sticky; top: 0; border-bottom: 1px solid #334155; white-space: nowrap; }
    td { padding: 6px 12px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
    tr:hover td { background: #1f2937; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">📊 CSV Data Viewer <span class="badge">${rowCount} rows &bull; ${colCount} columns</span></div>
    <input type="text" id="filter" class="search-box" placeholder="Filter rows..." oninput="filterTable()">
  </div>
  <div class="table-container">
    <table id="dataTable">
      <thead>
        <tr>${parsed.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${parsed.rows.map(r => `<tr>${r.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  </div>
  <script>
    function filterTable() {
      var q = document.getElementById('filter').value.toLowerCase();
      var rows = document.querySelectorAll('#dataTable tbody tr');
      rows.forEach(function(tr) {
        tr.style.display = tr.textContent.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
    if (dom.previewIframe) dom.previewIframe.srcdoc = doc;
    if (dom.sqlResultsPanel) dom.sqlResultsPanel.style.display = 'none';
    if (dom.consoleLogsList) dom.consoleLogsList.style.display = 'flex';
    addConsoleEntry('system', 'info', [`Parsed CSV: ${rowCount} rows, ${colCount} columns rendered.`]);
  }

  function runJsonPreview(jsonText) {
    clearConsole();
    formatActiveDocument();
    const currentContent = dom.codeTextarea ? dom.codeTextarea.value : jsonText;
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(currentContent);
    } catch (e) {
      parseError = e.message;
    }

    function renderJsonHtml(val, indent = 0) {
      const pad = '  '.repeat(indent);
      if (val === null) return `<span style="color:#569cd6;font-weight:600;">null</span>`;
      if (typeof val === 'boolean') return `<span style="color:#569cd6;font-weight:600;">${val}</span>`;
      if (typeof val === 'number') return `<span style="color:#b5cea8;">${val}</span>`;
      if (typeof val === 'string') return `<span style="color:#ce9178;">"${escapeHtml(val)}"</span>`;
      if (Array.isArray(val)) {
        if (val.length === 0) return '[]';
        const items = val.map(v => `${pad}  ${renderJsonHtml(v, indent + 1)}`).join(',\n');
        return `[\n${items}\n${pad}]`;
      }
      if (typeof val === 'object') {
        const keys = Object.keys(val);
        if (keys.length === 0) return '{}';
        const entries = keys.map(k => `${pad}  <span style="color:#9cdcfe;font-weight:600;">"${escapeHtml(k)}"</span>: ${renderJsonHtml(val[k], indent + 1)}`).join(',\n');
        return `{\n${entries}\n${pad}}`;
      }
      return escapeHtml(String(val));
    }

    const doc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Cascadia Code', Consolas, monospace; background: #0b0f19; color: #f8fafc; margin: 0; padding: 16px; font-size: 12.5px; line-height: 1.5; }
    .header { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .title { font-size: 14px; font-weight: 700; color: #38bdf8; }
    .status-valid { color: #10b981; font-size: 11px; background: rgba(16,185,129,0.15); padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(16,185,129,0.3); }
    .status-invalid { color: #ef4444; font-size: 11px; background: rgba(239,68,68,0.15); padding: 2px 8px; border-radius: 10px; border: 1px solid rgba(239,68,68,0.3); }
    .json-box { background: #111827; border: 1px solid #1e293b; border-radius: 6px; padding: 14px; overflow: auto; max-height: calc(100vh - 80px); }
    .err-box { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; padding: 12px; border-radius: 6px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">{ } JSON Inspector & Validator</div>
    <span class="${parseError ? 'status-invalid' : 'status-valid'}">${parseError ? '✕ Invalid JSON' : '✓ Valid JSON'}</span>
  </div>
  ${parseError ? `<div class="err-box"><strong>Parse Error:</strong> ${escapeHtml(parseError)}</div>` : ''}
  <div class="json-box">
    <pre style="margin:0;"><code>${parseError ? escapeHtml(currentContent) : renderJsonHtml(parsed)}</code></pre>
  </div>
</body>
</html>`;
    if (dom.previewIframe) dom.previewIframe.srcdoc = doc;
    if (dom.sqlResultsPanel) dom.sqlResultsPanel.style.display = 'none';
    if (dom.consoleLogsList) dom.consoleLogsList.style.display = 'flex';
    if (parseError) {
      addConsoleEntry('system', 'error', [`JSON Syntax Error: ${parseError}`]);
    } else {
      addConsoleEntry('system', 'info', ['JSON document validated and pretty-formatted.']);
    }
  }

  function stopCode() {
    if (dom.previewIframe) {
      dom.previewIframe.srcdoc = '<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0b0f19;color:#64748b;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><p>Preview execution stopped.</p></body></html>';
      addConsoleEntry('system', 'warn', ['Preview process terminated by user.']);
    }
  }

  function buildSandboxedDocument(html, cssFiles, jsFiles) {
    const bridgeScript = `
<script>
(function() {
  const BRIDGE_ID = 'aksh-playground-sandbox';
  function safeSerialize(val, depth = 0) {
    if (depth > 3) return '[Nested Object]';
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'function') return '[Function: ' + (val.name || 'anonymous') + ']';
    if (val instanceof Error) return { __isError: true, name: val.name, message: val.message, stack: val.stack };
    if (typeof val === 'object') {
      try {
        if (Array.isArray(val)) return val.map(item => safeSerialize(item, depth + 1));
        const copy = {};
        for (const k in val) {
          if (Object.prototype.hasOwnProperty.call(val, k)) copy[k] = safeSerialize(val[k], depth + 1);
        }
        return copy;
      } catch(e) { return '[Circular]'; }
    }
    return val;
  }
  function sendToParent(type, args) {
    try {
      window.parent.postMessage({
        source: BRIDGE_ID,
        type: type,
        args: Array.from(args).map(a => safeSerialize(a)),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      }, '*');
    } catch(err) {}
  }
  const orig = window.console;
  window.console = {
    ...orig,
    log: function(...a) { sendToParent('log', a); orig.log.apply(orig, a); },
    info: function(...a) { sendToParent('info', a); orig.info.apply(orig, a); },
    warn: function(...a) { sendToParent('warn', a); orig.warn.apply(orig, a); },
    error: function(...a) { sendToParent('error', a); orig.error.apply(orig, a); },
    clear: function() { sendToParent('clear', []); orig.clear(); }
  };
  window.onerror = function(msg, src, line, col, err) {
    sendToParent('error', [(err && err.stack) || (msg + ' (' + (line||1) + ':' + (col||1) + ')')]);
    return false;
  };
  window.addEventListener('unhandledrejection', function(e) {
    sendToParent('error', ['Unhandled Promise: ' + ((e.reason && e.reason.message) || e.reason)]);
  });
})();
</script>
`;

    const cssContent = cssFiles.map(f => f.content).join('\n\n');
    const styleTag = `<style id="aksh-styles">\n${cssContent}\n</style>`;

    const userScriptTags = jsFiles.map(f => {
      const safeJs = (f.content || '').replace(/<\/script/gi, '<\\/script');
      return `<script id="aksh-script-${f.name}">\n${safeJs}\n//# sourceURL=${f.name}\n</script>`;
    }).join('\n');

    let doc = html;

    // Clean virtual file links
    cssFiles.forEach(f => {
      doc = doc.replace(new RegExp('<link[^>]+href=["\'](\\./)?' + escapeRegExp(f.name) + '["\'][^>]*>', 'gi'), '');
    });
    jsFiles.forEach(f => {
      doc = doc.replace(new RegExp('<script[^>]+src=["\'](\\./)?' + escapeRegExp(f.name) + '["\'][^>]*>\\s*<\\/script>', 'gi'), '');
    });

    if (doc.includes('</head>')) {
      doc = doc.replace('</head>', `${bridgeScript}\n${styleTag}\n</head>`);
    } else {
      doc = `<head>\n${bridgeScript}\n${styleTag}\n</head>\n${doc}`;
    }

    if (doc.includes('</body>')) {
      doc = doc.replace('</body>', `${userScriptTags}\n</body>`);
    } else {
      doc = `${doc}\n${userScriptTags}`;
    }

    return doc;
  }

  function handleSandboxMessage(e) {
    if (!dom.previewIframe || e.source !== dom.previewIframe.contentWindow) return;
    const msg = e.data;
    if (!msg || msg.source !== 'aksh-playground-sandbox') return;

    if (msg.type === 'clear') {
      clearConsole();
      return;
    }

    addConsoleEntry('console', msg.type, msg.args, msg.time);

    // If runtime error, feed into Diagnostics engine
    if (msg.type === 'error' && msg.args && msg.args[0]) {
      const errStr = String(msg.args[0]);
      window.AkshDiagnostics.addRuntimeError(state.project.activeFile, 1, errStr);
      triggerDiagnosticsScan();
    }
  }

  // ==========================================================================
  // Console Logging System
  // ==========================================================================
  function addConsoleEntry(source, type, args, time) {
    const entry = {
      id: Date.now() + Math.random(),
      source,
      type,
      args,
      time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    state.consoleLogs.push(entry);
    renderConsoleEntry(entry);
    updateConsoleCounts();
  }

  function renderConsoleEntry(entry) {
    if (!dom.consoleLogsList) return;
    if (state.consoleFilter !== 'all' && state.consoleFilter !== entry.type) return;

    const li = document.createElement('li');
    li.className = `console-log-item log-${entry.type} log-type-${entry.type}`;

    let icon = 'LOG';
    if (entry.type === 'error') icon = 'ERR';
    if (entry.type === 'warn') icon = 'WARN';
    if (entry.type === 'info') icon = 'INFO';

    const formattedArgs = entry.args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return `<pre class="log-obj">${escapeHtml(JSON.stringify(arg, null, 2))}</pre>`;
      }
      return escapeHtml(String(arg));
    }).join(' ');

    li.innerHTML = `
      <span class="console-log-time log-time">${entry.time}</span>
      <span class="console-log-badge ${entry.type} log-icon">${icon}</span>
      <span class="console-log-content log-content">${formattedArgs}</span>
    `;

    dom.consoleLogsList.appendChild(li);
    dom.consoleLogsList.scrollTop = dom.consoleLogsList.scrollHeight;
  }

  function clearConsole() {
    state.consoleLogs = [];
    if (dom.consoleLogsList) dom.consoleLogsList.innerHTML = '';
    updateConsoleCounts();
  }

  function updateConsoleCounts() {
    const counts = { all: state.consoleLogs.length, log: 0, warn: 0, error: 0, info: 0 };
    state.consoleLogs.forEach(l => {
      if (counts[l.type] !== undefined) counts[l.type]++;
    });
    dom.filterChips.forEach(chip => {
      const filter = chip.dataset.filter;
      const countEl = chip.querySelector('.console-badge-count');
      if (countEl && counts[filter] !== undefined) countEl.textContent = counts[filter];
    });
  }

  // ==========================================================================
  // Export & Import (Real ZIP Archive, JSON, Standalone HTML)
  // ==========================================================================
  async function exportProjectAsZip() {
    syncActiveFileFromEditor();
    try {
      showToast('Generating ZIP archive...', 'info', 1500);
      const blob = await window.AkshZip.createZip(state.project.files);
      const safeName = (state.project.name || 'aksh-project').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      window.AkshZip.downloadZipBlob(blob, `${safeName}.zip`);
      showToast(`Exported "${safeName}.zip" successfully (${state.project.files.length} files)`, 'success');
    } catch (err) {
      console.error('ZIP Export Error:', err);
      showToast('Failed to generate ZIP: ' + err.message, 'error');
    }
  }

  function exportProjectJson() {
    syncActiveFileFromEditor();
    const backup = {
      version: '2.0',
      generator: 'Aksh Code Playground Pro',
      exportedAt: new Date().toISOString(),
      name: state.project.name,
      activeFile: state.project.activeFile,
      settings: {
        editorFontSize: state.editorFontSize,
        wordWrap: state.wordWrap,
        tabSize: state.tabSize,
        theme: state.theme
      },
      files: state.project.files
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const safeName = (state.project.name || 'aksh-project').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    downloadBlob(blob, `${safeName}.akshproject.json`);
    showToast(`Exported "${safeName}.akshproject.json"`, 'success');
  }

  function exportStandaloneHtml() {
    syncActiveFileFromEditor();
    const htmlFile = state.project.files.find(f => f.name.endsWith('.html')) || state.project.files[0];
    let htmlContent = htmlFile ? htmlFile.content : '<!DOCTYPE html><html><head><title>Aksh Project</title></head><body></body></html>';

    const cssFiles = state.project.files.filter(f => f.name.endsWith('.css'));
    const cssContent = cssFiles.map(f => f.content).join('\n\n');

    const jsFiles = state.project.files.filter(f => f.name.endsWith('.js'));
    const jsContent = jsFiles.map(f => f.content).join('\n\n');

    const styleTag = `<style>\n${cssContent}\n</style>`;
    const scriptTag = `<script>\n${jsContent}\n</script>`;

    let doc = htmlContent;
    if (doc.includes('</head>')) {
      doc = doc.replace('</head>', `${styleTag}\n</head>`);
    } else {
      doc = `${styleTag}\n${doc}`;
    }
    if (doc.includes('</body>')) {
      doc = doc.replace('</body>', `${scriptTag}\n</body>`);
    } else {
      doc = `${doc}\n${scriptTag}`;
    }

    const blob = new Blob([doc], { type: 'text/html' });
    const safeName = (state.project.name || 'aksh-project').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    downloadBlob(blob, `${safeName}.html`);
    showToast(`Exported standalone "${safeName}.html"`, 'success');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  async function handleImportFile(file) {
    if (!file) return;

    // 1. ZIP Archive Import
    if (window.AkshZip.isZipArchive(file.name)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const extracted = await window.AkshZip.readZip(arrayBuffer);

        if (extracted.length === 0) {
          throw new Error('No valid files found inside the ZIP archive.');
        }

        const fileListPreview = extracted.map(f => `<li><code>${escapeHtml(f.path)}</code> (${Math.round(f.size / 1024 * 10) / 10} KB)</li>`).join('');

        showConfirmModal(
          'Import ZIP Project',
          `<p>The ZIP archive <strong>"${escapeHtml(file.name)}"</strong> contains <strong>${extracted.length}</strong> file(s):</p>
           <ul style="max-height:140px;overflow-y:auto;padding-left:18px;margin:10px 0;font-size:12px;">${fileListPreview}</ul>
           <p style="color:var(--status-warning);font-size:12px;">Importing will replace your current workspace files. Confirm import?</p>`,
          () => {
            if (state.storageMode === 'device') {
              window.AkshStorage.closeLocalFolder();
              state.storageMode = 'browser';
              updateStorageModeBadge();
            }

            const projectName = file.name.replace(/\.zip$/i, '');
            state.project.name = projectName;
            state.project.files = extracted.map(f => ({
              name: f.name,
              path: f.path,
              type: window.AkshStorage.detectFileType(f.name),
              content: f.content,
              isBinary: f.isBinary,
              isDirty: false
            }));

            const entryFile = state.project.files.find(f => f.name === 'index.html') || state.project.files[0];
            state.project.activeFile = entryFile.path || entryFile.name;
            state.openTabs = state.project.files.slice(0, 4).map(f => f.path || f.name);
            state.dirty = false;

            if (dom.projectTitleInput) dom.projectTitleInput.value = projectName;
            renderTabs();
            renderFileTree();
            loadActiveFileIntoEditor();
            updateLanguageStatus();
            updateProjectStats();
            saveProjectToStorage(true);

            // Note: Never execute imported code automatically!
            stopCode();
            showToast(`Imported ${extracted.length} files from "${file.name}". Click 'Run' to execute.`, 'success');
          }
        );
      } catch (err) {
        console.error('ZIP Import Error:', err);
        showToast('Failed to import ZIP: ' + err.message, 'error');
      }
      return;
    }

    // 2. JSON Backup or HTML Standalone Import
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (!parsed.files || !Array.isArray(parsed.files)) throw new Error('Invalid project JSON structure.');

          if (state.storageMode === 'device') {
            window.AkshStorage.closeLocalFolder();
            state.storageMode = 'browser';
            updateStorageModeBadge();
          }

          state.project.name = parsed.name || file.name.replace('.json', '');
          state.project.files = parsed.files.map(f => ({ ...f, isDirty: false }));
          state.project.activeFile = parsed.activeFile || parsed.files[0].name;
          state.openTabs = parsed.openTabs || state.project.files.slice(0, 4).map(f => f.path || f.name);
          state.dirty = false;

          if (dom.projectTitleInput) dom.projectTitleInput.value = state.project.name;
          renderTabs();
          renderFileTree();
          loadActiveFileIntoEditor();
          updateLanguageStatus();
          updateProjectStats();
          saveProjectToStorage(true);
          stopCode();
          showToast(`Imported project "${state.project.name}"`, 'success');
        } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          importHtmlFile(file.name, content);
        }
      } catch (err) {
        showToast('Failed to import file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  function importHtmlFile(fileName, content) {
    const projectName = fileName.replace(/\.[^/.]+$/, '');
    state.project.name = projectName;
    if (dom.projectTitleInput) dom.projectTitleInput.value = projectName;

    state.project.files = [
      { name: 'index.html', path: 'index.html', type: 'html', content: content }
    ];
    state.project.activeFile = 'index.html';

    renderTabs();
    renderFileTree();
    loadActiveFileIntoEditor();
    updateLanguageStatus();
    saveProjectToStorage(true);
    stopCode();
    showToast(`Imported "${fileName}". Click 'Run' to execute.`, 'success');
  }

  // ==========================================================================
  // Aksh Local Code Assistant Integration
  // ==========================================================================
  async function handleAssistantSubmit(customPrompt) {
    const prompt = customPrompt || (dom.assistantInput ? dom.assistantInput.value.trim() : '');
    if (!prompt) return;

    if (dom.assistantInput) dom.assistantInput.value = '';

    // Render User Message
    renderAssistantMessage('user', prompt);

    // Context preparation
    syncActiveFileFromEditor();
    const active = getActiveFileObj();
    const contextType = dom.assistantContextSelect ? dom.assistantContextSelect.value : 'file';

    let selectedText = '';
    if (contextType === 'selection' && dom.codeTextarea) {
      selectedText = dom.codeTextarea.value.substring(dom.codeTextarea.selectionStart, dom.codeTextarea.selectionEnd);
    }

    const context = {
      activeFile: active ? (active.path || active.name) : 'index.html',
      fileContent: active ? active.content : '',
      selectedText: selectedText,
      allFiles: state.project.files,
      runtimeErrors: state.consoleLogs.filter(l => l.type === 'error').map(l => String(l.args[0]))
    };

    // Process locally with Aksh Assistant Engine
    const response = await window.AkshAssistant.processAssistantQuery(prompt, context);
    renderAssistantMessage('assistant', response.replyText, response);
  }

  function renderAssistantMessage(sender, text, responseObj = null) {
    if (!dom.assistantMessages) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `assistant-msg msg-${sender}`;

    if (sender === 'user') {
      msgDiv.textContent = text;
    } else {
      // Parse markdown in reply
      msgDiv.innerHTML = window.AkshLanguages.parseMarkdown(text);

      // If actionable proposed code exists, add Diff and Apply buttons
      if (responseObj && responseObj.actionable && responseObj.proposedCode) {
        const actionRow = document.createElement('div');
        actionRow.className = 'assistant-card-actions';

        const btnDiff = document.createElement('button');
        btnDiff.className = 'btn btn-secondary';
        btnDiff.style.fontSize = '11px';
        btnDiff.style.padding = '4px 10px';
        btnDiff.textContent = 'Preview Changes (Diff)';
        btnDiff.onclick = () => openDiffModal(responseObj.targetFile || state.project.activeFile, responseObj.proposedCode);

        const btnApply = document.createElement('button');
        btnApply.className = 'btn btn-primary';
        btnApply.style.fontSize = '11px';
        btnApply.style.padding = '4px 10px';
        btnApply.textContent = 'Apply Directly';
        btnApply.onclick = () => applyAssistantCode(responseObj.targetFile || state.project.activeFile, responseObj.proposedCode);

        actionRow.appendChild(btnDiff);
        actionRow.appendChild(btnApply);
        msgDiv.appendChild(actionRow);
      }
    }

    dom.assistantMessages.appendChild(msgDiv);
    dom.assistantMessages.scrollTop = dom.assistantMessages.scrollHeight;
  }

  function openDiffModal(targetFileName, proposedCode) {
    const file = state.project.files.find(f => (f.path || f.name) === targetFileName) || getActiveFileObj();
    const origCode = file ? file.content : '';
    const diff = window.AkshAssistant.computeLineDiff(origCode, proposedCode);

    let diffHtml = '<div class="diff-viewport">';
    diff.forEach(d => {
      const lineClass = d.type === 'add' ? 'add' : d.type === 'del' ? 'del' : 'eq';
      const symbol = d.type === 'add' ? '+' : d.type === 'del' ? '-' : ' ';
      diffHtml += `
        <div class="diff-line ${lineClass}">
          <span class="diff-ln-old">${d.lineOld || ''}</span>
          <span class="diff-ln-new">${d.lineNew || ''}</span>
          <span class="diff-symbol">${symbol}</span>
          <span class="diff-text">${escapeHtml(d.text)}</span>
        </div>
      `;
    });
    diffHtml += '</div>';

    showCustomModal(
      `Diff Preview: ${escapeHtml(targetFileName)}`,
      diffHtml,
      [
        {
          label: 'Accept & Apply Changes',
          className: 'btn btn-primary',
          action: () => {
            applyAssistantCode(targetFileName, proposedCode);
            closeModal();
          }
        },
        {
          label: 'Discard',
          className: 'btn btn-secondary',
          action: () => closeModal()
        }
      ]
    );
  }

  function applyAssistantCode(targetFileName, newContent) {
    const file = state.project.files.find(f => (f.path || f.name) === targetFileName) || getActiveFileObj();
    if (!file) return;

    window.AkshAssistant.recordUndo(file.path || file.name, file.content);
    file.content = newContent;

    if (state.project.activeFile === (file.path || file.name)) {
      if (dom.codeTextarea) dom.codeTextarea.value = newContent;
      updateLineNumbers();
      updateCursorStats();
    }

    setDirty(true);
    saveProjectToStorage(false);
    showToast(`Applied code changes to "${file.name}"`, 'success');
  }

  // ==========================================================================
  // Code Formatting (Ctrl+Shift+I)
  // ==========================================================================
  function formatActiveDocument() {
    syncActiveFileFromEditor();
    const file = getActiveFileObj();
    if (!file || !dom.codeTextarea) return;

    const ext = (file.path || file.name).split('.').pop().toLowerCase();
    let formatted = file.content;

    try {
      if (window.AkshLanguages && window.AkshLanguages.formatDocument) {
        formatted = window.AkshLanguages.formatDocument(file.content, ext, state.tabSize);
      } else if (ext === 'json') {
        const parsed = JSON.parse(file.content);
        formatted = JSON.stringify(parsed, null, state.tabSize);
      } else {
        // Universal clean formatting: normalize line endings, trim trailing whitespace, clean excessive newlines
        formatted = file.content
          .replace(/[ \t]+$/gm, '')
          .replace(/\n{3,}/g, '\n\n');
      }

      if (formatted !== file.content) {
        file.content = formatted;
        dom.codeTextarea.value = formatted;
        updateLineNumbers();
        updateCursorStats();
        setDirty(true);
        saveProjectToStorage(true);
        showToast(`Formatted "${file.name}" cleanly`, 'success');
      } else {
        showToast('Document is already cleanly formatted', 'info');
      }
    } catch (err) {
      showToast('Could not format document: ' + err.message, 'warning');
    }
  }

  // ==========================================================================
  // Side Panels & Activity Bar Switching
  // ==========================================================================
  function switchSidePanel(panelName) {
    state.activeSidePanel = panelName;

    dom.activityBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.panel === panelName);
    });

    dom.sidePanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `${panelName}-panel`);
    });

    if (panelName === 'qa') {
      updateComplexityMetrics();
    } else if (panelName === 'problems') {
      triggerDiagnosticsScan();
    } else if (panelName === 'templates') {
      renderTemplatesList();
    } else if (panelName === 'snippets') {
      renderSnippetsList();
    }
  }

  function renderTemplatesList(filter = '') {
    if (!dom.templatesListContainer || !window.AkshTemplates) return;
    dom.templatesListContainer.innerHTML = '';

    const templates = Object.values(window.AkshTemplates.TEMPLATES);
    const filtered = templates.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()) || t.description.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(tmpl => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;cursor:pointer;';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="color:var(--text-primary);font-size:12.5px;">${escapeHtml(tmpl.name)}</strong>
          <span style="font-size:10px;background:var(--bg-secondary);padding:2px 6px;border-radius:4px;color:var(--accent-electric);">${escapeHtml(tmpl.category)}</span>
        </div>
        <p style="font-size:11.5px;color:var(--text-secondary);margin-bottom:10px;line-height:1.4;">${escapeHtml(tmpl.description)}</p>
        <button class="btn btn-secondary btn-load-tmpl" style="padding:3px 10px;font-size:11px;">Load Template</button>
      `;

      card.querySelector('.btn-load-tmpl').onclick = () => loadTemplate(tmpl.id, true);
      dom.templatesListContainer.appendChild(card);
    });
  }

  function renderSnippetsList(filter = '') {
    if (!dom.snippetsListContainer || !window.AkshTemplates) return;
    dom.snippetsListContainer.innerHTML = '';

    const snippets = window.AkshTemplates.SNIPPETS;
    const filtered = snippets.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()) || s.language.toLowerCase().includes(filter.toLowerCase()));

    filtered.forEach(snp => {
      const card = document.createElement('div');
      card.className = 'snippet-card';
      card.style.cssText = 'background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:8px;padding:12px;';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="color:var(--text-primary);font-size:12px;">${escapeHtml(snp.title)}</strong>
          <span style="font-size:10px;color:var(--accent-electric);">${escapeHtml(snp.language)}</span>
        </div>
        <pre style="background:var(--bg-primary);padding:8px;border-radius:4px;font-size:10.5px;max-height:80px;overflow:hidden;margin-bottom:8px;"><code>${escapeHtml(snp.code)}</code></pre>
        <button class="btn btn-secondary btn-insert-snp" style="padding:2px 8px;font-size:11px;">Insert into Editor</button>
      `;

      card.querySelector('.btn-insert-snp').onclick = () => {
        insertTextAtCursor(snp.code);
        showToast(`Inserted snippet "${snp.title}"`, 'success');
      };
      dom.snippetsListContainer.appendChild(card);
    });
  }

  function insertTextAtCursor(textToInsert) {
    if (!dom.codeTextarea) return;
    const start = dom.codeTextarea.selectionStart;
    const end = dom.codeTextarea.selectionEnd;
    const val = dom.codeTextarea.value;
    dom.codeTextarea.value = val.substring(0, start) + textToInsert + val.substring(end);
    dom.codeTextarea.selectionStart = dom.codeTextarea.selectionEnd = start + textToInsert.length;
    dom.codeTextarea.focus();
    updateLineNumbers();
    updateCursorStats();
    setDirty(true);
  }

  function loadTemplate(templateKey, confirm = true) {
    const tmpl = window.AkshTemplates.getTemplate(templateKey);
    if (!tmpl) return;

    const doLoad = () => {
      if (state.storageMode === 'device') {
        window.AkshStorage.closeLocalFolder();
        state.storageMode = 'browser';
        updateStorageModeBadge();
      }
      state.project = {
        id: 'proj-' + Date.now(),
        name: tmpl.name,
        activeFile: tmpl.files[0].path || tmpl.files[0].name,
        files: JSON.parse(JSON.stringify(tmpl.files)),
        folders: []
      };
      state.openTabs = tmpl.files.map(f => f.path || f.name);
      state.dirty = false;

      if (dom.projectTitleInput) dom.projectTitleInput.value = state.project.name;
      renderTabs();
      renderFileTree();
      loadActiveFileIntoEditor();
      updateLanguageStatus();
      updateProjectStats();
      saveProjectToStorage(true);
      runCode();
      showToast(`Loaded "${tmpl.name}"`, 'success');
    };

    if (confirm && state.dirty) {
      showConfirmModal('Load Starter Template', 'You have unsaved changes in your current project. Load this template anyway?', doLoad);
    } else {
      doLoad();
    }
  }

  // ==========================================================================
  // Modals & Confirmation Dialogs
  // ==========================================================================
  function showConfirmModal(title, messageHtml, onConfirm) {
    showCustomModal(title, `<div style="font-size:13px;line-height:1.6;">${messageHtml}</div>`, [
      {
        label: 'Confirm',
        className: 'btn btn-primary',
        action: () => {
          if (onConfirm) onConfirm();
          closeModal();
        }
      },
      {
        label: 'Cancel',
        className: 'btn btn-secondary',
        action: () => closeModal()
      }
    ]);
  }

  function showCustomModal(title, bodyHtml, buttons = []) {
    if (!dom.modalBackdrop || !dom.modalTitle || !dom.modalBody || !dom.modalFooter) return;

    dom.modalTitle.textContent = title;
    dom.modalBody.innerHTML = bodyHtml;
    dom.modalFooter.innerHTML = '';

    buttons.forEach(btnDef => {
      const btn = document.createElement('button');
      btn.className = btnDef.className || 'btn btn-secondary';
      btn.textContent = btnDef.label;
      btn.onclick = btnDef.action;
      dom.modalFooter.appendChild(btn);
    });

    dom.modalBackdrop.classList.add('active');
  }

  function closeModal() {
    if (dom.modalBackdrop) dom.modalBackdrop.classList.remove('active');
  }

  // ==========================================================================
  // Layout Resizing Gutters
  // ==========================================================================
  function initResizing() {
    setupGutterDrag(dom.gutterSidebar, (dx) => {
      const explorer = document.getElementById('side-panels-container');
      if (!explorer) return;
      const currentWidth = explorer.getBoundingClientRect().width;
      const newWidth = Math.max(180, Math.min(500, currentWidth + dx));
      explorer.style.width = `${newWidth}px`;
    });

    setupGutterDrag(dom.gutterEditor, (dx) => {
      const wrapper = dom.editorWrapper;
      if (!wrapper) return;
      const currentWidth = wrapper.getBoundingClientRect().width;
      const parentWidth = wrapper.parentElement.getBoundingClientRect().width;
      const newPercent = Math.max(20, Math.min(80, ((currentWidth + dx) / parentWidth) * 100));
      wrapper.style.flex = `0 0 ${newPercent}%`;
    });

    setupGutterDrag(dom.gutterConsole, (dx, dy) => {
      const consoleEl = dom.consolePanel;
      if (!consoleEl) return;
      const currentHeight = consoleEl.getBoundingClientRect().height;
      const newHeight = Math.max(60, Math.min(500, currentHeight - dy));
      consoleEl.style.height = `${newHeight}px`;
    });
  }

  function setupGutterDrag(gutterEl, onDrag) {
    if (!gutterEl) return;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    gutterEl.onmousedown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      if (dom.dragOverlay) dom.dragOverlay.classList.add('active');
      gutterEl.classList.add('dragging');
      document.body.style.cursor = gutterEl.classList.contains('horizontal') ? 'row-resize' : 'col-resize';
      e.preventDefault();
    };

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;
      onDrag(dx, dy);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (dom.dragOverlay) dom.dragOverlay.classList.remove('active');
        gutterEl.classList.remove('dragging');
        document.body.style.cursor = '';
      }
    });
  }

  // ==========================================================================
  // Themes & Preferences
  // ==========================================================================
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (dom.themeToggle) {
      dom.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    window.AkshStorage.savePreferences({
      theme: state.theme,
      editorFontSize: state.editorFontSize,
      wordWrap: state.wordWrap,
      tabSize: state.tabSize,
      autoRun: state.autoRun,
      autoLint: state.autoLint
    });
  }

  function toggleWordWrap(forceVal) {
    state.wordWrap = forceVal !== undefined ? forceVal : !state.wordWrap;
    if (dom.codeTextarea) {
      dom.codeTextarea.classList.toggle('word-wrap', state.wordWrap);
    }
    if (dom.codeHighlightLayer) {
      dom.codeHighlightLayer.classList.toggle('word-wrap', state.wordWrap);
    }
    if (dom.btnToggleWrap) {
      dom.btnToggleWrap.classList.toggle('active', state.wordWrap);
    }
    if (!state.wordWrap && dom.lineGutter) {
      dom.lineGutter.querySelectorAll('.line-gutter-number').forEach(el => el.style.height = '');
    } else {
      syncGutterHeights();
    }
    window.AkshStorage.savePreferences({ wordWrap: state.wordWrap });
    showToast(state.wordWrap ? 'Word Wrap: Enabled' : 'Word Wrap: Disabled', 'info', 1200);
  }

  // ==========================================================================
  // Find & Replace
  // ==========================================================================
  function toggleFindReplace(open, focusReplace) {
    state.findReplace.isOpen = open !== undefined ? open : !state.findReplace.isOpen;
    if (dom.findReplaceBar) {
      dom.findReplaceBar.classList.toggle('active', state.findReplace.isOpen);
      if (state.findReplace.isOpen) {
        if (dom.codeTextarea) {
          const selStart = dom.codeTextarea.selectionStart;
          const selEnd = dom.codeTextarea.selectionEnd;
          if (selStart !== selEnd) {
            const selText = dom.codeTextarea.value.substring(selStart, selEnd);
            if (selText && !selText.includes('\n')) {
              if (dom.findInput) dom.findInput.value = selText;
            }
          }
        }
        performFind(false);
        if (focusReplace && dom.replaceInput) {
          dom.replaceInput.focus();
          dom.replaceInput.select();
        } else if (dom.findInput) {
          dom.findInput.focus();
          dom.findInput.select();
        }
      } else if (!state.findReplace.isOpen && dom.codeTextarea) {
        dom.codeTextarea.focus();
      }
    }
  }

  function performFind(shouldFocus = false) {
    if (!dom.findInput || !dom.codeTextarea) return;
    const query = dom.findInput.value;
    if (!query) {
      state.findReplace.matches = [];
      state.findReplace.currentIndex = -1;
      if (dom.findCountText) dom.findCountText.textContent = '0 matches';
      return;
    }
    const text = dom.codeTextarea.value;
    const regex = new RegExp(escapeRegExp(query), 'gi');
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
    }
    state.findReplace.matches = matches;
    if (matches.length > 0) {
      if (state.findReplace.currentIndex < 0 || state.findReplace.currentIndex >= matches.length) {
        state.findReplace.currentIndex = 0;
      }
      highlightCurrentFindMatch(shouldFocus);
    } else {
      state.findReplace.currentIndex = -1;
      if (dom.findCountText) dom.findCountText.textContent = '0 matches';
    }
  }

  function highlightCurrentFindMatch(shouldFocus = false) {
    const idx = state.findReplace.currentIndex;
    const matches = state.findReplace.matches;
    if (idx < 0 || idx >= matches.length || !dom.codeTextarea) return;
    const match = matches[idx];
    if (shouldFocus) {
      dom.codeTextarea.focus();
    }
    dom.codeTextarea.setSelectionRange(match.start, match.end);

    const lines = dom.codeTextarea.value.substring(0, match.start).split('\n');
    const lineNum = lines.length;
    const approxLineHeight = 22;
    dom.codeTextarea.scrollTop = Math.max(0, (lineNum - 4) * approxLineHeight);

    if (dom.findCountText) {
      dom.findCountText.textContent = `${idx + 1} of ${matches.length}`;
    }
    updateCursorStats();
  }

  function findNextMatch() {
    if (!state.findReplace.matches || state.findReplace.matches.length === 0) {
      performFind(false);
      return;
    }
    state.findReplace.currentIndex = (state.findReplace.currentIndex + 1) % state.findReplace.matches.length;
    highlightCurrentFindMatch(false);
  }

  function findPrevMatch() {
    if (!state.findReplace.matches || state.findReplace.matches.length === 0) {
      performFind(false);
      return;
    }
    state.findReplace.currentIndex = (state.findReplace.currentIndex - 1 + state.findReplace.matches.length) % state.findReplace.matches.length;
    highlightCurrentFindMatch(false);
  }

  function replaceOneMatch() {
    if (!dom.replaceInput || !dom.codeTextarea) return;
    const idx = state.findReplace.currentIndex;
    const matches = state.findReplace.matches;
    if (idx < 0 || idx >= matches.length) {
      performFind(false);
      return;
    }

    const match = matches[idx];
    const rep = dom.replaceInput.value;
    const val = dom.codeTextarea.value;
    dom.codeTextarea.value = val.substring(0, match.start) + rep + val.substring(match.end);
    dom.codeTextarea.selectionStart = match.start;
    dom.codeTextarea.selectionEnd = match.start + rep.length;
    onEditorContentChange();

    const query = dom.findInput ? dom.findInput.value : '';
    if (!query) return;
    const regex = new RegExp(escapeRegExp(query), 'gi');
    const newMatches = [];
    let m;
    while ((m = regex.exec(dom.codeTextarea.value)) !== null) {
      newMatches.push({ start: m.index, end: m.index + m[0].length });
    }
    state.findReplace.matches = newMatches;
    if (newMatches.length > 0) {
      state.findReplace.currentIndex = idx % newMatches.length;
      highlightCurrentFindMatch(false);
    } else {
      state.findReplace.currentIndex = -1;
      if (dom.findCountText) dom.findCountText.textContent = '0 matches';
    }
  }

  function replaceAllMatches() {
    if (!dom.findInput || !dom.replaceInput || !dom.codeTextarea) return;
    const query = dom.findInput.value;
    if (!query) return;
    const rep = dom.replaceInput.value;
    const val = dom.codeTextarea.value;
    const regex = new RegExp(escapeRegExp(query), 'gi');
    const count = (val.match(regex) || []).length;
    if (count === 0) {
      showToast('No occurrences found to replace', 'info');
      return;
    }
    dom.codeTextarea.value = val.replace(regex, rep);
    onEditorContentChange();
    performFind();
    showToast(`Replaced ${count} occurrence(s)`, 'success');
  }

  // ==========================================================================
  // Command Palette (Ctrl+Shift+P / F1)
  // ==========================================================================
  function getCommandPaletteItems() {
    const commands = [
      { id: 'run', label: 'Run / Preview Project', shortcut: 'Ctrl+Enter', icon: '▶', action: () => runCode() },
      { id: 'format', label: 'Format Active Document', shortcut: 'Ctrl+Shift+I', icon: '⚡', action: () => formatActiveDocument() },
      { id: 'save', label: 'Save Project', shortcut: 'Ctrl+S', icon: '💾', action: () => saveProjectToStorage(false) },
      { id: 'save-all', label: 'Save All Files', shortcut: 'Ctrl+Alt+S', icon: '💾', action: () => saveAllFiles() },
      { id: 'export-zip', label: 'Export as ZIP Archive', shortcut: 'Ctrl+Shift+S', icon: '📦', action: () => openExportZipModal() },
      { id: 'export-json', label: 'Export Project Backup (JSON)', shortcut: '', icon: '📄', action: () => exportProjectJson() },
      { id: 'export-html', label: 'Export Standalone HTML', shortcut: '', icon: '🌐', action: () => exportStandaloneHtml() },
      { id: 'find', label: 'Find in Current File', shortcut: 'Ctrl+F', icon: '🔍', action: () => toggleFindReplace(true, false) },
      { id: 'find-replace', label: 'Find & Replace in Current File', shortcut: 'Ctrl+H', icon: '🔁', action: () => toggleFindReplace(true, true) },
      { id: 'goto-line', label: 'Go to Line...', shortcut: 'Ctrl+G', icon: '#', action: () => toggleGotoLine(true) },
      { id: 'project-search', label: 'Search across Files', shortcut: 'Ctrl+Shift+F', icon: '🔎', action: () => toggleProjectSearch(true) },
      { id: 'view-problems', label: 'View: Show Problems & Diagnostics', shortcut: 'Ctrl+Shift+M', icon: '⚠', action: () => switchSidePanel('problems') },
      { id: 'view-explorer', label: 'View: Show Project Explorer', shortcut: '', icon: '📁', action: () => switchSidePanel('explorer') },
      { id: 'toggle-wrap', label: 'Toggle Word Wrap', shortcut: 'Alt+Z', icon: '↩', action: () => toggleWordWrap() },
      { id: 'toggle-theme', label: 'Toggle Color Theme (Dark / Light)', shortcut: '', icon: '🎨', action: () => applyTheme(state.theme === 'dark' ? 'light' : 'dark') },
      { id: 'toggle-console', label: 'Toggle Console Panel', shortcut: '', icon: '🖥️', action: () => { if (dom.btnToggleConsole) dom.btnToggleConsole.click(); } },
      { id: 'clear-console', label: 'Clear Console Logs', shortcut: '', icon: '🧹', action: () => clearConsole() },
      { id: 'open-folder', label: 'Open Local Folder (Mode B)', shortcut: '', icon: '📁', action: () => { if (dom.btnOpenFolder) dom.btnOpenFolder.click(); } },
      { id: 'new-file', label: 'New File...', shortcut: '', icon: '➕', action: () => { if (dom.btnNewFile) dom.btnNewFile.click(); } },
      { id: 'new-folder', label: 'New Folder...', shortcut: '', icon: '📁', action: () => { if (dom.btnNewFolder) dom.btnNewFolder.click(); } },
      { id: 'recent-projects', label: 'Open Recent Projects', shortcut: '', icon: '🕒', action: () => openRecentProjectsModal() },
      { id: 'settings', label: 'Studio Settings', shortcut: '', icon: '⚙️', action: () => { if (dom.btnSettings) dom.btnSettings.click(); } },
      { id: 'shortcuts', label: 'Keyboard Shortcuts Reference', shortcut: '', icon: '⌨️', action: () => { if (dom.btnShortcuts) dom.btnShortcuts.click(); } },
      { id: 'run-a11y', label: 'Run Accessibility (WCAG) Audit', shortcut: '', icon: '♿', action: () => { switchSidePanel('qa'); if (dom.btnRunA11y) dom.btnRunA11y.click(); } },
      { id: 'run-tests', label: 'Run In-Memory Unit Tests', shortcut: '', icon: '🧪', action: () => { switchSidePanel('qa'); if (dom.btnRunTests) dom.btnRunTests.click(); } },
      { id: 'open-assistant', label: 'Open AI Coding Assistant', shortcut: '', icon: '🤖', action: () => switchSidePanel('assistant') },
      { id: 'reset-layout', label: 'Reset Editor Layout Proportions', shortcut: '', icon: '📐', action: () => { if (dom.btnResetLayout) dom.btnResetLayout.click(); } },
      { id: 'reset-python', label: 'Reset Python Pyodide Session', shortcut: '', icon: '🐍', action: () => { if (dom.btnResetRuntime) dom.btnResetRuntime.click(); } },
      { id: 'reset-sql', label: 'Reset SQLite Sample Database', shortcut: '', icon: '🗄️', action: () => { if (dom.btnResetSampleDb) dom.btnResetSampleDb.click(); } }
    ];

    if (state.project && state.project.files) {
      state.project.files.forEach(f => {
        const path = f.path || f.name;
        commands.push({
          id: `file:${path}`,
          label: `Open File: ${path}`,
          shortcut: '',
          icon: getFileIcon(f.name),
          action: () => openFileInEditor(path)
        });
      });
    }

    return commands;
  }

  function openCommandPalette() {
    if (!dom.commandPaletteBackdrop || !dom.commandPaletteInput) return;
    state.commandPalette.isOpen = true;
    state.commandPalette.query = '';
    state.commandPalette.selectedIndex = 0;
    dom.commandPaletteBackdrop.style.display = 'flex';
    dom.commandPaletteInput.value = '';
    renderCommandPalette();
    setTimeout(() => {
      if (dom.commandPaletteInput) dom.commandPaletteInput.focus();
    }, 20);
  }

  function closeCommandPalette() {
    if (!dom.commandPaletteBackdrop) return;
    state.commandPalette.isOpen = false;
    dom.commandPaletteBackdrop.style.display = 'none';
    if (dom.codeTextarea) dom.codeTextarea.focus();
  }

  function toggleCommandPalette(open) {
    const shouldOpen = open !== undefined ? open : !state.commandPalette.isOpen;
    if (shouldOpen) {
      openCommandPalette();
    } else {
      closeCommandPalette();
    }
  }

  function renderCommandPalette() {
    if (!dom.commandPaletteList) return;
    const allCommands = getCommandPaletteItems();
    const query = (state.commandPalette.query || '').trim().toLowerCase();

    const filtered = query ? allCommands.filter(c => {
      return c.label.toLowerCase().includes(query) || (c.shortcut && c.shortcut.toLowerCase().includes(query));
    }) : allCommands;

    state.commandPalette.items = filtered;
    if (state.commandPalette.selectedIndex >= filtered.length) {
      state.commandPalette.selectedIndex = Math.max(0, filtered.length - 1);
    }

    if (filtered.length === 0) {
      dom.commandPaletteList.innerHTML = `<li class="command-palette-empty" style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px;">No matching commands found</li>`;
      return;
    }

    dom.commandPaletteList.innerHTML = filtered.map((cmd, idx) => {
      const isSelected = idx === state.commandPalette.selectedIndex;
      return `
        <li class="command-palette-item${isSelected ? ' selected' : ''}" data-cmd-index="${idx}" role="option" aria-selected="${isSelected}">
          <span class="command-palette-icon">${cmd.icon || '⚡'}</span>
          <span class="command-palette-label">${escapeHtml(cmd.label)}</span>
          ${cmd.shortcut ? `<span class="command-palette-shortcut"><kbd>${escapeHtml(cmd.shortcut)}</kbd></span>` : ''}
        </li>
      `;
    }).join('');

    const selectedEl = dom.commandPaletteList.querySelector('.command-palette-item.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function executeSelectedCommand() {
    const items = state.commandPalette.items;
    const idx = state.commandPalette.selectedIndex;
    if (items && items[idx]) {
      const cmd = items[idx];
      closeCommandPalette();
      cmd.action();
    }
  }

  // ==========================================================================
  // Go to Line (Ctrl+G)
  // ==========================================================================
  function toggleGotoLine(open) {
    if (!dom.gotoLineBar) return;
    const isVisible = dom.gotoLineBar.style.display !== 'none';
    const nextState = (open !== undefined) ? open : !isVisible;
    dom.gotoLineBar.style.display = nextState ? 'flex' : 'none';
    if (nextState && dom.gotoLineInput) {
      dom.gotoLineInput.value = '';
      dom.gotoLineInput.focus();
    }
  }

  function handleGotoLineSubmit() {
    if (!dom.gotoLineInput) return;
    const lineNum = parseInt(dom.gotoLineInput.value, 10);
    if (!isNaN(lineNum) && lineNum >= 1) {
      jumpToLine(lineNum);
      toggleGotoLine(false);
    } else {
      showToast('Please enter a valid line number (1+)', 'warning');
    }
  }

  function jumpToLine(lineNumber) {
    if (!dom.codeTextarea) return;
    const lines = dom.codeTextarea.value.split('\n');
    if (lineNumber < 1) lineNumber = 1;
    if (lineNumber > lines.length) lineNumber = lines.length;

    let charPos = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
      charPos += lines[i].length + 1;
    }

    const lineLen = lines[lineNumber - 1] ? lines[lineNumber - 1].length : 0;
    dom.codeTextarea.focus();
    dom.codeTextarea.setSelectionRange(charPos, charPos + lineLen);

    const approxLineHeight = 19;
    dom.codeTextarea.scrollTop = Math.max(0, (lineNumber - 4) * approxLineHeight);
    updateCursorStats();
  }

  // ==========================================================================
  // Project-wide Search (Ctrl+Shift+F)
  // ==========================================================================
  function toggleProjectSearch(open) {
    if (!dom.projectSearchContainer) return;
    const isVisible = dom.projectSearchContainer.style.display !== 'none';
    const nextState = (open !== undefined) ? open : !isVisible;
    dom.projectSearchContainer.style.display = nextState ? 'flex' : 'none';
    if (nextState && dom.projectSearchInput) {
      dom.projectSearchInput.focus();
      dom.projectSearchInput.select();
      performProjectSearch();
    }
  }

  function performProjectSearch() {
    if (!dom.projectSearchInput || !dom.projectSearchResults) return;
    const query = dom.projectSearchInput.value.trim().toLowerCase();
    dom.projectSearchResults.innerHTML = '';

    if (!query) {
      if (dom.projectSearchCount) dom.projectSearchCount.textContent = '0 results';
      return;
    }

    let matchCount = 0;
    state.project.files.forEach(file => {
      if (!file.content) return;
      const lines = file.content.split('\n');
      lines.forEach((lineText, lineIdx) => {
        const lowerLine = lineText.toLowerCase();
        const matchIdx = lowerLine.indexOf(query);
        if (matchIdx !== -1) {
          matchCount++;
          const li = document.createElement('li');
          li.className = 'project-search-item';

          const highlighted = escapeHtml(lineText.substring(0, matchIdx)) +
            `<span class="project-search-match">${escapeHtml(lineText.substring(matchIdx, matchIdx + query.length))}</span>` +
            escapeHtml(lineText.substring(matchIdx + query.length));

          li.innerHTML = `
            <div class="project-search-file">
              <span>${getFileIcon(file.name)}</span>
              <span>${escapeHtml(file.path || file.name)}:${lineIdx + 1}</span>
            </div>
            <div class="project-search-snippet">${highlighted}</div>
          `;

          li.onclick = () => {
            openFileInEditor(file.path || file.name);
            jumpToLine(lineIdx + 1);
          };

          dom.projectSearchResults.appendChild(li);
        }
      });
    });

    if (dom.projectSearchCount) {
      dom.projectSearchCount.textContent = `${matchCount} result${matchCount === 1 ? '' : 's'}`;
    }
  }

  // ==========================================================================
  // SQL Schema Browser
  // ==========================================================================
  function toggleSqlSchema() {
    if (!dom.sqlSchemaContainer) return;
    const isVisible = dom.sqlSchemaContainer.style.display !== 'none';
    if (isVisible) {
      dom.sqlSchemaContainer.style.display = 'none';
      if (dom.btnToggleSqlSchema) dom.btnToggleSqlSchema.textContent = 'Schema Browser';
    } else {
      dom.sqlSchemaContainer.style.display = 'block';
      if (dom.btnToggleSqlSchema) dom.btnToggleSqlSchema.textContent = 'Hide Schema';
      renderSqlSchema();
    }
  }

  function renderSqlSchema() {
    if (!dom.sqlSchemaContainer || !window.AkshLanguages || !window.AkshLanguages.sqlEngine) return;
    const schema = window.AkshLanguages.sqlEngine.getSchema();
    if (!schema || schema.length === 0) {
      dom.sqlSchemaContainer.innerHTML = '<span style="color:var(--text-muted);font-size:11px;">No tables found in database.</span>';
      return;
    }

    let gridHtml = '<div class="sql-schema-grid">';
    schema.forEach(tbl => {
      gridHtml += `
        <div class="sql-schema-card">
          <div class="sql-schema-card-header">
            <span>🗄️ ${escapeHtml(tbl.table)}</span>
            <span style="font-size:10px;color:var(--text-muted);">${tbl.rowCount} rows</span>
          </div>
          <ul class="sql-schema-col-list">
            ${tbl.columns.map(c => `
              <li class="sql-schema-col-item">
                <span class="sql-schema-col-name">${escapeHtml(c.name)}</span>
                <span class="sql-schema-col-type">${escapeHtml(c.type)}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    });
    gridHtml += '</div>';
    dom.sqlSchemaContainer.innerHTML = gridHtml;
  }

  // ==========================================================================
  // Recent Projects Modal
  // ==========================================================================
  async function openRecentProjectsModal() {
    const projects = await window.AkshStorage.getAllProjectsFromIdb();
    if (!projects || projects.length === 0) {
      showToast('No saved projects found in browser storage.', 'info');
      return;
    }

    let listHtml = '<div class="recent-project-list">';
    projects.forEach(p => {
      const isCurrent = p.id === state.project.id;
      const fileCount = p.files ? p.files.length : 0;
      const dateStr = p.updatedAt ? new Date(p.updatedAt).toLocaleString() : 'Unknown';
      listHtml += `
        <div class="recent-project-card">
          <div class="recent-project-info">
            <span class="recent-project-title">${escapeHtml(p.name || 'Untitled')} ${isCurrent ? '<span class="status-pill status-ready" style="font-size:10px;padding:1px 4px;margin-left:4px;">Active</span>' : ''}</span>
            <span class="recent-project-meta">${fileCount} files &bull; Modified ${dateStr}</span>
          </div>
          <div class="recent-project-actions">
            ${!isCurrent ? `<button class="btn btn-primary btn-open-recent" data-proj-id="${escapeHtml(p.id)}" style="padding:2px 8px;font-size:11px;">Open</button>` : ''}
            <button class="btn btn-secondary btn-dup-recent" data-proj-id="${escapeHtml(p.id)}" style="padding:2px 8px;font-size:11px;">Duplicate</button>
            <button class="btn btn-secondary btn-del-recent" data-proj-id="${escapeHtml(p.id)}" style="padding:2px 8px;font-size:11px;color:var(--status-error);">&times;</button>
          </div>
        </div>
      `;
    });
    listHtml += '</div>';

    showCustomModal('Recent Projects (Browser IndexedDB)', listHtml, [
      {
        label: 'Close',
        className: 'btn btn-secondary',
        action: () => closeModal()
      }
    ]);

    if (dom.modalBody) {
      dom.modalBody.querySelectorAll('.btn-open-recent').forEach(btn => {
        btn.onclick = async () => {
          const projId = btn.dataset.projId;
          const target = projects.find(p => p.id === projId);
          if (target) {
            closeModal();
            loadProjectObject(target);
            showToast(`Loaded "${target.name}"`, 'success');
          }
        };
      });

      dom.modalBody.querySelectorAll('.btn-dup-recent').forEach(btn => {
        btn.onclick = async () => {
          const projId = btn.dataset.projId;
          const target = projects.find(p => p.id === projId);
          if (target) {
            const clone = JSON.parse(JSON.stringify(target));
            clone.id = 'proj-' + Date.now();
            clone.name = (clone.name || 'Project') + ' (Copy)';
            clone.updatedAt = Date.now();
            await window.AkshStorage.saveProjectToIdb(clone);
            showToast(`Duplicated as "${clone.name}"`, 'success');
            openRecentProjectsModal();
          }
        };
      });

      dom.modalBody.querySelectorAll('.btn-del-recent').forEach(btn => {
        btn.onclick = async () => {
          const projId = btn.dataset.projId;
          const target = projects.find(p => p.id === projId);
          if (target) {
            if (confirm(`Permanently delete "${target.name}" from browser storage?`)) {
              await window.AkshStorage.deleteProjectFromIdb(projId);
              showToast(`Deleted "${target.name}"`, 'info');
              openRecentProjectsModal();
            }
          }
        };
      });
    }
  }

  // ==========================================================================
  // Export ZIP Modal with Custom Name & README Option
  // ==========================================================================
  function openExportZipModal() {
    syncActiveFileFromEditor();
    const currentName = state.project.name || 'aksh-project';
    const formHtml = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:11.5px;color:var(--text-muted);display:block;margin-bottom:4px;">ZIP Archive Filename:</label>
          <input type="text" id="export-zip-name-input" class="search-input" value="${escapeHtml(currentName)}" style="width:100%;font-size:12px;">
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="export-include-readme-check" checked style="cursor:pointer;">
          <label for="export-include-readme-check" style="font-size:11.5px;color:var(--text-primary);cursor:pointer;">
            Include generated README.md with project documentation
          </label>
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin:0;">
          All ${state.project.files.length} project files will be archived into a standards-compliant PKWARE ZIP file on your device.
        </p>
      </div>
    `;

    showCustomModal('Export Project as ZIP Archive', formHtml, [
      {
        label: 'Download ZIP',
        className: 'btn btn-primary',
        action: async () => {
          const nameInput = document.getElementById('export-zip-name-input');
          const readmeCheck = document.getElementById('export-include-readme-check');
          const zipName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : currentName;
          const includeReadme = readmeCheck ? readmeCheck.checked : true;

          closeModal();
          await executeZipExport(zipName, includeReadme);
        }
      },
      {
        label: 'Cancel',
        className: 'btn btn-secondary',
        action: () => closeModal()
      }
    ]);
  }

  async function executeZipExport(zipName, includeReadme = true) {
    showToast('Generating ZIP archive...', 'info');
    try {
      const filesToExport = state.project.files.map(f => ({ path: f.path || f.name, content: f.content }));
      if (includeReadme && !filesToExport.some(f => (f.path || f.name).toLowerCase() === 'readme.md')) {
        const readmeContent = window.AkshZip.generateProjectReadme(zipName, state.project.files);
        filesToExport.push({ path: 'README.md', content: readmeContent });
      }

      const zipBlob = await window.AkshZip.generateZipBlob(filesToExport);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${zipName.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Exported "${a.download}" successfully.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Export ZIP failed: ' + err.message, 'error');
    }
  }

  // ==========================================================================
  // Assistant Undo & Applied Change Recovery
  // ==========================================================================
  function undoAssistantChange() {
    if (!window.AkshAssistant || !window.AkshAssistant.popUndo) {
      showToast('Undo assistant is not available', 'warning');
      return;
    }
    const undoItem = window.AkshAssistant.popUndo();
    if (!undoItem) {
      showToast('No assistant changes to undo', 'info');
      return;
    }
    const file = state.project.files.find(f => (f.path || f.name) === undoItem.targetFile);
    if (file) {
      file.content = undoItem.previousContent;
      file.isDirty = true;
      state.dirty = true;
      if (state.project.activeFile === (file.path || file.name)) {
        if (dom.codeTextarea) dom.codeTextarea.value = file.content;
        updateHighlightLayer();
        updateLineNumbers();
        updateCursorStats();
      }
      renderTabs();
      updateSaveBadge('unsaved');
      saveProjectToStorage(false);
      showToast(`Reverted assistant changes to "${file.name}"`, 'info');
    }
  }

  // ==========================================================================
  // QA Tools: Accessibility, Color Contrast, and Documentation
  // ==========================================================================
  function initQaTools() {
    // 1. Accessibility Audit
    if (dom.btnRunA11y) {
      dom.btnRunA11y.onclick = () => {
        syncActiveFileFromEditor();
        const active = getActiveFileObj();
        let targetContent = active ? active.content : '';
        const ext = (active ? (active.path || active.name) : '').split('.').pop().toLowerCase();
        if (!['html', 'htm', 'svg'].includes(ext)) {
          const htmlFile = state.project.files.find(f => (f.path || f.name).endsWith('.html'));
          if (htmlFile) targetContent = htmlFile.content;
        }

        const issues = window.AkshDiagnostics.auditHtmlAccessibility(targetContent);
        if (!dom.a11yResultsContainer) return;
        if (issues.length === 0) {
          dom.a11yResultsContainer.innerHTML = '<span style="color:#10b981;font-size:11px;">🎉 Excellent! No WCAG accessibility issues detected.</span>';
        } else {
          dom.a11yResultsContainer.innerHTML = issues.map(iss => `
            <div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;">
              <span style="color:${iss.severity === 'error' ? '#ef4444' : '#f59e0b'};font-weight:600;">[${escapeHtml(iss.ruleId || iss.rule || 'RULE')}]</span>
              <span style="color:var(--text-primary);margin-left:4px;">${escapeHtml(iss.message)}</span>
            </div>
          `).join('');
        }
      };
    }

    // 2. Contrast Calculator Live Update
    function updateContrastCalc() {
      if (!dom.contrastFgPicker || !dom.contrastBgPicker || !dom.contrastRatioValue) return;
      const fg = dom.contrastFgPicker.value;
      const bg = dom.contrastBgPicker.value;
      if (dom.contrastFgText) dom.contrastFgText.value = fg;
      if (dom.contrastBgText) dom.contrastBgText.value = bg;

      const result = window.AkshDiagnostics.calculateContrastRatio(fg, bg);
      dom.contrastRatioValue.textContent = `${result.ratio.toFixed(2)}:1`;

      if (dom.badgeAa) {
        dom.badgeAa.className = `status-pill ${result.aaNormal ? 'status-ready' : 'status-failed'}`;
        dom.badgeAa.textContent = result.aaNormal ? 'AA Pass' : 'AA Fail';
      }
      if (dom.badgeAaa) {
        dom.badgeAaa.className = `status-pill ${result.aaaNormal ? 'status-ready' : 'status-failed'}`;
        dom.badgeAaa.textContent = result.aaaNormal ? 'AAA Pass' : 'AAA Fail';
      }
    }

    if (dom.contrastFgPicker) dom.contrastFgPicker.oninput = updateContrastCalc;
    if (dom.contrastBgPicker) dom.contrastBgPicker.oninput = updateContrastCalc;
    if (dom.contrastFgText) {
      dom.contrastFgText.oninput = () => {
        if (/^#[0-9a-fA-F]{6}$/.test(dom.contrastFgText.value)) {
          dom.contrastFgPicker.value = dom.contrastFgText.value;
          updateContrastCalc();
        }
      };
    }
    if (dom.contrastBgText) {
      dom.contrastBgText.oninput = () => {
        if (/^#[0-9a-fA-F]{6}$/.test(dom.contrastBgText.value)) {
          dom.contrastBgPicker.value = dom.contrastBgText.value;
          updateContrastCalc();
        }
      };
    }

    // 3. Project Documentation & README Generator
    if (dom.btnGenReadme) {
      dom.btnGenReadme.onclick = () => {
        const readme = window.AkshZip.generateProjectReadme(state.project.name || 'Aksh Project', state.project.files);
        const existing = state.project.files.find(f => (f.path || f.name).toLowerCase() === 'readme.md');
        if (existing) {
          existing.content = readme;
          existing.isDirty = true;
          switchActiveFile(existing.path || existing.name);
          showToast('Updated README.md documentation.', 'success');
        } else {
          createFile('README.md', readme);
          showToast('Generated README.md for project.', 'success');
        }
        updateProjectStats();
      };
    }
  }

  function updateProjectStats() {
    if (!dom.qaTotalFiles || !dom.qaTotalSize) return;
    const totalFiles = state.project.files.length;
    let totalBytes = 0;
    state.project.files.forEach(f => {
      totalBytes += (f.content ? f.content.length : 0);
    });
    dom.qaTotalFiles.textContent = totalFiles;
    dom.qaTotalSize.textContent = `${(totalBytes / 1024).toFixed(1)} KB`;
  }

  // ==========================================================================
  // Drag and Drop File/ZIP Import
  // ==========================================================================
  function initDragAndDrop() {
    const dropTargets = [dom.editorWrapper, dom.explorerPanel];
    dropTargets.forEach(target => {
      if (!target) return;
      target.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.add('drag-over');
      });

      target.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.remove('drag-over');
      });

      target.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        for (const file of files) {
          if (file.name.toLowerCase().endsWith('.zip')) {
            await handleImportFile(file);
            break;
          } else if (file.name.toLowerCase().endsWith('.json')) {
            await handleImportFile(file);
            break;
          } else {
            const text = await file.text();
            createFile(file.name, text);
          }
        }
      });
    });
  }

  // ==========================================================================
  // Editor Productivity & Keyboard Navigation
  // ==========================================================================
  function handleCodeTextareaKeydown(e) {
    const textarea = dom.codeTextarea;
    if (!textarea) return;

    // 1. Enter: Smart Auto-Indentation & Bracket Pair Splitting
    if (e.key === 'Enter') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      const lastNewline = val.lastIndexOf('\n', start - 1);
      const lineUpToCursor = val.substring(lastNewline + 1, start);
      const indentMatch = lineUpToCursor.match(/^(\s*)/);
      let indent = indentMatch ? indentMatch[1] : '';

      const tabStr = ' '.repeat(state.tabSize || 2);
      const trimmed = lineUpToCursor.trim();
      const charBefore = val[start - 1];
      const charAfter = val[end];

      // Between matching brackets: { }, [ ], ( )
      const isBetweenBrackets =
        (charBefore === '{' && charAfter === '}') ||
        (charBefore === '[' && charAfter === ']') ||
        (charBefore === '(' && charAfter === ')');

      if (isBetweenBrackets) {
        e.preventDefault();
        const innerIndent = indent + tabStr;
        const insertion = '\n' + innerIndent + '\n' + indent;
        textarea.value = val.substring(0, start) + insertion + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 1 + innerIndent.length;
        onEditorContentChange();
        return;
      }

      // Add extra indentation after open block tokens ({, [, (, or : in Python)
      const file = getActiveFileObj();
      const ext = (file ? (file.path || file.name) : '').split('.').pop().toLowerCase();
      const isPython = ['py', 'python'].includes(ext);
      if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(') || (isPython && trimmed.endsWith(':'))) {
        indent += tabStr;
      }

      e.preventDefault();
      const insertion = '\n' + indent;
      textarea.value = val.substring(0, start) + insertion + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
      onEditorContentChange();
      return;
    }

    // 2. Backspace: Smart Bracket & Quote Pair Deletion
    if (e.key === 'Backspace') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end && start > 0) {
        const val = textarea.value;
        const charBefore = val[start - 1];
        const charAfter = val[start];
        const pairMap = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
        if (pairMap[charBefore] && pairMap[charBefore] === charAfter) {
          e.preventDefault();
          textarea.value = val.substring(0, start - 1) + val.substring(start + 1);
          textarea.selectionStart = textarea.selectionEnd = start - 1;
          onEditorContentChange();
          return;
        }
      }
    }

    // 3. Tab / Shift+Tab indent/unindent
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const tabStr = ' '.repeat(state.tabSize || 2);

      if (start === end) {
        textarea.value = val.substring(0, start) + tabStr + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + tabStr.length;
      } else {
        const before = val.substring(0, start);
        const lineStart = before.lastIndexOf('\n') + 1;
        const selectedBlock = val.substring(lineStart, end);
        const lines = selectedBlock.split('\n');

        let modified;
        if (e.shiftKey) {
          modified = lines.map(line => line.startsWith(tabStr) ? line.slice(tabStr.length) : (line.startsWith(' ') ? line.slice(1) : line)).join('\n');
        } else {
          modified = lines.map(line => tabStr + line).join('\n');
        }

        textarea.value = val.substring(0, lineStart) + modified + val.substring(end);
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = lineStart + modified.length;
      }
      onEditorContentChange();
      return;
    }

    // 4. Overtyping closing bracket or quote
    const closingChars = [')', ']', '}', '"', "'", '`'];
    if (closingChars.includes(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start === end && textarea.value[start] === e.key) {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        return;
      }
    }

    // 5. Auto-closing opening brackets and quotes: ( [ { " ' `
    const openPairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    if (openPairs[e.key] && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const closing = openPairs[e.key];

      if (start !== end) {
        e.preventDefault();
        const selected = val.substring(start, end);
        textarea.value = val.substring(0, start) + e.key + selected + closing + val.substring(end);
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = end + 1;
        onEditorContentChange();
        return;
      }

      e.preventDefault();
      textarea.value = val.substring(0, start) + e.key + closing + val.substring(start);
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      onEditorContentChange();
      return;
    }

    // 3. Ctrl + / comment toggle
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault();
      toggleCommentAtSelection();
      return;
    }

    // 4. Alt + Up / Alt + Down: Move line
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveLine(e.key === 'ArrowUp' ? -1 : 1);
      return;
    }

    // 5. Shift + Alt + Down: Duplicate line
    if (e.shiftKey && e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      duplicateCurrentLine();
      return;
    }
  }

  function toggleCommentAtSelection() {
    const textarea = dom.codeTextarea;
    if (!textarea) return;
    const file = getActiveFileObj();
    const ext = (file ? (file.path || file.name) : '').split('.').pop().toLowerCase();

    let commentStart = '// ';
    let commentEnd = '';
    if (['html', 'htm', 'svg', 'xml'].includes(ext)) {
      commentStart = '<!-- ';
      commentEnd = ' -->';
    } else if (['py', 'python'].includes(ext)) {
      commentStart = '# ';
    } else if (['sql'].includes(ext)) {
      commentStart = '-- ';
    }

    const val = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = val.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = val.length;

    const selectedBlock = val.substring(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');

    const allCommented = lines.every(l => l.trim().startsWith(commentStart.trim()));
    const modified = lines.map(line => {
      if (allCommented) {
        const idx = line.indexOf(commentStart.trim());
        if (idx !== -1) {
          let after = line.substring(idx + commentStart.trim().length);
          if (after.startsWith(' ')) after = after.substring(1);
          if (commentEnd && after.endsWith(commentEnd.trim())) {
            after = after.slice(0, -commentEnd.trim().length).trimEnd();
          }
          return line.substring(0, idx) + after;
        }
        return line;
      } else {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        const text = line.substring(indent.length);
        return indent + commentStart + text + commentEnd;
      }
    }).join('\n');

    textarea.value = val.substring(0, lineStart) + modified + val.substring(lineEnd);
    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineStart + modified.length;
    onEditorContentChange();
  }

  function moveLine(direction) {
    const textarea = dom.codeTextarea;
    if (!textarea) return;
    const val = textarea.value;
    const start = textarea.selectionStart;
    const lines = val.split('\n');

    const curLineIdx = val.substring(0, start).split('\n').length - 1;
    const targetIdx = curLineIdx + direction;
    if (targetIdx < 0 || targetIdx >= lines.length) return;

    const temp = lines[curLineIdx];
    lines[curLineIdx] = lines[targetIdx];
    lines[targetIdx] = temp;

    textarea.value = lines.join('\n');
    jumpToLine(targetIdx + 1);
    onEditorContentChange();
  }

  function duplicateCurrentLine() {
    const textarea = dom.codeTextarea;
    if (!textarea) return;
    const val = textarea.value;
    const start = textarea.selectionStart;
    const lines = val.split('\n');
    const curLineIdx = val.substring(0, start).split('\n').length - 1;

    lines.splice(curLineIdx + 1, 0, lines[curLineIdx]);
    textarea.value = lines.join('\n');
    jumpToLine(curLineIdx + 2);
    onEditorContentChange();
  }

  function onEditorContentChange() {
    const active = getActiveFileObj();
    if (active && dom.codeTextarea) {
      active.content = dom.codeTextarea.value;
      active.isDirty = true;
      state.dirty = true;
      updateSaveBadge('unsaved');
      renderTabs();
      updateHighlightLayer();
      updateLineNumbers();
      updateCursorStats();
      updateComplexityMetrics();
      triggerDiagnosticsScan();
      triggerAutoRun();
    }
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
  function setupEventListeners() {
    // Top Bar Buttons
    dom.btnRun.onclick = () => runCode();
    dom.btnStop.onclick = () => stopCode();
    dom.btnSave.onclick = () => saveProjectToStorage(false);
    if (dom.btnSaveAll) dom.btnSaveAll.onclick = () => saveAllFiles();
    if (dom.btnRecentProjects) dom.btnRecentProjects.onclick = () => openRecentProjectsModal();

    // Open Local Folder (Mode B: File System Access API)
    dom.btnOpenFolder.onclick = async () => {
      if (!window.AkshStorage.isFileSystemAccessSupported()) {
        showCustomModal(
          'Local Folder Access',
          `<p>Direct local folder editing utilizes the modern <strong>File System Access API</strong>, supported in <strong>Google Chrome, Microsoft Edge, Opera, and Brave</strong>.</p>
           <p style="margin-top:10px;font-size:12.5px;color:var(--text-secondary);">On browsers like Firefox or Safari, you can use <strong>Browser Storage (IndexedDB)</strong> with our genuine <strong>ZIP Import & Export</strong> features to work with your files directly.</p>`,
          [{ label: 'Got It', className: 'btn btn-primary', action: () => closeModal() }]
        );
        return;
      }

      try {
        const folderProject = await window.AkshStorage.openLocalFolder();
        if (folderProject) {
          state.storageMode = 'device';
          state.project.name = folderProject.name;
          state.project.files = folderProject.files;
          state.project.activeFile = folderProject.activeFile;

          if (dom.projectTitleInput) dom.projectTitleInput.value = folderProject.name;
          updateStorageModeBadge();
          renderTabs();
          renderFileTree();
          loadActiveFileIntoEditor();
          updateLanguageStatus();
          switchSidePanel('explorer');
          showToast(`Opened folder "${folderProject.name}" directly from device`, 'success');
        }
      } catch (err) {
        showToast('Could not open folder: ' + err.message, 'error');
      }
    };

    // Storage Mode Pill click
    dom.storageModeBadge.onclick = () => {
      if (state.storageMode === 'device') {
        showConfirmModal(
          'Switch to Browser Storage',
          'Currently editing a local device folder. Switch back to browser-stored IndexedDB projects?',
          () => {
            window.AkshStorage.closeLocalFolder();
            state.storageMode = 'browser';
            updateStorageModeBadge();
            loadSavedState().then(() => {
              renderTabs();
              renderFileTree();
              loadActiveFileIntoEditor();
              updateLanguageStatus();
              showToast('Switched to Browser Storage mode', 'info');
            });
          }
        );
      } else {
        dom.btnOpenFolder.click();
      }
    };

    // New Project
    dom.btnNewProject.onclick = () => {
      showConfirmModal('New Project', 'Create a new blank project? Unsaved changes will be discarded.', () => {
        loadTemplate('blank', false);
      });
    };

    // Templates Button
    dom.btnTemplates.onclick = () => switchSidePanel('templates');

    // Export Dropdown & Items
    dom.btnExport.onclick = (e) => {
      e.stopPropagation();
      dom.exportMenu.classList.toggle('active');
    };
    dom.exportZipBtn.onclick = () => {
      dom.exportMenu.classList.remove('active');
      openExportZipModal();
    };
    dom.exportJsonBtn.onclick = () => {
      dom.exportMenu.classList.remove('active');
      exportProjectJson();
    };
    dom.exportHtmlBtn.onclick = () => {
      dom.exportMenu.classList.remove('active');
      exportStandaloneHtml();
    };

    // Import Button
    dom.btnImport.onclick = () => {
      if (dom.hiddenFileInput) {
        dom.hiddenFileInput.value = '';
        dom.hiddenFileInput.click();
      }
    };
    dom.hiddenFileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleImportFile(e.target.files[0]);
      }
    };

    // Theme Toggle
    dom.themeToggle.onclick = () => applyTheme(state.theme === 'dark' ? 'light' : 'dark');

    // Activity Bar Panel Switching
    dom.activityBtns.forEach(btn => {
      btn.onclick = () => switchSidePanel(btn.dataset.panel);
    });

    // File Tree Controls
    dom.btnNewFile.onclick = () => {
      const name = prompt('Enter new file name (e.g. style.css, utils.js, data.py):');
      if (name) createFile(name);
    };
    dom.btnNewFolder.onclick = () => {
      createFolder();
    };
    if (dom.btnSearchProject) {
      dom.btnSearchProject.onclick = () => toggleProjectSearch();
    }
    dom.btnRefreshExplorer.onclick = () => {
      renderFileTree();
      showToast('File tree refreshed', 'info');
    };

    // Assistant Form & Quick Actions
    dom.assistantForm.onsubmit = (e) => {
      e.preventDefault();
      handleAssistantSubmit();
    };
    if (dom.btnUndoAssistant) {
      dom.btnUndoAssistant.onclick = () => undoAssistantChange();
    }
    dom.btnClearChat.onclick = () => {
      if (dom.assistantMessages) {
        dom.assistantMessages.innerHTML = `
          <div class="assistant-msg msg-assistant">
            <h3>🤖 Aksh Code Assistant</h3>
            <p>Chat cleared. Ask coding questions or select a quick action above.</p>
          </div>
        `;
      }
    };
    dom.quickActionBtns.forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        let promptText = 'Analyze this code';
        if (action === 'analyze') promptText = 'Analyze this project';
        if (action === 'explain') promptText = 'Explain this code in simple language';
        if (action === 'findBugs') promptText = 'Find bugs and syntax errors';
        if (action === 'improve') promptText = 'Improve this code and modernize ES6+';
        if (action === 'responsive') promptText = 'Make this layout responsive';
        if (action === 'validate') promptText = 'Add input validation';
        if (action === 'tests') promptText = 'Create a test case for this function';
        if (action === 'a11y') promptText = 'Find accessibility problems';
        handleAssistantSubmit(promptText);
      };
    });

    // Problems Panel Controls
    dom.btnRescanProblems.onclick = () => triggerDiagnosticsScan();
    dom.btnClearProblems.onclick = () => {
      window.AkshDiagnostics.clearDiagnostics();
      renderProblemsList([]);
    };
    dom.probFilterBtns.forEach(btn => {
      btn.onclick = () => {
        dom.probFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.probFilter;
        const allDiags = window.AkshDiagnostics.getDiagnostics();
        const filtered = filter === 'all' ? allDiags : allDiags.filter(d => d.severity === filter);
        renderProblemsList(filtered);
      };
    });

    // QA & Testing Controls
    dom.btnRunTests.onclick = () => {
      if (!dom.testResultsContainer || !window.AkshDiagnostics) return;
      syncActiveFileFromEditor();
      const active = getActiveFileObj();
      const code = active ? active.content : '';
      const res = window.AkshDiagnostics.testRunner.runUserTests(code);

      let html = `<div style="margin-bottom:8px;font-weight:600;color:${res.success ? '#10b981' : '#ef4444'};">`;
      html += res.success ? `✅ All ${res.passed} test(s) passed!` : `❌ ${res.failed} of ${res.totalTests} test(s) failed.`;
      html += `</div>`;

      res.suites.forEach(suite => {
        html += `<div style="margin-top:6px;"><strong>${escapeHtml(suite.name)}</strong>:`;
        suite.tests.forEach(t => {
          html += `<div style="padding-left:12px;margin:2px 0;">${t.passed ? '✓' : '✗'} ${escapeHtml(t.name)} (${t.durationMs}ms)</div>`;
          if (t.error) html += `<div style="padding-left:24px;color:#ef4444;font-size:10.5px;">${escapeHtml(t.error)}</div>`;
        });
        html += `</div>`;
      });

      dom.testResultsContainer.innerHTML = html;
    };

    // Templates & Snippets Search
    if (dom.templatesSearchInput) {
      dom.templatesSearchInput.oninput = (e) => renderTemplatesList(e.target.value);
    }
    if (dom.snippetsSearchInput) {
      dom.snippetsSearchInput.oninput = (e) => renderSnippetsList(e.target.value);
    }

    // SQL Studio Actions
    if (dom.btnToggleSqlSchema) {
      dom.btnToggleSqlSchema.onclick = () => toggleSqlSchema();
    }
    if (dom.btnExportSqlCsv) {
      dom.btnExportSqlCsv.onclick = () => {
        if (!state.lastSqlResult) return;
        const csv = window.AkshLanguages.sqlEngine.exportResultsToCsv(state.lastSqlResult);
        const blob = new Blob([csv], { type: 'text/csv' });
        downloadBlob(blob, 'sql_query_results.csv');
        showToast('Exported query results to CSV', 'success');
      };
    }
    if (dom.btnResetSampleDb) {
      dom.btnResetSampleDb.onclick = () => {
        window.AkshLanguages.sqlEngine.initSampleDatabase();
        showToast('Sample SQLite database reset', 'info');
        runCode();
      };
    }

    // Go to Line Controls
    if (dom.btnGotoLine) {
      dom.btnGotoLine.onclick = () => toggleGotoLine();
    }
    if (dom.btnGotoLineSubmit) {
      dom.btnGotoLineSubmit.onclick = handleGotoLineSubmit;
    }
    if (dom.btnCloseGoto) {
      dom.btnCloseGoto.onclick = () => toggleGotoLine(false);
    }
    if (dom.gotoLineInput) {
      dom.gotoLineInput.onkeydown = (e) => {
        if (e.key === 'Enter') handleGotoLineSubmit();
        if (e.key === 'Escape') toggleGotoLine(false);
      };
    }

    // Project-wide Search Controls
    if (dom.btnCloseProjectSearch) {
      dom.btnCloseProjectSearch.onclick = () => toggleProjectSearch(false);
    }
    if (dom.projectSearchInput) {
      dom.projectSearchInput.oninput = performProjectSearch;
      dom.projectSearchInput.onkeydown = (e) => {
        if (e.key === 'Escape') toggleProjectSearch(false);
      };
    }

    // Reset Runtime Button
    if (dom.btnResetRuntime) {
      dom.btnResetRuntime.onclick = () => {
        window.AkshLanguages.resetPythonSession();
        addConsoleEntry('system', 'warn', ['Python session reset.']);
        showToast('Python WebAssembly session reset', 'info');
      };
    }

    // Editor Format Button
    if (dom.btnFormatCode) {
      dom.btnFormatCode.onclick = () => formatActiveDocument();
    }

    // Editor Input, Scrolling, Keyboard Productivity & Auto-Save
    if (dom.codeTextarea) {
      dom.codeTextarea.onkeydown = (e) => handleCodeTextareaKeydown(e);
      dom.codeTextarea.oninput = () => {
        onEditorContentChange();

        // Debounced Auto-Save using dedicated autoSaveTimer
        clearTimeout(state.autoSaveTimer);
        state.autoSaveTimer = setTimeout(() => {
          saveProjectToStorage(true);
        }, 800);
      };

      dom.codeTextarea.onscroll = () => {
        if (dom.lineGutter) dom.lineGutter.scrollTop = dom.codeTextarea.scrollTop;
        if (dom.codeHighlightLayer) {
          dom.codeHighlightLayer.scrollTop = dom.codeTextarea.scrollTop;
          dom.codeHighlightLayer.scrollLeft = dom.codeTextarea.scrollLeft;
        }
      };

      dom.codeTextarea.onkeyup = () => updateCursorStats();
      dom.codeTextarea.onclick = () => updateCursorStats();

      // Keep highlight layer width and gutter heights aligned on resize
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (dom.codeHighlightLayer && dom.codeTextarea) {
            const scrollbarW = dom.codeTextarea.offsetWidth - dom.codeTextarea.clientWidth;
            dom.codeHighlightLayer.style.right = `${scrollbarW}px`;
          }
          syncGutterHeights();
        });
        ro.observe(dom.codeTextarea);
      }
      window.addEventListener('resize', () => {
        if (dom.codeHighlightLayer && dom.codeTextarea) {
          const scrollbarW = dom.codeTextarea.offsetWidth - dom.codeTextarea.clientWidth;
          dom.codeHighlightLayer.style.right = `${scrollbarW}px`;
        }
        syncGutterHeights();
      });
    }

    // Project Title Input Updates
    if (dom.projectTitleInput) {
      const handleTitleUpdate = () => {
        const val = dom.projectTitleInput.value.trim() || 'Untitled Project';
        state.project.name = val;
        updateBreadcrumbs();
        clearTimeout(state.autoSaveTimer);
        state.autoSaveTimer = setTimeout(() => {
          saveProjectToStorage(true);
        }, 600);
      };
      dom.projectTitleInput.oninput = handleTitleUpdate;
      dom.projectTitleInput.onchange = handleTitleUpdate;
      dom.projectTitleInput.onblur = handleTitleUpdate;
    }

    // Auto-Run Execution Switch
    if (dom.autoRunSwitch) {
      dom.autoRunSwitch.onchange = () => {
        state.autoRun = dom.autoRunSwitch.checked;
        window.AkshStorage.savePreferences({ autoRun: state.autoRun });
        if (state.autoRun) {
          triggerAutoRun();
          showToast('Auto-run preview enabled', 'info', 1200);
        } else {
          clearTimeout(state.autoRunTimer);
          showToast('Auto-run preview disabled', 'info', 1200);
        }
      };
    }

    // Word Wrap Button
    if (dom.btnToggleWrap) {
      dom.btnToggleWrap.onclick = () => toggleWordWrap();
    }

    // Find & Replace Controls
    if (dom.btnFindOpen) dom.btnFindOpen.onclick = () => toggleFindReplace();
    if (dom.btnCloseFind) dom.btnCloseFind.onclick = () => toggleFindReplace(false);
    if (dom.findInput) {
      dom.findInput.oninput = () => performFind();
      dom.findInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            findPrevMatch();
          } else {
            findNextMatch();
          }
        } else if (e.key === 'Escape') {
          toggleFindReplace(false);
        }
      };
    }
    if (dom.replaceInput) {
      dom.replaceInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          replaceOneMatch();
        } else if (e.key === 'Escape') {
          toggleFindReplace(false);
        }
      };
    }
    if (dom.btnFindNext) dom.btnFindNext.onclick = () => findNextMatch();
    if (dom.btnFindPrev) dom.btnFindPrev.onclick = () => findPrevMatch();
    if (dom.btnReplaceOne) dom.btnReplaceOne.onclick = () => replaceOneMatch();
    if (dom.btnReplaceAll) dom.btnReplaceAll.onclick = () => replaceAllMatches();

    // Command Palette Controls
    if (dom.btnCommandPalette) {
      dom.btnCommandPalette.onclick = () => toggleCommandPalette();
    }
    if (dom.commandPaletteInput) {
      dom.commandPaletteInput.oninput = (e) => {
        state.commandPalette.query = e.target.value;
        state.commandPalette.selectedIndex = 0;
        renderCommandPalette();
      };
      dom.commandPaletteInput.onkeydown = (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const len = state.commandPalette.items.length;
          if (len > 0) {
            state.commandPalette.selectedIndex = (state.commandPalette.selectedIndex + 1) % len;
            renderCommandPalette();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const len = state.commandPalette.items.length;
          if (len > 0) {
            state.commandPalette.selectedIndex = (state.commandPalette.selectedIndex - 1 + len) % len;
            renderCommandPalette();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          executeSelectedCommand();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeCommandPalette();
        }
      };
    }
    if (dom.commandPaletteList) {
      dom.commandPaletteList.onclick = (e) => {
        const itemEl = e.target.closest('.command-palette-item');
        if (itemEl && itemEl.dataset.cmdIndex !== undefined) {
          state.commandPalette.selectedIndex = parseInt(itemEl.dataset.cmdIndex, 10);
          executeSelectedCommand();
        }
      };
    }
    if (dom.commandPaletteBackdrop) {
      dom.commandPaletteBackdrop.onclick = (e) => {
        if (e.target === dom.commandPaletteBackdrop) {
          closeCommandPalette();
        }
      };
    }

    // Status Bar Interactive Controls
    const statusProblemsBtn = document.getElementById('status-problems-btn');
    if (statusProblemsBtn) {
      statusProblemsBtn.onclick = () => switchSidePanel('problems');
    }
    if (dom.tabSizeStatusInfo) {
      dom.tabSizeStatusInfo.onclick = () => {
        const newSize = state.tabSize === 2 ? 4 : 2;
        state.tabSize = newSize;
        if (dom.selectTabSize) dom.selectTabSize.value = String(newSize);
        dom.tabSizeStatusInfo.textContent = `${newSize} Spaces`;
        if (window.AkshStorage) {
          window.AkshStorage.savePreferences({ tabSize: newSize });
        }
        showToast(`Indent set to ${newSize} Spaces`, 'info');
      };
    }
    if (dom.fileTypeTag) {
      dom.fileTypeTag.onclick = () => {
        openCommandPalette();
        if (dom.commandPaletteInput) {
          dom.commandPaletteInput.value = 'Language';
          dom.commandPaletteInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
    }

    // Sandbox Bridge Message Listener
    window.addEventListener('message', handleSandboxMessage);

    // Unsaved Changes Page Exit Warning
    window.addEventListener('beforeunload', (e) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in your project.';
        return e.returnValue;
      }
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl + Shift + P or F1 -> Command Palette
      if ((isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'p') || e.key === 'F1') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // Alt + Z -> Toggle Word Wrap
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        toggleWordWrap();
        return;
      }

      // Ctrl + S -> Save Active File
      if (isCtrlOrCmd && e.key.toLowerCase() === 's' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        saveProjectToStorage(false);
        return;
      }

      // Ctrl + Alt + S -> Save All Files
      if (isCtrlOrCmd && e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveAllFiles();
        return;
      }

      // Ctrl + Shift + S -> Export Project ZIP
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        openExportZipModal();
        return;
      }

      // Ctrl + G -> Go to Line
      if (isCtrlOrCmd && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        toggleGotoLine();
        return;
      }

      // Ctrl + Shift + F -> Search Across Files
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleProjectSearch();
        return;
      }

      // Ctrl + Shift + M -> Toggle Problems Panel (VS Code Standard)
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        switchSidePanel('problems');
        return;
      }

      // Ctrl + Enter -> Run Code
      if (isCtrlOrCmd && e.key === 'Enter') {
        e.preventDefault();
        runCode();
        return;
      }

      // Shift + Alt + F or Ctrl + Shift + I -> Format Code (VS Code Standard)
      if ((e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') || (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        formatActiveDocument();
        return;
      }

      // Ctrl + F -> Find in File
      if (isCtrlOrCmd && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        toggleFindReplace(true, false);
        return;
      }

      // Ctrl + H -> Find & Replace (VS Code Standard)
      if (isCtrlOrCmd && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        toggleFindReplace(true, true);
        return;
      }

      // Escape -> Close Modals / Search / Goto / Command Palette
      if (e.key === 'Escape') {
        closeModal();
        closeCommandPalette();
        toggleFindReplace(false);
        toggleGotoLine(false);
        toggleProjectSearch(false);
      }
    });

    // Close Dropdowns on Click Outside
    document.addEventListener('click', (e) => {
      if (dom.exportMenu && !dom.btnExport.contains(e.target)) {
        dom.exportMenu.classList.remove('active');
      }
    });

    // Modal Close Button & Backdrop
    if (dom.modalCloseBtn) dom.modalCloseBtn.onclick = closeModal;
    if (dom.modalBackdrop) {
      dom.modalBackdrop.onclick = (e) => {
        if (e.target === dom.modalBackdrop) closeModal();
      };
    }

    // Reset Layout Proportions Button
    dom.btnResetLayout.onclick = () => {
      const explorer = document.getElementById('side-panels-container');
      if (explorer) explorer.style.width = '250px';
      if (dom.editorWrapper) dom.editorWrapper.style.flex = '0 0 50%';
      if (dom.consolePanel) dom.consolePanel.style.height = '190px';
      showToast('Layout proportions reset', 'info');
    };

    // Keyboard Shortcuts Reference Modal
    dom.btnShortcuts.onclick = () => {
      showCustomModal(
        'Keyboard Shortcuts Reference',
        `
        <table style="width:100%;font-size:12px;border-collapse:collapse;color:var(--text-secondary);">
          <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:6px 0;"><kbd>Ctrl + S</kbd></td><td>Save Active File (Device Folder or Browser Storage)</td></tr>
          <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:6px 0;"><kbd>Ctrl + Shift + S</kbd></td><td>Export Project as Real ZIP Archive</td></tr>
          <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:6px 0;"><kbd>Ctrl + Enter</kbd></td><td>Run Code / Execute Preview</td></tr>
          <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:6px 0;"><kbd>Ctrl + Shift + I</kbd></td><td>Format Document Cleanly</td></tr>
          <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:6px 0;"><kbd>Ctrl + F</kbd></td><td>Find & Replace in Current File</td></tr>
          <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:6px 0;"><kbd>Alt + Z</kbd></td><td>Toggle Word Wrap</td></tr>
          <tr><td style="padding:6px 0;"><kbd>Esc</kbd></td><td>Close Active Dialogs / Find Bar</td></tr>
        </table>
        `,
        [{ label: 'Close', className: 'btn btn-primary', action: () => closeModal() }]
      );
    };

    // Settings Modal
    dom.btnSettings.onclick = () => {
      showCustomModal(
        'Studio Settings',
        `
        <div style="display:flex;flex-direction:column;gap:12px;font-size:12.5px;">
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:600;">Editor Font Size</label>
            <input type="number" id="setting-font-size" value="${state.editorFontSize}" min="10" max="24" style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);border-radius:4px;">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-weight:600;">Tab Size</label>
            <select id="setting-tab-size" style="padding:4px 8px;background:var(--bg-elevated);border:1px solid var(--border-default);color:var(--text-primary);border-radius:4px;">
              <option value="2" ${state.tabSize === 2 ? 'selected' : ''}>2 Spaces</option>
              <option value="4" ${state.tabSize === 4 ? 'selected' : ''}>4 Spaces</option>
            </select>
          </div>
          <div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="setting-auto-lint" ${state.autoLint ? 'checked' : ''}>
              <span>Auto-scan for errors and accessibility on edit</span>
            </label>
          </div>
        </div>
        `,
        [
          {
            label: 'Save Preferences',
            className: 'btn btn-primary',
            action: () => {
              const fontEl = document.getElementById('setting-font-size');
              const tabEl = document.getElementById('setting-tab-size');
              const lintEl = document.getElementById('setting-auto-lint');

              if (fontEl) {
                applyEditorFontSize(parseInt(fontEl.value, 10) || 14);
              }
              if (tabEl) state.tabSize = parseInt(tabEl.value, 10) || 2;
              if (lintEl) state.autoLint = lintEl.checked;
              updateTabSizeStatus();

              window.AkshStorage.savePreferences({
                theme: state.theme,
                editorFontSize: state.editorFontSize,
                wordWrap: state.wordWrap,
                tabSize: state.tabSize,
                autoRun: state.autoRun,
                autoLint: state.autoLint
              });

              closeModal();
              showToast('Preferences saved', 'success');
            }
          },
          { label: 'Cancel', className: 'btn btn-secondary', action: () => closeModal() }
        ]
      );
    };

    // Mobile View Switcher
    dom.mobileViewTabs.forEach(tab => {
      tab.onclick = () => {
        dom.mobileViewTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.body.setAttribute('data-mobile-view', tab.dataset.view);
      };
    });

    // Device Presets
    dom.presetBtns.forEach(btn => {
      btn.onclick = () => {
        dom.presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        state.currentPreset = preset;

        if (preset === 'responsive') {
          dom.previewFrameContainer.style.width = '100%';
          dom.viewportInfoTag.textContent = '100% Fluid';
        } else if (preset === 'desktop') {
          dom.previewFrameContainer.style.width = '1200px';
          dom.viewportInfoTag.textContent = '1200px Desktop';
        } else if (preset === 'tablet') {
          dom.previewFrameContainer.style.width = '768px';
          dom.viewportInfoTag.textContent = '768px Tablet';
        } else if (preset === 'mobile') {
          dom.previewFrameContainer.style.width = '375px';
          dom.viewportInfoTag.textContent = '375px Mobile';
        }
      };
    });

    // Console Filter Chips
    dom.filterChips.forEach(chip => {
      chip.onclick = () => {
        dom.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.consoleFilter = chip.dataset.filter;
        renderFilteredConsoleLogs();
      };
    });
    dom.btnClearConsole.onclick = () => clearConsole();
    dom.btnToggleConsole.onclick = () => {
      const currentHeight = dom.consolePanel.getBoundingClientRect().height;
      dom.consolePanel.style.height = currentHeight > 50 ? '34px' : '190px';
    };

    // Preview Reload & Fullscreen
    dom.btnRefreshPreview.onclick = () => runCode();
    dom.btnFullscreenPreview.onclick = () => {
      if (dom.previewIframe.requestFullscreen) {
        dom.previewIframe.requestFullscreen();
      }
    };
  }

  function renderFilteredConsoleLogs() {
    if (!dom.consoleLogsList) return;
    dom.consoleLogsList.innerHTML = '';
    state.consoleLogs.forEach(entry => renderConsoleEntry(entry));
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ==========================================================================
  // Application Startup & Initialization
  // ==========================================================================
  async function init() {
    initDomElements();
    setupEventListeners();
    initResizing();
    initDragAndDrop();
    initQaTools();

    // Render initial UI state immediately
    renderTabs();
    renderFileTree();
    loadActiveFileIntoEditor();
    updateLanguageStatus();
    updateBreadcrumbs();

    // 1. Load preferences and project from IndexedDB
    await loadSavedState();

    // 2. Apply theme & preferences
    applyTheme(state.theme);
    applyEditorFontSize(state.editorFontSize || 14);
    toggleWordWrap(state.wordWrap);
    updateTabSizeStatus();

    // 3. Update top bar
    if (dom.projectTitleInput) dom.projectTitleInput.value = state.project.name;
    updateStorageModeBadge();

    // 4. Render UI
    renderTabs();
    renderFileTree();
    loadActiveFileIntoEditor();
    updateLanguageStatus();
    updateProjectStats();

    // 5. Initial scan for diagnostics
    triggerDiagnosticsScan();

    // 6. Run preview initially
    await runCode();

    state.isInitialized = true;
    window.dispatchEvent(new CustomEvent('aksh:ready'));
    console.log('Aksh Code Playground Pro initialized successfully (IndexedDB Mode A + Device Mode B).');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
