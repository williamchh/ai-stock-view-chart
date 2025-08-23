

import { DataViewport } from './data.js';
import { DrawingItem, LineDrawing, RectangleDrawing, FibonacciDrawing } from './drawing-item.js';
import { PlotLayoutManager } from './layout.js';
;
/**
 * @typedef {Object} StockChart
 * @property {HTMLCanvasElement} canvas - The chart canvas element.
 * @property {PlotLayoutManager} plotLayoutManager - Manager for plot layouts.
 * @property {DataViewport} dataViewport - Data viewport information
 * @property {import('../stock-chart.js').StockChartOptions} options - Chart options
 * @property {Function} calculatePriceRange - Function to calculate price range
 */

/**
 * @typedef {LineDrawing | RectangleDrawing} Drawing
 */

/**
 * Manages drawing tools and annotations on the chart
 */
export class DrawingPanel {
    /**
     * @param {StockChart} stockChart - The parent StockChart instance
     */
    constructor(stockChart) {
        this.stockChart = stockChart;
        this.drawings = [];
        this.activeTool = null;
        this.currentDrawing = null;
        this.isDrawing = false;
        this.selectedDrawing = null;
        
        // Drawing styles
        this.defaultStyles = {
            line: {
                strokeStyle: '#ff6b35',
                lineWidth: 2,
                fillStyle: 'rgba(255, 107, 53, 0.1)'
            },
            rectangle: {
                strokeStyle: '#ff6b35',
                lineWidth: 2,
                fillStyle: 'rgba(255, 107, 53, 0.1)'
            },
            fibonacci: {
                strokeStyle: stockChart.options.theme === 'dark' ? '#ffffffc5' : '#000000a9',
                lineWidth: 1,
                fillStyle: 'rgba(76, 175, 80, 0.1)'
            }
        };
    }

    /**
     * Set the active drawing tool
     * @param {string} tool - The tool to activate (null to disable drawing)
     */
    setActiveTool(tool) {
        this.activeTool = tool;
        this.currentDrawing = null;
        this.isDrawing = false;
    }

    /**
     * Start a new drawing
     * @param {string} type - Type of drawing
     * @param {number} x - Starting x coordinate
     * @param {number} y - Starting y coordinate
     */
    startDrawing(type, x, y) {
        if (!this.activeTool || this.activeTool !== type) return;

        this.isDrawing = true;

        // Convert screen coordinates to data coordinates
        const mainPlotLayout = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlotLayout) return;

        const barWidth = mainPlotLayout.width / this.stockChart.dataViewport.visibleCount;
        const relativeX = x - mainPlotLayout.x;
        const dataIndex = Math.floor(relativeX / barWidth);
        const actualDataIndex = this.stockChart.dataViewport.startIndex + dataIndex;

        // Get the data point at this index
        if (!this.stockChart.dataViewport?.allData) return;
        const visibleData = this.stockChart.dataViewport.allData;
        if (!Array.isArray(visibleData) || actualDataIndex < 0 || actualDataIndex >= visibleData.length) return;

        const dataPoint = visibleData[actualDataIndex];
        if (!dataPoint || typeof dataPoint.time !== 'number') return;

        const time = dataPoint.time;
        if (!this.stockChart.options?.plots) return;
        const mainPlot = this.stockChart.options.plots.find(p => p.id === 'main');
        if (!mainPlot) return;

        const priceRange = this.stockChart.calculatePriceRange(
            mainPlot,
            this.stockChart.dataViewport.getVisibleData(),
            this.stockChart.dataViewport
        );
        if (!priceRange) return;

        const { minPrice, maxPrice } = priceRange;

        // Calculate price from y coordinate
        const relativeY = y - mainPlotLayout.y;
        const price = maxPrice - (relativeY / mainPlotLayout.height) * (maxPrice - minPrice);

        // Create the appropriate drawing item
        switch (type) {
            case 'line':
                this.currentDrawing = new LineDrawing();
                break;
            case 'rectangle':
                this.currentDrawing = new RectangleDrawing();
                break;
            case 'fibonacci':
                this.currentDrawing = new FibonacciDrawing(this.stockChart.options.theme);
                break;
            default:
                return;
        }

        // Set the style from defaults
        if (this.defaultStyles[type]) {
            Object.assign(this.currentDrawing.style, this.defaultStyles[type]);
        }

