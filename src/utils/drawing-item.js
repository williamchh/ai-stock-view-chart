/**
 * @typedef {object} DrawingItemPoints
 * @property {number} time - The time value (x-coordinate)
 * @property {number} price - The price value (y-coordinate)
 */

/**
 * Base class for all drawing items
 */
class DrawingItem {
    constructor(type) {
        this.type = type;
        /**
         * @type {DrawingItemPoints[]} points
         */
        this.points = []; // Array of {time, price} points
        this.style = {
            strokeStyle: '#000000',
            lineWidth: 1,
            fillStyle: 'rgba(0, 0, 0, 0.1)'
        };
    }

    /**
     * Add a point to the drawing item
     * @param {number} time - The time value (x-coordinate)
     * @param {number} price - The price value (y-coordinate)
     */
    addPoint(time, price) {
        this.points.push({ time, price });
    }

    /**
     * Convert time and price coordinates to pixel coordinates
     * @param {number} time - The time value
     * @param {number} price - The price value
     * @param {object} plotLayout - The plot layout information
     * @param {object} viewport - The data viewport
     * @param {number} minPrice - The minimum price in the current view
     * @param {number} maxPrice - The maximum price in the current view
     * @param {boolean} ignorePriceLimit - Whether to ignore price limits
     * @returns {{x: number, y: number}} The pixel coordinates
     */
    getPixelCoordinates(time, price, plotLayout, viewport, minPrice, maxPrice, ignorePriceLimit = false) {
        if (!viewport?.allData || viewport.allData.length === 0) return null;

        const allData = viewport.allData;
        
        // Find the index of the time in the full dataset.
        // This allows us to calculate the position even if the point is off-screen.
        const timeIndex = allData.findIndex(d => d.time >= time);
        const nearestTimeIndex = timeIndex === -1 ? allData.length - 1 :
            (timeIndex === 0 ? 0 :
                (Math.abs(allData[timeIndex].time - time) < Math.abs(allData[timeIndex - 1].time - time) ?
                    timeIndex : timeIndex - 1));

        if (nearestTimeIndex === -1) return null;

        const barWidth = plotLayout.width / viewport.visibleCount;

        // Calculate the x coordinate based on its position relative to the viewport's start index.
        const x = plotLayout.x + ((nearestTimeIndex - viewport.startIndex) * barWidth) + barWidth / 2;

        // Calculate y coordinate
        const priceRange = maxPrice - minPrice;
        // Avoid division by zero if price range is zero
        const y = priceRange > 0
            ? plotLayout.y + ((maxPrice - price) / priceRange) * plotLayout.height
            : plotLayout.y + plotLayout.height / 2; // Middle of the plot if no range

        // If we don't ignore price limits and the calculated y is outside the plot, return null.
        // This check is now less critical as we draw the line to the boundary, but can be useful.
        if (!ignorePriceLimit && (y < plotLayout.y || y > plotLayout.y + plotLayout.height)) {
            // We can still return the coordinates because the drawing logic will handle clipping.
        }

        return { x, y };
    }

    /**
     * Draw the item on the canvas
     * @param {CanvasRenderingContext2D} ctx - The canvas context
     * @param {object} plotLayout - The plot layout information
     * @param {object} viewport - The data viewport
     * @param {number} minPrice - The minimum price in the current view
     * @param {number} maxPrice - The maximum price in the current view
     */
    draw(ctx, plotLayout, viewport, minPrice, maxPrice) {
        // To be implemented by subclasses
    }

    /**
     * Export the drawing item to JSON
     * @returns {object} The JSON representation of the drawing item
     */
    toJSON() {
        return {
            type: this.type,
            points: this.points,
            style: this.style
        };
    }

    /**
     * Import drawing item from JSON
     * @param {object} json - The JSON representation of the drawing item
     */
    fromJSON(json) {
        this.points = json.points;
        this.style = json.style;
    }
}


/**
 * Line drawing item
 */
class LineDrawing extends DrawingItem {
    /**
     * @param {number} barWidth - The width of each bar/candle in pixels
     * @param {string} type - The type of line ('line', 'horizontal-line', or 'vertical-line')
     */
    constructor(barWidth, type = 'line') {
        super(type);
        this.barWidth = barWidth;
        this.constraint = type === 'horizontal-line' ? 'horizontal' :
                         type === 'vertical-line' ? 'vertical' :
                         'line';
    }

