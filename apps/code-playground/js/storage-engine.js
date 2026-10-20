/**
 * Aksh Code Playground — Storage & Device Integration Engine
 * Manages two explicit modes:
 * Mode A: Browser Storage (IndexedDB primary storage for projects + localStorage for preferences)
 * Mode B: Local Project Folder (Direct device folder access via File System Access API)
 * Fully compliant with GitHub Pages static hosting. Zero telemetry, zero uploads.
 */

(function (window) {
  'use strict';

  const DB_NAME = 'AkshCodePlaygroundDB';
  const DB_VERSION = 1;
  const STORE_PROJECTS = 'projects';
  const STORE_METADATA = 'metadata';
  const PREFS_KEY = 'aksh_playground_preferences_v2';
  const ACTIVE_PROJECT_ID_KEY = 'aksh_active_project_id_v2';

  // State
  let dbInstance = null;
  let activeMode = 'browser'; // 'browser' | 'device'
  let localDirHandle = null;
  let localDirName = '';
  let fileHandlesMap = new Map(); // path -> FileSystemFileHandle
  let dirHandlesMap = new Map();  // path -> FileSystemDirectoryHandle

  // ==========================================================================
  // Mode A: IndexedDB Storage Engine
  // ==========================================================================

  function openIndexedDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB is not supported in this browser. Falling back to localStorage.');
        resolve(null);
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const store = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async function getDbStore(storeName, mode = 'readonly') {
    const db = await openIndexedDB();
    if (!db) return null;
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  /**
   * Saves a project into IndexedDB (with localStorage backup for resilience).
   */
  async function saveProjectToIdb(project) {
    if (!project || !project.id) {
      throw new Error('Project must have a valid id');
    }

    const payload = {
      id: project.id,
      name: project.name || 'Untitled Project',
      activeFile: project.activeFile || 'index.html',
      openTabs: project.openTabs || [],
      folders: project.folders || [],
      files: (project.files || []).map(f => ({
        name: f.name,
        path: f.path || f.name,
        type: f.type,
        content: f.content,
        isDirty: !!f.isDirty,
        isBinary: !!f.isBinary
      })),
      updatedAt: new Date().toISOString()
    };

    try {
      const store = await getDbStore(STORE_PROJECTS, 'readwrite');
      if (store) {
        await new Promise((resolve, reject) => {
          const req = store.put(payload);
          req.onsuccess = () => resolve(true);
          req.onerror = (e) => reject(e.target.error);
        });
      }
    } catch (err) {
      console.warn('IDB put error, falling back to localStorage:', err);
    }

    // Keep active ID in localStorage
    try {
      localStorage.setItem(ACTIVE_PROJECT_ID_KEY, project.id);
      // Also backup the active project to localStorage for quick restore
      localStorage.setItem('aksh_code_playground_v1', JSON.stringify(payload));
    } catch (e) {
      // Ignore quota errors on localStorage
    }

    return payload;
  }

  /**
   * Retrieves a project by ID from IndexedDB.
   */
  async function getProjectFromIdb(projectId) {
    try {
      const store = await getDbStore(STORE_PROJECTS, 'readonly');
      if (store) {
        const project = await new Promise((resolve, reject) => {
          const req = store.get(projectId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = (e) => reject(e.target.error);
        });
        if (project) return project;
      }
    } catch (err) {
      console.warn('Error reading from IDB:', err);
    }

    // Fallback to localStorage
    try {
      const saved = localStorage.getItem('aksh_code_playground_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.id === projectId || !projectId) return parsed;
      }
    } catch (e) {}

    return null;
  }

  /**
   * Returns a list of all saved projects from IndexedDB.
   */
  async function getAllProjectsFromIdb() {
    try {
      const store = await getDbStore(STORE_PROJECTS, 'readonly');
      if (store) {
        const projects = await new Promise((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = (e) => reject(e.target.error);
        });
        if (projects && projects.length > 0) {
          return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }
      }
    } catch (err) {
      console.warn('Error reading all projects from IDB:', err);
    }

    // Fallback
    try {
      const saved = localStorage.getItem('aksh_code_playground_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return [parsed];
      }
    } catch (e) {}

    return [];
  }

  /**
   * Deletes a project from IndexedDB.
   */
  async function deleteProjectFromIdb(projectId) {
    try {
      const store = await getDbStore(STORE_PROJECTS, 'readwrite');
      if (store) {
        await new Promise((resolve, reject) => {
          const req = store.delete(projectId);
          req.onsuccess = () => resolve(true);
          req.onerror = (e) => reject(e.target.error);
        });
      }
    } catch (err) {
      console.warn('Error deleting project from IDB:', err);
    }
  }

  // ==========================================================================
  // Preferences (localStorage only)
  // ==========================================================================

  function loadPreferences() {
    const defaults = {
      theme: 'dark',
      editorFontSize: 14,
      wordWrap: true,
      tabSize: 2,
      autoRun: false,
      autoLint: true
    };
    try {
      const raw = localStorage.getItem(PREFS_KEY) || localStorage.getItem('aksh_code_playground_settings_v1');
      if (raw) {
        return { ...defaults, ...JSON.parse(raw) };
      }
    } catch (e) {}
    return defaults;
  }

  function savePreferences(prefs) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }

  // ==========================================================================
  // Mode B: File System Access API Adapter
  // ==========================================================================

  function isFileSystemAccessSupported() {
    return typeof window.showDirectoryPicker === 'function';
  }

  /**
   * Requests permission to read/write a file handle.
   */
  async function verifyPermission(fileHandle, readWrite = true) {
    const options = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
    return false;
  }

  /**
   * Opens a local folder using the browser File System Access API.
   * Scans files recursively, constructs virtual project structure.
   */
  async function openLocalFolder() {
    if (!isFileSystemAccessSupported()) {
      throw new Error('FILE_SYSTEM_ACCESS_UNSUPPORTED');
    }

    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({
        id: 'aksh-code-playground-folder',
        mode: 'readwrite'
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        return null; // User cancelled picker
      }
      throw err;
    }

    localDirHandle = dirHandle;
    localDirName = dirHandle.name;
    fileHandlesMap.clear();
    dirHandlesMap.clear();
    dirHandlesMap.set('', dirHandle);

    const projectFiles = [];
    const IGNORED_DIRS = new Set(['.git', '.vscode', 'node_modules', '.idea', 'dist', 'build', '__pycache__']);
    const TEXT_EXTS = new Set([
      'html', 'htm', 'css', 'js', 'mjs', 'ts', 'jsx', 'tsx',
      'json', 'py', 'sql', 'md', 'txt', 'svg', 'xml', 'yaml', 'yml',
      'csv', 'c', 'cpp', 'h', 'java', 'rs', 'go', 'php', 'rb', 'sh'
    ]);

    async function scanDirectory(currentDirHandle, relativePath = '', depth = 0) {
      if (depth > 6) return; // Prevent excessive deep directory recursion

      for await (const [name, entry] of currentDirHandle.entries()) {
        if (name.startsWith('.') && name !== '.gitignore') continue;

        if (entry.kind === 'directory') {
          if (IGNORED_DIRS.has(name)) continue;
          const subPath = relativePath ? `${relativePath}/${name}` : name;
          dirHandlesMap.set(subPath, entry);
          await scanDirectory(entry, subPath, depth + 1);
        } else if (entry.kind === 'file') {
          const filePath = relativePath ? `${relativePath}/${name}` : name;
          const ext = name.split('.').pop().toLowerCase();

          // Only read text files to prevent locking or memory crashes
          if (TEXT_EXTS.has(ext)) {
            try {
              const file = await entry.getFile();
              if (file.size < 10 * 1024 * 1024) { // Max 10MB per file
                const text = await file.text();
                fileHandlesMap.set(filePath, entry);
                projectFiles.push({
                  name: name,
                  path: filePath,
                  type: detectFileType(name),
                  content: text,
                  isBinary: false
                });
              }
            } catch (readErr) {
              console.warn(`Could not read file "${filePath}":`, readErr);
            }
          }
        }
      }
    }

    await scanDirectory(dirHandle, '', 0);

    // If folder was empty, generate a starter index.html
    if (projectFiles.length === 0) {
      projectFiles.push({
        name: 'index.html',
        path: 'index.html',
        type: 'html',
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${localDirName}</title>\n</head>\n<body>\n  <h1>${localDirName}</h1>\n  <p>Local folder opened in Aksh Code Playground.</p>\n</body>\n</html>`
      });
    }

    activeMode = 'device';

    return {
      name: localDirName,
      files: projectFiles,
      dirName: localDirName,
      activeFile: projectFiles[0].path || projectFiles[0].name
    };
  }

  /**
   * Saves a file directly to the local folder handle.
   */
  async function saveFileToDisk(filePath, content) {
    if (activeMode !== 'device' || !localDirHandle) {
      throw new Error('Not currently editing a local device folder.');
    }

    let fileHandle = fileHandlesMap.get(filePath);

    // If handle not cached, navigate directory path to create or get it
    if (!fileHandle) {
      const parts = filePath.split('/');
      const fileName = parts.pop();
      let currentDir = localDirHandle;

      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }

      fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      fileHandlesMap.set(filePath, fileHandle);
    }

    // Verify write permissions
    const permitted = await verifyPermission(fileHandle, true);
    if (!permitted) {
      throw new Error(`Write permission denied by user for "${filePath}".`);
    }

    // Write file content safely using atomic stream
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    return true;
  }

  /**
   * Creates a new file in the local device folder.
   */
  async function createFileOnDisk(filePath, initialContent = '') {
    if (activeMode !== 'device' || !localDirHandle) return false;
    await saveFileToDisk(filePath, initialContent);
    return true;
  }

  /**
   * Creates a directory in the local device folder.
   */
  async function createFolderOnDisk(folderPath) {
    if (activeMode !== 'device' || !localDirHandle) return false;
    const clean = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parts = clean.split('/').filter(Boolean);
    let currentDir = localDirHandle;
    let accumulated = '';
    for (const part of parts) {
      accumulated = accumulated ? `${accumulated}/${part}` : part;
      currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      dirHandlesMap.set(accumulated, currentDir);
    }
    return true;
  }

  /**
   * Deletes a file from the local device folder.
   */
  async function deleteFileOnDisk(filePath) {
    if (activeMode !== 'device' || !localDirHandle) return false;

    const parts = filePath.replace(/\\/g, '/').split('/');
    const fileName = parts.pop();
    let currentDir = localDirHandle;

    for (const part of parts) {
      if (!part) continue;
      currentDir = await currentDir.getDirectoryHandle(part, { create: false });
    }

    await currentDir.removeEntry(fileName);
    fileHandlesMap.delete(filePath);
    return true;
  }

  /**
   * Deletes a directory and its contents from the local device folder.
   */
  async function deleteFolderOnDisk(folderPath) {
    if (activeMode !== 'device' || !localDirHandle) return false;
    const clean = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const parts = clean.split('/').filter(Boolean);
    if (parts.length === 0) return false;
    const folderName = parts.pop();
    let currentDir = localDirHandle;
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: false });
    }
    await currentDir.removeEntry(folderName, { recursive: true });
    dirHandlesMap.delete(clean);
    // Remove all cached file handles under this folder
    for (const [k] of fileHandlesMap.entries()) {
      if (k === clean || k.startsWith(`${clean}/`)) {
        fileHandlesMap.delete(k);
      }
    }
    return true;
  }

  /**
   * Renames a file on disk by reading old file, writing new file, and deleting old file.
   */
  async function renameFileOnDisk(oldPath, newPath, content) {
    if (activeMode !== 'device' || !localDirHandle) return false;
    await saveFileToDisk(newPath, content);
    await deleteFileOnDisk(oldPath);
    return true;
  }

  function detectFileType(name) {
    const ext = name.split('.').pop().toLowerCase();
    switch (ext) {
      case 'html': case 'htm': return 'html';
      case 'css': return 'css';
      case 'js': case 'mjs': return 'javascript';
      case 'ts': case 'tsx': return 'typescript';
      case 'json': return 'json';
      case 'py': return 'python';
      case 'sql': return 'sql';
      case 'md': return 'markdown';
      case 'svg': return 'svg';
      case 'xml': return 'xml';
      case 'yaml': case 'yml': return 'yaml';
      case 'csv': return 'csv';
      default: return 'text';
    }
  }

  function getActiveMode() {
    return activeMode;
  }

  function setActiveMode(mode) {
    activeMode = mode;
  }

  function getLocalDirName() {
    return localDirName;
  }

  function closeLocalFolder() {
    activeMode = 'browser';
    localDirHandle = null;
    localDirName = '';
    fileHandlesMap.clear();
    dirHandlesMap.clear();
  }

  // Export
  window.AkshStorage = {
    // Mode A: IndexedDB
    openIndexedDB,
    saveProjectToIdb,
    getProjectFromIdb,
    getAllProjectsFromIdb,
    deleteProjectFromIdb,
    // Preferences
    loadPreferences,
    savePreferences,
    // Mode B: Local Device Folder
    isFileSystemAccessSupported,
    openLocalFolder,
    saveFileToDisk,
    createFileOnDisk,
    createFolderOnDisk,
    deleteFileOnDisk,
    deleteFolderOnDisk,
    renameFileOnDisk,
    closeLocalFolder,
    // Mode tracking
    getActiveMode,
    setActiveMode,
    getLocalDirName,
    detectFileType
  };

})(window);
