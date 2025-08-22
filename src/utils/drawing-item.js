/**
 * Base class for all drawing items
 */
class DrawingItem {
    constructor(type) {
        this.type = type;
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
        const visibleStartTime = allData[viewport.startIndex].time;
        const visibleEndTime = allData[viewport.startIndex + viewport.visibleCount - 1].time;
        const timeRange = visibleEndTime - visibleStartTime;
        const relativeTime = (time - visibleStartTime) / timeRange;
        
        // Calculate x coordinate based on relative time position
        const x = plotLayout.x + (relativeTime * plotLayout.width);

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
class LineDrawing extends DrawingItem {
    constructor() {
        super('line');
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

// Export the classes
export { DrawingItem, LineDrawing, RectangleDrawing, FibonacciDrawing };
