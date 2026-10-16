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
            // Serialize active layers asynchronously into blobs
            const serializedLayers = await Promise.all(
                window.PSLayers.layers.map((layer) => {
                    return new Promise((resolve) => {
                        let maskBlobPromise = Promise.resolve(null);
                        if (layer.hasMask && layer.maskCanvas) {
                            maskBlobPromise = new Promise(resMask => layer.maskCanvas.toBlob(resMask, 'image/png'));
                        }

                        maskBlobPromise.then(maskBlob => {
                            if (layer.isGroup || !layer.canvas) {
                                resolve({
                                    id: layer.id,
                                    name: layer.name,
                                    visible: layer.visible,
                                    locked: !!layer.locked,
                                    opacity: layer.opacity,
                                    blendMode: layer.blendMode,
                                    x: layer.x || 0,
                                    y: layer.y || 0,
                                    width: 0,
                                    height: 0,
                                    blob: null,
                                    hasMask: false,
                                    maskBlob: null,
                                    isGroup: true,
                                    groupId: layer.groupId || null,
                                    expanded: layer.expanded !== false,
                                    clipped: false,
                                    alphaLocked: false
                                });
                            } else {
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
                                        blob: blob,
                                        hasMask: !!layer.hasMask,
                                        maskBlob: maskBlob,
                                        maskDisabled: !!layer.maskDisabled,
                                        editingTarget: layer.editingTarget || 'layer',
                                        isGroup: false,
                                        groupId: layer.groupId || null,
                                        expanded: true,
                                        clipped: !!layer.clipped,
                                        alphaLocked: !!layer.alphaLocked,
                                        isTextLayer: !!layer.isTextLayer,
                                        textContent: layer.textContent || null,
                                        fontSize: layer.fontSize || null,
                                        fontFamily: layer.fontFamily || null,
                                        isBold: !!layer.isBold,
                                        isItalic: !!layer.isItalic
                                    });
                                }, 'image/png');
                            }
                        });
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
            if (item.isGroup) {
                window.PSLayers.layers.push({
                    id: item.id,
                    name: item.name,
                    isGroup: true,
                    expanded: item.expanded !== false,
                    visible: item.visible !== false,
                    locked: !!item.locked,
                    opacity: item.opacity !== undefined ? item.opacity : 100,
                    blendMode: item.blendMode || 'source-over',
                    groupId: item.groupId || null,
                    x: item.x || 0,
                    y: item.y || 0
                });
                continue;
            }

            const canvas = document.createElement('canvas');
            canvas.width = item.width || session.width;
            canvas.height = item.height || session.height;
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

            let maskCanvas = null;
            let maskCtx = null;
            if (item.hasMask && item.maskBlob) {
                maskCanvas = document.createElement('canvas');
                maskCanvas.width = canvas.width;
                maskCanvas.height = canvas.height;
                maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
                await new Promise((res) => {
                    const mImg = new Image();
                    const mUrl = URL.createObjectURL(item.maskBlob);
                    mImg.onload = () => {
                        maskCtx.drawImage(mImg, 0, 0);
                        URL.revokeObjectURL(mUrl);
                        res();
                    };
                    mImg.onerror = () => {
                        URL.revokeObjectURL(mUrl);
                        res();
                    };
                    mImg.src = mUrl;
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
                y: item.y || 0,
                hasMask: !!item.hasMask,
                maskCanvas: maskCanvas,
                maskCtx: maskCtx,
                maskDisabled: !!item.maskDisabled,
                editingTarget: item.editingTarget || 'layer',
                isGroup: false,
                groupId: item.groupId || null,
                expanded: true,
                clipped: !!item.clipped,
                alphaLocked: !!item.alphaLocked,
                isTextLayer: !!item.isTextLayer,
                textContent: item.textContent || null,
                fontSize: item.fontSize || null,
                fontFamily: item.fontFamily || null,
                isBold: !!item.isBold,
                isItalic: !!item.isItalic
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
