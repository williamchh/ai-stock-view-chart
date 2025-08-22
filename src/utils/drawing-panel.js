

/**
 * @typedef {Object} StockChart
 * @property {HTMLCanvasElement} canvas - The chart canvas element.
 * @property {any} plotLayoutManager - Manager for plot layouts.
 * @property {any} dataViewport - Viewport handling data slicing and indexing.
 * @property {number} minPrice - Minimum price in the visible range.
 * @property {number} maxPrice - Maximum price in the visible range.
*/
/**
 * @typedef {Object} DrawingPoint
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} [price] - Price at this point
 * @property {Date} [date] - Date at this point
 */

import { getValueBasedOnY } from "./data.js";

/**
 * @typedef {Object} Drawing
 * @property {string} id - Unique identifier
 * @property {string} type - Type of drawing (line, rectangle, ellipse, text, etc.)
 * @property {DrawingPoint[]} points - Array of points defining the drawing
 * @property {Object} style - Style properties for the drawing
 * @property {string} [text] - Text content for text drawings
 * @property {boolean} [completed] - Whether the drawing is complete
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
                color: '#ff6b35',
                width: 2,
                lineDash: []
            },
            rectangle: {
                color: '#ff6b35',
                width: 2,
                fillColor: 'rgba(255, 107, 53, 0.1)',
                lineDash: []
            },
            ellipse: {
                color: '#ff6b35',
                width: 2,
                fillColor: 'rgba(255, 107, 53, 0.1)',
                lineDash: []
            },
            text: {
                color: '#ffffff',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                font: '12px Arial',
                padding: 4
            },
            fibonacci: {
                color: '#4CAF50',
                width: 1,
                fillColors: [
                    'rgba(76, 175, 80, 0.1)',
                    'rgba(76, 175, 80, 0.15)',
                    'rgba(76, 175, 80, 0.2)',
                    'rgba(76, 175, 80, 0.25)',
                    'rgba(76, 175, 80, 0.3)'
                ]
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
        const point = this.screenToChartCoordinates(x, y);
        
        this.currentDrawing = {
            id: this.generateId(),
            type: type,
            points: [point],
            style: { ...this.defaultStyles[type] },
            completed: false
        };

        // Handle text tool specifically
        if (type === 'text') {
            // Prompt for text input
            const text = window.prompt('Enter text:', '');
            if (text !== null) {
                this.currentDrawing.text = text;
                this.completeDrawing(); // Complete drawing immediately after text input
            } else {
                this.cancelDrawing(); // Cancel if user cancels prompt
            }
        }
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
            
            const point = this.screenToChartCoordinates(x, y);
            
            // Text doesn't need continueDrawing as it's completed immediately
            if (this.currentDrawing.type === 'text') return;
            
            if (this.currentDrawing.type === 'line' || 
                this.currentDrawing.type === 'rectangle' || 
                this.currentDrawing.type === 'ellipse' || 
                this.currentDrawing.type === 'fibonacci') {
                // For two-point drawings, update the second point
                if (this.currentDrawing.points.length === 1) {
                    this.currentDrawing.points.push(point);
                } else if (this.currentDrawing.points.length === 2) {
                    this.currentDrawing.points[1] = point;
                }
            } else if (this.currentDrawing.type === 'freehand') {
                // For freehand drawing, add points continuously
                this.currentDrawing.points.push(point);
            }
        }
    }

    /**
     * Complete the current drawing
     */
    completeDrawing() {
        if (!this.isDrawing || !this.currentDrawing) return;

        this.currentDrawing.completed = true;
        this.drawings.push(this.currentDrawing);
        this.isDrawing = false;
        this.currentDrawing = null;
    }

    /**
     * Cancel the current drawing
     */
    cancelDrawing() {
        this.isDrawing = false;
        this.currentDrawing = null;
    }

    /**
     * Remove a drawing by ID
     * @param {string} id - The drawing ID to remove
     */
    removeDrawing(id) {
        this.drawings = this.drawings.filter(d => d.id !== id);
        if (this.selectedDrawing?.id === id) {
            this.selectedDrawing = null;
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
            case 'ellipse':
                this.renderEllipse(ctx, points, style);
                break;
            case 'text':
                this.renderText(ctx, points, drawing.text, style);
                break;
            case 'fibonacci':
                this.renderFibonacci(ctx, points, style);
                break;
            case 'freehand':
                this.renderFreehand(ctx, points, style);
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
        
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        if (style.lineDash && style.lineDash.length > 0) {
            ctx.setLineDash(style.lineDash);
        }
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
    }

    /**
     * Render a rectangle drawing
     * @private
     */
    renderRectangle(ctx, points, style) {
        if (points.length < 2) return;
        
        const x = Math.min(points[0].x, points[1].x);
        const y = Math.min(points[0].y, points[1].y);
        const width = Math.abs(points[1].x - points[0].x);
        const height = Math.abs(points[1].y - points[0].y);
        
        if (style.fillColor) {
            ctx.fillStyle = style.fillColor;
            ctx.fillRect(x, y, width, height);
        }
        
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        if (style.lineDash && style.lineDash.length > 0) {
            ctx.setLineDash(style.lineDash);
        }
        ctx.strokeRect(x, y, width, height);
    }

    /**
     * Render an ellipse drawing
     * @private
     */
    renderEllipse(ctx, points, style) {
        if (points.length < 2) return;
        
        const centerX = (points[0].x + points[1].x) / 2;
        const centerY = (points[0].y + points[1].y) / 2;
        const radiusX = Math.abs(points[1].x - points[0].x) / 2;
        const radiusY = Math.abs(points[1].y - points[0].y) / 2;
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        
        if (style.fillColor) {
            ctx.fillStyle = style.fillColor;
            ctx.fill();
        }
        
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        if (style.lineDash && style.lineDash.length > 0) {
            ctx.setLineDash(style.lineDash);
        }
        ctx.stroke();
    }

    /**
     * Render text drawing
     * @private
     */
    renderText(ctx, points, text, style) {
        if (!text || points.length === 0) return;
        
        const point = points[0];
        
        ctx.font = style.font;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = parseInt(style.font); // Get font size from style
        
        // Calculate text position with proper alignment
        const bgX = point.x;
        const bgY = point.y;
        const bgWidth = textWidth + (style.padding * 2);
        const bgHeight = textHeight + (style.padding * 2);
        
        // Background
        if (style.backgroundColor) {
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        }
        
        // Text - position text in the middle of background
        ctx.fillStyle = style.color;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bgX + style.padding, bgY + (bgHeight / 2));
    }

    /**
     * Render Fibonacci retracements
     * @private
     */
    renderFibonacci(ctx, points, style) {
        if (points.length < 2) return;
        
        const start = points[0];
        const end = points[1];
        const levels = [0, 0.236, 0.382, 0.618, 1, 1.618, 2, 2.618, 3.618, 4.236];
        
        // Calculate the full height based on 23.6% level
        // If end point represents 23.6%, calculate what 100% would be
        const height100 = Math.abs(end.y - start.y);
        const fullHeight = height100;
        const direction = end.y > start.y ? 1 : -1;
        
        // Set common styles for all lines
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.setLineDash([5, 5]);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        
        // Draw each level
        levels.forEach(level => {
            // Calculate Y position based on the full height
            const y = start.y + (direction * fullHeight * level);
            
            // Draw line
            ctx.beginPath();
            ctx.moveTo(start.x, y);
            ctx.lineTo(end.x, y);
            ctx.stroke();
            
            // Draw label
            ctx.fillStyle = style.color;
            const label = `${(level * 100).toFixed(1)}%`;
            ctx.fillText(label, Math.min(start.x, end.x) + 5, y - 2);
        });
        
        // Reset line dash
        ctx.setLineDash([]);
    }

    /**
     * Render freehand drawing
     * @private
     */
    renderFreehand(ctx, points, style) {
        if (points.length < 2) return;
        
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        
        ctx.stroke();
    }

    /**
     * Convert screen coordinates to chart coordinates
     * @param {number} screenX - Screen X coordinate
     * @param {number} screenY - Screen Y coordinate
     * @returns {DrawingPoint} Chart coordinates
     */
    screenToChartCoordinates(screenX, screenY) {
        const plotLayout = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!plotLayout) {
            return { x: screenX, y: screenY };
        }

        // First check if we have valid data viewport
        if (!this.stockChart.dataViewport?.data) {
            return { x: screenX, y: screenY };
        }

        const visibleData = this.stockChart.dataViewport.getVisibleData() || [];
        if (visibleData.length === 0) {
            return { x: screenX, y: screenY };
        }

        // Calculate price range
        const lows = visibleData.map(d => d.low).filter(v => v !== undefined && v !== null);
        const highs = visibleData.map(d => d.high).filter(v => v !== undefined && v !== null);
        
        if (lows.length === 0 || highs.length === 0) {
            return { x: screenX, y: screenY };
        }

        const minPrice = Math.min(...lows);
        const maxPrice = Math.max(...highs);
        const priceRange = maxPrice - minPrice;
        const paddedMinPrice = minPrice - (priceRange * 0.1);
        const paddedMaxPrice = maxPrice + (priceRange * 0.1);

        // Convert screen coordinates to chart coordinates
        const x = screenX;
        const y = screenY;
        
        // Calculate price at Y position
        const price = getValueBasedOnY(
            y,
            plotLayout.y,
            plotLayout.height,
            paddedMinPrice,
            paddedMaxPrice
        );

        // Calculate date at X position
        let date = null;
        if (this.stockChart.dataViewport && x >= plotLayout.x && x <= plotLayout.x + plotLayout.width) {
            const barWidth = plotLayout.width / this.stockChart.dataViewport.visibleCount;
            const dataIndex = Math.floor(this.stockChart.dataViewport.startIndex + 
                (x - plotLayout.x) / barWidth);
            
            if (dataIndex >= 0 && dataIndex < this.stockChart.dataViewport.data.length) {
                const dataPoint = this.stockChart.dataViewport.data[dataIndex];
                if (dataPoint && dataPoint.time) {
                    date = new Date(dataPoint.time * 1000);
                }
            }
        }
        
        return { x, y, price, date };
    }

    /**
     * Generate a unique ID for drawings
     * @returns {string} Unique ID
     */
    generateId() {
        return 'drawing_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get drawing at specific coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Drawing|null} Drawing at coordinates or null
     */
    getDrawingAt(x, y) {
        // Simple hit detection - check if point is near any drawing
        const threshold = 5;
        
        for (let i = this.drawings.length - 1; i >= 0; i--) {
            const drawing = this.drawings[i];
            if (this.isPointNearDrawing(x, y, drawing, threshold)) {
                return drawing;
            }
        }
        
        return null;
    }

    /**
     * Check if point is near a drawing
     * @private
     */
    isPointNearDrawing(x, y, drawing, threshold) {
        switch (drawing.type) {
            case 'line':
                return this.isPointNearLine(x, y, drawing.points, threshold);
            case 'rectangle':
                return this.isPointInRectangle(x, y, drawing.points);
            case 'ellipse':
                return this.isPointInEllipse(x, y, drawing.points);
            case 'text':
                return this.isPointNearText(x, y, drawing.points);
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
     * Check if point is in an ellipse
     * @private
     */
    isPointInEllipse(x, y, points) {
        if (points.length < 2) return false;
        
        const centerX = (points[0].x + points[1].x) / 2;
        const centerY = (points[0].y + points[1].y) / 2;
        const radiusX = Math.abs(points[1].x - points[0].x) / 2;
        const radiusY = Math.abs(points[1].y - points[0].y) / 2;
        
        const normalizedX = (x - centerX) / radiusX;
        const normalizedY = (y - centerY) / radiusY;
        
        return (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
    }

    /**
     * Check if point is near text
     * @private
     */
    isPointNearText(x, y, points) {
        if (points.length === 0) return false;
        
        const point = points[0];
        const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
        return distance <= 10;
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