/**
 * @fileoverview Utility functions for data manipulation and scaling.
 * @author Your Name
 */

/**
 * Manages the visible data window for horizontal scrolling.
 */
export class DataViewport {
    /**
     * @param {Array<object>} allData - The complete dataset.
     * @param {number} initialVisibleCount - The initial number of data points visible.
     */
    constructor(allData, initialVisibleCount) {
        this.allData = allData;
        this.visibleCount = initialVisibleCount;
        this.startIndex = Math.max(0, allData.length - initialVisibleCount);
    }

    /**
     * Gets the currently visible data points.
     * @returns {Array<object>} An array of data points within the current viewport.
     */
    getVisibleData() {
        return this.allData.slice(this.startIndex, this.startIndex + this.visibleCount);
    }

    /**
     * Scrolls the viewport horizontally.
     * @param {number} delta - The number of data points to scroll. Positive scrolls right (newer data), negative scrolls left (older data).
     */
    scroll(delta) {
        this.startIndex = Math.max(0, Math.min(this.allData.length - this.visibleCount, this.startIndex + delta));
    }

    /**
     * Zooms the viewport in or out by adjusting the number of visible data points.
     * @param {number} zoomFactor - A multiplier for zooming. >1 for zoom in (fewer visible), <1 for zoom out (more visible).
     * @param {number} anchorIndex - The index within the *visible* data to anchor the zoom around.
     */
    zoom(zoomFactor, anchorIndex) {
        const currentVisibleData = this.getVisibleData();
        const absoluteAnchorIndex = this.startIndex + anchorIndex;

        const newVisibleCount = Math.max(10, Math.min(this.allData.length, Math.round(this.visibleCount / zoomFactor)));

        // Calculate new start index to keep anchor point relatively stable
        const ratio = anchorIndex / currentVisibleData.length;
        const newStartIndex = Math.round(absoluteAnchorIndex - (newVisibleCount * ratio));

        this.visibleCount = newVisibleCount;
        this.startIndex = Math.max(0, Math.min(this.allData.length - this.visibleCount, newStartIndex));
    }

    /**
     * Updates the total dataset.
     * @param {Array<object>} newData - The new complete dataset.
     */
    updateData(newData) {
        this.allData = newData;
        this.startIndex = Math.max(0, this.allData.length - this.visibleCount); // Adjust start index if data shrinks
    }
}

/**
 * Calculates the pixel position for a given data index within a plot.
 * @param {number} index - The data index.
 * @param {number} startIndex - The start index of the visible data.
 * @param {number} visibleCount - The number of visible data points.
 * @param {number} plotWidth - The width of the plot area in pixels.
 * @param {number} barWidth - The calculated width of each bar/candle.
 * @returns {number} The x-coordinate on the canvas.
 */
export function getXPixel(index, startIndex, visibleCount, plotWidth, barWidth) {
    const dataIndexInView = index - startIndex;
    return (dataIndexInView * barWidth) + (plotWidth / 2) - (visibleCount * barWidth / 2);
}

/**
 * Calculates the pixel position for a given price value within a plot's y-axis.
 * @param {number} price - The price value.
 * @param {number} minPrice - The minimum price in the visible range.
 * @param {number} maxPrice - The maximum price in the visible range.
 * @param {number} plotHeight - The height of the plot area in pixels.
 * @param {number} plotY - The y-coordinate of the top of the plot area.
 * @returns {number} The y-coordinate on the canvas.
 */
export function getYPixel(price, minPrice, maxPrice, plotHeight, plotY) {
    const priceRange = maxPrice - minPrice;
    if (priceRange === 0) return plotY + plotHeight / 2; // Avoid division by zero

    const normalizedPrice = (price - minPrice) / priceRange;
    return plotY + plotHeight - (normalizedPrice * plotHeight);
}