/**
 * Aksh Photoshop - Undo/Redo History State Manager
 * Bounded memory snapshots for zero-latency rollback
 */

window.PSHistory = {
    stack: [],
    currentIndex: -1,
    maxStates: 30,

    init() {
        this.stack = [];
        this.currentIndex = -1;
        this.renderUI();
    },

    saveState(actionLabel = 'Edit') {
        if (!window.PSLayers || !window.PSApp) return;

        // Truncate redo branches if editing after undo
        if (this.currentIndex < this.stack.length - 1) {
            this.stack = this.stack.slice(0, this.currentIndex + 1);
        }

        // Deep-clone layers
        const serializedLayers = window.PSLayers.layers.map(layer => {
            const copy = document.createElement('canvas');
            copy.width = layer.canvas.width;
            copy.height = layer.canvas.height;
            copy.getContext('2d').drawImage(layer.canvas, 0, 0);

            return {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                locked: layer.locked,
                opacity: layer.opacity,
                blendMode: layer.blendMode,
                x: layer.x,
                y: layer.y,
                width: layer.canvas.width,
                height: layer.canvas.height,
                canvas: copy
            };
        });

        const snapshot = {
            label: actionLabel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            canvasWidth: window.PSApp.width,
            canvasHeight: window.PSApp.height,
            activeLayerId: window.PSLayers.activeLayerId,
            layers: serializedLayers
        };

        this.stack.push(snapshot);

        if (this.stack.length > this.maxStates) {
            this.stack.shift();
        } else {
            this.currentIndex++;
        }

        this.renderUI();
        if (window.PSStorage) {
            window.PSStorage.markDirty();
        }
    },

    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.restoreSnapshot(this.stack[this.currentIndex]);
        }
    },

    redo() {
        if (this.currentIndex < this.stack.length - 1) {
            this.currentIndex++;
            this.restoreSnapshot(this.stack[this.currentIndex]);
        }
    },

    jumpTo(index) {
        if (index >= 0 && index < this.stack.length) {
            this.currentIndex = index;
            this.restoreSnapshot(this.stack[this.currentIndex]);
        }
    },

    restoreSnapshot(snapshot) {
        if (!snapshot) return;

        window.PSApp.setCanvasDimensions(snapshot.canvasWidth, snapshot.canvasHeight, false);

        window.PSLayers.layers = snapshot.layers.map(saved => {
            const c = document.createElement('canvas');
            c.width = saved.width;
            c.height = saved.height;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(saved.canvas, 0, 0);

            return {
                id: saved.id,
                name: saved.name,
                canvas: c,
                ctx: ctx,
                visible: saved.visible,
                locked: saved.locked,
                opacity: saved.opacity,
                blendMode: saved.blendMode,
                x: saved.x,
                y: saved.y
            };
        });

        window.PSLayers.activeLayerId = snapshot.activeLayerId;
        window.PSLayers.renderLayersList();
        window.PSLayers.compositeAll();
        this.renderUI();
        if (window.PSStorage) {
            window.PSStorage.markDirty();
        }
    },

    clear() {
        if (this.stack.length === 0) return;
        const latest = this.stack[this.currentIndex];
        this.stack = [latest];
        this.currentIndex = 0;
        this.renderUI();
    },

    renderUI() {
        const listEl = document.getElementById('history-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        this.stack.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = `history-item ${idx === this.currentIndex ? 'active' : ''} ${idx > this.currentIndex ? 'undone' : ''}`;
            row.innerHTML = `${window.PSIcons.get('history', '', 13, 13)} <span>${item.label}</span> <span class="history-time">${item.timestamp}</span>`;
            row.addEventListener('click', () => this.jumpTo(idx));
            listEl.appendChild(row);
        });

        listEl.scrollTop = listEl.scrollHeight;
    }
};
