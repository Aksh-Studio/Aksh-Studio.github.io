/**
 * history.js — Snapshot-based undo/redo history manager
 * Aksh Photoshop
 */
'use strict';

class HistoryManager {
  /**
   * @param {AkshPhotoshop} app
   */
  constructor(app) {
    this.app      = app;
    this.stack    = [];   // Array of snapshot entries
    this.cursor   = -1;   // Current position in stack
    this.maxDepth = 50;   // Maximum undo steps
    this.listEl   = $('history-list');
  }

  /**
   * Capture the current state of every layer and push to stack.
   * Drops any "future" states beyond the current cursor position.
   * @param {string} label  Human-readable label for the history list
   */
  snapshot(label = 'Edit') {
    // Discard redo states
    this.stack = this.stack.slice(0, this.cursor + 1);

    const entry = {
      label,
      layers: this.app.layerManager.layers.map(l => ({
        name:      l.name,
        visible:   l.visible,
        opacity:   l.opacity,
        blendMode: l.blendMode,
        imageData: l.ctx.getImageData(0, 0, this.app.canvasWidth, this.app.canvasHeight)
      })),
      activeIndex:  this.app.layerManager.activeIndex,
      canvasWidth:  this.app.canvasWidth,
      canvasHeight: this.app.canvasHeight
    };

    this.stack.push(entry);

    // Enforce max depth by dropping the oldest entry
    if (this.stack.length > this.maxDepth) {
      this.stack.shift();
    }

    this.cursor = this.stack.length - 1;
    this.render();
  }

  /**
   * Step back one state in the history stack.
   * @returns {boolean}  true if undo was possible
   */
  undo() {
    if (this.cursor <= 0) return false;
    this.cursor--;
    this._restore(this.stack[this.cursor]);
    this.render();
    return true;
  }

  /**
   * Step forward one state in the history stack.
   * @returns {boolean}  true if redo was possible
   */
  redo() {
    if (this.cursor >= this.stack.length - 1) return false;
    this.cursor++;
    this._restore(this.stack[this.cursor]);
    this.render();
    return true;
  }

  /**
   * Jump to an arbitrary history entry by index.
   * @param {number} index
   */
  jumpTo(index) {
    if (index < 0 || index >= this.stack.length) return;
    this.cursor = index;
    this._restore(this.stack[index]);
    this.render();
  }

  /**
   * Restore application state from a snapshot entry.
   * @private
   * @param {Object} entry
   */
  _restore(entry) {
    const lm = this.app.layerManager;
    lm.layers = entry.layers.map(snap => {
      const c   = createOffscreenCanvas(entry.canvasWidth, entry.canvasHeight);
      const ctx = c.getContext('2d');
      ctx.putImageData(snap.imageData, 0, 0);
      return {
        canvas:    c,
        ctx,
        name:      snap.name,
        visible:   snap.visible,
        opacity:   snap.opacity,
        blendMode: snap.blendMode
      };
    });
    lm.activeIndex = clamp(entry.activeIndex, 0, lm.layers.length - 1);
    lm.renderLayersPanel();
    this.app.composite();
  }

  /**
   * Re-render the history panel list UI.
   */
  render() {
    this.listEl.innerHTML = '';
    this.stack.forEach((entry, i) => {
      const li = document.createElement('li');
      li.className = 'history-item' +
        (i === this.cursor ? ' current' : '') +
        (i > this.cursor  ? ' future'  : '');
      li.innerHTML = `<span class="history-icon">📋</span>${entry.label}`;
      li.addEventListener('click', () => this.jumpTo(i));
      this.listEl.appendChild(li);
    });

    // Scroll current item into view
    const items = this.listEl.querySelectorAll('.history-item');
    if (items[this.cursor]) {
      items[this.cursor].scrollIntoView({ block: 'nearest' });
    }
  }
}
