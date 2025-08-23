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
     * @returns {{x: number, y: number}} The pixel coordinates
     */
    getPixelCoordinates(time, price, plotLayout, viewport, minPrice, maxPrice) {
        if (!viewport?.allData || !viewport.getVisibleData) return null;
        
        const allData = viewport.allData;
        const visibleData = viewport.getVisibleData();
        
        // Find the index of the nearest time in the data
        const timeIndex = allData.findIndex(d => d.time >= time);
        const nearestTimeIndex = timeIndex === -1 ? allData.length - 1 : 
            (timeIndex === 0 ? 0 :
                (Math.abs(allData[timeIndex].time - time) < Math.abs(allData[timeIndex - 1].time - time) ?
                    timeIndex : timeIndex - 1));
        
        if (nearestTimeIndex === -1) return null;

        // Calculate relative position in viewport
        const barWidth = plotLayout.width / viewport.visibleCount;
        
        // Find the actual index in visible data for more accurate positioning
        const visibleTimeIndex = visibleData.findIndex(d => d.time >= time);
        const nearestVisibleIndex = visibleTimeIndex === -1 ? visibleData.length - 1 : 
            (visibleTimeIndex === 0 ? 0 :
                (Math.abs(visibleData[visibleTimeIndex].time - time) < Math.abs(visibleData[visibleTimeIndex - 1].time - time) ?
                    visibleTimeIndex : visibleTimeIndex - 1));
                    
        // Calculate x coordinate based on the index in visible data
        const x = plotLayout.x + (nearestVisibleIndex * barWidth);

        // Calculate y coordinate
        const y = plotLayout.y + ((maxPrice - price) / (maxPrice - minPrice)) * plotLayout.height;

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
/**
 * Line drawing item
 */
class LineDrawing extends DrawingItem {
    /**
     * @param {string} type - The type of line ('line', 'horizontal-line', or 'vertical-line')
     */
    constructor(type = 'line') {
        super(type);
        this.constraint = type === 'horizontal-line' ? 'horizontal' :
                         type === 'vertical-line' ? 'vertical' :
                         'line';
    }

    draw(ctx, plotLayout, viewport, minPrice, maxPrice) {
        if (this.points.length < 2) return;

        const start = this.getPixelCoordinates(
            this.points[0].time,
            this.points[0].price,
            plotLayout,
            viewport,
            minPrice,
            maxPrice
        );

        let endX = this.points[1].time;
        let endY = this.points[1].price;

        if (this.constraint === 'horizontal') {
            endY = this.points[0].price;
        } else if (this.constraint === 'vertical') {
            endX = this.points[0].time;
        }

        const end = this.getPixelCoordinates(
            endX,
            endY,
            plotLayout,
            viewport,
            minPrice,
            maxPrice
        );

        if (!start || !end) return;

        ctx.beginPath();
        ctx.strokeStyle = this.style.strokeStyle;
        ctx.lineWidth = this.style.lineWidth;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }
}

/**
 * Rectangle drawing item
 */
class RectangleDrawing extends DrawingItem {
    constructor() {
        super('rectangle');
    }

    draw(ctx, plotLayout, viewport, minPrice, maxPrice) {
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

    draw(ctx, plotLayout, viewport, minPrice, maxPrice) {
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

        const priceRange = Math.abs(this.points[1].price - this.points[0].price);
        const isUptrend = this.points[1].price > this.points[0].price;
        const startPrice = this.points[0].price;

        // Draw each Fibonacci level
        ctx.lineWidth = this.style.lineWidth;
        ctx.strokeStyle = this.style.strokeStyle;
        ctx.fillStyle = this.style.strokeStyle; // Use the same color for text
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

    // Generate Fibonacci sequence: [1, 2, 3, 5, 8, 13, 21, 34]
    fibSequence(count = 8) {
        if (count <= 0) return [];
        if (count === 1) return [1];
        const seq = [1, 2, 3];
        while (seq.length < count) {
            const len = seq.length;
            seq.push(seq[len - 1] + seq[len - 2]);
        }
        return seq;
    }

    draw(ctx, plotLayout, viewport, minPrice, maxPrice) {
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

        // Calculate the base unit from the selection
        const timeDiff = Math.abs(this.points[1].time - this.points[0].time);
        const direction = this.points[1].time > this.points[0].time ? 1 : -1;
        const startTime = this.points[0].time;

        // Get visible data to verify the time difference
        const visibleData = viewport.getVisibleData();
        if (visibleData.length < 2) return;
        
        const barDuration = visibleData[1].time - visibleData[0].time; // Time difference between bars
        
        // If selected points are less than 2 bars apart, use single bar duration
        // Otherwise use the selected time difference as the base unit
        const baseUnit = timeDiff < barDuration * 2 ? barDuration : timeDiff;

        // Get Fibonacci sequence and calculate time zones
        const fibNumbers = this.fibSequence(8); // Get first 8 Fibonacci numbers
        const timeZones = fibNumbers.map(step => startTime + direction * step * baseUnit);

        const color = this.theme === 'dark' ? '#FFFFFF' : '#000000';
        this.style.strokeStyle = color;
        this.style.fillStyle = color;
        
        // Draw settings
        ctx.lineWidth = this.style.lineWidth;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.setLineDash([5, 5]);
        ctx.textAlign = 'center';
        ctx.font = '12px Arial';

        // Draw selected range indicator
        if (timeDiff >= barDuration) {
            ctx.beginPath();
            ctx.moveTo(start.x + this.halfBarWidth, plotLayout.y);
            ctx.lineTo(start.x + this.halfBarWidth, plotLayout.y + plotLayout.height);
            ctx.moveTo(end.x + this.halfBarWidth, plotLayout.y);
            ctx.lineTo(end.x + this.halfBarWidth, plotLayout.y + plotLayout.height);
            ctx.strokeStyle = this.style.strokeStyle;
            ctx.stroke();
        }
        else {
            ctx.beginPath();
            ctx.moveTo(start.x + this.halfBarWidth, plotLayout.y);
            ctx.lineTo(start.x + this.halfBarWidth, plotLayout.y + plotLayout.height);
            ctx.moveTo(end.x + this.halfBarWidth, plotLayout.y);
            ctx.lineTo(end.x + this.halfBarWidth, plotLayout.y + plotLayout.height);
            ctx.strokeStyle = this.style.strokeStyle;
            ctx.stroke();
            return;
        }

        // Draw each time zone line
        timeZones.forEach((time, index) => {
            // Check if this time is beyond the latest candlestick
            const latestCandleTime = viewport.allData[viewport.allData.length - 1]?.time;
            if (latestCandleTime && time > latestCandleTime) return;

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
            ctx.moveTo(coord.x + this.halfBarWidth, plotLayout.y);
            ctx.lineTo(coord.x + this.halfBarWidth, plotLayout.y + plotLayout.height);
            ctx.stroke();

            // Draw Fibonacci number label at the top
            const label = fibNumbers[index].toString();
            ctx.fillText(label, coord.x + this.halfBarWidth, plotLayout.height - 15);

            const labelWidth = ctx.measureText(label).width + 5; // Add some padding for better visibility

            // Draw the period label (in days) below
            const periods = Math.round(fibNumbers[index] * (timeDiff / barDuration));
            if (periods > 0) {
                const periodLabel = `(${periods})`;
                ctx.fillText(periodLabel, coord.x + this.halfBarWidth + labelWidth, plotLayout.height - 15);
            }
        });

        // Reset line dash
        ctx.setLineDash([]);
    }
}

// Export the classes
export { DrawingItem, LineDrawing, RectangleDrawing, FibonacciDrawing, FibonacciZoonDrawing };
