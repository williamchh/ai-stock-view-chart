/**
 * @fileoverview Main entry point for the StockChart library.
 * @author Your Name
 */

/**
 * Represents the main StockChart class.
 */
import lightTheme from './themes/light.js';
import darkTheme from './themes/dark.js';
import { drawCandlestick, drawLine } from './utils/drawing.js';
import { PlotLayoutManager } from './utils/layout.js';
import { DataViewport, getXPixel, getYPixel } from './utils/data.js';

/**
 * @typedef {import('./stock-chart.d.ts').StockChartOptions} StockChartOptions
 */

/**
 * @typedef {import('./stock-chart.d.ts').StockData} StockData
 */

/**
 * @typedef {import('./stock-chart.d.ts').PlotConfig} PlotConfig
 */

/**
 * Represents the main StockChart class.
 * Provides rendering, interaction, and theming for financial charts.
 */
class StockChart {
    /**
     * Initializes a new StockChart instance.
     * @param {string} elementId - The ID of the HTML element to mount the chart to.
     * @param {StockChartOptions} options - Configuration options for the chart.
     */
    static init(elementId, options) {
        const container = document.getElementById(elementId);
        if (!container) {
            console.error(`StockChart: Element with ID '${elementId}' not found.`);
            return;
        }

        const chartInstance = new StockChart(container, options);
        chartInstance.render();
        return chartInstance;
    }

    /**
     * Constructs a new StockChart instance
     * @param {HTMLElement} container - The HTML element to mount the chart to.
     * @param {StockChartOptions} options - Configuration options for the chart.
     */
    constructor(container, options) {
        this.container = container;
        this.options = { ...StockChart.defaultOptions, ...options };
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.plotLayoutManager = new PlotLayoutManager(
            this.canvas.width,
            this.canvas.height,
            this.options.plots
        );

        this.resize();

        const mainPlot = this.options.plots?.find(p => p.id === 'main');
        if (!mainPlot) {
            throw new Error("StockChart options must include a plot with id 'main'.");
        }
        this.dataViewport = new DataViewport(mainPlot.data || [], this.options.initialVisibleCandles, 8);

        this.isDragging = false;
        this.isResizingPlot = false;
        this.resizingPlotId = null;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.crosshairX = -1;
        this.crosshairY = -1;
        this.resizeHandleHeight = 10; // Height of the resize handle area
        this.minPrice = 0; // Will be updated in render
        this.maxPrice = 0; // Will be updated in render
        this.priceScale = 1.0; // vertical zoom/scale factor
        this.priceOffset = 0; // vertical offset for panning
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        // Custom event listener for external cursor sync
        window.addEventListener('broadcastCursor', (e) => {
            const { x, y } = /** @type {CustomEvent<{x: number, y: number}>} */ (e).detail;
            this.crosshairX = x;
            this.crosshairY = y;
            this.render();
        });
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.handleMouseOut.bind(this));
        this.canvas.addEventListener('wheel', this.handleMouseWheel.bind(this));
        this.canvas.addEventListener('dblclick', this.resetVerticalScale.bind(this));
        
