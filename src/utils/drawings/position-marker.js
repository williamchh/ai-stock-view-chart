/**
 * @fileoverview Position marker drawing utility for stock charts.
 * Draws buy/sell position markers on the chart with price and optional lots information.
 * @author H Chen
 */

import { getXPixel, getYPixel } from '../data.js';

/**
 * PositionMarker class for managing and drawing stock positions on the chart.
 */
export class PositionMarker {
    /**
     * Creates a new PositionMarker instance.
     * @param {Object} chart - The StockChart instance
     */
    constructor(chart) {
        this.chart = chart;
        this.positions = [];
    }

    /**
     * Adds a position marker to the chart.
     * @param {Object} position - The position to add
     * @param {number|Date} position.timestamp - Unix timestamp (in seconds) or Date object for position
     * @param {number} position.price - The price level of position
     * @param {'buy'|'sell'} position.orderType - Type of order ('buy' or 'sell')
     * @param {number} [position.lots] - Optional number of lots/shares
     * @param {string} [position.id] - Optional unique identifier for the position
     * @returns {string} The ID of the added position
     */
    addPosition(position) {
        const id = position.id || `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Convert Date object to timestamp if needed
        let timestamp = position.timestamp;
        if (position.timestamp instanceof Date) {
            timestamp = Math.floor(position.timestamp.getTime() / 1000);
        }
        
        const newPosition = {
            id,
            timestamp: timestamp,
            price: position.price,
            orderType: position.orderType,
            lots: position.lots
        };
        this.positions.push(newPosition);
        return id;
    }

    /**
     * Adds multiple position markers to the chart at once.
     * @param {Object[]} positions - Array of positions to add
     * @returns {string[]} Array of IDs of the added positions
     */
    addPositions(positions) {
        return positions.map(position => this.addPosition(position));
    }

    /**
     * Removes a position marker by ID.
     * @param {string} id - The ID of position to remove
     * @returns {boolean} True if position was found and removed
     */
    removePosition(id) {
        const index = this.positions.findIndex(p => p.id === id);
        if (index !== -1) {
            this.positions.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Updates an existing position marker.
     * @param {string} id - The ID of the position to update
     * @param {Object} updates - The fields to update
     * @param {number|Date} [updates.timestamp] - New timestamp (Date object or Unix timestamp in seconds)
     * @param {number} [updates.price] - New price
     * @param {'buy'|'sell'} [updates.orderType] - New order type
     * @param {number} [updates.lots] - New lots
     * @returns {boolean} True if position was found and updated
     */
    updatePosition(id, updates) {
        const position = this.positions.find(p => p.id === id);
        if (position) {
            // Convert Date object to timestamp if needed
            if (updates.timestamp instanceof Date) {
                updates = { ...updates, timestamp: Math.floor(updates.timestamp.getTime() / 1000) };
            }
            Object.assign(position, updates);
            return true;
        }
        return false;
    }

    /**
     * Clears all position markers.
     */
    clearPositions() {
        this.positions = [];
    }

    /**
     * Gets all position markers.
     * @returns {Array} Array of all positions
     */
    getPositions() {
        return [...this.positions];
    }

    /**
     * Renders all position markers on the chart.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     * @param {Object} [options] - Rendering options
     * @param {string} [options.buyColor] - Color for buy positions (defaults to theme candleUp)
     * @param {string} [options.sellColor] - Color for sell positions (defaults to theme candleDown)
     * @param {number} [options.markerSize] - Size of the marker triangle (defaults to 10)
     * @param {number} [options.labelPadding] - Padding around the label (defaults to 4)
     * @param {boolean} [options.showLots] - Whether to show lots in label (defaults to true if lots provided)
     */
    render(ctx, options = {}) {
        if (this.positions.length === 0) return;

        const theme = this.chart.currentTheme;
        const mainPlot = this.chart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return;

        const { minPrice, maxPrice } = this.chart.calculatePriceRange(
            this.chart.options.plots.find(p => p.id === 'main'),
            this.chart.dataViewport.getVisibleData(),
            this.chart.dataViewport
        );

        const barWidth = mainPlot.width / this.chart.dataViewport.visibleCount;
        const markerSize = options.markerSize || 10;
        const labelPadding = options.labelPadding || 4;
        const buyColor = options.buyColor || theme.candleUp;
        const sellColor = options.sellColor || theme.candleDown;
        const showLots = options.showLots !== false;

        // Group positions by x-coordinate to avoid overlapping labels
        const positionsByX = new Map();

        this.positions.forEach(position => {
            // Calculate x position based on timestamp
            const dataIndex = this.chart.findTimeIndex(position.timestamp, this.chart.dataViewport.allData);
            const relativeIndex = dataIndex - this.chart.dataViewport.startIndex;

            // Only render if position is within visible range
            if (relativeIndex >= 0 && relativeIndex < this.chart.dataViewport.visibleCount) {
                const x = mainPlot.x + getXPixel(
                    dataIndex,
                    this.chart.dataViewport.startIndex,
                    this.chart.dataViewport.visibleCount,
                    mainPlot.width,
                    barWidth
                ) + barWidth / 2;

                // Calculate y position based on price
                const y = getYPixel(
                    position.price,
                    minPrice,
                    maxPrice,
                    mainPlot.height,
                    mainPlot.y
                );

                if (!positionsByX.has(x)) {
                    positionsByX.set(x, []);
                }
                positionsByX.get(x).push({ position, x, y });
            }
        });

        // Render positions grouped by x-coordinate
        positionsByX.forEach((positionsAtX) => {
            // Sort by y position to handle overlapping
            positionsAtX.sort((a, b) => a.y - b.y);

            positionsAtX.forEach(({ position, x, y }, index) => {
                const isBuy = position.orderType === 'buy';
                const color = isBuy ? buyColor : sellColor;

                // Draw marker triangle
                this.drawMarker(ctx, x, y, markerSize, isBuy, color);

                // Draw label
                this.drawLabel(
                    ctx,
                    x,
                    y,
                    position.price,
                    isBuy,
                    color,
                    labelPadding,
                    showLots,
                    theme.textColor,
                    position.lots,
                    markerSize
                );
            });
        });
    }

    /**
     * Draws a marker triangle at the specified position.
     * @private
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} size - Size of the marker
     * @param {boolean} isBuy - Whether this is a buy position
     * @param {string} color - Color for the marker
     */
    drawMarker(ctx, x, y, size, isBuy, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        ctx.beginPath();
        if (isBuy) {
            // Buy marker: triangle pointing up, tip at price level (y)
            ctx.moveTo(x, y);  // tip at exact price level
            ctx.lineTo(x - size, y + size * 2);  // bottom left
            ctx.lineTo(x + size, y + size * 2);  // bottom right
            ctx.closePath();
        } else {
            // Sell marker: triangle pointing down, tip at price level (y)
            ctx.moveTo(x, y);  // tip at exact price level
            ctx.lineTo(x - size, y - size * 2);  // top left
            ctx.lineTo(x + size, y - size * 2);  // top right
            ctx.closePath();
        }

        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draws a label with price and optional lots.
     * @private
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
     * @param {number} x - X coordinate of marker
     * @param {number} y - Y coordinate of marker
     * @param {number} price - The price to display
     * @param {boolean} isBuy - Whether this is a buy position
     * @param {string} color - Color for the label background
     * @param {number} padding - Padding around the label
     * @param {boolean} showLots - Whether to show lots
     * @param {string} textColor - Text color
     * @param {number} [lots] - Optional lots to display
     * @param {number} [markerSize] - Size of the marker for alignment
     */
    drawLabel(ctx, x, y, price, isBuy, color, padding, showLots, textColor, lots, markerSize = 10) {
        ctx.save();

        // Format price based on value
        let priceText;
        if (price >= 1000) {
            priceText = price.toFixed(0);
        } else if (price >= 100) {
            priceText = price.toFixed(1);
        } else if (price >= 10) {
            priceText = price.toFixed(2);
        } else {
            priceText = price.toFixed(3);
        }

        // Build label text
        let labelText = priceText;
        if (showLots && lots !== undefined && lots !== null) {
            labelText += ` (${lots})`;
        }

        // Set font
        ctx.font = '11px Arial';
        const textMetrics = ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = 12;
        const gap = 2;  // Small gap between marker and label

        // Calculate label position
        // Buy (arrow up): arrow bottom is at y + size * 2, label top aligns with arrow bottom
        // Sell (arrow down): arrow top is at y - size * 2, label bottom aligns with arrow top
        let labelY;
        if (isBuy) {
            // Arrow bottom is at y + markerSize * 2
            // Label top should be at arrow bottom + gap
            // Since text baseline is 'bottom', labelY = labelTop + textHeight + padding
            labelY = (y + markerSize * 2) + gap + textHeight + padding;
        } else {
            // Arrow top is at y - markerSize * 2
            // Label bottom should be at arrow top - gap
            // Label bottom = labelY + padding
            labelY = (y - markerSize * 2) - gap - padding;
        }
        const labelX = x - textWidth / 2;

        // Draw label background
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.roundRect(
            labelX - padding,
            labelY - textHeight - padding,
            textWidth + padding * 2,
            textHeight + padding * 2,
            3
        );
        ctx.fill();

        // Draw text
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(labelText, labelX, labelY + padding);

        ctx.restore();
    }
}

/**
 * Helper function to draw a single position marker (for one-time rendering).
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
 * @param {Object} chart - The StockChart instance
 * @param {Object} position - The position to draw
 * @param {number|Date} position.timestamp - Unix timestamp (in seconds) or Date object for position
 * @param {number} position.price - The price level of position
 * @param {'buy'|'sell'} position.orderType - Type of order ('buy' or 'sell')
 * @param {number} [position.lots] - Optional number of lots/shares
 * @param {Object} [options] - Rendering options
 */
export function drawPositionMarker(ctx, chart, position, options = {}) {
    const marker = new PositionMarker(chart);
    marker.addPosition(position);
    marker.render(ctx, options);
}
