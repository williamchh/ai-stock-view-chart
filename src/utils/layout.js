/**
 * @fileoverview Utility functions for managing chart layout and plots.
 * @author Your Name
 */

/**
 * Manages the layout of multiple plots within a given canvas area.
 */
export class PlotLayoutManager {

    /**
     * @type {number}
     * @private
     */
    plotTotalHeight;

    /**
     * @type {number}
     * @private
     */
    plotTotalWidth;

    // Define constants for margins
    /**
     * @type {number}
     * @readonly
     */
    RIGHT_Y_AXIS_MARGIN = 80; // Space for Y-axis labels on the right

    /**
     * @type {number}
     * @readonly
     */
    BOTTOM_X_AXIS_MARGIN = 40; // Space for X-axis labels at the bottom

    /**
     * @type {number}
     * @readonly
     */
    CHART_LEFT_MARGIN = 0; // Small left margin for the chart area

    /**
     * @type {number}
     * @readonly
     */
    CHART_TOP_MARGIN = 0; // Small top margin for the chart area

    /**
     * @param {number} canvasWidth - The total width of the canvas.
     * @param {number} canvasHeight - The total height of the canvas.
     * @param {Array<import("../stock-chart").PlotConfig>} plotConfigs - An array of plot configurations, e.g., [{ id: 'main', heightRatio: 0.7 }, { id: 'volume', heightRatio: 0.3 }]
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
     * @private
     */
    calculateLayout() {
        let currentY = 0;
        const nonOverlayPlots = this.plotConfigs.filter(p => !p.overlay);
        const totalRatio = nonOverlayPlots.reduce((sum, p) => sum + p.heightRatio, 0);

        this.plotConfigs.forEach(config => {
            if (config.overlay) {
                // An overlay plot should be drawn on top of a main plot.
                // Find the main plot's layout and assign it to the overlay plot.
                const mainPlotLayout = this.plots['main']; // Assuming 'main' is the ID of the main plot
                if (mainPlotLayout) {
                    this.plots[config.id] = { ...mainPlotLayout };
                }
            } else {


                // Calculate available drawing area for plots
                const availableWidth = this.canvasWidth - this.CHART_LEFT_MARGIN - this.RIGHT_Y_AXIS_MARGIN;
                const availableHeight = this.canvasHeight - this.CHART_TOP_MARGIN - this.BOTTOM_X_AXIS_MARGIN;

                const plotHeight = (config.heightRatio / totalRatio) * availableHeight;
                this.plots[config.id] = {
                    x: this.CHART_LEFT_MARGIN,
                    y: currentY + this.CHART_TOP_MARGIN,
                    width: availableWidth,
                    height: plotHeight,
                };
                currentY += plotHeight;
            }
        });

        this.plotTotalHeight = currentY;
        this.plotTotalWidth = this.canvasWidth - this.RIGHT_Y_AXIS_MARGIN; // Assuming 80px for the right Y-axis margin
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

    /**
     * Gets the total width of all plots.
     * @returns {number} - The total width of all plots.
     */
    getPlotTotalWidth() {
        return this.plotTotalWidth;
    }

    /**
     * Gets the total height of all plots.
     * @returns {number} - The total height of all plots.
     */
    getPlotTotalHeight() {
        return this.plotTotalHeight;
    }
}