/**
 * Aksh Photoshop - Multi-Layer Engine & Canvas Compositor
 */

window.PSLayers = {
    layers: [],
    activeLayerId: null,
    counter: 1,

    init(width, height, bgType = 'white') {
        this.layers = [];
        this.counter = 1;
        const baseLayer = this.createLayerObject('Background', width, height);

        if (bgType === 'white') {
            baseLayer.ctx.fillStyle = '#ffffff';
            baseLayer.ctx.fillRect(0, 0, width, height);
        } else if (bgType === 'black') {
            baseLayer.ctx.fillStyle = '#000000';
            baseLayer.ctx.fillRect(0, 0, width, height);
        }

        this.layers.push(baseLayer);
        this.activeLayerId = baseLayer.id;
        this.renderLayersList();
        this.compositeAll();
    },

    createLayerObject(name, width, height) {
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        return {
            id: 'layer_' + Date.now() + '_' + (this.counter++),
            name: name || `Layer ${this.counter}`,
            canvas: c,
            ctx: ctx,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'source-over',
            x: 0,
            y: 0,
            hasMask: false,
            maskCanvas: null,
            maskCtx: null,
            maskDisabled: false,
            editingTarget: 'layer', // 'layer' | 'mask'
            isGroup: false,
            groupId: null,
            expanded: true,
            clipped: false,
            alphaLocked: false
        };
    },

    getActiveLayer() {
        return this.layers.find(l => l.id === this.activeLayerId) || this.layers[0] || null;
    },

    getActiveDrawable() {
        const layer = this.getActiveLayer();
        if (!layer) return null;
        if (layer.isGroup) return null;
        if (layer.editingTarget === 'mask' && layer.hasMask && layer.maskCanvas) {
            return {
                id: layer.id,
                name: `${layer.name} (Mask)`,
                canvas: layer.maskCanvas,
                ctx: layer.maskCtx,
                x: layer.x,
                y: layer.y,
                isMask: true,
                locked: layer.locked,
                alphaLocked: false
            };
        }
        return {
            id: layer.id,
            name: layer.name,
            canvas: layer.canvas,
            ctx: layer.ctx,
            x: layer.x,
            y: layer.y,
            isMask: false,
            locked: layer.locked,
            alphaLocked: layer.alphaLocked
        };
    },

    addNewLayer(name) {
        const base = this.layers.find(l => l.canvas);
        const w = base ? base.canvas.width : (window.PSApp ? window.PSApp.width : 800);
        const h = base ? base.canvas.height : (window.PSApp ? window.PSApp.height : 600);
        const layer = this.createLayerObject(name || `Layer ${this.layers.length + 1}`, w, h);
        this.layers.push(layer);
        this.activeLayerId = layer.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`New Layer (${layer.name})`);
        return layer;
    },

    addImageAsLayer(img, name = 'Image Layer') {
        const base = this.layers.find(l => l.canvas);
        const w = base ? base.canvas.width : (window.PSApp ? window.PSApp.width : 800);
        const h = base ? base.canvas.height : (window.PSApp ? window.PSApp.height : 600);
        const layer = this.createLayerObject(name, w, h);

        const scale = Math.min(w / img.width, h / img.height, 1);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const offsetX = Math.round((w - drawW) / 2);
        const offsetY = Math.round((h - drawH) / 2);

        layer.ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        this.layers.push(layer);
        this.activeLayerId = layer.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Import ${name}`);
        return layer;
    },

    duplicateActiveLayer() {
        const active = this.getActiveLayer();
        if (!active) return;

        if (active.isGroup) {
            const groupCopy = {
                id: 'group_' + Date.now() + '_' + (this.counter++),
                name: `${active.name} Copy`,
                isGroup: true,
                expanded: active.expanded !== false,
                visible: active.visible,
                locked: false,
                opacity: active.opacity,
                blendMode: active.blendMode,
                groupId: active.groupId,
                x: active.x,
                y: active.y
            };
            const idx = this.layers.findIndex(l => l.id === active.id);
            this.layers.splice(idx + 1, 0, groupCopy);

            // Duplicate child layers belonging to this group
            const childLayers = this.layers.filter(l => l.groupId === active.id && l.id !== groupCopy.id);
            let insertOffset = 1;
            childLayers.forEach(child => {
                if (child.isGroup) return;
                const childCopy = this.createLayerObject(`${child.name} Copy`, child.canvas.width, child.canvas.height);
                childCopy.ctx.drawImage(child.canvas, 0, 0);
                childCopy.opacity = child.opacity;
                childCopy.blendMode = child.blendMode;
                childCopy.x = child.x;
                childCopy.y = child.y;
                childCopy.locked = false;
                childCopy.groupId = groupCopy.id;
                childCopy.clipped = !!child.clipped;
                childCopy.alphaLocked = !!child.alphaLocked;
                childCopy.isTextLayer = !!child.isTextLayer;
                childCopy.textContent = child.textContent || null;
                childCopy.fontSize = child.fontSize || null;
                childCopy.fontFamily = child.fontFamily || null;
                childCopy.isBold = !!child.isBold;
                childCopy.isItalic = !!child.isItalic;
                if (child.hasMask && child.maskCanvas) {
                    childCopy.hasMask = true;
                    childCopy.maskDisabled = !!child.maskDisabled;
                    childCopy.editingTarget = child.editingTarget || 'layer';
                    childCopy.maskCanvas = document.createElement('canvas');
                    childCopy.maskCanvas.width = child.maskCanvas.width;
                    childCopy.maskCanvas.height = child.maskCanvas.height;
                    childCopy.maskCtx = childCopy.maskCanvas.getContext('2d', { willReadFrequently: true });
                    childCopy.maskCtx.drawImage(child.maskCanvas, 0, 0);
                }
                insertOffset++;
                this.layers.splice(idx + insertOffset, 0, childCopy);
            });

            this.activeLayerId = groupCopy.id;
            this.renderLayersList();
            this.compositeAll();
            window.PSStorage.markDirty();
            window.PSHistory.saveState(`Duplicate Group (${active.name})`);
            return;
        }

        const copy = this.createLayerObject(`${active.name} Copy`, active.canvas.width, active.canvas.height);
        copy.ctx.drawImage(active.canvas, 0, 0);
        copy.opacity = active.opacity;
        copy.blendMode = active.blendMode;
        copy.x = active.x;
        copy.y = active.y;
        copy.locked = false;
        copy.groupId = active.groupId;
        copy.clipped = !!active.clipped;
        copy.alphaLocked = !!active.alphaLocked;
        copy.isTextLayer = !!active.isTextLayer;
        copy.textContent = active.textContent || null;
        copy.fontSize = active.fontSize || null;
        copy.fontFamily = active.fontFamily || null;
        copy.isBold = !!active.isBold;
        copy.isItalic = !!active.isItalic;

        if (active.hasMask && active.maskCanvas) {
            copy.hasMask = true;
            copy.maskDisabled = !!active.maskDisabled;
            copy.editingTarget = active.editingTarget || 'layer';
            copy.maskCanvas = document.createElement('canvas');
            copy.maskCanvas.width = active.maskCanvas.width;
            copy.maskCanvas.height = active.maskCanvas.height;
            copy.maskCtx = copy.maskCanvas.getContext('2d', { willReadFrequently: true });
            copy.maskCtx.drawImage(active.maskCanvas, 0, 0);
        }

        const idx = this.layers.findIndex(l => l.id === active.id);
        this.layers.splice(idx + 1, 0, copy);
        this.activeLayerId = copy.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Duplicate Layer (${active.name})`);
    },

    deleteActiveLayer() {
        if (this.layers.length <= 1) {
            this.clearActiveLayer();
            return;
        }
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx === -1) return;

        const deletedLayer = this.layers[idx];
        const deletedName = deletedLayer.name;

        if (deletedLayer.isGroup) {
            this.layers.forEach(l => {
                if (l.groupId === deletedLayer.id) {
                    l.groupId = deletedLayer.groupId || null;
                }
            });
        }

        this.layers.splice(idx, 1);
        const nextIdx = Math.max(0, idx - 1);
        this.activeLayerId = this.layers[nextIdx].id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Delete Layer (${deletedName})`);
    },

    clearActiveLayer() {
        const drawable = this.getActiveDrawable();
        if (!drawable || drawable.locked) return;

        if (window.PSSelection && window.PSSelection.isActive) {
            window.PSSelection.clearSelectionPixels(drawable);
        } else {
            drawable.ctx.clearRect(0, 0, drawable.canvas.width, drawable.canvas.height);
        }

        this.compositeAll();
        this.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Clear Layer');
    },

    fillActiveLayer(color) {
        const drawable = this.getActiveDrawable();
        if (!drawable || drawable.locked) return;

        if (window.PSSelection && window.PSSelection.isActive) {
            window.PSSelection.fillSelectionPixels(drawable, color);
        } else {
            drawable.ctx.fillStyle = color;
            drawable.ctx.fillRect(0, 0, drawable.canvas.width, drawable.canvas.height);
        }

        this.compositeAll();
        this.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Fill Layer');
    },

    toggleLock(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.locked = !layer.locked;
            this.renderLayersList();
        }
    },

    moveActiveLayerOrder(direction) {
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx === -1) return;

        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= this.layers.length) return;

        const temp = this.layers[idx];
        this.layers[idx] = this.layers[targetIdx];
        this.layers[targetIdx] = temp;

        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Reorder Layer');
    },

    mergeDown() {
        const idx = this.layers.findIndex(l => l.id === this.activeLayerId);
        if (idx <= 0) return;

        const topLayer = this.layers[idx];
        const bottomLayer = this.layers[idx - 1];
        if (topLayer.isGroup || bottomLayer.isGroup) {
            console.warn('Cannot merge groups. Ungroup first.');
            return;
        }
        if (bottomLayer.locked) return;

        const topCanvas = this.getRenderableCanvas(topLayer);
        bottomLayer.ctx.save();
        bottomLayer.ctx.globalAlpha = topLayer.opacity / 100;
        bottomLayer.ctx.globalCompositeOperation = topLayer.blendMode;
        bottomLayer.ctx.drawImage(topCanvas, topLayer.x - bottomLayer.x, topLayer.y - bottomLayer.y);
        bottomLayer.ctx.restore();

        this.layers.splice(idx, 1);
        this.activeLayerId = bottomLayer.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Merge Down');
    },

    flattenImage() {
        if (this.layers.length <= 1 && !this.layers[0]?.isGroup) return;

        const w = window.PSApp.width;
        const h = window.PSApp.height;
        const flattened = this.createLayerObject('Background', w, h);

        flattened.ctx.fillStyle = '#ffffff';
        flattened.ctx.fillRect(0, 0, w, h);

        this.compositeAll();
        const mainCanvas = document.getElementById('main-canvas');
        if (mainCanvas) {
            flattened.ctx.drawImage(mainCanvas, 0, 0);
        }

        this.layers = [flattened];
        this.activeLayerId = flattened.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState('Flatten Image');
    },

    flipActiveLayer(horizontal = true) {
        const layer = this.getActiveLayer();
        if (!layer || layer.locked || layer.isGroup) return;

        const flipCanvas = (canvas, ctx) => {
            const w = canvas.width;
            const h = canvas.height;
            const temp = document.createElement('canvas');
            temp.width = w;
            temp.height = h;
            temp.getContext('2d').drawImage(canvas, 0, 0);

            ctx.clearRect(0, 0, w, h);
            ctx.save();
            if (horizontal) {
                ctx.translate(w, 0);
                ctx.scale(-1, 1);
            } else {
                ctx.translate(0, h);
                ctx.scale(1, -1);
            }
            ctx.drawImage(temp, 0, 0);
            ctx.restore();
        };

        flipCanvas(layer.canvas, layer.ctx);

        if (layer.hasMask && layer.maskCanvas && layer.maskCtx) {
            flipCanvas(layer.maskCanvas, layer.maskCtx);
        }

        this.compositeAll();
        this.renderLayersList();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(horizontal ? 'Flip Horizontal' : 'Flip Vertical');
    },

    // --- Layer Mask Operations ---
    addMaskToActiveLayer() {
        const active = this.getActiveLayer();
        if (!active || active.isGroup) return null;
        if (active.hasMask && active.maskCanvas) return active.maskCanvas;

        const mc = document.createElement('canvas');
        mc.width = active.canvas.width;
        mc.height = active.canvas.height;
        const mCtx = mc.getContext('2d', { willReadFrequently: true });
        // Solid white = fully revealed
        mCtx.fillStyle = '#ffffff';
        mCtx.fillRect(0, 0, mc.width, mc.height);

        active.hasMask = true;
        active.maskCanvas = mc;
        active.maskCtx = mCtx;
        active.maskDisabled = false;
        active.editingTarget = 'mask';

        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Add Layer Mask (${active.name})`);
        return mc;
    },

    removeMask(layerId = null, apply = false) {
        const layer = this.layers.find(l => l.id === (layerId || this.activeLayerId));
        if (!layer || !layer.hasMask || !layer.maskCanvas) return;

        if (apply && !layer.maskDisabled) {
            this.applyMaskToCanvas(layer.canvas, layer.maskCanvas);
        }

        layer.hasMask = false;
        layer.maskCanvas = null;
        layer.maskCtx = null;
        layer.maskDisabled = false;
        layer.editingTarget = 'layer';

        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(apply ? `Apply Mask (${layer.name})` : `Delete Mask (${layer.name})`);
    },

    toggleMaskDisabled(layerId = null) {
        const layer = this.layers.find(l => l.id === (layerId || this.activeLayerId));
        if (!layer || !layer.hasMask) return;
        layer.maskDisabled = !layer.maskDisabled;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
    },

    setEditingTarget(target, layerId = null) {
        const layer = this.layers.find(l => l.id === (layerId || this.activeLayerId));
        if (!layer) return;
        layer.editingTarget = target;
        this.renderLayersList();
    },

    applyMaskToCanvas(destCanvas, maskCanvas) {
        const w = destCanvas.width;
        const h = destCanvas.height;
        const dCtx = destCanvas.getContext('2d', { willReadFrequently: true });
        const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
        const dImg = dCtx.getImageData(0, 0, w, h);
        const mImg = mCtx.getImageData(0, 0, w, h);
        const dd = dImg.data;
        const md = mImg.data;

        for (let i = 0; i < dd.length; i += 4) {
            // Mask luminance (0 black = transparent, 255 white = opaque)
            const lum = (md[i] * 299 + md[i + 1] * 587 + md[i + 2] * 114) / 1000;
            const maskAlpha = (md[i + 3] / 255) * (lum / 255);
            dd[i + 3] = Math.round(dd[i + 3] * maskAlpha);
        }
        dCtx.putImageData(dImg, 0, 0);
    },

    // --- Layer Group Operations ---
    createGroup(name = 'Group') {
        const group = {
            id: 'group_' + Date.now() + '_' + (this.counter++),
            name: name || `Group ${this.counter}`,
            isGroup: true,
            expanded: true,
            visible: true,
            locked: false,
            opacity: 100,
            blendMode: 'source-over',
            groupId: null,
            x: 0,
            y: 0
        };

        const active = this.getActiveLayer();
        let insertIdx = this.layers.length;
        if (active) {
            insertIdx = this.layers.findIndex(l => l.id === active.id) + 1;
            active.groupId = group.id;
        }

        this.layers.splice(insertIdx, 0, group);
        this.activeLayerId = group.id;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`New Group (${group.name})`);
        return group;
    },

    toggleGroupExpand(groupId) {
        const group = this.layers.find(l => l.id === groupId && l.isGroup);
        if (group) {
            group.expanded = !group.expanded;
            this.renderLayersList();
        }
    },

    ungroup(groupId) {
        const idx = this.layers.findIndex(l => l.id === groupId && l.isGroup);
        if (idx === -1) return;
        const group = this.layers[idx];
        this.layers.forEach(l => {
            if (l.groupId === group.id) {
                l.groupId = group.groupId || null;
            }
        });
        this.layers.splice(idx, 1);
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(`Ungroup (${group.name})`);
    },

    // --- Clipping Mask & Alpha Lock ---
    toggleClippingMask(layerId = null) {
        const layer = this.layers.find(l => l.id === (layerId || this.activeLayerId));
        if (!layer || layer.isGroup) return;
        layer.clipped = !layer.clipped;
        this.renderLayersList();
        this.compositeAll();
        window.PSStorage.markDirty();
        window.PSHistory.saveState(layer.clipped ? `Create Clipping Mask (${layer.name})` : `Release Clipping Mask (${layer.name})`);
    },

    toggleAlphaLock(layerId = null) {
        const layer = this.layers.find(l => l.id === (layerId || this.activeLayerId));
        if (!layer || layer.isGroup) return;
        layer.alphaLocked = !layer.alphaLocked;
        this.renderLayersList();
        window.PSStorage.markDirty();
    },

    getRenderableCanvas(layer, previewFilterFn = null) {
        let srcCanvas = layer.canvas;
        if (previewFilterFn && layer.id === this.activeLayerId) {
            srcCanvas = previewFilterFn(layer.canvas);
        }

        if (!layer.hasMask || !layer.maskCanvas || layer.maskDisabled) {
            return srcCanvas;
        }

        const temp = document.createElement('canvas');
        temp.width = layer.canvas.width;
        temp.height = layer.canvas.height;
        const tCtx = temp.getContext('2d', { willReadFrequently: true });
        tCtx.drawImage(srcCanvas, 0, 0);
        this.applyMaskToCanvas(temp, layer.maskCanvas);
        return temp;
    },

    compositeAll(previewFilterFn = null) {
        const mainCanvas = document.getElementById('main-canvas');
        if (!mainCanvas) return;
        const mainCtx = mainCanvas.getContext('2d');
        mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

        // Map groups for fast parent lookup
        const groupMap = {};
        this.layers.forEach(l => {
            if (l.isGroup) groupMap[l.id] = l;
        });

        // Track base layer for clipping chains
        let lastNonClippedLayer = null;

        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (layer.isGroup) continue;

            // Check group hierarchy visibility & opacity
            let isParentVisible = true;
            let groupOpacityMultiplier = 1;
            let currentGroupId = layer.groupId;
            while (currentGroupId && groupMap[currentGroupId]) {
                const grp = groupMap[currentGroupId];
                if (!grp.visible) {
                    isParentVisible = false;
                    break;
                }
                groupOpacityMultiplier *= (grp.opacity / 100);
                currentGroupId = grp.groupId;
            }

            if (!layer.visible || !isParentVisible) continue;

            const effectiveOpacity = (layer.opacity / 100) * groupOpacityMultiplier;
            const renderCanvas = this.getRenderableCanvas(layer, previewFilterFn);

            mainCtx.save();
            mainCtx.globalAlpha = window.PSUtils.clamp(effectiveOpacity, 0, 1);
            mainCtx.globalCompositeOperation = layer.blendMode;

            if (layer.clipped && lastNonClippedLayer) {
                // Clipped layer: mask by base layer's alpha
                const clipBuffer = document.createElement('canvas');
                clipBuffer.width = layer.canvas.width;
                clipBuffer.height = layer.canvas.height;
                const cCtx = clipBuffer.getContext('2d');
                cCtx.drawImage(renderCanvas, 0, 0);
                cCtx.globalCompositeOperation = 'destination-in';
                const baseRenderable = this.getRenderableCanvas(lastNonClippedLayer);
                cCtx.drawImage(baseRenderable, lastNonClippedLayer.x - layer.x, lastNonClippedLayer.y - layer.y);
                mainCtx.drawImage(clipBuffer, layer.x, layer.y);
            } else {
                mainCtx.drawImage(renderCanvas, layer.x, layer.y);
                if (!layer.clipped) {
                    lastNonClippedLayer = layer;
                }
            }

            mainCtx.restore();
        }
    },

    renderLayersList() {
        const listEl = document.getElementById('layers-list');
        const countBadge = document.getElementById('layer-count-badge');
        const blendSelect = document.getElementById('layer-blend-mode');
        const opacityInput = document.getElementById('layer-opacity-input');

        if (!listEl) return;
        listEl.innerHTML = '';
        if (countBadge) countBadge.textContent = this.layers.length;

        const active = this.getActiveLayer();
        if (active) {
            if (blendSelect) blendSelect.value = active.blendMode;
            if (opacityInput) opacityInput.value = active.opacity;
        }

        // Build group map to check collapsed parents
        const groupMap = {};
        this.layers.forEach(l => {
            if (l.isGroup) groupMap[l.id] = l;
        });

        // Render from top of stack downwards in the UI
        [...this.layers].reverse().forEach(layer => {
            // Check if hidden due to collapsed ancestor group
            let isInsideCollapsedGroup = false;
            let currentGroupId = layer.groupId;
            while (currentGroupId && groupMap[currentGroupId]) {
                if (!groupMap[currentGroupId].expanded) {
                    isInsideCollapsedGroup = true;
                    break;
                }
                currentGroupId = groupMap[currentGroupId].groupId;
            }

            if (isInsideCollapsedGroup) return; // collapsed from view

            const isItemActive = layer.id === this.activeLayerId;
            const item = document.createElement('div');
            item.className = `layer-item ${isItemActive ? 'active' : ''} ${layer.locked ? 'locked' : ''} ${layer.isGroup ? 'group-item' : ''} ${layer.groupId ? 'group-child' : ''} ${layer.clipped ? 'clipped-item' : ''}`;

            // Visibility Toggle Button
            const visBtn = document.createElement('button');
            visBtn.className = `layer-vis-btn ${layer.visible ? 'visible' : ''}`;
            visBtn.title = layer.visible ? 'Hide' : 'Show';
            visBtn.innerHTML = window.PSIcons.get(layer.visible ? 'eye' : 'eye-slash', '', 14, 14);
            visBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                layer.visible = !layer.visible;
                this.renderLayersList();
                this.compositeAll();
                window.PSStorage.markDirty();
            });
            item.appendChild(visBtn);

            if (layer.isGroup) {
                // Group Expand / Collapse Chevron
                const expBtn = document.createElement('button');
                expBtn.className = 'layer-group-exp-btn';
                expBtn.innerHTML = window.PSIcons.get(layer.expanded ? 'chevron-down' : 'chevron-right', '', 12, 12);
                expBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleGroupExpand(layer.id);
                });
                item.appendChild(expBtn);

                // Folder Icon
                const folderIcon = document.createElement('span');
                folderIcon.className = 'layer-folder-icon';
                folderIcon.innerHTML = window.PSIcons.get('folder', '', 14, 14);
                item.appendChild(folderIcon);

                // Group Info
                const info = document.createElement('div');
                info.className = 'layer-info';
                info.innerHTML = `
                    <span class="layer-name" title="Double click to rename">${layer.name}</span>
                    <span class="layer-meta">${layer.opacity}% • Folder</span>
                `;
                item.appendChild(info);

                // Delete Group Button
                const delBtn = document.createElement('button');
                delBtn.className = 'layer-quick-del-btn';
                delBtn.title = 'Ungroup / Delete Folder';
                delBtn.innerHTML = window.PSIcons.get('xmark', '', 12, 12);
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.ungroup(layer.id);
                });
                item.appendChild(delBtn);
            } else {
                // Regular Layer: Clipping Indicator
                if (layer.clipped) {
                    const clipIcon = document.createElement('span');
                    clipIcon.className = 'layer-clip-indicator';
                    clipIcon.title = 'Clipped to layer below';
                    clipIcon.innerHTML = window.PSIcons.get('clip-arrow', '', 12, 12);
                    item.appendChild(clipIcon);
                }

                // Alpha Lock Toggle Button
                const alphaBtn = document.createElement('button');
                alphaBtn.className = `layer-alpha-btn ${layer.alphaLocked ? 'locked' : ''}`;
                alphaBtn.title = layer.alphaLocked ? 'Unlock Transparent Pixels' : 'Lock Transparent Pixels';
                alphaBtn.innerHTML = window.PSIcons.get('lock-alpha', '', 12, 12);
                alphaBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleAlphaLock(layer.id);
                });
                item.appendChild(alphaBtn);

                // Lock Layer Button
                const lockBtn = document.createElement('button');
                lockBtn.className = `layer-lock-btn ${layer.locked ? 'locked' : ''}`;
                lockBtn.title = layer.locked ? 'Unlock Layer' : 'Lock Layer';
                lockBtn.innerHTML = window.PSIcons.get(layer.locked ? 'lock' : 'unlock', '', 12, 12);
                lockBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    layer.locked = !layer.locked;
                    this.renderLayersList();
                });
                item.appendChild(lockBtn);

                // Layer Main Thumbnail
                const thumb = document.createElement('canvas');
                thumb.className = `layer-thumb ${layer.editingTarget === 'layer' ? 'target-active' : ''}`;
                thumb.width = 40;
                thumb.height = 30;
                thumb.title = 'Edit Layer Pixels';
                const tCtx = thumb.getContext('2d');
                tCtx.drawImage(layer.canvas, 0, 0, 40, 30);
                thumb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.activeLayerId = layer.id;
                    this.setEditingTarget('layer', layer.id);
                });
                item.appendChild(thumb);

                // Layer Mask Thumbnail (if mask exists)
                if (layer.hasMask && layer.maskCanvas) {
                    const maskThumb = document.createElement('canvas');
                    maskThumb.className = `layer-thumb mask-thumb ${layer.editingTarget === 'mask' ? 'target-active' : ''} ${layer.maskDisabled ? 'disabled' : ''}`;
                    maskThumb.width = 40;
                    maskThumb.height = 30;
                    maskThumb.title = layer.maskDisabled ? 'Mask Disabled (Click to edit)' : 'Edit Layer Mask (Black hides, White reveals)';
                    const mtCtx = maskThumb.getContext('2d');
                    mtCtx.drawImage(layer.maskCanvas, 0, 0, 40, 30);
                    maskThumb.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.activeLayerId = layer.id;
                        this.setEditingTarget('mask', layer.id);
                    });
                    item.appendChild(maskThumb);
                }

                // Layer Info
                const info = document.createElement('div');
                info.className = 'layer-info';
                info.innerHTML = `
                    <span class="layer-name" title="Double click to rename">${layer.name}</span>
                    <span class="layer-meta">${layer.opacity}% • ${this.formatBlendMode(layer.blendMode)}${layer.hasMask ? ' [Mask]' : ''}</span>
                `;
                item.appendChild(info);
            }

            // Click item to select
            item.addEventListener('click', () => {
                this.activeLayerId = layer.id;
                this.renderLayersList();
            });

            // Double click to rename
            item.addEventListener('dblclick', () => {
                const newName = prompt('Rename:', layer.name);
                if (newName && newName.trim()) {
                    layer.name = newName.trim();
                    this.renderLayersList();
                    window.PSStorage.markDirty();
                    window.PSHistory.saveState(`Rename (${layer.name})`);
                }
            });

            listEl.appendChild(item);
        });
    },

    formatBlendMode(mode) {
        const names = {
            'source-over': 'Normal',
            'multiply': 'Multiply',
            'screen': 'Screen',
            'overlay': 'Overlay',
            'darken': 'Darken',
            'lighten': 'Lighten',
            'color-dodge': 'Color Dodge',
            'color-burn': 'Color Burn',
            'hard-light': 'Hard Light',
            'soft-light': 'Soft Light',
            'difference': 'Difference',
            'exclusion': 'Exclusion',
            'hue': 'Hue',
            'saturation': 'Saturation',
            'color': 'Color',
            'luminosity': 'Luminosity'
        };
        return names[mode] || mode;
    }
};
