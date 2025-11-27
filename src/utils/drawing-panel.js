

/**
 * Helper function to determine if a color is dark
 * @param {string} color - The color to check (hex format)
 * @returns {boolean} True if the color is dark
 */
function isDarkColor(color) {
    // Remove the # if present
    const hex = color.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Calculate luminance (perceived brightness)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return true if the color is dark (luminance < 0.5)
    return luminance < 0.5;
}

import { calculateBollingerBands, calculateDeMarker, calculateEMA, calculateMACD, calculateRSI, calculateSMA } from '../indicators/indicator-utils.js';
import { DataViewport, getXPixel } from './data.js';
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
 * @property {Function} render - Function to render/redraw the chart
 * @property {Function} loadIndicatorSettings - Function to load indicator settings
 * @property {Function} applyTheme - Function to apply the current theme
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
        this.editPlotId = null;

        // We'll calculate barWidth dynamically when needed instead of storing it
        
        
        // Bind mouse and touch event handlers
        this.handleMouseDownBound = this.handleMouseDown.bind(this);
        this.handleMouseMoveBound = this.continueDrawing.bind(this);
        this.handleMouseUpBound = this.completeDrawing.bind(this);
        this.handleTouchStartBound = this.handleTouchStart.bind(this);
        this.handleTouchMoveBound = this.handleTouchMove.bind(this);
        this.handleTouchEndBound = this.handleTouchEnd.bind(this);
        
        // Add mouse event listeners to the canvas
        this.stockChart.canvas.addEventListener('mousedown', this.handleMouseDownBound);
        this.stockChart.canvas.addEventListener('mousemove', this.handleMouseMoveBound);
        this.stockChart.canvas.addEventListener('mouseup', this.handleMouseUpBound);
        
        // Add touch event listeners to the canvas
        this.stockChart.canvas.addEventListener('touchstart', this.handleTouchStartBound, { passive: false });
        this.stockChart.canvas.addEventListener('touchmove', this.handleTouchMoveBound, { passive: false });
        this.stockChart.canvas.addEventListener('touchend', this.handleTouchEndBound);
        
        // Add touch events to control points for better mobile interaction
        this.touchStartTime = 0;
        this.touchTimeout = null;
        this.touchDistance = 0;
        this.touchMoved = false;
        
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
 * Check if we're on a mobile device
 * @returns {boolean} True if on mobile device
 * @private
 */
_isMobile() {
    return window.innerWidth <= 768;
}

/**
 * Get touch point coordinates relative to canvas
 * @param {Touch} touch - The touch event's Touch object
 * @returns {{x: number, y: number}} The coordinates
 * @private
 */
