/**
 * @fileoverview Utility functions for managing chart layout and plots.
 * @author Your Name
 */

/**
 * Manages the layout of multiple plots within a given canvas area.
 */
export class PlotLayoutManager {
    /**
     * @param {number} canvasWidth - The total width of the canvas.
     * @param {number} canvasHeight - The total height of the canvas.
     * @param {Array<object>} plotConfigs - An array of plot configurations, e.g., [{ id: 'main', heightRatio: 0.7 }, { id: 'volume', heightRatio: 0.3 }]
     */
    constructor(canvasWidth, canvasHeight, plotConfigs) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.plotConfigs = plotConfigs;
        this.plots = {};
        this.calculateLayout();
    }

    /**
     * Recalculates the layout of plots based on canvas dimensions and plot configurations.
     */
    calculateLayout() {
        let currentY = 0;
        const mainPlotConfig = this.plotConfigs.find(p => p.id === 'main');
        if (!mainPlotConfig) {
            console.error("Main plot configuration is missing.");
            return;
        }

        this.plotConfigs.forEach(config => {
            if (config.overlay) {
                this.plots[config.id] = { ...this.plots['main'] };
            } else {
                const plotHeight = this.canvasHeight * config.heightRatio;
                this.plots[config.id] = {
                    x: 0,
                    y: currentY,
                    width: this.canvasWidth,
                    height: plotHeight,
                };
                currentY += plotHeight;
            }
        });
    }

    /**
     * Gets the layout dimensions for a specific plot.
     * @param {string} plotId - The ID of the plot.
     * @returns {object|null} - An object with x, y, width, height, or null if not found.
     */
    getPlotLayout(plotId) {
        return this.plots[plotId] || null;
    }

    /**
     * Updates the canvas dimensions and recalculates the layout.
     * @param {number} newWidth - The new width of the canvas.
     * @param {number} newHeight - The new height of the canvas.
     */
    updateCanvasDimensions(newWidth, newHeight) {
        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;
        this.calculateLayout();
    }
}