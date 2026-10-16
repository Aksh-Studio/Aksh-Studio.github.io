/**
 * Aksh Photoshop - Native Layered Project Format (.akshphoto)
 * Preserves 100% layer fidelity, blend modes, opacities, and positions
 */

window.PSProject = {
    async exportProject(filename = 'aksh-project.akshphoto') {
        if (!window.PSLayers || window.PSLayers.layers.length === 0) return;

        try {
            const projectData = {
                app: 'Aksh Photoshop',
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                width: window.PSApp.width,
                height: window.PSApp.height,
                activeLayerId: window.PSLayers.activeLayerId,
                layers: window.PSLayers.layers.map(layer => ({
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    locked: !!layer.locked,
                    opacity: layer.opacity,
                    blendMode: layer.blendMode,
                    x: layer.x,
                    y: layer.y,
                    width: layer.canvas ? layer.canvas.width : (window.PSApp ? window.PSApp.width : 0),
                    height: layer.canvas ? layer.canvas.height : (window.PSApp ? window.PSApp.height : 0),
                    dataUrl: layer.canvas ? layer.canvas.toDataURL('image/png') : null,
                    hasMask: !!layer.hasMask,
                    maskDataUrl: (layer.hasMask && layer.maskCanvas) ? layer.maskCanvas.toDataURL('image/png') : null,
                    maskDisabled: !!layer.maskDisabled,
                    editingTarget: layer.editingTarget || 'layer',
                    isGroup: !!layer.isGroup,
                    groupId: layer.groupId || null,
                    expanded: layer.expanded !== false,
                    clipped: !!layer.clipped,
                    alphaLocked: !!layer.alphaLocked,
                    isTextLayer: !!layer.isTextLayer,
                    textContent: layer.textContent || null,
                    fontSize: layer.fontSize || null,
                    fontFamily: layer.fontFamily || null,
                    isBold: !!layer.isBold,
                    isItalic: !!layer.isItalic
                }))
            };

            const jsonStr = JSON.stringify(projectData);
            window.PSUtils.downloadText(jsonStr, filename, 'application/json');
            window.PSStorage.markClean();
        } catch (err) {
            console.error('[PSProject] Export failed:', err);
            alert(`Project export failed: ${err.message}`);
        }
    },

    async openProject(file) {
        try {
            const text = await file.text();
            const project = JSON.parse(text);

            if (!project.width || !project.height || !Array.isArray(project.layers)) {
                throw new Error('Invalid .akshphoto project format.');
            }

            window.PSApp.setCanvasDimensions(project.width, project.height, false);
            window.PSHistory.init();
            window.PSLayers.layers = [];

            for (const item of project.layers) {
                let canvas = null;
                let ctx = null;

                if (!item.isGroup) {
                    canvas = document.createElement('canvas');
                    canvas.width = item.width || project.width;
                    canvas.height = item.height || project.height;
                    ctx = canvas.getContext('2d', { willReadFrequently: true });

                    if (item.dataUrl) {
                        await new Promise((resolve) => {
                            const img = new Image();
                            img.onload = () => {
                                ctx.drawImage(img, 0, 0);
                                resolve();
                            };
                            img.onerror = () => resolve();
                            img.src = item.dataUrl;
                        });
                    }
                }

                let maskCanvas = null;
                let maskCtx = null;
                if (item.hasMask && item.maskDataUrl) {
                    maskCanvas = document.createElement('canvas');
                    maskCanvas.width = canvas.width;
                    maskCanvas.height = canvas.height;
                    maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
                    await new Promise((resolve) => {
                        const mImg = new Image();
                        mImg.onload = () => {
                            maskCtx.drawImage(mImg, 0, 0);
                            resolve();
                        };
                        mImg.onerror = () => resolve();
                        mImg.src = item.maskDataUrl;
                    });
                }

                window.PSLayers.layers.push({
                    id: item.id || window.PSUtils.generateId('layer'),
                    name: item.name || 'Layer',
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
                    isGroup: !!item.isGroup,
                    groupId: item.groupId || null,
                    expanded: item.expanded !== false,
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

            window.PSLayers.activeLayerId = project.activeLayerId || window.PSLayers.layers[0]?.id;
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSStorage.markClean();
            window.PSHistory.saveState(`Open Project (${file.name})`);
            window.PSApp.fitToScreen();

            // Synchronize active document tab
            if (window.PSApp && window.PSApp.activeDocId) {
                const currentDoc = window.PSApp.documents.find(d => d.id === window.PSApp.activeDocId);
                if (currentDoc) {
                    currentDoc.title = file.name.replace(/\.[^/.]+$/, '');
                    currentDoc.width = project.width;
                    currentDoc.height = project.height;
                    currentDoc.layers = window.PSLayers.layers;
                    currentDoc.activeLayerId = window.PSLayers.activeLayerId;
                    currentDoc.historyStack = window.PSHistory.stack;
                    currentDoc.historyIndex = window.PSHistory.currentIndex;
                    window.PSApp.renderDocumentTabs();
                }
            }

            return true;
        } catch (err) {
            console.error('[PSProject] Failed to open project:', err);
            alert(`Failed to open project: ${err.message}`);
            return false;
        }
    }
};
