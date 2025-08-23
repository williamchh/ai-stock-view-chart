

import { DataViewport } from './data.js';
import { DrawingItem, LineDrawing, RectangleDrawing, FibonacciDrawing, FibonacciZoonDrawing } from './drawing-item.js';
import { PlotLayoutManager } from './layout.js';
;
/**
 * @typedef {Object} StockChart
 * @property {HTMLCanvasElement} canvas - The chart canvas element.
 * @property {PlotLayoutManager} plotLayoutManager - Manager for plot layouts.
 * @property {DataViewport} dataViewport - Data viewport information
 * @property {import('../stock-chart.js').StockChartOptions} options - Chart options
 * @property {Function} calculatePriceRange - Function to calculate price range
 * @property {HTMLDivElement} toolbar - The toolbar element
 * @property {Object} currentTheme - The current theme object
 * @property {Function} setDrawingTool - Function to set the active drawing tool
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
        this.selectedPoint = null;
        this.isEditing = false;
        this._isChartFrozen = false;
        
        // We'll calculate barWidth dynamically when needed instead of storing it
        
        
        // Bind mouse event handlers
        this.handleMouseDownBound = this.handleMouseDown.bind(this);
        this.handleMouseMoveBound = this.continueDrawing.bind(this);
        this.handleMouseUpBound = this.completeDrawing.bind(this);
        
        // Add mouse event listeners to the canvas
        this.stockChart.canvas.addEventListener('mousedown', this.handleMouseDownBound);
        this.stockChart.canvas.addEventListener('mousemove', this.handleMouseMoveBound);
        this.stockChart.canvas.addEventListener('mouseup', this.handleMouseUpBound);
        
        // Drawing styles
        this.defaultStyles = {
            line: {
                strokeStyle: '#ff6b35',
                lineWidth: 2,
                fillStyle: 'rgba(255, 107, 53, 0.1)'
            },
            'horizontal-line': {
                strokeStyle: '#ff6b35',
                lineWidth: 2,
                fillStyle: 'rgba(255, 107, 53, 0.1)'
            },
            'vertical-line': {
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
            },
            'fibonacci-zoon': {
                strokeStyle: stockChart.options.theme === 'dark' ? '#ffffffc5' : '#000000a9',
                lineWidth: 1,
                fillStyle: 'rgba(76, 175, 80, 0.1)'
            }
        };
    }

    /**
     * Get whether the chart should be frozen (not draggable/zoomable)
     * @returns {boolean} True if the chart should be frozen
     */
    get isChartFrozen() {
        return this._isChartFrozen;
    }

    /**
     * Set the active drawing tool
     * @param {string} tool - The tool to activate (null to disable drawing)
     */
    setActiveTool(tool) {
        // If clicking the same tool that's already active, deactivate it
        if (this.activeTool === tool) {
            this.activeTool = null;
        } else {
            this.activeTool = tool;
        }
        this.currentDrawing = null;
        this.isDrawing = false;
        this.selectedDrawing = null;
        this.selectedPoint = null;
        this.isEditing = false;
    }

    /**
     * Start a new drawing
     * @param {string} type - Type of drawing
     * @param {number} x - Starting x coordinate
     * @param {number} y - Starting y coordinate
     */
    startDrawing(type, x, y) {
        if (this.activeTool && this.activeTool !== type) return;

        this.isDrawing = true;

        // Convert screen coordinates to data coordinates
        const mainPlotLayout = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlotLayout) return;

        const relativeX = x - mainPlotLayout.x;
        const barWidth = mainPlotLayout.width / this.stockChart.dataViewport.visibleCount;
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
            case 'fibonacci-zoon':
                const barWidth = mainPlotLayout.width / this.stockChart.dataViewport.visibleCount;
                this.currentDrawing = new FibonacciZoonDrawing(this.stockChart.options.theme, barWidth);
                break;
            case 'horizontal-line':
                this.currentDrawing = new LineDrawing('horizontal-line');
                break;
            case 'vertical-line':
                this.currentDrawing = new LineDrawing('vertical-line');
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
     * @param {MouseEvent} event - The mouse event
     */
    continueDrawing(event) {
        // Get the canvas coordinates
        const rect = this.stockChart.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Check if the point is within the main plot area
        const mainPlot = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return;

        if (x >= mainPlot.x && x <= mainPlot.x + mainPlot.width &&
            y >= mainPlot.y && y <= mainPlot.y + mainPlot.height) {
            
            // Convert screen coordinates to data coordinates
            // const barWidth = mainPlot.width / this.stockChart.dataViewport.visibleCount;
            const relativeX = x - mainPlot.x;
            const barWidth = mainPlot.width / this.stockChart.dataViewport.visibleCount;
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

            if (this.isEditing && this.selectedDrawing && this.selectedPoint !== null) {
                // Update the selected point's position
                this.selectedDrawing.points[this.selectedPoint] = { time, price };
            } else if (this.isDrawing && this.currentDrawing) {



                // Update or add point for new drawing
                if (this.currentDrawing.points.length === 1) {
                    // Don't add if it's the same as the first point
                    const firstPoint = this.currentDrawing.points[0];
                    if (time !== firstPoint.time || price !== firstPoint.price) {
                        this.currentDrawing.addPoint(time, price);
                    }
                } else if (this.currentDrawing.points.length === 2) {
                    const firstPoint = this.currentDrawing.points[0];
                    if (['horizontal-line', 'vertical-line'].includes(this.activeTool)) {
                        if (this.activeTool === 'horizontal-line') {
                            this.currentDrawing.points[1] = { time, price: firstPoint.price };
                        } else if (this.activeTool === 'vertical-line') {
                            this.currentDrawing.points[1] = { time: firstPoint.time, price };
                        }
                    }
                    else {
                        // Update second point if it's different from the first
                        if (time !== firstPoint.time || price !== firstPoint.price) {
                            this.currentDrawing.points[1] = { time, price };
                        }
                    }
                }
            }
        }
    }

    /**
     * Complete the current drawing
     */
    completeDrawing() {
        if (this.isEditing) {
            // Keep editing mode active, just release the point being edited
            this.selectedPoint = null;
        } else if (this.isDrawing && this.currentDrawing && this.currentDrawing.points.length >= 2) {
            // Complete new drawing
            this.drawings.push(this.currentDrawing);
            this.isDrawing = false;

            // Reset drawing state but don't automatically select the drawing
            this.selectedDrawing = null;
            this.currentDrawing = null;
            this.isEditing = false;
            this._isChartFrozen = false;
            
            // Automatically switch back to select tool
            this.setActiveTool(null);
            // Notify stockChart to update toolbar
            if (this.stockChart && typeof this.stockChart.setDrawingTool === 'function') {
                this.stockChart.setDrawingTool(null);
            }
        }
    }

    /**
     * Handle mouse down event
     * @param {MouseEvent} event - The mouse event
     */
    handleMouseDown(event) {
        // Get the canvas coordinates
        const rect = this.stockChart.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (this.activeTool) {
            this.startDrawing(this.activeTool, x, y);
        } else {
            // Try to select a point for editing
            if (this.trySelectPoint(x, y)) {
                this.isEditing = true;
                this._isChartFrozen = true;
                return;
            }

            // Check if we clicked near the current selected drawing
            const clickedOnDrawing = this.selectedDrawing && this.isNearDrawing(x, y, this.selectedDrawing);
            
            // If we clicked away from any drawing, unfreeze the chart and clear selection
            if (!clickedOnDrawing) {
                this.isEditing = false;
                this.selectedDrawing = null;
                this.selectedPoint = null;
                this._isChartFrozen = false;
            }
        }
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

        // Render control points for selected drawing
        if (this.selectedDrawing) {
            this.renderControlPoints(ctx, this.selectedDrawing);
        }

        ctx.restore();
    }

    /**
     * Render control points for a drawing
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {DrawingItem} drawing - The drawing to render control points for
     */
    renderControlPoints(ctx, drawing) {
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
        // Draw control points for each point in the drawing
        drawing.points.forEach((point, index) => {
            const screenPoint = new DrawingItem().getPixelCoordinates(
                point.time,
                point.price,
                mainPlot,
                this.stockChart.dataViewport,
                priceRange.minPrice,
                priceRange.maxPrice
            );

            
            if (screenPoint) {
                if (drawing.type === 'fibonacci-zoon') {
                    const barWidth = mainPlot.width / this.stockChart.dataViewport.visibleCount;
                    screenPoint.x += barWidth / 2; // Adjust for Fibonacci zone center
                }
                ctx.beginPath();
                ctx.arc(screenPoint.x, screenPoint.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = index === this.selectedPoint ? '#ff0000' : '#ffffff';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();
            }
        });
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
            case 'horizontal-line':
            case 'vertical-line':
                this.renderLine(ctx, points, style);
                break;
            case 'rectangle':
                this.renderRectangle(ctx, points, style);
                break;
            case 'fibonacci':
            case 'fibonacci-zoon':
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
     * Check if a point is near a drawing
     * @param {number} x - Screen x coordinate
     * @param {number} y - Screen y coordinate
     * @param {DrawingItem} drawing - The drawing to check
     * @returns {boolean} True if the point is near the drawing
     */
    isNearDrawing(x, y, drawing) {
        debugger
        const mainPlot = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return false;

        const mainPlotConfig = this.stockChart.options.plots.find(p => p.id === 'main');
        if (!mainPlotConfig) return false;

        const priceRange = this.stockChart.calculatePriceRange(
            mainPlotConfig,
            this.stockChart.dataViewport.getVisibleData(),
            this.stockChart.dataViewport
        );
        if (!priceRange) return false;

        // Convert drawing points to screen coordinates
        const screenPoints = drawing.points.map(point => {
            return new DrawingItem().getPixelCoordinates(
                point.time,
                point.price,
                mainPlot,
                this.stockChart.dataViewport,
                priceRange.minPrice,
                priceRange.maxPrice
            );
        }).filter(Boolean);

        if (screenPoints.length < 2) return false;

        // Check if point is near the drawing based on its type
        switch (drawing.type) {
            case 'line':
                return this.isPointNearLine(x, y, screenPoints, 10); // 10px threshold
            case 'rectangle':
                return this.isPointInRectangle(x, y, screenPoints);
            case 'fibonacci':
                return this.isPointNearLine(x, y, screenPoints, 10); // Handle like a line
            default:
                return false;
        }
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
     * Check if a point is near a drawing point
     * @param {number} x - Screen x coordinate
     * @param {number} y - Screen y coordinate
     * @param {DrawingItem} drawing - The drawing to check
     * @returns {Object|null} The point index if found, null otherwise
     */
    isNearDrawingPoint(x, y, drawing) {
        const mainPlot = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return null;

        const mainPlotConfig = this.stockChart.options.plots.find(p => p.id === 'main');
        if (!mainPlotConfig) return null;

        const priceRange = this.stockChart.calculatePriceRange(
            mainPlotConfig,
            this.stockChart.dataViewport.getVisibleData(),
            this.stockChart.dataViewport
        );
        if (!priceRange) return null;

        // Convert each drawing point to screen coordinates and check distance
        const threshold = 10; // pixels
        for (let i = 0; i < drawing.points.length; i++) {
            const point = drawing.points[i];
            const screenPoint = new DrawingItem().getPixelCoordinates(
                point.time,
                point.price,
                mainPlot,
                this.stockChart.dataViewport,
                priceRange.minPrice,
                priceRange.maxPrice
            );

            if (screenPoint) {
                let distance;
                if (drawing.type === 'fibonacci-zoon') {
                    // For Fibonacci zoon, only consider x-coordinate distance
                    distance = Math.abs(x - screenPoint.x);
                } else {
                    // For other drawings, consider both x and y coordinates
                    distance = Math.sqrt(
                        Math.pow(x - screenPoint.x, 2) + 
                        Math.pow(y - screenPoint.y, 2)
                    );
                }
                if (distance <= threshold) {
                    return {
                        pointIndex: i,
                        drawing: drawing
                    };
                }
            }
        }
        return null;
    }

    /**
     * Try to select a drawing point at the given coordinates
     * @param {number} x - Screen x coordinate
     * @param {number} y - Screen y coordinate
     * @returns {boolean} True if a point was selected
     */
    trySelectPoint(x, y) {
        for (const drawing of this.drawings) {
            const result = this.isNearDrawingPoint(x, y, drawing);
            if (result) {
                this.selectedDrawing = result.drawing;
                this.selectedPoint = result.pointIndex;
                this.isEditing = true;
                return true;
            }
        }
        return false;
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