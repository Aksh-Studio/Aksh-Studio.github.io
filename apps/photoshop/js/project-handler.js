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
                    width: layer.canvas.width,
                    height: layer.canvas.height,
                    dataUrl: layer.canvas.toDataURL('image/png')
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
                const canvas = document.createElement('canvas');
                canvas.width = item.width || project.width;
                canvas.height = item.height || project.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

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
                    y: item.y || 0
                });
            }

            window.PSLayers.activeLayerId = project.activeLayerId || window.PSLayers.layers[0]?.id;
            window.PSLayers.compositeAll();
            window.PSLayers.renderLayersList();
            window.PSStorage.markClean();
            window.PSHistory.saveState(`Open Project (${file.name})`);
            window.PSApp.fitToScreen();
            return true;
        } catch (err) {
            console.error('[PSProject] Failed to open project:', err);
            alert(`Failed to open project: ${err.message}`);
            return false;
        }
    }
};
