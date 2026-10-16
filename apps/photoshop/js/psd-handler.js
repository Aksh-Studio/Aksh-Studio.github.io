/**
 * Aksh Photoshop - Bidirectional Adobe Photoshop (.psd) Binary Pipeline
 * Powered by local vendored ag-psd engine
 */

window.PSPsd = {
    blendModeMapToCanvas: {
        'normal': 'source-over',
        'multiply': 'multiply',
        'screen': 'screen',
        'overlay': 'overlay',
        'darken': 'darken',
        'lighten': 'lighten',
        'color dodge': 'color-dodge',
        'color burn': 'color-burn',
        'hard light': 'hard-light',
        'soft light': 'soft-light',
        'difference': 'difference',
        'exclusion': 'exclusion',
        'hue': 'hue',
        'saturation': 'saturation',
        'color': 'color',
        'luminosity': 'luminosity'
    },

    blendModeMapToPsd: {
        'source-over': 'normal',
        'multiply': 'multiply',
        'screen': 'screen',
        'overlay': 'overlay',
        'darken': 'darken',
        'lighten': 'lighten',
        'color-dodge': 'color dodge',
        'color-burn': 'color burn',
        'hard-light': 'hard light',
        'soft-light': 'soft light',
        'difference': 'difference',
        'exclusion': 'exclusion',
        'hue': 'hue',
        'saturation': 'saturation',
        'color': 'color',
        'luminosity': 'luminosity'
    },

    async openPsdFile(file) {
        if (!window.agPsd) {
            alert('PSD parser library is not loaded.');
            return false;
        }

        try {
            const buffer = await file.arrayBuffer();
            const psd = window.agPsd.readPsd(buffer, {
                skipThumbnail: true,
                skipCompositeImageData: false
            });

            if (!psd || !psd.width || !psd.height) {
                throw new Error('Invalid or unreadable PSD format.');
            }

            const docW = psd.width;
            const docH = psd.height;

            window.PSApp.setCanvasDimensions(docW, docH, false);
            window.PSHistory.init();
            window.PSLayers.layers = [];

            const allPsdLayers = [];
            const collectLayers = (nodes, parentHidden = false) => {
                nodes.forEach(node => {
                    const isHidden = parentHidden || !!node.hidden;
                    if (node.children && node.children.length > 0) {
                        collectLayers(node.children, isHidden);
                    } else if (node.canvas) {
                        allPsdLayers.push({
                            ...node,
                            hidden: isHidden
                        });
                    }
                });
            };

            if (psd.children && psd.children.length > 0) {
                collectLayers(psd.children);
                if (allPsdLayers.length > 0) {
                    allPsdLayers.forEach((child, index) => {
                        const layerCanvas = document.createElement('canvas');
                        layerCanvas.width = docW;
                        layerCanvas.height = docH;
                        const ctx = layerCanvas.getContext('2d', { willReadFrequently: true });

                        if (child.canvas) {
                            const left = child.left !== undefined ? child.left : 0;
                            const top = child.top !== undefined ? child.top : 0;
                            ctx.drawImage(child.canvas, left, top);
                        }

                        const canvasBlend = this.blendModeMapToCanvas[child.blendMode] || 'source-over';
                        const opacity = child.opacity !== undefined ? Math.round(child.opacity * 100) : 100;

                        window.PSLayers.layers.push({
                            id: window.PSUtils.generateId('psd_layer'),
                            name: child.name || `Layer ${index + 1}`,
                            canvas: layerCanvas,
                            ctx: ctx,
                            visible: !child.hidden,
                            locked: false,
                            opacity: opacity,
                            blendMode: canvasBlend,
                            x: 0,
                            y: 0,
                            hasMask: false,
                            maskCanvas: null,
                            maskCtx: null,
                            maskDisabled: false,
                            editingTarget: 'layer',
                            isGroup: false,
                            groupId: null,
                            expanded: true,
                            clipped: false,
                            alphaLocked: false
                        });
                    });
                }
            } else if (psd.canvas) {
                // Composite image fallback if no distinct layers
                const baseLayer = window.PSLayers.createLayerObject('Background', docW, docH);
                baseLayer.ctx.drawImage(psd.canvas, 0, 0);
                window.PSLayers.layers.push(baseLayer);
            }

            if (window.PSLayers.layers.length === 0) {
                window.PSLayers.init(docW, docH, 'white');
            }

            window.PSLayers.activeLayerId = window.PSLayers.layers[window.PSLayers.layers.length - 1].id;
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSStorage.markDirty();
            window.PSHistory.saveState(`Open PSD (${file.name})`);
            window.PSApp.fitToScreen();

            // Synchronize active document tab
            if (window.PSApp && window.PSApp.activeDocId) {
                const currentDoc = window.PSApp.documents.find(d => d.id === window.PSApp.activeDocId);
                if (currentDoc) {
                    currentDoc.title = file.name.replace(/\.[^/.]+$/, '');
                    currentDoc.width = docW;
                    currentDoc.height = docH;
                    currentDoc.layers = window.PSLayers.layers;
                    currentDoc.activeLayerId = window.PSLayers.activeLayerId;
                    currentDoc.historyStack = window.PSHistory.stack;
                    currentDoc.historyIndex = window.PSHistory.currentIndex;
                    window.PSApp.renderDocumentTabs();
                }
            }

            return true;
        } catch (err) {
            console.error('[PSPsd] Failed to parse PSD:', err);
            alert(`Unable to open PSD file: ${err.message}`);
            return false;
        }
    },

    exportPsdFile(filename = 'aksh-project.psd') {
        if (!window.agPsd) {
            alert('PSD serialization library is not loaded.');
            return;
        }

        try {
            const mainCanvas = document.getElementById('main-canvas');
            const docW = window.PSApp.width;
            const docH = window.PSApp.height;

            const children = window.PSLayers.layers
                .filter(layer => !layer.isGroup && layer.canvas)
                .map(layer => {
                    const psdBlend = this.blendModeMapToPsd[layer.blendMode] || 'normal';
                    const renderableCanvas = window.PSLayers.getRenderableCanvas(layer);
                    return {
                        name: layer.name,
                        canvas: renderableCanvas,
                        left: layer.x,
                        top: layer.y,
                        opacity: layer.opacity / 100,
                        blendMode: psdBlend,
                        hidden: !layer.visible
                    };
                });

            const psdDoc = {
                width: docW,
                height: docH,
                canvas: mainCanvas,
                children: children
            };

            const buffer = window.agPsd.writePsd(psdDoc);
            const blob = new Blob([buffer], { type: 'image/vnd.adobe.photoshop' });
            window.PSUtils.downloadBlob(blob, filename);
        } catch (err) {
            console.error('[PSPsd] Export PSD error:', err);
            alert(`PSD Export failed: ${err.message}`);
        }
    }
};