    draw(ctx, plotLayout, viewport, minPrice, maxPrice, currentTheme, startEndTimes) {
        if (this.points.length < 2) return;

        let p1 = this.points[0];
        let p2 = this.points[1];

        if (this.constraint === 'horizontal') {
            p2 = { ...p2, price: p1.price };
        } else if (this.constraint === 'vertical') {
            p2 = { ...p2, time: p1.time };
        }

        const start = this.getPixelCoordinates(p1.time, p1.price, plotLayout, viewport, minPrice, maxPrice, true);
        const end = this.getPixelCoordinates(p2.time, p2.price, plotLayout, viewport, minPrice, maxPrice, true);

        if (!start || !end) return;

        const plotX1 = plotLayout.x;
        const plotY1 = plotLayout.y;
        const plotX2 = plotLayout.x + plotLayout.width;
        const plotY2 = plotLayout.y + plotLayout.height;

        // Use Liang-Barsky algorithm to clip the line
        let x1 = start.x, y1 = start.y, x2 = end.x, y2 = end.y;
        const dx = x2 - x1, dy = y2 - y1;
        let t0 = 0, t1 = 1;
        const p = [-dx, dx, -dy, dy];
        const q = [x1 - plotX1, plotX2 - x1, y1 - plotY1, plotY2 - y1];

        for (let i = 0; i < 4; i++) {
            if (p[i] === 0) {
                if (q[i] < 0) return; // Line is outside and parallel
            } else {
                const r = q[i] / p[i];
                if (p[i] < 0) {
                    t0 = Math.max(t0, r);
                } else {
                    t1 = Math.min(t1, r);
                }
            }
        }

        if (t0 < t1) {
            const clippedX1 = x1 + t0 * dx;
            const clippedY1 = y1 + t0 * dy;
            const clippedX2 = x1 + t1 * dx;
            const clippedY2 = y1 + t1 * dy;

            ctx.beginPath();
            ctx.strokeStyle = this.style.strokeStyle;
            ctx.lineWidth = this.style.lineWidth;
            ctx.moveTo(clippedX1, clippedY1);
            ctx.lineTo(clippedX2, clippedY2);
            ctx.stroke();
        }
    }
}

/**
 * Rectangle drawing item
 */
class RectangleDrawing extends DrawingItem {
    constructor() {
        super('rectangle');
    }

    draw(ctx, plotLayout, viewport, minPrice, maxPrice, currentTheme) {
        if (this.points.length < 2) return;

        const start = this.getPixelCoordinates(
            this.points[0].time,
            this.points[0].price,
            plotLayout,
            viewport,
            minPrice,
            maxPrice
        );

        const end = this.getPixelCoordinates(
            this.points[1].time,
            this.points[1].price,
            plotLayout,
            viewport,
            minPrice,
            maxPrice
        );

        if (!start || !end) return;

        ctx.beginPath();
        ctx.fillStyle = this.style.fillStyle;
        ctx.strokeStyle = this.style.strokeStyle;
        ctx.lineWidth = this.style.lineWidth;
        ctx.rect(
            Math.min(start.x, end.x),
            Math.min(start.y, end.y),
            Math.abs(end.x - start.x),
            Math.abs(end.y - start.y)
        );
        ctx.fill();
        ctx.stroke();
    }
}

/**
 * Fibonacci drawing item
 */
class FibonacciDrawing extends DrawingItem {
    constructor(theme) {
        super('fibonacci');
        // Fibonacci levels (0%, 23.6%, 38.2%, 61.8%, 100%, 161.8%, 200%, 261.8%, 361.8%, 423.6%)
        this.levels = [0, 0.236, 0.382, 0.618, 1, 1.618, 2, 2.618, 3.618, 4.236];
        this.style.strokeStyle = theme === 'dark' ? '#FFFFFF' : '#000000';
    }

    draw(ctx, plotLayout, viewport, minPrice, maxPrice, currentTheme, startEndTimes) {
        if (this.points.length < 2) return;

        const ignorePriceLimit = true;

        const start = this.getPixelCoordinates(
            this.points[0].time,
            this.points[0].price,
            plotLayout,
            viewport,
            minPrice,
            maxPrice,
            ignorePriceLimit
        );

        const end = this.getPixelCoordinates(
            this.points[1].time,
            this.points[1].price,
            plotLayout,
            viewport,
            minPrice,
            maxPrice,
            ignorePriceLimit
        );

        if (!start || !end) return;

        const priceRange = Math.abs(this.points[1].price - this.points[0].price);
        const isUptrend = this.points[1].price > this.points[0].price;
        const startPrice = this.points[0].price;

        let startTime = null, endTime = null;
        if (startEndTimes) {
            startTime = startEndTimes.startTime;
            endTime = startEndTimes.endTime;

            const minPointsTime = Math.min(this.points[0].time, this.points[1].time);
            const maxPointsTime = Math.max(this.points[0].time, this.points[1].time);
            if (minPointsTime > endTime || maxPointsTime < startTime) return;
        }

        // Draw each Fibonacci level
        ctx.lineWidth = this.style.lineWidth;
        ctx.strokeStyle = currentTheme.textColor;
        ctx.fillStyle = currentTheme.textColor; // Use the same color for text
        ctx.setLineDash([5, 5]);
        ctx.textAlign = 'left';
        ctx.font = '12px Arial';

        this.levels.forEach((level) => {
            const levelPrice = isUptrend 
                ? startPrice + (priceRange * level)
                : startPrice - (priceRange * level);

            const levelCoord = this.getPixelCoordinates(
                this.points[1].time,
                levelPrice,
                plotLayout,
                viewport,
                minPrice,
                maxPrice
            );

            if (!levelCoord) return;

            // Draw line
            ctx.beginPath();
            ctx.moveTo(start.x, levelCoord.y);
            ctx.lineTo(end.x, levelCoord.y);
            ctx.stroke();

            // Draw label
            const label = (level * 100).toFixed(1) + '%';
            ctx.fillText(label, end.x + 5, levelCoord.y);
        });

        // Reset line dash
        ctx.setLineDash([]);
    }
}

