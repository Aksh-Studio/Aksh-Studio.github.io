/**
 * Aksh Photoshop - IndexedDB Persistence & Debounced Autosave Subsystem
 * DB Name: PhotoshopWorkspaceDB
 * Stores: workspace_state, presets_store
 */

window.PSStorage = {
    dbName: 'PhotoshopWorkspaceDB',
    dbVersion: 1,
    db: null,
    autosaveTimer: null,
    isDirty: false,
    isSaving: false,
    lastSavedTimestamp: null,

    async init() {
        return new Promise((resolve) => {
            if (!window.indexedDB) {
                console.warn('[PSStorage] IndexedDB not supported; using fallback memory mode.');
                resolve(false);
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('workspace_state')) {
                    db.createObjectStore('workspace_state', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('presets_store')) {
                    db.createObjectStore('presets_store', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.updateSaveIndicator();
                resolve(true);
            };

            request.onerror = (event) => {
                console.warn('[PSStorage] Failed to open IndexedDB:', event.target.error);
                resolve(false);
            };
        });
    },

    markDirty() {
        this.isDirty = true;
        this.updateSaveIndicator();
        this.scheduleAutosave();
    },

    markClean() {
        this.isDirty = false;
        this.updateSaveIndicator();
    },

    scheduleAutosave(delayMs = 3500) {
        if (this.autosaveTimer) {
            clearTimeout(this.autosaveTimer);
        }
        this.autosaveTimer = setTimeout(() => {
            this.saveWorkspaceState();
        }, delayMs);
    },

    async saveWorkspaceState() {
        if (!this.db || !window.PSApp || !window.PSLayers || this.isSaving) return;
        if (window.PSLayers.layers.length === 0) return;

        this.isSaving = true;
        this.updateSaveIndicator();

        try {
            // Serialize active layers asynchronously into blobs/dataURLs
            const serializedLayers = await Promise.all(
                window.PSLayers.layers.map((layer) => {
                    return new Promise((resolve) => {
                        layer.canvas.toBlob((blob) => {
                            resolve({
                                id: layer.id,
                                name: layer.name,
                                visible: layer.visible,
                                locked: !!layer.locked,
                                opacity: layer.opacity,
                                blendMode: layer.blendMode,
                                x: layer.x,
                                y: layer.y,
                                width: layer.canvas.width,
                                height: layer.canvas.height,
                                blob: blob
                            });
                        }, 'image/png');
                    });
                })
            );

            const record = {
                id: 'active_session',
                timestamp: Date.now(),
                width: window.PSApp.width,
                height: window.PSApp.height,
                activeLayerId: window.PSLayers.activeLayerId,
                layers: serializedLayers
            };

            const tx = this.db.transaction(['workspace_state'], 'readwrite');
            const store = tx.objectStore('workspace_state');
            store.put(record);

            tx.oncomplete = () => {
                this.isSaving = false;
                this.isDirty = false;
                this.lastSavedTimestamp = Date.now();
                this.updateSaveIndicator();
            };

            tx.onerror = (e) => {
                console.warn('[PSStorage] Autosave transaction failed:', e.target.error);
                this.isSaving = false;
                this.updateSaveIndicator();
            };
        } catch (err) {
            console.warn('[PSStorage] Autosave error:', err);
            this.isSaving = false;
            this.updateSaveIndicator();
        }
    },

    async checkRecoverableSession() {
        if (!this.db) return null;
        return new Promise((resolve) => {
            const tx = this.db.transaction(['workspace_state'], 'readonly');
            const store = tx.objectStore('workspace_state');
            const req = store.get('active_session');

            req.onsuccess = () => {
                const session = req.result;
                if (session && session.layers && session.layers.length > 0) {
                    resolve(session);
                } else {
                    resolve(null);
                }
            };

            req.onerror = () => resolve(null);
        });
    },

    async restoreSession(session) {
        if (!session) return false;

        window.PSApp.setCanvasDimensions(session.width, session.height, false);
        window.PSLayers.layers = [];
        window.PSHistory.init();

        for (const item of session.layers) {
            const canvas = document.createElement('canvas');
            canvas.width = item.width;
            canvas.height = item.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            if (item.blob) {
                await new Promise((res) => {
                    const img = new Image();
                    const url = URL.createObjectURL(item.blob);
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0);
                        URL.revokeObjectURL(url);
                        res();
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(url);
                        res();
                    };
                    img.src = url;
                });
            }

            window.PSLayers.layers.push({
                id: item.id,
                name: item.name,
                canvas: canvas,
                ctx: ctx,
                visible: item.visible !== false,
                locked: !!item.locked,
                opacity: item.opacity !== undefined ? item.opacity : 100,
                blendMode: item.blendMode || 'source-over',
                x: item.x || 0,
                y: item.y || 0
            });
        }

        window.PSLayers.activeLayerId = session.activeLayerId || window.PSLayers.layers[0]?.id;
        window.PSLayers.renderLayersList();
        window.PSLayers.compositeAll();
        window.PSHistory.saveState('Restored Session');
        window.PSApp.fitToScreen();
        this.markClean();
        return true;
    },

    async clearSession() {
        if (!this.db) return;
        const tx = this.db.transaction(['workspace_state'], 'readwrite');
        tx.objectStore('workspace_state').delete('active_session');
    },

    updateSaveIndicator() {
        const el = document.getElementById('save-status-indicator');
        if (!el) return;

        if (this.isSaving) {
            el.innerHTML = '<span class="status-dot saving"></span> Saving...';
            el.className = 'status-indicator saving';
        } else if (this.isDirty) {
            el.innerHTML = '<span class="status-dot dirty"></span> Unsaved changes';
            el.className = 'status-indicator dirty';
        } else {
            el.innerHTML = '<span class="status-dot saved"></span> All changes saved';
            el.className = 'status-indicator saved';
        }
    }
};