        // Touch event listeners for mobile devices
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this));

        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === this.container) {
                    this.resize();
                    this.render();
                }
            }
        });
        this.resizeObserver.observe(this.container);

        this.applyTheme(this.options.theme);
    }

    /**
     * Default options for the StockChart.
     * @type {StockChartOptions}
     */
    static defaultOptions = {
        theme: 'light', // 'light' or 'dark'
        plots: [
            { id: 'main', heightRatio: 0.7, data: [], type: 'line' }
        ],
        initialVisibleCandles: 100,
        // Add more default options as needed
    };

    static themes = { light: lightTheme, dark: darkTheme };

    /**
     * Resizes the canvas to match the container's dimensions and redraws the chart.
     * @private
     */
    resize() {
        let { clientWidth, clientHeight } = this.container;

        // Fallback to window dimensions if container size is not set
        if (clientWidth === 0) {
            clientWidth = window.innerWidth;
        }
        if (clientHeight === 0) {
            clientHeight = window.innerHeight;
        }

        this.canvas.width = clientWidth;
        this.canvas.height = clientHeight;
        this.plotLayoutManager.updateCanvasDimensions(clientWidth, clientHeight);
    }

    /**
     * Applies the specified theme to the chart.
     * @param {'light' | 'dark'} themeName - The name of the theme to apply ('light' or 'dark').
     */
    applyTheme(themeName) {
        // This will be expanded to load themes from src/themes
        const theme = StockChart.themes[themeName] || StockChart.themes.light;
        this.currentTheme = theme;
        // Apply theme colors to canvas context or CSS variables
        this.canvas.style.backgroundColor = theme.background;
        this.render(); // Redraw with new theme
    }

    /**
     * Handles mouse wheel for vertical scale adjustment
     * @param {WheelEvent} event
     */
    handleVerticalMouseWheel(event) {
        if (event.ctrlKey) {
            // vertical zoom
            const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
            this.priceScale *= zoomFactor;
            this.render();
            event.preventDefault();
        }
    }

    /**
     * Resets the vertical price scaling and offset.
     */
    /**
     * Resets the vertical scaling (price zoom) to defaults.
     */
    resetVerticalScale() {
        this.priceScale = 1.0;
        this.priceOffset = 0;
        this.render();
    }

    /**
     * Renders the chart. This method will be expanded to draw different chart types and plots.
     */
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = this.currentTheme.chartAreaBackground || '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const visibleData = this.dataViewport.getVisibleData();
        if (visibleData.length === 0) {
            this.ctx.fillStyle = this.currentTheme.textColor;
            this.ctx.font = '20px Arial';
            this.ctx.fillText('No data to display', this.canvas.width / 2 - 80, this.canvas.height / 2);
            return;
        }

        const barWidth = this.canvas.width / this.dataViewport.visibleCount;

        // Helper function to calculate price range
        /**
         * Calculates the price range for a given plot configuration and visible data.
         * @param { PlotConfig} plotConfig - The configuration object for the plot.
         * @param {Array} visibleData - The data that is currently visible in the viewport.
         * @param {DataViewport} dataViewport - The current data viewport information.
         * @returns An object containing the minPrice and maxPrice for the plot.
         */
        function calculatePriceRange(plotConfig, visibleData, dataViewport) {
            let minPrice, maxPrice;
            
            if (plotConfig.type === 'volume') {
                minPrice = 0;
                maxPrice = Math.max(...visibleData.map(d => d.volume || 1));
            } else if (plotConfig.type === 'line') {
                const plotVisibleData = plotConfig.data.slice(dataViewport.startIndex, dataViewport.startIndex + dataViewport.visibleCount);
                const values = plotVisibleData.map(d => d.value);
                const currentMinPrice = Math.min(...values);
                const currentMaxPrice = Math.max(...values);
                const priceRange = currentMaxPrice - currentMinPrice;
                const padding = priceRange * 0.1; // 10% padding
                minPrice = currentMinPrice - padding;
                maxPrice = currentMaxPrice + padding;
            } else {
                const lows = visibleData.map(d => d.low);
                const highs = visibleData.map(d => d.high);
                const currentMinPrice = Math.min(...lows);
                const currentMaxPrice = Math.max(...highs);
                const priceRange = currentMaxPrice - currentMinPrice;
                const padding = priceRange * 0.1; // 10% padding
                minPrice = currentMinPrice - padding;
                maxPrice = currentMaxPrice + padding;
            }
            
            return { minPrice, maxPrice };
        }

        // Simplified main rendering code
        this.options.plots.forEach(plotConfig => {
            const plotLayout = this.plotLayoutManager.getPlotLayout(plotConfig.id);
            if (plotLayout) {
                // Draw plot background
                this.ctx.fillStyle = this.currentTheme.chartAreaBackground;
                this.ctx.fillRect(plotLayout.x, plotLayout.y, plotLayout.width, plotLayout.height);

                this.ctx.strokeStyle = this.currentTheme.gridColor;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(plotLayout.x, plotLayout.y, plotLayout.width, plotLayout.height);

                // Draw resize handle if not the last plot
                const isLastPlot = this.options.plots.indexOf(plotConfig) === this.options.plots.length - 1;
                if (!isLastPlot && !plotConfig.overlay) {
                    // Draw resize handle
                    const handleY = plotLayout.y + plotLayout.height - this.resizeHandleHeight / 2;
                    this.ctx.fillStyle = this.isResizingPlot && this.resizingPlotId === plotConfig.id ? 
                        'rgba(150, 150, 150, 0.3)' : 'rgba(100, 100, 100, 0.1)';
                    this.ctx.fillRect(plotLayout.x, handleY, plotLayout.width, this.resizeHandleHeight);
                    
                    // Draw handle dots
                    this.ctx.fillStyle = this.currentTheme.gridColor;
                    const dotSpacing = 6;
                    const dotsWidth = 30;
                    const startX = plotLayout.x + (plotLayout.width - dotsWidth) / 2;
                    for (let x = startX; x < startX + dotsWidth; x += dotSpacing) {
                        this.ctx.beginPath();
                        this.ctx.arc(x, handleY + this.resizeHandleHeight / 2, 1, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                }

                // Calculate price range once
                const { minPrice, maxPrice } = calculatePriceRange(plotConfig, visibleData, this.dataViewport);

                // Draw Y-axis labels before clipping
                this.drawYAxisLabels(plotConfig, plotLayout, minPrice, maxPrice);

                this.ctx.save(); // Save context before clipping for plot data
                this.ctx.beginPath();
                this.ctx.rect(plotLayout.x, plotLayout.y, plotLayout.width, plotLayout.height);
                this.ctx.clip(); // Clip to the plot area for drawing data

                const plotData = plotConfig.data && plotConfig.data.length > 0 ? plotConfig.data : visibleData;
                const plotVisibleData = plotData.slice(this.dataViewport.startIndex, this.dataViewport.startIndex + this.dataViewport.visibleCount);

                // Draw data points based on plot type
                switch (plotConfig.type) {
                    case 'candlestick':
                        plotVisibleData.forEach((dataPoint, i) => {
                            const x = getXPixel(this.dataViewport.startIndex + i, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth);
                            const openY = getYPixel(dataPoint.open, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            const highY = getYPixel(dataPoint.high, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            const lowY = getYPixel(dataPoint.low, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            const closeY = getYPixel(dataPoint.close, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            drawCandlestick(this.ctx, dataPoint, x, openY, highY, lowY, closeY, barWidth * 0.7, this.currentTheme);
                        });
                        break;
                    case 'line':
                        plotVisibleData.forEach((dataPoint, i) => {
                            if (i > 0) {
                                const prevDataPoint = plotVisibleData[i - 1];
                                const x1 = getXPixel(this.dataViewport.startIndex + i - 1, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth) + barWidth / 2;
                                const y1 = getYPixel(prevDataPoint.value, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                                const x2 = getXPixel(this.dataViewport.startIndex + i, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth) + barWidth / 2;
                                const y2 = getYPixel(dataPoint.value, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                                drawLine(this.ctx, x1, y1, x2, y2, this.currentTheme.lineColor, 2);
                            }
                        });
                        break;
                    case 'volume':
                        plotVisibleData.forEach((dataPoint, i) => {
                            const x = getXPixel(this.dataViewport.startIndex + i, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth);
                            const volHeight = ((dataPoint.volume || 0) / maxPrice) * plotLayout.height;
                            const y = plotLayout.y + plotLayout.height - volHeight;
                            this.ctx.fillStyle = this.currentTheme.volumeColor || 'rgba(0, 150, 136, 0.6)';
                            this.ctx.fillRect(x, y, barWidth * 0.7, volHeight);
                        });
                        break;
                }
            }
            this.ctx.restore();
        });

        // Draw X-axis labels
        this.drawXAxisLabels();

        // Debug overlay
        this.ctx.fillText(`Canvas: ${this.canvas.width}x${this.canvas.height}`, 20, 60);

        // Draw crosshair
        if (this.crosshairX !== -1 && this.crosshairY !== -1) {
            this.ctx.strokeStyle = this.currentTheme.crosshairColor;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]); // Dashed line

            // Vertical line - only within plot area, not in y-axis label area
            const firstPlot = this.options.plots[0];
            const plotLayout = this.plotLayoutManager.getPlotLayout(firstPlot.id);
            if (plotLayout && this.crosshairX <= plotLayout.x + plotLayout.width) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.crosshairX, 0);
                this.ctx.lineTo(this.crosshairX, this.plotLayoutManager.getPlotTotalHeight());
                this.ctx.stroke();
            }

            // Horizontal line for any plot the cursor is over
            this.options.plots.forEach(plot => {
                if (plot.overlay) return; // Skip overlay plots
                const plotLayout = this.plotLayoutManager.getPlotLayout(plot.id);
                if (plotLayout && 
                    this.crosshairY >= plotLayout.y && 
                    this.crosshairY <= plotLayout.y + plotLayout.height) {
                    // Draw horizontal line for this plot
                    this.ctx.beginPath();
                    this.ctx.moveTo(0, this.crosshairY);
                    this.ctx.lineTo(this.plotLayoutManager.getPlotTotalWidth(), this.crosshairY);
                    this.ctx.stroke();
                }
            });
            this.ctx.setLineDash([]); // Reset line dash

            // Display price and indicator info overlay
            this.displayInfoOverlay();
        }
    }

    /**
     * Handles mouse down events for dragging and viewport interaction.
     * @param {MouseEvent} event
     */

    /**
     * Handles mouse down events for dragging.
     * @param {MouseEvent} event - The mouse event.
     */
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseY = event.clientY - rect.top;
        
        // Check if clicking on a resize handle
        for (let i = 0; i < this.options.plots.length - 1; i++) {
            const plot = this.options.plots[i];
            if (!plot.overlay) {
                const layout = this.plotLayoutManager.getPlotLayout(plot.id);
                const handleY = layout.y + layout.height - this.resizeHandleHeight / 2;
                if (Math.abs(mouseY - handleY - this.resizeHandleHeight / 2) < this.resizeHandleHeight) {
                    this.isResizingPlot = true;
                    this.resizingPlotId = plot.id;
                    this.lastMouseY = event.clientY;
                    return;
                }
            }
        }

        // If not resizing, then it's regular dragging
        this.isDragging = true;
        this.lastMouseX = event.clientX;
    }

    /**
     * Handles mouse move events for dragging and crosshair.
     * @param {MouseEvent} event - The mouse event.
     */
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.crosshairX = event.clientX - rect.left;
        this.crosshairY = event.clientY - rect.top;

        if (this.isResizingPlot) {
            const deltaY = event.clientY - this.lastMouseY;
            this.lastMouseY = event.clientY;

            // Find the plot being resized and the next plot
            const plotIndex = this.options.plots.findIndex(p => p.id === this.resizingPlotId);
            let nextPlotIndex = plotIndex + 1;
            while (nextPlotIndex < this.options.plots.length && this.options.plots[nextPlotIndex].overlay) {
                nextPlotIndex++;
            }

            if (plotIndex >= 0 && nextPlotIndex < this.options.plots.length) {
                const plot = this.options.plots[plotIndex];
                const nextPlot = this.options.plots[nextPlotIndex];
                
                // Calculate new height ratios
                const totalRatio = plot.heightRatio + nextPlot.heightRatio;
                const pixelsPerRatio = this.canvas.height / totalRatio;
                const ratioChange = deltaY / pixelsPerRatio;
                
                // Ensure minimum height for both plots (10% of their combined height)
                const minRatio = totalRatio * 0.1;
                const newRatio = Math.max(minRatio, Math.min(totalRatio - minRatio, plot.heightRatio + ratioChange));
                
                plot.heightRatio = newRatio;
                nextPlot.heightRatio = totalRatio - newRatio;
                
                // Recalculate layout
                this.render();
            }
        } else if (this.isDragging) {
            const deltaX = event.clientX - this.lastMouseX;
            const barWidth = this.canvas.width / this.dataViewport.visibleCount;
            const scrollAmount = Math.round(deltaX / barWidth);

            if (scrollAmount !== 0) {
                this.dataViewport.scroll(-scrollAmount);
                this.lastMouseX = event.clientX;
                this.render();
            }
        } else {
            // Check if mouse is over a resize handle
            let isOverHandle = false;
            for (let i = 0; i < this.options.plots.length - 1; i++) {
                const plot = this.options.plots[i];
                if (!plot.overlay) {
                    const layout = this.plotLayoutManager.getPlotLayout(plot.id);
                    const handleY = layout.y + layout.height - this.resizeHandleHeight / 2;
                    if (Math.abs(this.crosshairY - handleY - this.resizeHandleHeight / 2) < this.resizeHandleHeight) {
                        this.canvas.style.cursor = 'row-resize';
                        isOverHandle = true;
                        break;
                    }
                }
            }
            if (!isOverHandle) {
                this.canvas.style.cursor = 'default';
            }
            this.render();
        }
    }

    /**
     * Handles mouse up events.
     */
    handleMouseUp() {
        this.isDragging = false;
        this.isResizingPlot = false;
        this.resizingPlotId = null;
        this.canvas.style.cursor = 'default';
    }

    /**
     * Handles mouse out events.
     */
    handleMouseOut() {
        this.isDragging = false;
        this.crosshairX = -1;
        this.crosshairY = -1;
        this.render();
    }

    /**
     * Handles mouse wheel events for zooming.
     * @param {WheelEvent} event - The mouse wheel event.
     */
    handleMouseWheel(event) {
        event.preventDefault(); // Prevent page scrolling

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Horizontal zoom (time axis)
        if (event.ctrlKey) { // Use Ctrl + scroll for vertical zoom
            const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
            const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
            if (mainPlotLayout) {
                const currentPriceRange = this.maxPrice - this.minPrice;
                const newPriceRange = currentPriceRange / zoomFactor;

                // Calculate price at mouse Y position within the main plot
                // Need to invert getYPixel for this
                const priceAtMouseY = this.minPrice + (this.maxPrice - this.minPrice) * ((mainPlotLayout.y + mainPlotLayout.height - mouseY) / mainPlotLayout.height);

                // Adjust min/max price to zoom around the mouse Y position
                this.minPrice = priceAtMouseY - (newPriceRange * ((priceAtMouseY - this.minPrice) / currentPriceRange));
                this.maxPrice = priceAtMouseY + (newPriceRange * ((this.maxPrice - priceAtMouseY) / currentPriceRange));
            }
            this.render();
        } else { // Normal scroll for horizontal zoom
            const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1; // Zoom in or out
            const dataIndexAtMouse = Math.floor(this.crosshairX / (this.canvas.width / this.dataViewport.visibleCount));
            this.dataViewport.zoom(zoomFactor, dataIndexAtMouse);
            this.render();
        }
    }

    /**
     * Handles touch start events for mobile dragging.
     * @param {TouchEvent} event - The touch event.
     */
    handleTouchStart(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            this.isDragging = true;
            const touch = event.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastMouseX = touch.clientX - rect.left;
            this.lastTouchX = touch.clientX - rect.left;
            this.lastTouchY = touch.clientY - rect.top;
        }
    }

    /**
     * Handles touch move events for mobile dragging.
     * @param {TouchEvent} event - The touch event.
     */
    handleTouchMove(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            this.crosshairX = touchX;
            this.crosshairY = touchY;

            if (this.isDragging) {
                const deltaX = touchX - this.lastTouchX;
                const barWidth = this.canvas.width / this.dataViewport.visibleCount;
                const scrollAmount = Math.round(deltaX / barWidth);

                if (scrollAmount !== 0) {
                    this.dataViewport.scroll(-scrollAmount);
                    this.lastTouchX = touchX;
                    this.lastTouchY = touchY;
                    this.render();
                } else {
                    this.render();
                }
            } else {
                this.render();
            }
        }
    }

    /**
     * Handles touch end events for mobile dragging.
     * @param {TouchEvent} event - The touch event.
     */
    handleTouchEnd(event) {
        event.preventDefault();
        this.isDragging = false;
        // Hide crosshair on touch end for better mobile experience
        this.crosshairX = -1;
        this.crosshairY = -1;
        this.render();
    }

    drawXAxisLabels() {
        const visibleData = this.dataViewport.getVisibleData();
        if (visibleData.length === 0) return;

        const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
        if (!mainPlotLayout) return;

        // Calculate the amount of space we have for labels
        const availableWidth = mainPlotLayout.width;
        const fontSize = Math.max(10, Math.min(12, Math.floor(availableWidth / 50))); // Responsive font size
        const minLabelSpacing = fontSize * 8; // Minimum pixels between labels
        
        // Calculate optimal number of labels based on available space
        const _maxLabels = Math.floor(availableWidth / minLabelSpacing);
        const maxLabels = _maxLabels > 10 ? 10 : _maxLabels;
        const labelInterval = Math.max(1, Math.floor(visibleData.length / maxLabels));

        // Set up text properties
        this.ctx.fillStyle = this.currentTheme.textColor;
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = 'center';
        
        // Position labels just above bottom margin
        const xAxisY = this.canvas.height - fontSize;

        // Get date range for format selection
        const firstDate = new Date(visibleData[0].time * 1000);
        const lastDate = new Date(visibleData[visibleData.length - 1].time * 1000);
        const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

        // Helper function to format date based on range and available space
        const formatDate = (date) => {
            if (daysDiff > 365) {
                // For ranges over a year
                return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
            } else if (daysDiff > 30) {
                // For ranges over a month
                return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            } else {
                // For shorter ranges
                return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
            }
        };

        // Draw the labels
        for (let i = 0; i < visibleData.length; i += labelInterval) {
            const dataPoint = visibleData[i];
            if (!dataPoint || !dataPoint.time) continue;

            const x = getXPixel(
                this.dataViewport.startIndex + i,
                this.dataViewport.startIndex,
                this.dataViewport.visibleCount,
                mainPlotLayout.width,
                mainPlotLayout.width / this.dataViewport.visibleCount
            );

            const date = new Date(dataPoint.time * 1000);
            // const label = formatDate(date);
            const label = date.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
            
            // Only draw if the label would be within the plot area
            if (x >= mainPlotLayout.x && x <= mainPlotLayout.x + mainPlotLayout.width) {
                this.ctx.fillText(label, x, xAxisY);
            }
        }
    }

    drawYAxisLabels(plotConfig, plotLayout, minPrice, maxPrice) {
        this.ctx.fillStyle = this.currentTheme.textColor;
        
        // Responsive font size based on canvas width
        const fontSize = this.canvas.width < 600 ? 10 : 12;
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = 'left';

        // Adjust number of labels based on plot height to prevent overlap
        const minLabelSpacing = fontSize + 4; // Minimum spacing between labels
        const maxLabels = Math.max(3, Math.min(8, Math.floor(plotLayout.height / minLabelSpacing)));
        const numLabels = Math.min(5, maxLabels);
        const priceStep = (maxPrice - minPrice) / numLabels;

        // Calculate label positions to avoid overlap
        const labels = [];
        for (let i = 0; i <= numLabels; i++) {
            const price = minPrice + (i * priceStep);
            const y = getYPixel(price, minPrice, maxPrice, plotLayout.height, plotLayout.y);
            labels.push({ price, y });
        }

        // Filter labels to prevent overlap at plot boundaries
        const filteredLabels = labels.filter(({ y }) => {
            // Skip labels that are too close to top or bottom edges
            const margin = fontSize * 1.5;
            return y >= plotLayout.y + margin && y <= plotLayout.y + plotLayout.height - margin;
        });

        // If we filtered out too many labels, ensure we have at least 2
        let finalLabels = filteredLabels;
        if (filteredLabels.length < 2 && labels.length >= 2) {
            // Keep first and last labels, but adjust their positions slightly
            const firstLabel = labels[0];
            const lastLabel = labels[labels.length - 1];
            
            // Move labels slightly inward if they're at the edges
            const adjustedFirst = {
                ...firstLabel,
                y: Math.max(plotLayout.y + fontSize, firstLabel.y)
            };
            const adjustedLast = {
                ...lastLabel,
                y: Math.min(plotLayout.y + plotLayout.height - fontSize, lastLabel.y)
            };
            
            finalLabels = [adjustedFirst, adjustedLast];
        }

        // Draw horizontal grid lines and labels
        finalLabels.forEach(({ price, y }) => {
            // Draw horizontal grid line
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.currentTheme.gridColor;
            this.ctx.setLineDash([2, 2]); // Dotted line for grid
            this.ctx.moveTo(plotLayout.x, y);
            this.ctx.lineTo(plotLayout.x + plotLayout.width, y);
            this.ctx.stroke();
            this.ctx.setLineDash([]); // Reset line style

            // Format label based on value magnitude
            let label;
            if (plotConfig.type === 'volume') {
                if (price >= 1000000) {
                    label = (price / 1000000).toFixed(1) + 'M';
                } else if (price >= 1000) {
                    label = (price / 1000).toFixed(1) + 'K';
                } else {
                    label = Math.round(price).toLocaleString();
                }
            } else {
                // For prices, use appropriate decimal places
                if (price >= 1000) {
                    label = price.toFixed(0);
                } else if (price >= 100) {
                    label = price.toFixed(1);
                } else if (price >= 10) {
                    label = price.toFixed(2);
                } else {
                    label = price.toFixed(3);
                }
            }

            // Draw label in the right margin area with better positioning
            const x = plotLayout.x + plotLayout.width + (this.canvas.width < 600 ? 2 : 4);
            this.ctx.fillText(label, x, y + fontSize / 3);
        });

        // Draw the y-axis line last (so it's on top of grid lines)
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.currentTheme.gridColor;
        this.ctx.lineWidth = 1;
        this.ctx.moveTo(plotLayout.x + plotLayout.width, plotLayout.y);
        this.ctx.lineTo(plotLayout.x + plotLayout.width, plotLayout.y + plotLayout.height);
        this.ctx.stroke();
    }

    /**
     * Displays price and indicator information at the crosshair position.
     */
    displayInfoOverlay() {
        const visibleData = this.dataViewport.getVisibleData();
        if (visibleData.length === 0) return;

        const barWidth = this.canvas.width / this.dataViewport.visibleCount;
        const dataIndexAtCrosshair = Math.floor(this.crosshairX / barWidth);
        const actualDataIndex = this.dataViewport.startIndex + dataIndexAtCrosshair;

        this.options.plots.forEach(plotConfig => {
            const plotLayout = this.plotLayoutManager.getPlotLayout(plotConfig.id);
            if (!plotLayout || plotConfig.overlay) return;

            const plotData = plotConfig.data && plotConfig.data.length > 0 ? plotConfig.data : visibleData;

            if (actualDataIndex >= 0 && actualDataIndex < plotData.length) {
                const dataPoint = plotData[actualDataIndex];

                this.ctx.fillStyle = this.currentTheme.overlayTextColor;
                this.ctx.font = '12px Arial';

                // Show current price to the right of crosshair
                // if (plotConfig.id === 'main' && dataPoint.close !== undefined) {
                const cursorY = this.crosshairY;
                // const cursorYPriceText = this.plotLayoutManager.getValueBasedOnY(plotConfig.id, cursorY);
                // const priceText = dataPoint.close.toFixed(2);
                // const yPrice = this.plotLayoutManager.getPlotYForValue(dataPoint.close);
                this.ctx.textAlign = 'left';
                const priceX = this.plotLayoutManager.getPlotTotalWidth() + 5;
                this.ctx.fillText('cursorYPriceText', priceX, this.crosshairY);
                // }

                // Show date at the bottom of crosshair
                if (plotConfig.id === 'main' && dataPoint.time !== undefined) {
                    const date = new Date(dataPoint.time * 1000);
                    const dateText = date.toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'numeric', 
                        day: 'numeric'
                    });
                    this.ctx.textAlign = 'center';
                    // Position the date text 5 pixels below the bottom of the plot area
                    const dateY = this.plotLayoutManager.getPlotTotalHeight() + 15; // Use total height for bottom margin
                    this.ctx.fillText(dateText, this.crosshairX, dateY);
                }

                // Show summary in top-right corner
                let infoText = Object.entries(dataPoint)
                    .map(([key, value]) => {
                        if (key === 'time' || key === 'date') return null;
                        const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                        return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${formattedValue}`;
                    })
                    .filter(Boolean)
                    .join(' ');

                // Position text in the top-right corner of the plot
                const textY = plotLayout.y + 15;
                const textX = plotLayout.x + plotLayout.width - 10; // 10px padding from right edge
                
                this.ctx.textAlign = 'right';
                this.ctx.fillText(infoText, textX, textY);
                this.ctx.textAlign = 'left'; // Reset alignment for other text
            }
        });
    }

    /**
     * Renders overlay panels for indicators (placeholder, extendable).
     */
    renderOverlayPanels() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.font = '10px Arial';
        this.ctx.fillText('Overlay panels reserved for indicators', 10, this.canvas.height - 10);
        this.ctx.restore();
    }
}

export default StockChart;