        // Add the first point
        this.currentDrawing.addPoint(time, price);


    }

    /**
     * Continue drawing with additional points
     * @param {number} x - Current x coordinate
     * @param {number} y - Current y coordinate
     */
    continueDrawing(x, y) {
        if (!this.isDrawing || !this.currentDrawing) return;
        
        // Check if the point is within the main plot area
        const mainPlot = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return;

        if (x >= mainPlot.x && x <= mainPlot.x + mainPlot.width &&
            y >= mainPlot.y && y <= mainPlot.y + mainPlot.height) {
            
            // Convert screen coordinates to data coordinates
            const barWidth = mainPlot.width / this.stockChart.dataViewport.visibleCount;
            const relativeX = x - mainPlot.x;
            const dataIndex = Math.floor(relativeX / barWidth);
            const actualDataIndex = this.stockChart.dataViewport.startIndex + dataIndex;

            // Get the data point at this index
            if (!this.stockChart.dataViewport?.allData || 
                actualDataIndex < 0 || 
                actualDataIndex >= this.stockChart.dataViewport.allData.length) return;

            const dataPoint = this.stockChart.dataViewport.allData[actualDataIndex];
            if (!dataPoint || typeof dataPoint.time !== 'number') return;

            const time = dataPoint.time;
            const mainPlotConfig = this.stockChart.options.plots.find(p => p.id === 'main');
            if (!mainPlotConfig) return;

            const priceRange = this.stockChart.calculatePriceRange(
                mainPlotConfig,
                this.stockChart.dataViewport.getVisibleData(),
                this.stockChart.dataViewport
            );
            if (!priceRange) return;

            // Calculate price from y coordinate
            const relativeY = y - mainPlot.y;
            const { minPrice, maxPrice } = priceRange;
            const price = maxPrice - (relativeY / mainPlot.height) * (maxPrice - minPrice);

            // Update or add point
            if (this.currentDrawing.points.length === 1) {
                // Don't add if it's the same as the first point
                const firstPoint = this.currentDrawing.points[0];
                if (time !== firstPoint.time || price !== firstPoint.price) {
                    this.currentDrawing.addPoint(time, price);
                }
            } else if (this.currentDrawing.points.length === 2) {
                // Update second point if it's different from the first
                const firstPoint = this.currentDrawing.points[0];
                if (time !== firstPoint.time || price !== firstPoint.price) {
                    this.currentDrawing.points[1] = { time, price };
                }
            }
        }
    }

    /**
     * Complete the current drawing
     */
    completeDrawing() {
        if (!this.isDrawing || !this.currentDrawing || this.currentDrawing.points.length < 2) return;

        this.drawings.push(this.currentDrawing);
        this.isDrawing = false;
        this.currentDrawing = null;
    }


    /**
     * Clear all drawings
     */
    clearDrawings() {
        this.drawings = [];
        this.currentDrawing = null;
        this.isDrawing = false;
        this.selectedDrawing = null;
    }

    /**
     * Render all drawings on the canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    render(ctx) {
        if (!this.stockChart.plotLayoutManager) return;

        const mainPlot = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return;

        ctx.save();
        // Set line join and cap for smoother drawings
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Render completed drawings
        this.drawings.forEach(drawing => {
            this.renderDrawing(ctx, drawing);
        });

        // Render current drawing in progress
        if (this.currentDrawing && this.isDrawing) {
            this.renderDrawing(ctx, this.currentDrawing);
        }

        ctx.restore();
    }

    /**
     * Render a single drawing
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Drawing} drawing - The drawing to render
     */
    renderDrawing(ctx, drawing) {
        const { type, points, style } = drawing;
        
        ctx.save();
        
        switch (type) {
            case 'line':
                this.renderLine(ctx, points, style);
                break;
            case 'rectangle':
                this.renderRectangle(ctx, points, style);
                break;
            case 'fibonacci':
                drawing.draw(ctx, 
                    this.stockChart.plotLayoutManager.getPlotLayout('main'),
                    this.stockChart.dataViewport,
                    this.stockChart.calculatePriceRange(
                        this.stockChart.options.plots.find(p => p.id === 'main'),
                        this.stockChart.dataViewport.getVisibleData(),
                        this.stockChart.dataViewport
                    ).minPrice,
                    this.stockChart.calculatePriceRange(
                        this.stockChart.options.plots.find(p => p.id === 'main'),
                        this.stockChart.dataViewport.getVisibleData(),
                        this.stockChart.dataViewport
                    ).maxPrice
                );
                break;
        }
        
        ctx.restore();
    }

    /**
     * Render a line drawing
     * @private
     */
    renderLine(ctx, points, style) {
        if (points.length < 2) return;

        const mainPlot = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return;

        const mainPlotConfig = this.stockChart.options.plots.find(p => p.id === 'main');
        if (!mainPlotConfig) return;

        const priceRange = this.stockChart.calculatePriceRange(
            mainPlotConfig,
            this.stockChart.dataViewport.getVisibleData(),
            this.stockChart.dataViewport
        );
        if (!priceRange) return;

        const drawingItem = new DrawingItem();
        
        // Convert time/price to pixel coordinates for both points
        const start = drawingItem.getPixelCoordinates(
            points[0].time,
            points[0].price,
            mainPlot,
            {
                ...this.stockChart.dataViewport,
                getVisibleData: () => this.stockChart.dataViewport.getVisibleData()
            },
            priceRange.minPrice,
            priceRange.maxPrice
        );
        
        const end = drawingItem.getPixelCoordinates(
            points[1].time,
            points[1].price,
            mainPlot,
            {
                ...this.stockChart.dataViewport,
                getVisibleData: () => this.stockChart.dataViewport.getVisibleData()
            },
            priceRange.minPrice,
            priceRange.maxPrice
        );

        if (!start || !end) return;
        
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }

    /**
     * Render a rectangle drawing
     * @private
     */
    renderRectangle(ctx, points, style) {
        if (points.length < 2) return;

        const mainPlot = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return;

        const mainPlotConfig = this.stockChart.options.plots.find(p => p.id === 'main');
        if (!mainPlotConfig) return;

        const priceRange = this.stockChart.calculatePriceRange(
            mainPlotConfig,
            this.stockChart.dataViewport.getVisibleData(),
            this.stockChart.dataViewport
        );
        if (!priceRange) return;

        // Convert time/price to pixel coordinates for both points
        const start = new DrawingItem().getPixelCoordinates(
            points[0].time,
            points[0].price,
            mainPlot,
            this.stockChart.dataViewport,
            priceRange.minPrice,
            priceRange.maxPrice
        );
        
        const end = new DrawingItem().getPixelCoordinates(
            points[1].time,
            points[1].price,
            mainPlot,
            this.stockChart.dataViewport,
            priceRange.minPrice,
            priceRange.maxPrice
        );

        if (!start || !end) return;
        
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        
        if (style.fillStyle) {
            ctx.fillStyle = style.fillStyle;
            ctx.fillRect(x, y, width, height);
        }
        
        ctx.strokeStyle = style.strokeStyle;
        ctx.lineWidth = style.lineWidth;
        ctx.strokeRect(x, y, width, height);
    }



    /**
     * Check if point is near a line
     * @private
     */
    isPointNearLine(x, y, points, threshold) {
        if (points.length < 2) return false;
        
        const [p1, p2] = points;
        const distance = this.pointToLineDistance(x, y, p1.x, p1.y, p2.x, p2.y);
        return distance <= threshold;
    }

    /**
     * Check if point is in a rectangle
     * @private
     */
    isPointInRectangle(x, y, points) {
        if (points.length < 2) return false;
        
        const rectX = Math.min(points[0].x, points[1].x);
        const rectY = Math.min(points[0].y, points[1].y);
        const rectWidth = Math.abs(points[1].x - points[0].x);
        const rectHeight = Math.abs(points[1].y - points[0].y);
        
        return x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight;
    }

    /**
     * Calculate distance from point to line segment
     * @private
     */
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Export drawings as JSON
     * @returns {string} JSON string of drawings
     */
    exportDrawings() {
        return JSON.stringify(this.drawings);
    }

    /**
     * Import drawings from JSON
     * @param {string} jsonString - JSON string of drawings
     */
    importDrawings(jsonString) {
        try {
            const drawings = JSON.parse(jsonString);
            this.drawings = drawings;
        } catch (error) {
            console.error('Failed to import drawings:', error);
        }
    }
}