_getTouchCoordinates(touch) {
    const rect = this.stockChart.canvas.getBoundingClientRect();
    return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
    };
}    /**
     * Set the active drawing tool
     * @param {string} tool - The tool to activate (null to disable drawing)
     */
    setActiveTool(tool) {
        console.log('setActiveTool', tool);
        if (tool === 'settings') {
            this.showIndicatorSettings();
            return;
        }
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
        this._isChartFrozen = true; // Freeze chart when drawing starts

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
                this.currentDrawing = new LineDrawing(barWidth);
                break;
            case 'rectangle':
                this.currentDrawing = new RectangleDrawing();
                break;
            case 'fibonacci':
                this.currentDrawing = new FibonacciDrawing(this.stockChart.options.theme);
                break;
            case 'fibonacci-zoon':
                this.currentDrawing = new FibonacciZoonDrawing(this.stockChart.options.theme, barWidth);
                break;
            case 'horizontal-line':
                this.currentDrawing = new LineDrawing(barWidth, 'horizontal-line');
                break;
            case 'vertical-line':
                this.currentDrawing = new LineDrawing(barWidth, 'vertical-line');
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
     * @param {MouseEvent | { clientX: number, clientY: number }} event - The event object containing client coordinates
     */
    continueDrawing(event) {
        // Get the canvas coordinates
        const rect = this.stockChart.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Check if the point is within the main plot area
        const mainPlot = this.stockChart.plotLayoutManager.getPlotLayout('main');
        if (!mainPlot) return;

        // Update crosshair position to follow mouse/finger during drawing
        if (x >= mainPlot.x && x <= mainPlot.x + mainPlot.width) {
            const barWidth = mainPlot.width / this.stockChart.dataViewport.visibleCount;
            
            // Calculate which candlestick mouse is closest to (same logic as in stock-chart.js)
            const relativeX = x - mainPlot.x;
            const dataIndex = Math.round(relativeX / barWidth - 0.5);
            
            // Ensure dataIndex stays within valid bounds
            const clampedIndex = Math.max(0, Math.min(this.stockChart.dataViewport.visibleCount - 1, dataIndex));
            
            // Calculate exact center of candlestick
            const candleX = mainPlot.x + getXPixel(
                this.stockChart.dataViewport.startIndex + clampedIndex,
                this.stockChart.dataViewport.startIndex,
                this.stockChart.dataViewport.visibleCount,
                mainPlot.width,
                barWidth
            );
            
            // Update crosshair position
            /** @type {any} */ (this.stockChart).crosshairX = candleX + (barWidth / 2);
        }
        /** @type {any} */ (this.stockChart).crosshairY = y;

        if (x >= mainPlot.x && x <= mainPlot.x + mainPlot.width &&
            y >= mainPlot.y && y <= mainPlot.y + mainPlot.height) {
            
            // Convert screen coordinates to data coordinates
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

            let needsRender = false;

            if (this.isEditing && this.selectedDrawing && this.selectedPoint !== null) {
                // Update the selected point's position
                const oldPoint = { ...this.selectedDrawing.points[this.selectedPoint] };
                const newPoint = { time, price };

                // Only update if position changed
                if (oldPoint.time !== newPoint.time || oldPoint.price !== newPoint.price) {
                    this.selectedDrawing.points[this.selectedPoint] = newPoint;
                    needsRender = true;
                }
            } 
            else if (this.isDrawing && this.currentDrawing) {
                // Create second point immediately if we don't have one
                if (this.currentDrawing.points.length === 1) {
                    const point = { time, price };
                    if (['horizontal-line', 'vertical-line'].includes(this.activeTool)) {
                        const firstPoint = this.currentDrawing.points[0];
                        if (this.activeTool === 'horizontal-line') {
                            point.price = firstPoint.price;
                        } else if (this.activeTool === 'vertical-line') {
                            point.time = firstPoint.time;
                        }
                    }
                    this.currentDrawing.addPoint(point.time, point.price);
                    needsRender = true;
                }
                // Keep updating the last point's position while drawing
                else if (this.currentDrawing.points.length === 2) {
                    const oldPoint = { ...this.currentDrawing.points[1] };
                    const firstPoint = this.currentDrawing.points[0];
                    let newPoint = { time, price };

                    if (['horizontal-line', 'vertical-line'].includes(this.activeTool)) {
                        if (this.activeTool === 'horizontal-line') {
                            newPoint.price = firstPoint.price;
                        } else if (this.activeTool === 'vertical-line') {
                            newPoint.time = firstPoint.time;
                        }
                    }

                    // Only update if position changed
                    if (oldPoint.time !== newPoint.time || oldPoint.price !== newPoint.price) {
                        this.currentDrawing.points[1] = newPoint;
                        needsRender = true;
                    }
                }
            }

            // Only render if something changed
            if (needsRender) {
                this.stockChart.render();
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
            this._isChartFrozen = false; // Unfreeze chart when drawing completes
            
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
     * Handle touch start event
     * @param {TouchEvent} event - The touch event
     */
    handleTouchStart(event) {
        event.preventDefault();
        event.stopPropagation();

        // Reset touch tracking variables
        this.touchStartTime = Date.now();
        this.touchMoved = false;
        this.touchDistance = 0;

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const { x, y } = this._getTouchCoordinates(touch);
            
            if (this.activeTool) {
                this.startDrawing(this.activeTool, x, y);
            } else {
                // Clear any existing touch timeout
                if (this.touchTimeout) {
                    clearTimeout(this.touchTimeout);
                    this.touchTimeout = null;
                }

                // Try to select a point for editing with a larger hit area on mobile
                const hitArea = this._isMobile() ? 20 : 10; // Larger hit area for mobile
                if (this.trySelectPoint(x, y, hitArea)) {
                    this.isEditing = true;
                    this._isChartFrozen = true;
                    
                    // Add haptic feedback if available
                    if (window.navigator && window.navigator.vibrate) {
                        window.navigator.vibrate(50); // Short vibration
                    }
                    return;
                }

                // Check if we touched near the current selected drawing
                const touchedOnDrawing = this.selectedDrawing && this.isNearDrawing(x, y, this.selectedDrawing);
                
                // If we touched away from any drawing, set up a timeout to clear selection
                // This allows for a small delay to distinguish between tap and drag
                if (!touchedOnDrawing) {
                    this.touchTimeout = setTimeout(() => {
                        if (!this.touchMoved) {
                            this.isEditing = false;
                            this.selectedDrawing = null;
                            this.selectedPoint = null;
                            this._isChartFrozen = false;
                            this.stockChart.render();
                        }
                    }, 300); // 300ms delay
                }
            }

            // Store initial touch position for detecting movement
            this.lastTouchX = x;
            this.lastTouchY = y;
        } else if (event.touches.length === 2) {
            // Handle multi-touch gestures (e.g., pinch to zoom) if needed
            // For now, we'll just prevent any ongoing editing
            if (this.isEditing) {
                this.completeDrawing();
            }
        }
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} event - The touch event
     */
    handleTouchMove(event) {
        event.preventDefault();
        event.stopPropagation();

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const { x, y } = this._getTouchCoordinates(touch);
            
            // Calculate the distance moved
            const deltaX = x - this.lastTouchX;
            const deltaY = y - this.lastTouchY;
            this.touchDistance += Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // If we've moved more than a threshold, mark as moved
            if (this.touchDistance > 10) {
                this.touchMoved = true;
                // Clear any pending touch timeout
                if (this.touchTimeout) {
                    clearTimeout(this.touchTimeout);
                    this.touchTimeout = null;
                }
            }
            
            // Update the drawing with smooth motion
            if (this.isDrawing && this.currentDrawing) {
                requestAnimationFrame(() => {
                    this.continueDrawing({ clientX: touch.clientX, clientY: touch.clientY });
                });
            } else if (this.isEditing && this.selectedDrawing) {
                requestAnimationFrame(() => {
                    this.continueDrawing({ clientX: touch.clientX, clientY: touch.clientY });
                });
            }
            
            // Store the current touch position
            this.lastTouchX = x;
            this.lastTouchY = y;
        } else if (event.touches.length === 2) {
            // Handle pinch-to-zoom if needed
            // For now, we just prevent any drawing operations
            if (this.isDrawing || this.isEditing) {
                this.touchMoved = true;
            }
        }
    }

    /**
     * Handle touch end event
     * @param {TouchEvent} event - The touch event
     */
    handleTouchEnd(event) {
        event.preventDefault();
        event.stopPropagation();

        const touchDuration = Date.now() - this.touchStartTime;
        
        // Clear any pending timeouts
        if (this.touchTimeout) {
            clearTimeout(this.touchTimeout);
            this.touchTimeout = null;
        }
        
        // Handle tap vs drag differently
        if (!this.touchMoved && touchDuration < 300) { // Short tap
            if (this.isEditing) {
                // Quick tap while editing completes the edit
                this.completeDrawing();
                
                // Add haptic feedback if available
                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate(50);
                }
            }
        } else {
            // Normal drawing/editing completion
            if (this.isDrawing || this.isEditing) {
                this.completeDrawing();
            }
        }
        
        // Reset touch state
        this.touchStartTime = 0;
        this.touchMoved = false;
        this.touchDistance = 0;
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
                // Use larger control points on mobile
                const isMobile = this._isMobile();
                const pointSize = isMobile ? 8 : 4;
                const lineWidth = isMobile ? 2 : 1;
                
                // Draw larger hit area first
                if (isMobile) {
                    ctx.beginPath();
                    ctx.arc(screenPoint.x, screenPoint.y, pointSize + 6, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fill();
                }
                
                // Draw the main control point
                ctx.beginPath();
                ctx.arc(screenPoint.x, screenPoint.y, pointSize, 0, Math.PI * 2);
                ctx.fillStyle = index === this.selectedPoint ? '#ff0000' : '#ffffff';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = lineWidth;
                ctx.fill();
                ctx.stroke();
                
                // Add inner dot for better visibility
                if (isMobile) {
                    ctx.beginPath();
                    ctx.arc(screenPoint.x, screenPoint.y, 2, 0, Math.PI * 2);
                    ctx.fillStyle = '#000000';
                    ctx.fill();
                }
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
                this.renderLine(ctx, points, style, type);
                break;
            case 'rectangle':
                this.renderRectangle(ctx, points, style);
                break;
            case 'fibonacci':
            case 'fibonacci-zoon':
                const times = this.stockChart.dataViewport.getVisibleStartEndTime();
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
                    ).maxPrice,
                    this.stockChart.currentTheme,
                    times
                );
                break;
        }
        
        ctx.restore();
    }

    /**
     * Render a line drawing
     * @private
     */
    renderLine(ctx, points, style, type) {
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

        const times = this.stockChart.dataViewport.getVisibleStartEndTime();
        if (times) {
            const { startTime, endTime } = times;
            // either points time before start time or after end time 
            // return
            if (points[0].time < startTime && points[1].time < startTime) return;
            if (points[0].time > endTime && points[1].time > endTime) return;
        }

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

        const times = this.stockChart.dataViewport.getVisibleStartEndTime();
        if (times) {
            const { startTime, endTime } = times;
            // either points time before start time or after end time 
            // return
            if (points[0].time < startTime && points[1].time < startTime) return;
            if (points[0].time > endTime && points[1].time > endTime) return;
        }

        if (!start && !end) return;

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
    isNearDrawingPoint(x, y, drawing, threshold = 10) {
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
    trySelectPoint(x, y, hitArea = 10) {
        for (const drawing of this.drawings) {
            const result = this.isNearDrawingPoint(x, y, drawing, hitArea);
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
    showIndicatorSettings(options = {}) {
        const { indicatorId: editIndicatorId, settings: editSettings, plotId: editPlotId } = options;
        this.indicators = [
            {
                name: 'SMA',
                id: 'sma',
                settings: [
                    { key: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 200 },
                    { key: 'priceType', label: 'Price Type', type: 'select', default: 'close',
                    options: [
                        { value: 'close', label: 'Close' },
                        { value: 'hlc/3', label: 'HLC/3' },
                        { value: 'ohlc/4', label: 'OHLC/4' },
                        { value: 'hlcc/4', label: 'HLCC/4' }
                    ]
                    },
                    { key: 'lineColor', label: 'Line Color', type: 'color', default: '#2196F3' }
                ]
            },
            { 
                name: 'EMA', 
                id: 'ema',
                settings: [
                    { key: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 200 },
                    { key: 'priceType', label: 'Price Type', type: 'select', default: 'close', 
                    options: [
                        { value: 'close', label: 'Close' },
                        { value: 'hlc/3', label: 'HLC/3' },
                        { value: 'ohlc/4', label: 'OHLC/4' },
                        { value: 'hlcc/4', label: 'HLCC/4' }
                    ]
                    },
                    { key: 'lineColor', label: 'Line Color', type: 'color', default: '#FF9800' }
                ]
            },
            { 
                name: 'RSI', 
                id: 'rsi',
                settings: [
                    { key: 'period', label: 'Period', type: 'number', default: 14, min: 2, max: 100 },
                    { key: 'priceType', label: 'Price Type', type: 'select', default: 'close', 
                    options: [
                        { value: 'close', label: 'Close' },
                        { value: 'hlc/3', label: 'HLC/3' },
                        { value: 'ohlc/4', label: 'OHLC/4' },
                        { value: 'hlcc/4', label: 'HLCC/4' }
                    ]
                    },
                    // { key: 'overbought', label: 'Overbought Level', type: 'number', default: 70, min: 50, max: 90 },
                    // { key: 'oversold', label: 'Oversold Level', type: 'number', default: 30, min: 10, max: 50 },
                    { key: 'lineColor', label: 'RSI Line Color', type: 'color', default: '#9C27B0' },
                    // { key: 'overboughtColor', label: 'Overbought Color', type: 'color', default: '#F44336' },
                    // { key: 'oversoldColor', label: 'Oversold Color', type: 'color', default: '#4CAF50' }
                ]
            },
            {
                id: 'macd',
                name: 'MACD',
                plots: [
                    { name: 'MACD Line', type: 'line' },
                    { name: 'Signal Line', type: 'line' },
                    { name: 'Histogram', type: 'histogram' }
                ],
                settings: [
                    { key: 'fastPeriod', label: 'Fast Period', type: 'number', default: 12, min: 1, max: 50 },
                    { key: 'slowPeriod', label: 'Slow Period', type: 'number', default: 26, min: 1, max: 100 },
                    { key: 'signalPeriod', label: 'Signal Period', type: 'number', default: 9, min: 1, max: 50 },
                    { key: 'priceType', label: 'Price Type', type: 'select', default: 'close',
                    options: [
                        { value: 'close', label: 'Close' },
                        { value: 'hlc/3', label: 'HLC/3' },
                        { value: 'ohlc/4', label: 'OHLC/4' },
                        { value: 'hlcc/4', label: 'HLCC/4' }
                    ]
                    },
                    { key: 'macdColor', label: 'MACD Line Color', type: 'color', default: '#2196F3' },
                    { key: 'signalColor', label: 'Signal Line Color', type: 'color', default: '#FF9800' },
                    { key: 'histogramColor', label: 'Histogram Color', type: 'color', default: '#4CAF50' }
                ]
            },
            { 
                name: 'Bollinger Bands', 
                id: 'bollinger',
                settings: [
                    { key: 'period', label: 'Period', type: 'number', default: 20, min: 2, max: 100 },
                    { key: 'stdDev', label: 'Standard Deviation', type: 'number', default: 2, min: 0.1, max: 5, step: 0.001 },
                    { key: 'priceType', label: 'Price Type', type: 'select', default: 'close', 
                    options: [
                        { value: 'close', label: 'Close' },
                        { value: 'hlc/3', label: 'HLC/3' },
                        { value: 'ohlc/4', label: 'OHLC/4' },
                        { value: 'hlcc/4', label: 'HLCC/4' }
                    ]
                    },
                    { key: 'upperBandColor', label: 'Upper Band Color', type: 'color', default: '#3F51B5' },
                    { key: 'middleBandColor', label: 'Middle Band Color', type: 'color', default: '#2196F3' },
                    { key: 'lowerBandColor', label: 'Lower Band Color', type: 'color', default: '#3F51B5' },
                    // { key: 'fillColor', label: 'Fill Color', type: 'color', default: '#E1F5FE', opacity: true }
                ]
            },
            { 
                name: 'DeMarker', 
                id: 'demarker',
                settings: [
                    { key: 'period', label: 'Period', type: 'number', default: 14, min: 1, max: 100 },
                    // { key: 'overbought', label: 'Overbought Level', type: 'number', default: 0.7, min: 0.5, max: 0.9, step: 0.01 },
                    // { key: 'oversold', label: 'Oversold Level', type: 'number', default: 0.3, min: 0.1, max: 0.5, step: 0.01 },
                    { key: 'lineColor', label: 'DeMarker Line Color', type: 'color', default: '#607D8B' },
                    // { key: 'overboughtColor', label: 'Overbought Color', type: 'color', default: '#F44336' },
                    // { key: 'oversoldColor', label: 'Oversold Color', type: 'color', default: '#4CAF50' }
                ]
            }
        ];

        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Create modal dialog
        const currentTheme = this.stockChart.currentTheme;
        const isDarkTheme = currentTheme.name === 'dark' ||
                           (currentTheme.background && isDarkColor(currentTheme.background));
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background-color: ${currentTheme.background || '#ffffff'};
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            width: 650px;
            max-width: 90vw;
            max-height: 80vh;
            overflow: hidden;
            font-family: Arial, sans-serif;
            color: ${currentTheme.textColor || '#333333'};
        `;

        dialog.innerHTML = `
            <div class="modal-header" style="padding: 20px; border-bottom: 1px solid ${currentTheme.gridColor || '#e0e0e0'}; background-color: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : '#f8f9fa'};">
                <h3 style="margin: 0; color: ${currentTheme.textColor || '#333'}; font-size: 18px;">Chart Settings</h3>
            </div>
            
            <div class="main-tab-container" style="display: flex; border-bottom: 1px solid ${currentTheme.gridColor || '#e0e0e0'}; background-color: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : '#f8f9fa'};">
                <button class="main-tab-btn active" data-group="settings" style="
                    flex: 1;
                    padding: 12px 16px;
                    border: none;
                    background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'};
                    color: ${currentTheme.textColor || '#333'};
                    cursor: pointer;
                    border-bottom: 2px solid #007bff;
                    font-weight: 500;
                    font-size: 15px;
                ">Settings</button>
                <button class="main-tab-btn" data-group="indicators" style="
                    flex: 1;
                    padding: 12px 16px;
                    border: none;
                    background: transparent;
                    color: ${isDarkTheme ? '#aaa' : '#666'};
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    font-weight: 500;
                    font-size: 15px;
                ">Indicators</button>
            </div>

            <div id="settings-group" class="tab-group active" style="display: block;">
                <div class="sub-tab-container" style="display: flex; border-bottom: 1px solid ${currentTheme.gridColor || '#e0e0e0'}; background-color: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : '#f8f9fa'}; overflow-x: auto;">
                    <button class="tab-btn active" data-tab="theme" style="
                        flex: 0 0 auto;
                        padding: 12px 16px;
                        border: none;
                        background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'};
                        color: ${currentTheme.textColor || '#333'};
                        cursor: pointer;
                        border-bottom: 2px solid #007bff;
                        font-weight: 500;
                        white-space: nowrap;
                        min-width: 80px;
                    ">Theme</button>
                </div>
            </div>

            <div id="indicators-group" class="tab-group" style="display: none;">
                <div class="sub-tab-container" style="display: flex; border-bottom: 1px solid ${currentTheme.gridColor || '#e0e0e0'}; background-color: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : '#f8f9fa'}; overflow-x: auto;">
                    ${this.indicators.map((indicator, index) => `
                        <button class="tab-btn ${index === 0 ? 'active' : ''}" data-tab="${indicator.id}" style="
                            flex: 0 0 auto;
                            padding: 12px 16px;
                            border: none;
                            background: ${index === 0 ? (isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white') : 'transparent'};
                            color: ${index === 0 ? (currentTheme.textColor || '#333') : (isDarkTheme ? '#aaa' : '#666')};
                            cursor: pointer;
                            border-bottom: 2px solid ${index === 0 ? '#007bff' : 'transparent'};
                            font-weight: 500;
                            white-space: nowrap;
                            min-width: 80px;
                        ">${indicator.name}</button>
                    `).join('')}
                </div>
            </div>
            
            <div class="tab-content" style="padding: 20px; max-height: min(450px, calc(80vh - 200px)); overflow-y: auto; background-color: ${currentTheme.background || '#ffffff'};">
                <div id="theme-tab" class="tab-pane active" style="display: block;">
                    <div class="theme-settings">
                        <h4 style="margin: 0 0 20px 0; color: ${currentTheme.textColor || '#333'}; font-size: 16px;">Theme Settings</h4>
                        <form class="settings-form" id="theme-form">
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Theme Type</label>
                                <select name="themeType" style="width: 100%; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                    <option value="dark">Dark Theme</option>
                                    <option value="light">Light Theme</option>
                                    <option value="custom">Custom Theme</option>
                                </select>
                            </div>
                            <div id="custom-theme-controls" style="display: none;">
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
                                    <div class="form-group">
                                        <label for="background" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Background:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="background" value="#1A1A1D" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="background_hex" value="#1A1A1D" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="chartAreaBackground" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Chart Area:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="chartAreaBackground" value="#292930" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="chartAreaBackground_hex" value="#292930" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="textColor" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Text:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="textColor" value="#C5C6C7" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="textColor_hex" value="#C5C6C7" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="gridColor" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Grid:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="gridColor" value="#4E4E50" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="gridColor_hex" value="#4E4E50" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="lineColor" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Line:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="lineColor" value="#66FCF1" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="lineColor_hex" value="#66FCF1" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="positiveColor" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Positive:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="positiveColor" value="#45A29E" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="positiveColor_hex" value="#45A29E" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="negativeColor" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Negative:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="negativeColor" value="#C5433D" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="negativeColor_hex" value="#C5433D" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="candleUp" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Candle Up:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="candleUp" value="#45A29E" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="candleUp_hex" value="#45A29E" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label for="candleDown" style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">Candle Down:</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <input type="color" name="candleDown" value="#C5433D" style="width: 50px; height: 35px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; cursor: pointer; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; padding: 2px;">
                                            <input type="text" name="candleDown_hex" value="#C5433D" maxlength="7" style="flex: 1; padding: 8px 12px; border: 1px solid ${currentTheme.gridColor || '#ddd'}; border-radius: 4px; font-size: 14px; font-family: monospace; background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'}; color: ${currentTheme.textColor || '#333'};">
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="form-actions" style="margin-top: 24px; display: flex; gap: 12px;">
                                <button type="submit" class="apply-theme-btn" style="background: #00c2ff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Apply Theme</button>
                            </div>
                        </form>
                    </div>
                </div>
                ${this.indicators.map((indicator, index) => `
                    <div id="${indicator.id}-tab" class="tab-pane" style="display: none;">
                        <div class="indicator-settings">
                            <h4 style="margin: 0 0 20px 0; color: ${currentTheme.textColor || '#333'}; font-size: 16px;">${indicator.name} Settings</h4>
                            
                            <form class="settings-form" data-indicator="${indicator.id}">
                                ${indicator.settings.map(setting => {
                                    if (setting.type === 'select') {
                                        return `
                                            <div class="form-group" style="margin-bottom: 16px;">
                                                <label style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">${setting.label}</label>
                                                <select name="${setting.key}" style="
                                                    width: 100%;
                                                    padding: 8px 12px;
                                                    border: 1px solid ${currentTheme.gridColor || '#ddd'};
                                                    border-radius: 4px;
                                                    font-size: 14px;
                                                    background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'};
                                                    color: ${currentTheme.textColor || '#333'};
                                                ">
                                                    ${setting.options.map(option => `
                                                        <option value="${option.value}" ${option.value === setting.default ? 'selected' : ''}>${option.label}</option>
                                                    `).join('')}
                                                </select>
                                            </div>
                                        `;
                                    } else if (setting.type === 'color') {
                                        return `
                                            <div class="form-group" style="margin-bottom: 16px;">
                                                <label style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">${setting.label}</label>
                                                <div style="display: flex; align-items: center; gap: 10px;">
                                                    <input 
                                                        type="color" 
                                                        name="${setting.key}" 
                                                        value="${setting.default}" 
                                                        id="${indicator.id}-${setting.key}"
                                                        style="
                                                            width: 50px;
                                                            height: 35px;
                                                            border: 1px solid ${currentTheme.gridColor || '#ddd'};
                                                            border-radius: 4px;
                                                            cursor: pointer;
                                                            background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'};
                                                            padding: 2px;
                                                        "
                                                    />
                                                    <input 
                                                        type="text" 
                                                        name="${setting.key}_hex"
                                                        value="${setting.default}" 
                                                        placeholder="#RRGGBB"
                                                        maxlength="7"
                                                        style="
                                                            flex: 1;
                                                            padding: 8px 12px;
                                                            border: 1px solid ${currentTheme.gridColor || '#ddd'};
                                                            border-radius: 4px;
                                                            font-size: 14px;
                                                            font-family: monospace;
                                                            box-sizing: border-box;
                                                            background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'};
                                                            color: ${currentTheme.textColor || '#333'};
                                                        "
                                                    />
                                                    ${setting.opacity ? `
                                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 80px;">
                                                            <label style="font-size: 12px; color: ${isDarkTheme ? '#aaa' : '#666'};">Opacity:</label>
                                                            <input 
                                                                type="range" 
                                                                name="${setting.key}_opacity"
                                                                min="0" 
                                                                max="1" 
                                                                step="0.1" 
                                                                value="0.3"
                                                                style="width: 60px;"
                                                            />
                                                            <span class="opacity-value" style="font-size: 11px; color: ${isDarkTheme ? '#aaa' : '#666'}; min-width: 25px;">0.3</span>
                                                        </div>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        `;
                                    } else {
                                        return `
                                            <div class="form-group" style="margin-bottom: 16px;">
                                                <label style="display: block; margin-bottom: 6px; color: ${currentTheme.textColor || '#333'}; font-weight: 500; font-size: 14px;">${setting.label}</label>
                                                <input 
                                                    type="${setting.type}" 
                                                    name="${setting.key}" 
                                                    value="${setting.default}" 
                                                    id="${indicator.id}-${setting.key}"
                                                    ${setting.min ? `min="${setting.min}"` : ''}
                                                    ${setting.max ? `max="${setting.max}"` : ''}
                                                    ${setting.step ? `step="${setting.step}"` : ''}
                                                    style="
                                                        width: 100%;
                                                        padding: 8px 12px;
                                                        border: 1px solid ${currentTheme.gridColor || '#ddd'};
                                                        border-radius: 4px;
                                                        font-size: 14px;
                                                        box-sizing: border-box;
                                                        background: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white'};
                                                        color: ${currentTheme.textColor || '#333'};
                                                    "
                                                />
                                            </div>
                                        `;
                                    }
                                }).join('')}
                                
                                <div class="form-actions" style="margin-top: 24px; display: flex; gap: 12px;">
                                    <button type="submit" class="add-indicator-btn" id="add-indicator-btn" style="
                                        background: #00c2ff;
                                        color: white;
                                        border: none;
                                        padding: 10px 20px;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-size: 14px;
                                        font-weight: 500;
                                    ">${this.editPlotId ? 'Update Indicator' : '➕ Add Indicator'}</button>
                                </div>
                            </form>
                            
                            <div class="active-instances" style="margin-top: 24px; padding-top: 20px; border-top: 1px solid ${currentTheme.gridColor || '#e0e0e0'};">
                                <h5 style="margin: 0 0 12px 0; color: ${currentTheme.textColor || '#333'}; font-size: 14px;">Active ${indicator.name} Instances</h5>
                                <div id="${indicator.id}-instances" class="instances-list">
                                    <!-- Active instances will be populated here -->
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="modal-footer" style="
                padding: 16px 20px;
                border-top: 1px solid ${currentTheme.gridColor || '#e0e0e0'};
                background-color: ${isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : '#f8f9fa'};
                display: flex;
                justify-content: center;
                align-items: center;
            ">

                <button id="close-indicator-settings" style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">Close</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // Initialize the dialog
        this.initializeIndicatorDialog(overlay, this.indicators, { editIndicatorId, editSettings, editPlotId });
    }

    /**
     * Get the stock data for the main plot.
     * @returns {Array<import('../stock-chart.js').StockData>}
     */
    getMainPlotStockData() {
        return this.stockChart.options.plots.find(p => p.id === 'main').data;
    }

    initializeIndicatorDialog(overlay, indicators, options = {}) {
        const { editIndicatorId, editSettings } = options;
        const dialog = overlay.querySelector('div');
        
        // Setup color picker synchronization
        this.setupColorPickerSync(dialog);
        
        // Setup theme controls
        const themeTypeSelect = dialog.querySelector('select[name="themeType"]');
        const customThemeControls = dialog.querySelector('#custom-theme-controls');
        
        // Set initial theme type based on current theme
        themeTypeSelect.value = this.stockChart.options.theme || 'dark';
        if (themeTypeSelect.value === 'custom') {
            customThemeControls.style.display = 'block';
            // Set custom theme color values
            Object.entries(this.stockChart.currentTheme).forEach(([key, value]) => {
                const colorInput = dialog.querySelector(`input[name="${key}"]`);
                const hexInput = dialog.querySelector(`input[name="${key}_hex"]`);
                if (colorInput && hexInput) {
                    colorInput.value = value;
                    hexInput.value = value;
                }
            });
        }
        
        // Handle theme type changes
        themeTypeSelect.addEventListener('change', (event) => {
            const selectedTheme = event.target.value;
            customThemeControls.style.display = selectedTheme === 'custom' ? 'block' : 'none';
        });
        
        // Handle theme form submission
        const themeForm = dialog.querySelector('#theme-form');
        themeForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = new FormData(themeForm);
            const themeType = formData.get('themeType');
            
            if (themeType === 'custom') {
                // Build custom theme object
                const customTheme = {};
                formData.forEach((value, key) => {
                    if (!key.endsWith('_hex')) {
                        customTheme[key] = value;
                    }
                });
                this.stockChart.applyTheme(customTheme);
            } else {
                this.stockChart.applyTheme(themeType);
            }
            
            // Show success message
            const submitBtn = themeForm.querySelector('.apply-theme-btn');
            submitBtn.textContent = '✓ Theme Applied';
            submitBtn.style.background = '#28a745';
            setTimeout(() => {
                submitBtn.textContent = 'Apply Theme';
                submitBtn.style.background = '#00c2ff';
            }, 2000);
        });
        
        // Main group switching functionality
        const mainTabBtns = dialog.querySelectorAll('.main-tab-btn');
        const tabGroups = dialog.querySelectorAll('.tab-group');
        
        mainTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const currentTheme = this.stockChart.currentTheme;
                const isDarkTheme = currentTheme.name === 'dark' ||
                                   (currentTheme.background && isDarkColor(currentTheme.background));
                
                // Remove active class from all main tabs and groups
                mainTabBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = isDarkTheme ? '#aaa' : '#666';
                    b.style.borderBottomColor = 'transparent';
                });
                tabGroups.forEach(group => {
                    group.classList.remove('active');
                    group.style.display = 'none';
                });

                // Hide all tab panes first
                dialog.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                    pane.style.display = 'none';
                });
                // Reset all tab buttons
                dialog.querySelectorAll('.tab-btn').forEach(tabBtn => {
                    tabBtn.classList.remove('active');
                    tabBtn.style.background = 'transparent';
                    tabBtn.style.color = isDarkTheme ? '#aaa' : '#666';
                    tabBtn.style.borderBottomColor = 'transparent';
                });

                // Add active class to clicked main tab
                btn.classList.add('active');
                btn.style.background = isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white';
                btn.style.color = currentTheme.textColor || '#333';
                btn.style.borderBottomColor = '#007bff';

                // Show corresponding group and activate its first tab
                const groupId = btn.dataset.group + '-group';
                const targetGroup = dialog.querySelector(`#${groupId}`);
                if (targetGroup) {
                    targetGroup.classList.add('active');
                    targetGroup.style.display = 'block';

                    // Find and activate first tab in this group
                    const firstTabBtn = targetGroup.querySelector('.tab-btn');
                    const firstTabId = firstTabBtn?.dataset.tab;
                    if (firstTabBtn && firstTabId) {
                        firstTabBtn.classList.add('active');
                        firstTabBtn.style.background = isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white';
                        firstTabBtn.style.color = currentTheme.textColor || '#333';
                        firstTabBtn.style.borderBottomColor = '#007bff';

                        const firstTabPane = dialog.querySelector(`#${firstTabId}-tab`);
                        if (firstTabPane) {
                            firstTabPane.classList.add('active');
                            firstTabPane.style.display = 'block';
                        }

                        // Update instances list if switching to indicators
                        if (btn.dataset.group === 'indicators' && firstTabId) {
                            this.updateInstancesList(firstTabId);
                        }
                    }
                }
            });
        });

        // Sub-tab switching functionality
        const tabBtns = dialog.querySelectorAll('.tab-btn');
        const tabPanes = dialog.querySelectorAll('.tab-pane');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const currentTheme = this.stockChart.currentTheme;
                const isDarkTheme = currentTheme.name === 'dark' ||
                                   (currentTheme.background && isDarkColor(currentTheme.background));
                // Find the parent group
                const parentGroup = btn.closest('.tab-group');
                if (!parentGroup) return;

                // Only affect tabs within the same group
                const groupTabBtns = parentGroup.querySelectorAll('.tab-btn');
                
                // Hide all tab panes in dialog first
                dialog.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                    pane.style.display = 'none';
                });

                // Remove active class from all tabs in this group
                groupTabBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.color = isDarkTheme ? '#aaa' : '#666';
                    b.style.borderBottomColor = 'transparent';
                });

                // Add active class to clicked tab
                btn.classList.add('active');
                btn.style.background = isDarkTheme ? currentTheme.chartAreaBackground || '#2c2c2c' : 'white';
                btn.style.color = currentTheme.textColor || '#333';
                btn.style.borderBottomColor = '#007bff';
                
                // Show only the target pane
                const targetTab = dialog.querySelector(`#${btn.dataset.tab}-tab`);
                if (targetTab) {
                    targetTab.classList.add('active');
                    targetTab.style.display = 'block';
                }

                // Update instances list for indicators
                if (btn.dataset.tab !== 'theme') {
                    this.updateInstancesList(btn.dataset.tab);
                }

                // Reset form for this indicator
                if (btn.dataset.tab !== 'theme') {
                    const form = targetTab.querySelector('form');
                    if (form) {
                        form.reset();
                        const editBtn = form.querySelector('.add-indicator-btn');
                        if (editBtn) {
                            editBtn.textContent = '➕ Add Indicator';
                            editBtn.style.background = '#00c2ff';
                        }
                    }
                }
            });
        });

        // Form submission for adding indicators
        dialog.addEventListener('submit', (event) => {
            event.preventDefault();
            const form = event.target;
            if (!form.dataset.indicator) return;
            const indicatorId = form.dataset.indicator;
            const formData = new FormData(form);
            const settings = {};

            for (let [key, value] of formData.entries()) {
                // Skip hex inputs as they're just for display sync
                if (key.endsWith('_hex')) continue;
                
                // Convert numeric values
                const indicator = indicators.find(ind => ind.id === indicatorId);
                const setting = indicator.settings.find(s => s.key === key);
                
                if (setting && setting.type === 'number') {
                    // @ts-ignore
                    settings[key] = parseFloat(value);
                } else {
                    settings[key] = value;
                }
            }
            
            this.addIndicatorWithSettings(indicatorId, settings);
            this.updateInstancesList(indicatorId);
            
            // Show success feedback
            const submitBtn = form.querySelector('.add-indicator-btn');
            // add emoji
            const originalText = '➕ Add Indicator';
            submitBtn.textContent = '✓ Successfully';
            submitBtn.style.background = '#28a745';
            
            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.style.background = '#00c2ff';
            }, 2000);
        });

        // Preview functionality
        dialog.addEventListener('click', (event) => {

            // Remove instance functionality
            if (event.target.classList.contains('remove-instance-btn')) {
                const plotId = event.target.dataset.plotId;
                const indicatorId = event.target.dataset.indicatorId;
                this.removeIndicator(plotId);
                this.updateInstancesList(indicatorId);
            }

            // Edit instance functionality
            if (event.target.classList.contains('edit-instance-btn')) {
                const plotId = event.target.dataset.plotId;
                this.editIndicatorInstance(plotId);

                // update button label
                const editBtn = document.getElementById(`add-indicator-btn`);
                if (editBtn) {
                    editBtn.textContent = `✏️ Update Indicator`;
                }
            }
        });

        // Close functionality
        dialog.querySelector('#close-indicator-settings').addEventListener('click', () => {
            document.body.removeChild(overlay);
            // Reset drawing states to ensure crosshair works
            this.resetDrawingStates();
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                // Reset drawing states to ensure crosshair works
                this.resetDrawingStates();
            }
        });

        // Initialize instances lists for all indicators
        indicators.forEach(indicator => {
            this.updateInstancesList(indicator.id);
        });

        if (editIndicatorId && editSettings) {
            // Activate the correct tab
            const tabBtn = dialog.querySelector(`.tab-btn[data-tab="${editIndicatorId}"]`);
            if (tabBtn) {
                tabBtn.click();
            }

            // Populate the form with existing settings
            const form = dialog.querySelector(`#${editIndicatorId}-tab .settings-form`);
            if (form) {
                for (const key in editSettings) {
                    const input = form.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = editSettings[key];
                        
                        // Update hex input if it's a color
                        const hexInput = form.querySelector(`[name="${key}_hex"]`);
                        if (hexInput) {
                            hexInput.value = editSettings[key];
                        }
                    }
                }
            }
        }
    }

    setupColorPickerSync(dialog) {
        // Setup color picker and hex input synchronization
        dialog.addEventListener('input', (event) => {
            const target = event.target;
            
            if (target.type === 'color') {
                // Update corresponding hex input
                const hexInput = dialog.querySelector(`[name="${target.name}_hex"]`);
                if (hexInput) {
                    hexInput.value = target.value.toUpperCase();
                }
            }
            
            if (target.name && target.name.endsWith('_hex')) {
                // Update corresponding color picker
                const colorKey = target.name.replace('_hex', '');
                const colorInput = dialog.querySelector(`[name="${colorKey}"]`);
                if (colorInput && this.isValidHex(target.value)) {
                    colorInput.value = target.value;
                }
            }
            
            if (target.type === 'range' && target.name.includes('opacity')) {
                // Update opacity display
                const opacityDisplay = target.parentElement.querySelector('.opacity-value');
                if (opacityDisplay) {
                    opacityDisplay.textContent = target.value;
                }
            }
        });

        // Validate hex input on blur
        dialog.addEventListener('blur', (event) => {
            const target = event.target;
            if (target.name && target.name.endsWith('_hex')) {
                if (!this.isValidHex(target.value)) {
                    target.style.borderColor = '#dc3545';
                    target.title = 'Invalid hex color format. Use #RRGGBB';
                } else {
                    target.style.borderColor = '#ddd';
                    target.title = '';
                }
            }
        }, true);
    }

    isValidHex(hex) {
        return /^#[0-9A-Fa-f]{6}$/.test(hex);
    }

    updateInstancesList(indicatorId) {
        const instancesContainer = document.querySelector(`#${indicatorId}-instances`);
        if (!instancesContainer) return;
    
        const instances = this.getIndicatorInstances(indicatorId);
        const indicator = this.indicators.find(ind => ind.id === indicatorId);
    
        if (instances.length === 0) {
            instancesContainer.innerHTML = `
                <div style="color: #666; font-style: italic; padding: 12px; text-align: center; border: 1px dashed #ddd; border-radius: 4px;">
                    No ${indicatorId.toUpperCase()} instances added yet
                </div>
            `;
        } 
        else {
            const renderInstances = [];
            // find unique name from instances
            const uniqueNames = new Set(instances.map(instance => instance.name));
            uniqueNames.forEach(name => {
                const instance = instances.find(inst => inst.name === name);
                if (instance) {
                    renderInstances.push(instance);
                }
            });
            // For single-plot indicators, show all instances
            instancesContainer.innerHTML = renderInstances.map(instance => `
                <div class="instance-item" style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    margin-bottom: 8px;
                    background: #f9f9f9;
                ">
                    <div style="flex: 1;">
                        <div style="font-weight: 500; color: #333; font-size: 13px; display: flex; align-items: center; gap: 8px;">
                            ${instance.name}
                            ${this.getColorIndicatorsForInstance(instance)}
                        </div>
                        <div style="color: #666; font-size: 11px;">${this.formatInstances(instance)}</div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="edit-instance-btn" data-plot-id="${instance.plotId}" style="
                            background: #ffc107;
                            color: #212529;
                            border: none;
                            padding: 4px 8px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                        ">Edit</button>
                        <button class="remove-instance-btn" data-plot-id="${instance.plotId}" data-indicator-id="${indicatorId}" style="
                            background: #dc3545;
                            color: white;
                            border: none;
                            padding: 4px 8px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                        ">Remove</button>
                    </div>
                </div>
            `).join('');
        }
    }

    getColorIndicatorsForInstance(instance) {
        // Extract color settings from instance and display them as small color squares
        const colorSettings = Object.entries(instance.settings).filter(([key, value]) => 
            key.toLowerCase().includes('color') && typeof value === 'string' && value.startsWith('#')
        );
        
        return colorSettings.map(([key, color]) => `
            <div style="
                width: 12px; 
                height: 12px; 
                background-color: ${color}; 
                border: 1px solid #ccc; 
                border-radius: 2px;
                display: inline-block;
                margin-right: 2px;
                title: '${key}: ${color}'
            "></div>
        `).join('');
    }

    formatInstances({settings}) {
        // Exclude color settings from the summary to keep it clean
        const nonColorSettings = Object.entries(settings).filter(([key, value]) => 
            !key.toLowerCase().includes('color') && !key.includes('opacity')
        );
        
        return nonColorSettings
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
    }

    getIndicatorInstances(indicatorId) {
        if (!this.stockChart || !this.stockChart.options || !this.stockChart.options.plots) {
            return [];
        }
        
        return this.stockChart.options.plots
            .filter(plot => plot.indicator && plot.indicator.id === indicatorId)
            .map(plot => ({
                name: plot.indicator.name,
                plotId: plot.id,
                settings: plot.indicator.settings || {}
            }));
    }

    /**
     * Add a new indicator with the specified settings.
     * @param {string} indicatorId - The ID of the indicator to add.
     * @param {Object} settings - The settings for the indicator.
     */
    addIndicatorWithSettings(indicatorId, settings) {
        if (this.editPlotId) {
            this.removeIndicator(this.editPlotId);
        }
        const timestamp = Date.now();
        
        // Create a descriptive name based on settings
        let name = this.getIndicatorDisplayName(indicatorId);
        if (settings.period) {
            name += ` (${settings.period})`;
        }

        if (!this.stockChart.options.plots) {
            this.stockChart.options.plots = [];
        }

        const valueSelector = this.getValueSelector(settings.priceType || 'close');

        let data = [];
        const mainPlotData = this.getMainPlotStockData();
        switch (indicatorId) {
            case 'sma':
                data = calculateSMA(mainPlotData, settings.period, valueSelector);
                break;
            case 'bollinger':
                data = calculateBollingerBands(mainPlotData, settings.period, settings.standardDeviationMultiplier, valueSelector);
                break;
            case 'demarker':
                data = calculateDeMarker(mainPlotData, settings.period);
                break;
            case 'macd':
                data = calculateMACD(mainPlotData, settings.fastPeriod, settings.slowPeriod, settings.signalPeriod, valueSelector);
                break;
            case 'ema':
                data = calculateEMA(mainPlotData, settings.period, valueSelector);
                break;
            case 'rsi':
                data = calculateRSI(mainPlotData, settings.period, valueSelector);
                break;
            // Add more cases for different indicators as needed
        }

        const totalPlots = this.stockChart.options.plots?.length || 1;
        const plots = this.getPlotsByIndicatorId(indicatorId, data, totalPlots, settings);

        plots.forEach((plot, idx) => {
            plot.indicator = {
                id: indicatorId,
                settings: settings,
                name: name
            };

            const targetPlotIndex = this.stockChart.options.plots
                .findIndex(p => p.id === plot.id && p.targetId === plot.targetId);

            if (targetPlotIndex > -1) {
                // Update existing plot
                this.stockChart.options.plots[targetPlotIndex] = plot;
            }
            else {
                // @ts-ignore
                this.stockChart.options.plots.push(plot);
            }

            const isMainPlot = plot.id === 'main';

            if (!isMainPlot) {
                // @ts-ignore
                this.stockChart.plotLayoutManager.updatePlotIndicator(plot, 'add');
            }
        });

        
        this.stockChart.render();

        // Save indicator settings to local storage
        const savedIndicators = JSON.parse(localStorage.getItem('asv-chart-indicator-settings')) || [];
        let existingIndicatorIndex;
        if (['sma', 'ema'].includes(indicatorId)) {
            existingIndicatorIndex = savedIndicators.findIndex(i => i.id === indicatorId && i.settings.period === settings.period);
        }
        else {
            existingIndicatorIndex = savedIndicators.findIndex(i => i.id === indicatorId);
        }

        if (existingIndicatorIndex > -1) {
            savedIndicators[existingIndicatorIndex].settings = settings;
        } else {
            savedIndicators.push({ id: indicatorId, settings });
        }
        
        localStorage.setItem('asv-chart-indicator-settings', JSON.stringify(savedIndicators));

        this.editPlotId = null;
    }

    /**
     * Get the value selector function based on the price type.
     * @param {'hlc/3' | 'ohlc/4' | 'hlcc/4' | 'close'} priceType 
     * @returns {function} Value selector function
     */
    getValueSelector(priceType) {
        switch (priceType) {
            case 'hlc/3':
                return d => (d.high + d.low + d.close) / 3;
            case 'ohlc/4':
                return d => (d.open + d.high + d.low + d.close) / 4;
            case 'hlcc/4':
                return d => (d.high + d.low + d.close * 2) / 4;
            case 'close':
            default:
                return d => d.close;
        }
    }

    /**
     * 
     * @param {string} indicatorId 
     * @param {Array} data 
     * @param {number} totalPlots
     * @param {Object} settings
     * @returns {Array<import('../stock-chart.js').PlotConfig>}
     */
    getPlotsByIndicatorId(indicatorId, data, totalPlots, settings) {
        const plots = [];

        switch (indicatorId) {
            case 'macd':
                plots.push({
                    id: 'macd',
                    type: 'line',
                    heightRatio: 0.15,
                    data: data.map(d => ({ time: d.time, value: d.macd })),
                    keyLabel: 'MACD',
                    style: {
                        lineColor: settings.macdColor,
                        lineWidth: 3
                    }
                });
                plots.push({
                    id: 'signal',
                    type: 'line',
                    data: data.map(d => ({ time: d.time, value: d.signal })),
                    overlay: true,
                    targetId: 'macd',
                    keyLabel: 'Signal',
                    style: {
                        lineColor: settings.signalColor,
                        lineWidth: 1.5
                    }
                });
                plots.push({
                    id: 'histogram',
                    type: 'histogram',
                    data: data.map(d => ({ time: d.time, value: d.histogram })),
                    overlay: true,
                    targetId: 'macd',
                    keyLabel: 'Histogram',
                    style: {
                        positiveColor: 'rgba(0, 150, 136, 0.5)',
                        negativeColor: 'rgba(233, 30, 99, 0.5)'
                    }
                });
                break;
            case 'rsi':
                plots.push({
                    id: 'rsi',
                    type: 'line',
                    heightRatio: 0.15,
                    data: data,
                    keyLabel: 'RSI',
                    style: {
                        lineColor: settings.lineColor,
                        lineWidth: 1.5
                    }
                });
                break;
            case 'sma':
                plots.push({
                    id: 'sma' + totalPlots,
                    type: 'line',
                    data: data,
                    targetId: 'main',
                    keyLabel: 'SMA',
                    overlay: true,
                    style: {
                        lineColor: settings.lineColor,
                        lineWidth: 1.5
                    }
                });
                break;
            case 'ema':
                plots.push({
                    id: 'ema' + totalPlots,
                    type: 'line',
                    heightRatio: 0.15,
                    targetId: 'main',
                    data: data,
                    keyLabel: 'EMA',
                    overlay: true,
                    style: {
                        lineColor: settings.lineColor,
                        lineWidth: 1.5
                    }
                });
                break;
            case 'bollinger':
                plots.push({
                    id: 'bollinger',
                    type: 'line',
                    heightRatio: 0.15,
                    targetId: 'main',
                    data: data.map(d => ({ time: d.time, value: d.upper })),
                    overlay: true,
                    keyLabel: 'Bollinger Bands',
                    style: {
                        lineColor: settings.upperBandColor,
                        lineWidth: 1.5
                    }
                });
                plots.push({
                    id: 'bollinger_lower',
                    type: 'line',
                    heightRatio: 0.15,
                    data: data.map(d => ({ time: d.time, value: d.lower })),
                    overlay: true,
                    targetId: 'main',
                    keyLabel: 'Bollinger Bands',
                    style: {
                        lineColor: settings.lowerBandColor,
                        lineWidth: 1.5
                    }
                });
                plots.push({
                    id: 'bollinger_middle',
                    type: 'line',
                    heightRatio: 0.15,
                    data: data.map(d => ({ time: d.time, value: d.middle })),
                    overlay: true,
                    targetId: 'main',
                    keyLabel: 'Bollinger Bands',
                    style: {
                        lineColor: settings.middleBandColor,
                        lineWidth: 1.5
                    }
                });
                break;
            case 'demarker':
                plots.push({
                    id: 'demarker',
                    type: 'line',
                    heightRatio: 0.15,
                    data: data,
                    keyLabel: 'DeMarker',
                    style: {
                        lineColor: settings.lineColor,
                        lineWidth: 1.5
                    }
                });
                break;
        }

        // @ts-ignore
        return plots;
    }   

    previewIndicator(indicatorId, settings) {
        // Implement preview functionality - could show a temporary overlay or highlight
        console.log(`Previewing ${indicatorId} with settings:`, settings);
        
        // Example: Show an alert with the configuration
        const settingsText = Object.entries(settings)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        
        alert(`Preview ${this.getIndicatorDisplayName(indicatorId)}:\n\n${settingsText}`);
    }

    editIndicatorInstance(plotId) {
        const plot = this.stockChart.options.plots.find(p => p.id === plotId);
        if (!plot || !plot.indicator) return;

        const { id: indicatorId, settings } = plot.indicator;

        Object.entries(settings)
            .forEach(([key, value]) => {
                const inputEle = document.getElementById(`${indicatorId}-${key}`);
                if (inputEle) {
                    // update input value
                    (inputEle instanceof HTMLInputElement || inputEle instanceof HTMLSelectElement)
                        ? inputEle.value = value
                        : null;
                }
            });

        this.editPlotId = plotId;

        // this.showIndicatorSettings({ indicatorId, settings, plotId });
    }

    /**
     * Remove an indicator from the chart
     * @param {string} plotId 
     */
    removeIndicator(plotId) {
    
        if (this.stockChart.options.plots) {

            const plotToRemove = this.stockChart.options.plots.find(plot => plot.id === plotId);
            const relatedPlots = this.stockChart.options.plots.filter(plot => plot.indicator?.id === plotId);

            
            const removedPlotIds = [plotToRemove.id, ...relatedPlots.map(p => p.id)];
            
            // Remove all plots at once
            this.stockChart.options.plots = this.stockChart.options.plots.filter(plot => !removedPlotIds.includes(plot.id));
            
            // Update the plot configurations in the layout manager
            this.stockChart.plotLayoutManager.updatePlotConfigurations(this.stockChart.options.plots);
            
            // Recalculate layout and render once
            this.stockChart.plotLayoutManager.calculateLayout();
            this.stockChart.render();
            
            if (plotToRemove && plotToRemove.indicator) {
                // Remove indicator settings from local storage
                const savedIndicators = JSON.parse(localStorage.getItem('asv-chart-indicator-settings')) || [];
                const updatedIndicators = savedIndicators.filter(i => i.id !== plotToRemove.indicator.id);
                localStorage.setItem('asv-chart-indicator-settings', JSON.stringify(updatedIndicators));
            }
        }
    }

     /**
     * Reset drawing states to ensure crosshair works properly
     */
    resetDrawingStates() {
        this.isDrawing = false;
        this.selectedDrawing = null;
        this.selectedPoint = null;
        this.isEditing = false;
        this._isChartFrozen = false;
        this.currentDrawing = null;
        
        // Also reset the stock chart's drawing tool
        if (this.stockChart && this.stockChart.setDrawingTool) {
            this.stockChart.setDrawingTool(null);
        }
        
        // Trigger a render to update the chart
        if (this.stockChart && this.stockChart.render) {
            this.stockChart.render();
        }
    }

    getIndicatorDisplayName(indicatorId) {
        const indicators = {
            'bollinger': 'Bollinger Bands',
            'demarker': 'DeMarker',
            'ema': 'EMA',
            'macd': 'MACD',
            'rsi': 'RSI',
            'sma': 'SMA'
        };
        return indicators[indicatorId] || indicatorId.toUpperCase();
    }

}