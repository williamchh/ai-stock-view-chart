/**
 * @fileoverview Handles click detection and candlestick data emission for StockChart.
 * @author H Chen
 */

/**
 * @typedef {import('../stock-chart.d.ts').StockData} StockData
 */

/**
 * Default options for ClickHandler
 */
const DEFAULT_OPTIONS = {
    enabled: true,
    clickThreshold: 5,
    timeThreshold: 500
};

/**
 * ClickHandler class for detecting true clicks and emitting candlestick data.
 * A "true click" is defined as:
 * - Mouse down and up positions are within a small threshold (default 5px)
 * - Duration is within time threshold (default 500ms)
 * - Not during dragging, drawing, resizing, or other interactions
 */
export class ClickHandler {
    /**
     * @param {import('../stock-chart.d.ts').default} stockChart - The StockChart instance
     * @param {Partial<typeof DEFAULT_OPTIONS>} options - Configuration options
     */
    constructor(stockChart, options = DEFAULT_OPTIONS) {
        this.stockChart = stockChart;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        
        this.mouseDownX = 0;
        this.mouseDownY = 0;
        this.mouseDownTime = 0;
        this.isMouseDown = false;
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        this.isTouchDown = false;
    }

    /**
     * Enable or disable the click handler
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.options.enabled = enabled;
    }

    /**
     * Check if click handler is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return this.options.enabled;
    }

    /**
     * Handle mouse down event - track starting position
     * @param {number} x - Mouse X position relative to canvas
     * @param {number} y - Mouse Y position relative to canvas
     */
    handleMouseDown(x, y) {
        this.mouseDownX = x;
        this.mouseDownY = y;
        this.mouseDownTime = Date.now();
        this.isMouseDown = true;
    }

    /**
     * Handle mouse up event - check if it's a true click and emit data
     * @param {number} x - Mouse X position relative to canvas
     * @param {number} y - Mouse Y position relative to canvas
     * @param {MouseEvent} event - The original mouse event
     */
    handleMouseUp(x, y, event) {
        if (!this.options.enabled || !this.isMouseDown) {
            this.isMouseDown = false;
            return;
        }

        this.isMouseDown = false;

        const isTrueClick = this.checkIfTrueClick(x, y);
        if (isTrueClick) {
            this.emitCandleData(x, y, event);
        }
    }

    /**
     * Handle touch start event - track starting position
     * @param {number} x - Touch X position relative to canvas
     * @param {number} y - Touch Y position relative to canvas
     */
    handleTouchStart(x, y) {
        this.touchStartX = x;
        this.touchStartY = y;
        this.touchStartTime = Date.now();
        this.isTouchDown = true;
    }

    /**
     * Handle touch end event - check if it's a true tap and emit data
     * @param {number} x - Touch X position relative to canvas
     * @param {number} y - Touch Y position relative to canvas
     * @param {TouchEvent} event - The original touch event
     */
    handleTouchEnd(x, y, event) {
        if (!this.options.enabled || !this.isTouchDown) {
            this.isTouchDown = false;
            return;
        }

        this.isTouchDown = false;

        const isTrueTap = this.checkIfTrueTap(x, y);
        if (isTrueTap) {
            this.emitCandleData(x, y, event);
        }
    }

    /**
     * Check if the mouse interaction is a true click (not a drag)
     * @param {number} upX - Mouse up X position
     * @param {number} upY - Mouse up Y position
     * @returns {boolean}
     */
    checkIfTrueClick(upX, upY) {
        const distance = Math.sqrt(
            Math.pow(upX - this.mouseDownX, 2) + 
            Math.pow(upY - this.mouseDownY, 2)
        );
        const duration = Date.now() - this.mouseDownTime;

        return distance <= this.options.clickThreshold && 
               duration <= this.options.timeThreshold;
    }

    /**
     * Check if the touch interaction is a true tap (not a drag)
     * @param {number} endX - Touch end X position
     * @param {number} endY - Touch end Y position
     * @returns {boolean}
     */
    checkIfTrueTap(endX, endY) {
        const distance = Math.sqrt(
            Math.pow(endX - this.touchStartX, 2) + 
            Math.pow(endY - this.touchStartY, 2)
        );
        const duration = Date.now() - this.touchStartTime;

        return distance <= this.options.clickThreshold && 
               duration <= this.options.timeThreshold;
    }

    /**
     * Get the candlestick data at the given position
     * @param {number} x - X position relative to canvas
     * @returns {{data: StockData | null, index: number, plotId: string | null}}
     */
    getCandleDataAtPosition(x) {
        const mainPlotLayout = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlotLayout) {
            return { data: null, index: -1, plotId: null };
        }

        const barWidth = mainPlotLayout.width / this.stockChart.dataViewport.visibleCount;
        const relativeX = x - mainPlotLayout.x;
        const visibleIndex = Math.round(relativeX / barWidth - 0.5);
        
        const clampedVisibleIndex = Math.max(0, Math.min(this.stockChart.dataViewport.visibleCount - 1, visibleIndex));
        const dataIndex = this.stockChart.dataViewport.startIndex + clampedVisibleIndex;
        
        const mainPlot = this.stockChart.options.plots?.find(p => p.id === 'main');
        if (!mainPlot || !mainPlot.data || dataIndex < 0 || dataIndex >= mainPlot.data.length) {
            return { data: null, index: -1, plotId: null };
        }

        const data = mainPlot.data[dataIndex];
        return { data, index: dataIndex, plotId: 'main' };
    }

    /**
     * Emit candlestick data via CustomEvent
     * @param {number} x - X position relative to canvas
     * @param {number} y - Y position relative to canvas
     * @param {MouseEvent | TouchEvent} originalEvent - The original event
     */
    emitCandleData(x, y, originalEvent) {
        const { data, index, plotId } = this.getCandleDataAtPosition(x);
        
        if (!data) {
            return;
        }

        const detail = {
            data: {
                time: data.time,
                open: data.open,
                high: data.high,
                low: data.low,
                close: data.close,
                volume: data.volume,
                signals: data.signals
            },
            index,
            plotId,
            originalEvent,
            position: { x, y }
        };

        const event = new CustomEvent('candleClick', {
            detail,
            bubbles: true,
            cancelable: true
        });

        this.stockChart.canvas.dispatchEvent(event);
        
        if (typeof window !== 'undefined') {
            const globalEvent = new CustomEvent('candleClick', { detail });
            window.dispatchEvent(globalEvent);
        }
    }

    /**
     * Reset the click handler state
     */
    reset() {
        this.isMouseDown = false;
        this.isTouchDown = false;
    }
}

export default ClickHandler;