/**
 * FibonacciZoon drawing item - Uses the Fibonacci sequence: 1, 2, 5, 8, 13, 21, 34
 */
class FibonacciZoonDrawing extends DrawingItem {
    /**
     * @param {'light' | 'dark' | import("../stock-chart.js").Theme} theme
     * @param {number} barWidth
     */
    constructor(theme, barWidth) {
        super('fibonacci-zoon');
        this.theme = theme;
        this.halfBarWidth = barWidth / 2;
    }

    // Generate Fibonacci sequence: [0, 1, 2, 3, 5, 8, 13, 21, 34]
    fibSequence(count = 8) {
        if (count < 0) return [];
        if (count === 0) return [0];
        if (count === 1) return [1];
        const seq = [0, 1, 1];
        while (seq.length < count) {
            const len = seq.length;
            seq.push(seq[len - 1] + seq[len - 2]);
        }
        return seq;
    }

    draw(ctx, plotLayout, viewport, minPrice, maxPrice, currentTheme, startEndTimes) {
        if (this.points.length < 2) return;

        const start = this.getPixelCoordinates(
            this.points[0].time,
            this.points[0].price,
            plotLayout,
            viewport,
            minPrice,
            maxPrice
        );

        const end = this.getPixelCoordinates(
            this.points[1].time,
            this.points[1].price,
            plotLayout,
            viewport,
            minPrice,
            maxPrice
        );

        let _startTime = null, _endTime = null;
        if (startEndTimes) {
            _startTime = startEndTimes.startTime;
            _endTime = startEndTimes.endTime;
        }

        // Get visible data and find the indices of our points
        const allData = viewport.allData;
        if (!allData || allData.length < 2) return;
        
        const startIndex = allData.findIndex(d => d.time >= this.points[0].time);
        const endIndex = allData.findIndex(d => d.time >= this.points[1].time);
        if (startIndex === -1 || endIndex === -1) return;
        
        // Calculate the number of bars between points
        const barCount = Math.abs(endIndex - startIndex);
        const direction = endIndex > startIndex ? 1 : -1;
        
        // If selected points are less than 2 bars apart, use single bar as base
        const baseBarCount = Math.max(1, barCount);

        // Get Fibonacci sequence and calculate time zones based on bar indices
        const fibNumbers = this.fibSequence(10); // Get first 10 Fibonacci numbers
        const timeZones = fibNumbers.map(step => {
            const targetIndex = startIndex + direction * step * baseBarCount;
            // Ensure we don't go beyond array bounds
            // const safeIndex = Math.min(Math.max(0, targetIndex), allData.length - 1);
            // return allData[safeIndex].time;
            const totalLength = allData.length - 1;
            if (targetIndex > 0 && targetIndex <= totalLength) {
                return allData[targetIndex].time;
            }
            else if (targetIndex < 0) {
                return allData[0].time - 1;
            }
            else {
                return allData[totalLength].time + 1;
            }
        });

        const color = currentTheme.textColor;// this.theme === 'dark' ? '#FFFFFF' : '#000000';
        this.style.strokeStyle = color;
        this.style.fillStyle = color;
        
        // Draw settings
        ctx.lineWidth = this.style.lineWidth;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.setLineDash([5, 5]);
        ctx.textAlign = 'center';
        ctx.font = '12px Arial';

        // Draw each time zone line
        timeZones.forEach((time, index) => {
            // Check if this time is beyond the latest candlestick
            const latestCandleTime = viewport.allData[viewport.allData.length - 1]?.time;
            if (latestCandleTime && time > latestCandleTime) return;

            if (_startTime && time < _startTime) return;
            if (_endTime && time > _endTime) return;

            const coord = this.getPixelCoordinates(
                time,
                this.points[0].price,
                plotLayout,
                viewport,
                minPrice,
                maxPrice
            );

            if (!coord) return;

            // Draw vertical line
            ctx.beginPath();
            ctx.moveTo(coord.x, plotLayout.y);
            ctx.lineTo(coord.x, plotLayout.y + plotLayout.height - 20);
            ctx.stroke();

            // Draw Fibonacci number label at the top
            const label = fibNumbers[index].toString();
            ctx.fillText(label, coord.x, plotLayout.height - 15);

            const labelWidth = ctx.measureText(label).width + 5; // Add some padding for better visibility

            // Draw the number of bars as the period label below
            const bars = fibNumbers[index] * baseBarCount;
            if (bars > 0) {
                const periodLabel = `(${bars})`;
                const periodLabelWidth = ctx.measureText(periodLabel).width;
                ctx.fillText(periodLabel, 
                    coord.x + periodLabelWidth, 
                    plotLayout.height - 15);
            }
        });

        // Reset line dash
        ctx.setLineDash([]);
    }
}

// Export the classes
export { DrawingItem, LineDrawing, RectangleDrawing, FibonacciDrawing, FibonacciZoonDrawing };
