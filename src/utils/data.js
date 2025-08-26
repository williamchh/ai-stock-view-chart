/**
 * @fileoverview Utility functions for data manipulation and scaling.
 * @author H Chen
 */

/**
 * Manages the visible data window for horizontal scrolling.
 */
export class DataViewport {
    /**
     * @param {Array<object>} allData - The complete dataset.
     * @param {number} initialVisibleCount - The initial number of data points visible.
     */
    constructor(allData, initialVisibleCount, rightPadding = 0) {
        this.allData = allData;
        // Set visible count including right padding but not exceeding total data plus padding
        this.visibleCount = Math.min(initialVisibleCount, allData.length + rightPadding);
        this.rightPadding = rightPadding;
        // Calculate max start index considering right padding
        this.maxStartIndex = Math.max(0, allData.length - this.visibleCount + rightPadding);
        // Set initial position to show the latest data plus right padding
        this.startIndex = Math.max(0, allData.length - (this.visibleCount - rightPadding));
    }

    /**
     * @private
     * @readonly
     */
    MIN_PORT_VISIBLE_COUNT = 10;

    /**
     * Gets the currently visible data points.
     * @returns {Array<object>} An array of data points within the current viewport.
     */
    getVisibleData() {
        const endIndex = Math.min(this.startIndex + this.visibleCount, this.allData.length);
        return this.allData.slice(this.startIndex, endIndex);
    }

    getVisibleStartEndTime() {
        const vd = this.getVisibleData();
        if (!vd || vd.length === 0) return null;
        return { startTime: vd[0].time, endTime: vd[vd.length - 1].time };
    }

    /**
     * Scrolls the viewport horizontally.
     * @param {number} delta - The number of data points to scroll. Positive scrolls right (newer data), negative scrolls left (older data).
     */
    scroll(delta) {
        // Update maxStartIndex in case visibleCount has changed, including rightPadding
        this.maxStartIndex = this.allData.length - this.visibleCount + this.rightPadding;
        const newStartIndex = this.startIndex + delta;
        
        // Allow scrolling slightly past the edges for better UX, but prevent excessive overscroll
        const overscrollAmount = Math.min(
            Math.round(this.visibleCount * 0.1), // 10% overscroll
            Math.round(this.allData.length * 0.1) // but no more than 10% of total data length
        );
        
        // Calculate min and max start indices
        const minStart = 0; // Don't allow scrolling past the start of data
        const maxStart = this.maxStartIndex + overscrollAmount;
        
        // Ensure we can't scroll too far past the beginning or end of the data
        this.startIndex = Math.max(minStart, Math.min(maxStart, newStartIndex));
    }

    /**
     * Zooms the viewport in or out by adjusting the number of visible data points.
     * @param {number} zoomFactor - A multiplier for zooming. >1 for zoom in (fewer visible), <1 for zoom out (more visible).
     * @param {number} anchorIndex - The index within the *visible* data to anchor the zoom around.
     */
    zoom(zoomFactor, anchorIndex) {
        // If zooming out (zoomFactor < 1) and we're already at the start of data
        if (zoomFactor < 1 && this.startIndex <= 0) {
            // Request more data before proceeding with zoom
            window.dispatchEvent(new CustomEvent('requestOlderData', {
                detail: {
                    currentOldestDataTime: this.allData[0]?.time,
                    requestedCount: Math.round(this.visibleCount * 0.5), // Request 50% more data
                    zoomFactor: zoomFactor,
                    anchorIndex: anchorIndex
                }
            }));
            
            // Don't proceed with zoom if we're at the data boundary
            if (this.startIndex === 0) {
                return;
            }
        }

        const absoluteAnchorIndex = this.startIndex + anchorIndex;

        let adjustedZoomFactor = zoomFactor;
        const projectedVisibleCount = Math.round(this.visibleCount / zoomFactor);
        if (projectedVisibleCount > 200 && zoomFactor < 0.99) {
            adjustedZoomFactor *= 0.99;
        }
        
        // Calculate new visible count with bounds
        const newVisibleCount = Math.max(
            this.MIN_PORT_VISIBLE_COUNT, // Minimum visible count
            Math.min(
                this.allData.length, // Maximum visible count (removed rightPadding for zoom)
                Math.round(this.visibleCount / adjustedZoomFactor)
            )
        );

        // Calculate the ratio of where the anchor point is in the view
        const ratio = anchorIndex / this.visibleCount;
        
        // Calculate new start index to keep anchor point relatively stable
        const targetPosition = Math.round(newVisibleCount * ratio);
        const newStartIndex = absoluteAnchorIndex - targetPosition;
        
        // Update visible count and maxStartIndex
        this.visibleCount = newVisibleCount;
        this.maxStartIndex = Math.max(0, this.allData.length - this.visibleCount);
        
        // Allow minimal overscroll for zoom operations
        const overscrollAmount = Math.round(this.visibleCount * 0.05); // Reduced to 5%
        const minStart = Math.max(-overscrollAmount, 0); // Prevent negative indices
        const maxStart = this.maxStartIndex + overscrollAmount;
        
        // Set new start index with strict bounds checking
        this.startIndex = Math.max(minStart, Math.min(maxStart, newStartIndex));

        // Dispatch an event if we're at the start of the data and trying to zoom out
        if (this.startIndex <= minStart && zoomFactor < 1) {
            window.dispatchEvent(new CustomEvent('requestOlderData', {
                detail: {
                    currentOldestDataTime: this.allData[0]?.time,
                    requestedCount: Math.round(this.visibleCount * 0.5) // Request 50% more data
                }
            }));
        }
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
    return (dataIndexInView * barWidth);
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

/**
 * Calculates the value based on a Y-coordinate position within a plot.
 * This is the inverse of getYPixel.
 * @param {number} y - The y-coordinate on the canvas.
 * @param {number} plotY - The y-coordinate of the top of the plot area.
 * @param {number} plotHeight - The height of the plot area in pixels.
 * @param {number} minValue - The minimum value in the visible range.
 * @param {number} maxValue - The maximum value in the visible range.
 * @returns {number} The value at the given y-coordinate.
 */
export function getValueBasedOnY(y, plotY, plotHeight, minValue, maxValue) {
    if (plotHeight === 0) return (maxValue + minValue) / 2; // Avoid division by zero

    const normalizedY = 1 - ((y - plotY) / plotHeight); // Invert Y axis
    const valueRange = maxValue - minValue;
    return minValue + (normalizedY * valueRange);
}