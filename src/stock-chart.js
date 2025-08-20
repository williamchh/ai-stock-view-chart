/**
 * @fileoverview Main entry point for the StockChart library.
 * @author H Chen
 */

/**
 * Represents the main StockChart class.
 */
import lightTheme from './themes/light.js';
import darkTheme from './themes/dark.js';
import { drawCandlestick, drawLine } from './utils/drawing.js';
import { PlotLayoutManager } from './utils/layout.js';
import { DataViewport, getXPixel, getYPixel, getValueBasedOnY } from './utils/data.js';

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
        // Ensure container has a valid size
        this.ensureContainerSize(container);

        this.container = container;
        this.options = { ...StockChart.defaultOptions, ...options };
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        
        // Initialize pinch-to-zoom state
        this.initialPinchDistance = 0;
        this.isPinching = false;

        // Initialize dataViewport first
        const mainPlot = this.options.plots?.find(p => p.id === 'main');
        if (!mainPlot) {
            throw new Error("StockChart options must include a plot with id 'main'.");
        }
        this.dataViewport = new DataViewport(mainPlot.data || [], this.options.initialVisibleCandles, 5);

        // Then initialize plot layout with calculated Y-axis width
        this.plotLayoutManager = new PlotLayoutManager(
            this.canvas.width,
            this.canvas.height,
            this.options.plots
        );

        this.resize();

        this.isDragging = false;
        this.isResizingPlot = false;
        this.resizingPlotId = null;
        this.isDraggingYAxis = false; // New: for Y-axis dragging
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
        this.plotScales = new Map(); // Store scales for each plot
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
     * Calculates the price range for a given plot configuration and visible data.
     * @param { PlotConfig} plotConfig - The configuration object for the plot.
     * @param {Array} visibleData - The data that is currently visible in the viewport.
     * @param {DataViewport} dataViewport - The current data viewport information.
     * @returns An object containing the minPrice and maxPrice for the plot.
     */
    calculatePriceRange(plotConfig, visibleData, dataViewport) {
        let minPrice, maxPrice;
        
        if (plotConfig.type === 'volume') {
            minPrice = 0;
            maxPrice = Math.max(...visibleData.map(d => d.volume || 1));
        } else if (plotConfig.type === 'line') {
            const plotVisibleData = plotConfig.data.slice(dataViewport.startIndex, dataViewport.startIndex + dataViewport.visibleCount);
            const values = plotVisibleData.map(d => d.value ?? d.close).filter(v => v !== null && isFinite(v));
            if (values.length === 0) {
                return { minPrice: 0, maxPrice: 1 }; // Default range if no valid data
            }
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

        // Apply the plot's scale if it exists
        // Make sure we have plotScales initialized
        if (this.plotScales instanceof Map && plotConfig && plotConfig.id) {
            const plotScale = this.plotScales.get(plotConfig.id) || 1.0;
            if (plotScale !== 1.0) {
                const midPrice = (maxPrice + minPrice) / 2;
                const halfRange = (maxPrice - minPrice) / 2;
                minPrice = midPrice - (halfRange / plotScale);
                maxPrice = midPrice + (halfRange / plotScale);
            }
        }
        
        return { minPrice, maxPrice };
    }

    /**
     * Calculate the maximum width needed for Y-axis labels across all plots
     * @private
     * @returns {number} The maximum width needed for the Y-axis labels
     */
    calculateYAxisWidth() {
        if (!this.ctx || !this.dataViewport) {
            return 80; // Default width if not ready
        }

        const ctx = this.ctx;
        let maxWidth = 0;
        const fontSize = this.canvas.width < 600 ? 10 : 12;
        ctx.font = `${fontSize}px Arial`;

        // If no data is available yet, use some sample values
        const visibleData = this.dataViewport.getVisibleData();
        if (visibleData.length === 0) {
            return 80; // Default width if no data
        }

        // Check each plot's min and max values
        this.options.plots.forEach(plotConfig => {
            const { minPrice, maxPrice } = this.calculatePriceRange(plotConfig, visibleData, this.dataViewport);
            let testValues = [minPrice, maxPrice];

            // Generate some sample values between min and max
            const range = maxPrice - minPrice;
            for (let i = 1; i < 4; i++) {
                testValues.push(minPrice + (range * i / 4));
            }

            // Format each value and measure its width
            testValues.forEach(value => {
                let label;
                if (plotConfig.type === 'volume') {
                    if (value >= 1000000) {
                        label = (value / 1000000).toFixed(1) + 'M';
                    } else if (value >= 1000) {
                        label = (value / 1000).toFixed(1) + 'K';
                    } else {
                        label = Math.round(value).toLocaleString();
                    }
                } else {
                    if (value >= 1000) {
                        label = value.toFixed(0);
                    } else if (value >= 100) {
                        label = value.toFixed(1);
                    } else if (value >= 10) {
                        label = value.toFixed(2);
                    } else {
                        label = value.toFixed(3);
                    }
                }
                
                const width = ctx.measureText(label).width;
                maxWidth = Math.max(maxWidth, width);
            });
        });

        // Add padding
        return maxWidth + (this.canvas.width < 600 ? 4 : 8);
    }

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

        // Calculate Y-axis width and update layout
        const yAxisWidth = this.calculateYAxisWidth();
        this.plotLayoutManager.updateCanvasDimensions(clientWidth, clientHeight, yAxisWidth);
    }

    /**
     * Applies the specified theme to the chart.
     * @param {('light' | 'dark' | Object)} theme - The name of the built-in theme ('light' or 'dark') or a custom theme object.
     */
    applyTheme(theme) {
        // If theme is a string, use built-in theme, otherwise use custom theme
        const themeToApply = typeof theme === 'string' ? 
            (StockChart.themes[theme] || StockChart.themes.light) : 
            { ...StockChart.themes.light, ...theme }; // Merge with light theme for fallback values
        
        this.currentTheme = themeToApply;
        // Apply theme colors to canvas context or CSS variables
        this.canvas.style.backgroundColor = themeToApply.background;
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

        // Calculate price range using class method
        // const { minPrice, maxPrice } = this.calculatePriceRange(plotConfig, visibleData, this.dataViewport);

        // Simplified main rendering code
        // Create a map to store calculated price ranges for non-overlay plots
        const priceRanges = new Map();
        const mainPlot = this.options.plots.find(p => p.id === 'main');
        if (!mainPlot) {
            return;
        }
        const mainVisibleData = mainPlot.data.slice(this.dataViewport.startIndex, this.dataViewport.startIndex + this.dataViewport.visibleCount);
        priceRanges.set('main', this.calculatePriceRange(mainPlot, mainVisibleData, this.dataViewport));

        this.options.plots.forEach(plotConfig => {
            const isOverlay = plotConfig.overlay || false;
            const targetPlotId = isOverlay ? (plotConfig.targetId || 'main') : plotConfig.id;
            
            const plotLayout = this.plotLayoutManager.getPlotLayout(targetPlotId);
            if (!plotLayout) return;

            const barWidth = plotLayout.width / this.dataViewport.visibleCount;

            // Calculate and store price range for non-overlay plots
            if (!isOverlay && !priceRanges.has(plotConfig.id)) {
                const plotVisibleData = plotConfig.data.slice(this.dataViewport.startIndex, this.dataViewport.startIndex + this.dataViewport.visibleCount);
                priceRanges.set(plotConfig.id, this.calculatePriceRange(plotConfig, plotVisibleData, this.dataViewport));
            }

            const { minPrice, maxPrice } = priceRanges.get(targetPlotId);

            if (plotLayout) {
                // Draw plot background and border only for non-overlay plots
                if (!isOverlay) {
                    this.ctx.fillStyle = this.currentTheme.chartAreaBackground;
                    this.ctx.fillRect(plotLayout.x, plotLayout.y, plotLayout.width, plotLayout.height);

                    this.ctx.strokeStyle = this.currentTheme.gridColor;
                    this.ctx.lineWidth = 1;
                    this.ctx.strokeRect(plotLayout.x, plotLayout.y, plotLayout.width, plotLayout.height);
                }

                // Draw resize handle if not the last plot
                const isLastPlot = this.options.plots.indexOf(plotConfig) === this.options.plots.length - 1;
                if (!isLastPlot && !isOverlay) {
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

                // Draw Y-axis labels before clipping, only for non-overlay plots
                if (!isOverlay) {
                    this.drawYAxisLabels(plotConfig, plotLayout, minPrice, maxPrice);
                }

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
                            const candleWidth = barWidth * 0.7;
                            const x = plotLayout.x + getXPixel(this.dataViewport.startIndex + i, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth) + (barWidth - candleWidth) / 2;
                            const openY = getYPixel(dataPoint.open, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            const highY = getYPixel(dataPoint.high, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            const lowY = getYPixel(dataPoint.low, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            const closeY = getYPixel(dataPoint.close, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            drawCandlestick(this.ctx, dataPoint, x, openY, highY, lowY, closeY, candleWidth, this.currentTheme);
                        });
                        break;
                    case 'line':
                        let lastValidIndex = -1;
                        plotVisibleData.forEach((dataPoint, i) => {
                            const value = dataPoint.value ?? dataPoint.close;
                            // Skip if current point has no value or is zero
                            if (value === null || value === undefined || value === 0) {
                                lastValidIndex = -1;
                                return;
                            }

                            // If we have a previous valid point, draw line
                            if (lastValidIndex !== -1) {
                                const prevDataPoint = plotVisibleData[lastValidIndex];
                                const x1 = plotLayout.x + getXPixel(this.dataViewport.startIndex + lastValidIndex, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth) + barWidth / 2;
                                const y1 = getYPixel(prevDataPoint.value ?? prevDataPoint.close, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                                const x2 = plotLayout.x + getXPixel(this.dataViewport.startIndex + i, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth) + barWidth / 2;
                                const y2 = getYPixel(value, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                                const lineColor = plotConfig.style?.lineColor || this.currentTheme.lineColor;
                                const lineWidth = plotConfig.style?.lineWidth || 2;
                                drawLine(this.ctx, x1, y1, x2, y2, lineColor, lineWidth);
                            }
                            lastValidIndex = i;
                        });
                        break;
                    case 'volume':
                        plotVisibleData.forEach((dataPoint, i) => {
                            const volWidth = barWidth * 0.7;
                            const x = plotLayout.x + getXPixel(this.dataViewport.startIndex + i, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth) + (barWidth - volWidth) / 2;
                            const volHeight = ((dataPoint.volume || 0) / maxPrice) * plotLayout.height;
                            const y = plotLayout.y + plotLayout.height - volHeight;
                            this.ctx.fillStyle = this.currentTheme.volumeColor || 'rgba(0, 150, 136, 0.6)';
                            this.ctx.fillRect(x, y, volWidth, volHeight);
                        });
                        break;
                    case 'histogram':
                        plotVisibleData.forEach((dataPoint, i) => {
                            const histoWidth = barWidth * 0.7;
                            const x = plotLayout.x + getXPixel(this.dataViewport.startIndex + i, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth) + (barWidth - histoWidth) / 2;
                            const y = getYPixel(0, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                            const barHeight = getYPixel(dataPoint.value, minPrice, maxPrice, plotLayout.height, plotLayout.y) - y;

                            this.ctx.fillStyle = dataPoint.value >= 0 ?
                                (plotConfig.style?.positiveColor || this.currentTheme.positiveColor) :
                                (plotConfig.style?.negativeColor || this.currentTheme.negativeColor);

                            this.ctx.fillRect(x, y, histoWidth, barHeight);
                        });
                        break;
                    case 'signal':
                        this.renderSignals(plotVisibleData, plotLayout, plotConfig, minPrice, maxPrice, barWidth);
                        break;
                        
                }
            }
            this.ctx.restore();
        });

        // Draw X-axis labels
        this.drawXAxisLabels();

        // Draw chart name, code, and meta string
        this.drawChartName();

        // Debug overlay
        // this.ctx.fillText(`Canvas: ${this.canvas.width}x${this.canvas.height}`, 20, 60);

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

    renderSignals(plotVisibleData, plotLayout, plotConfig, minPrice, maxPrice, barWidth) {
        let lastValidIndex = -1;
        let signalStart = null;
        
        plotVisibleData.forEach((dataPoint, i) => {
            if (dataPoint.value === undefined || dataPoint.value === null) {
                if (signalStart !== null) {
                    // Draw the previous signal block
                    this.drawSignalBlock(
                        plotLayout,
                        signalStart,
                        lastValidIndex,
                        plotConfig.style,
                        minPrice,
                        maxPrice,
                        barWidth
                    );
                    signalStart = null;
                }
                return;
            }

            if (signalStart === null) {
                signalStart = i;
            }
            lastValidIndex = i;
        });

        // Draw the last signal block if exists
        // @ts-ignore
        if (signalStart != null && lastValidIndex >= signalStart) {
            this.drawSignalBlock(
                plotLayout,
                signalStart,
                lastValidIndex,
                plotConfig.style,
                minPrice,
                maxPrice,
                barWidth
            );
        }
    }

    /**
     * Handles mouse down events for dragging.
     * @param {MouseEvent} event - The mouse event.
     */
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // First check if clicking in Y-axis area
        for (const plot of this.options.plots) {
            if (plot.overlay) continue;
            const layout = this.plotLayoutManager.getPlotLayout(plot.id);
            if (layout) {
                const yAxisArea = {
                    x: layout.x + layout.width,  // Y-axis is on the right
                    y: layout.y,
                    width: 50,  // Y-axis width
                    height: layout.height
                };

                if (mouseX >= yAxisArea.x && mouseX <= yAxisArea.x + yAxisArea.width &&
                    mouseY >= yAxisArea.y && mouseY <= yAxisArea.y + yAxisArea.height) {
                    this.isDraggingYAxis = true;
                    this.resizingPlotId = plot.id;
                    this.lastMouseY = event.clientY;
                    return;
                }
            }
        }
        
        // Then check if clicking on a resize handle
        for (let i = 0; i < this.options.plots.length - 1; i++) {
            const plot = this.options.plots[i];
            if (!plot.overlay) {
                const layout = this.plotLayoutManager.getPlotLayout(plot.id);
                const handleY = layout.y + layout.height;
                if (Math.abs(mouseY - handleY) < this.resizeHandleHeight) {
                    this.isResizingPlot = true;
                    this.resizingPlotId = plot.id;
                    this.lastMouseY = event.clientY;
                    return;
                }
            }
        }

        // If not resizing or Y-axis dragging, then it's regular dragging
        this.isDragging = true;
        this.lastMouseX = event.clientX;
    }

    /**
     * Handles mouse move events for dragging and crosshair.
     * @param {MouseEvent} event - The mouse event.
     */
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Get the main plot layout for proper positioning
        const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
        if (mainPlotLayout) {
            const barWidth = mainPlotLayout.width / this.dataViewport.visibleCount;

            // Calculate which candlestick the mouse is closest to
            const relativeX = mouseX - mainPlotLayout.x;  // Adjust for plot area x-offset
            const dataIndex = Math.round(relativeX / barWidth - 0.5);
            
            // Ensure dataIndex stays within valid bounds
            const clampedIndex = Math.max(0, Math.min(this.dataViewport.visibleCount - 1, dataIndex));
            
            // Calculate exact center of the candlestick using getXPixel and adding half candle width
            const candleX = mainPlotLayout.x + getXPixel(this.dataViewport.startIndex + clampedIndex, this.dataViewport.startIndex, this.dataViewport.visibleCount, mainPlotLayout.width, barWidth);
            this.crosshairX = candleX + (barWidth / 2);
        }
        this.crosshairY = mouseY;

        if (this.isDraggingYAxis && this.resizingPlotId) {
            const deltaY = event.clientY - this.lastMouseY;
            this.lastMouseY = event.clientY;
            
            // Get the current plot's scale
            let plotScale = this.plotScales.get(this.resizingPlotId) || 1.0;
            
            // Adjust scale based on drag direction (up = increase, down = decrease)
            const scaleFactor = Math.exp(-deltaY * 0.01);
            plotScale *= scaleFactor;
            
            // Limit the scale to reasonable bounds
            plotScale = Math.max(0.1, Math.min(10, plotScale));
            
            // Store the new scale
            this.plotScales.set(this.resizingPlotId, plotScale);
            
            this.render();
            return;
        }

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
                const plotLayout = this.plotLayoutManager.getPlotLayout(plot.id);
                const pixelsPerRatio = plotLayout.height / plot.heightRatio;
                const ratioChange = deltaY / pixelsPerRatio;
                
                // Ensure minimum height for both plots (10% of their combined height)
                const minRatio = totalRatio * 0.1;
                const newRatio = Math.max(minRatio, Math.min(totalRatio - minRatio, plot.heightRatio + ratioChange));
                
                plot.heightRatio = newRatio;
                nextPlot.heightRatio = totalRatio - newRatio;
                
                // Recalculate layout and render
                this.resize();
                this.render();
            }
        } else if (this.isDragging) {
            const deltaX = event.clientX - this.lastMouseX;
            const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
            const barWidth = mainPlotLayout ? mainPlotLayout.width / this.dataViewport.visibleCount : this.canvas.width / this.dataViewport.visibleCount;
            const scrollAmount = Math.round(deltaX / barWidth);

            if (scrollAmount !== 0) {
                this.dataViewport.scroll(-scrollAmount);
                this.lastMouseX = event.clientX;
                this.render();
            }
        } else {
            // Check if mouse is over a resize handle or Y-axis
            let specialCursor = false;
            for (const plot of this.options.plots) {
                if (plot.overlay) continue;
                const layout = this.plotLayoutManager.getPlotLayout(plot.id);
                if (layout) {
                    // Check resize handle
                    const handleY = layout.y + layout.height;
                    if (Math.abs(this.crosshairY - handleY) < this.resizeHandleHeight) {
                        this.canvas.style.cursor = 'row-resize';
                        specialCursor = true;
                        break;
                    }

                    // Check Y-axis area
                    const yAxisArea = {
                        x: layout.x + layout.width,
                        y: layout.y,
                        width: 50,
                        height: layout.height
                    };
                    if (this.crosshairX >= yAxisArea.x && this.crosshairX <= yAxisArea.x + yAxisArea.width &&
                        this.crosshairY >= yAxisArea.y && this.crosshairY <= yAxisArea.y + yAxisArea.height) {
                        this.canvas.style.cursor = 'ns-resize';
                        specialCursor = true;
                        break;
                    }
                }
            }
            if (!specialCursor) {
                this.canvas.style.cursor = 'default';
            }
            this.render();
        }
    }

    /**
     * Handles mouse up events.
     */
    handleMouseUp(event) {
        this.isDragging = false;
        this.isResizingPlot = false;
        this.isDraggingYAxis = false;
        this.resizingPlotId = null;
        this.canvas.style.cursor = 'default';

        // Handle double click on Y-axis
        if (event && event.detail === 2) { // Double click
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            // Check if double click was in Y-axis area
            for (const plot of this.options.plots) {
                if (plot.overlay) continue;
                const layout = this.plotLayoutManager.getPlotLayout(plot.id);
                if (layout) {
                    const yAxisArea = {
                        x: layout.x + layout.width,
                        y: layout.y,
                        width: 50,
                        height: layout.height
                    };

                    if (mouseX >= yAxisArea.x && mouseX <= yAxisArea.x + yAxisArea.width &&
                        mouseY >= yAxisArea.y && mouseY <= yAxisArea.y + yAxisArea.height) {
                        // Reset scale for this plot
                        this.plotScales.delete(plot.id);
                        this.render();
                        break;
                    }
                }
            }
        }
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
            const zoomFactor = event.deltaY < 0 ? 1.1 : 0.901; //1 / 1.1; // Zoom in or out
            const dataIndexAtMouse = Math.floor(this.crosshairX / (this.canvas.width / this.dataViewport.visibleCount));
            this.dataViewport.zoom(zoomFactor, dataIndexAtMouse);
            this.render();
        }
    }

    /**
     * Handles touch start events for mobile dragging.
     * @param {TouchEvent} event - The touch event.
     */
    // State tracking for touch interactions
    lastTapTime = 0;
    lastTapX = 0;
    lastTapY = 0;
    touchHoldTimer = null;
    isCrosshairMode = false;
    touchStartX = 0;
    touchStartY = 0;

    handleTouchStart(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();

        // Clear any existing touch hold timer
        if (this.touchHoldTimer) {
            clearTimeout(this.touchHoldTimer);
            this.touchHoldTimer = null;
        }

        // Reset all touch states first
        if (event.touches.length !== this.lastTouchCount) {
            this.isPinching = false;
            this.isDragging = false;
            this.isResizingPlot = false;
            this.isDraggingYAxis = false;
            this.isCrosshairMode = false;
            this.initialPinchDistance = 0;
        }
        this.lastTouchCount = event.touches.length;

        if (event.touches.length === 2) {
            // Initialize pinch-to-zoom with validation
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const touch1X = touch1.clientX - rect.left;
            const touch1Y = touch1.clientY - rect.top;
            const touch2X = touch2.clientX - rect.left;
            const touch2Y = touch2.clientY - rect.top;

            // Ensure touches are far enough apart to start pinch
            const initialDistance = Math.sqrt(
                Math.pow(touch2X - touch1X, 2) + 
                Math.pow(touch2Y - touch1Y, 2)
            );

            if (initialDistance > 30) { // Minimum distance threshold
                this.isPinching = true;
                this.initialPinchDistance = initialDistance;
                this.pinchCenterX = (touch1X + touch2X) / 2;
                this.pinchCenterY = (touch1Y + touch2Y) / 2;
                this.lastPinchDistance = initialDistance;
            }

            // Calculate initial pinch distance
            this.initialPinchDistance = Math.sqrt(
                Math.pow(touch2X - touch1X, 2) + 
                Math.pow(touch2Y - touch1Y, 2)
            );

            // Calculate pinch center point
            this.pinchCenterX = (touch1X + touch2X) / 2;
            this.pinchCenterY = (touch1Y + touch2Y) / 2;
        } else if (event.touches.length === 1) {
            const touch = event.touches[0];
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            // Store initial touch position for movement detection
            this.initialTouchX = touchX;
            this.initialTouchY = touchY;
            this.lastTouchX = touchX;
            this.lastTouchY = touchY;

            // Check for Y-axis touch first
            for (const plot of this.options.plots) {
                if (plot.overlay) continue;
                const layout = this.plotLayoutManager.getPlotLayout(plot.id);
                if (layout) {
                    const yAxisArea = {
                        x: layout.x + layout.width,
                        y: layout.y,
                        width: 50,
                        height: layout.height
                    };

                    if (touchX >= yAxisArea.x && touchX <= yAxisArea.x + yAxisArea.width &&
                        touchY >= yAxisArea.y && touchY <= yAxisArea.y + yAxisArea.height) {
                        // Check for double tap
                        const currentTime = new Date().getTime();
                        const tapLength = currentTime - this.lastTapTime;
                        const tapDistance = Math.sqrt(
                            Math.pow(touchX - this.lastTapX, 2) + 
                            Math.pow(touchY - this.lastTapY, 2)
                        );

                        if (tapLength < 300 && tapDistance < 30) { // 300ms and 30px threshold
                            // Double tap detected - reset scale
                            this.plotScales.delete(plot.id);
                            this.render();
                            this.lastTapTime = 0; // Reset to prevent triple tap
                            return;
                        }

                        // Store tap info for next time
                        this.lastTapTime = currentTime;
                        this.lastTapX = touchX;
                        this.lastTapY = touchY;

                        this.isDraggingYAxis = true;
                        this.resizingPlotId = plot.id;
                        this.lastTouchY = touchY;
                        return;
                    }
                }
            }

            // Then check for plot resize handle touch
            for (let i = 0; i < this.options.plots.length - 1; i++) {
                const plot = this.options.plots[i];
                if (!plot.overlay) {
                    const layout = this.plotLayoutManager.getPlotLayout(plot.id);
                    const handleY = layout.y + layout.height;
                    if (Math.abs(touchY - handleY) < this.resizeHandleHeight) {
                        this.isResizingPlot = true;
                        this.resizingPlotId = plot.id;
                        this.lastTouchY = touchY;
                        return;
                    }
                }
            }

            // If not Y-axis or resize, then it's regular chart dragging
            this.isDragging = true;
            this.lastTouchX = touchX;
            this.lastTouchY = touchY;
            // Hide crosshair initially
            this.crosshairX = -1;
            this.crosshairY = -1;

            // Start the touch hold timer
            this.touchHoldTimer = setTimeout(() => {
                if (this.isDragging) {
                    // Switch to crosshair mode after 1 second hold
                    this.isCrosshairMode = true;
                    // Update crosshair position
                    const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
                    if (mainPlotLayout) {
                        const barWidth = mainPlotLayout.width / this.dataViewport.visibleCount;
                        const relativeX = touchX - mainPlotLayout.x;
                        const dataIndex = Math.round(relativeX / barWidth - 0.5);
                        const clampedIndex = Math.max(0, Math.min(this.dataViewport.visibleCount - 1, dataIndex));
                        const candleX = mainPlotLayout.x + getXPixel(
                            this.dataViewport.startIndex + clampedIndex,
                            this.dataViewport.startIndex,
                            this.dataViewport.visibleCount,
                            mainPlotLayout.width,
                            barWidth
                        );
                        this.crosshairX = candleX + (barWidth / 2);
                        this.crosshairY = touchY;
                    }
                    this.render();
                }
            }, 1000); // 1 second delay
        }
    }

    /**
     * Handles touch move events for mobile dragging.
     * @param {TouchEvent} event - The touch event.
     */
    handleTouchMove(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();

        if (event.touches.length === 2 && this.isPinching) {
            // Handle pinch-to-zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const touch1X = touch1.clientX - rect.left;
            const touch1Y = touch1.clientY - rect.top;
            const touch2X = touch2.clientX - rect.left;
            const touch2Y = touch2.clientY - rect.top;

            // Calculate current pinch distance with better precision
            const currentPinchDistance = Math.sqrt(
                Math.pow(touch2X - touch1X, 2) + 
                Math.pow(touch2Y - touch1Y, 2)
            );

            // Skip processing if the distance is too small (avoid division by zero)
            if (this.initialPinchDistance > 10 && currentPinchDistance > 10) {
                // Calculate zoom factor with improved stability
                const rawZoomFactor = currentPinchDistance / this.initialPinchDistance;
                
                // Calculate the new pinch center with smoothing
                const newPinchCenterX = (touch1X + touch2X) / 2;
                const newPinchCenterY = (touch1Y + touch2Y) / 2;

                // Apply exponential smoothing to pinch centers
                const smoothingFactor = 0.3;
                const smoothedPinchCenterX = this.pinchCenterX ? 
                    this.pinchCenterX * (1 - smoothingFactor) + newPinchCenterX * smoothingFactor :
                    newPinchCenterX;
                const smoothedPinchCenterY = this.pinchCenterY ? 
                    this.pinchCenterY * (1 - smoothingFactor) + newPinchCenterY * smoothingFactor :
                    newPinchCenterY;

                // Find which plot contains the pinch center
                let targetPlotId = null;
                for (const plot of this.options.plots) {
                    if (plot.overlay) continue;
                    const layout = this.plotLayoutManager.getPlotLayout(plot.id);
                    if (layout && 
                        smoothedPinchCenterY >= layout.y && 
                        smoothedPinchCenterY <= layout.y + layout.height) {
                        targetPlotId = plot.id;
                        break;
                    }
                }

                if (targetPlotId) {
                    // Determine zoom direction based on gesture
                    const verticalChange = Math.abs(smoothedPinchCenterY - this.pinchCenterY);
                    const horizontalChange = Math.abs(smoothedPinchCenterX - this.pinchCenterX);
                    
                    // Improved threshold and damping for zoom changes
                    const minZoomChange = 0.002; // Reduced threshold for smoother response
                    const normalizedZoomFactor = Math.abs(rawZoomFactor - 1);
                    
                    if (normalizedZoomFactor > minZoomChange) {
                        // Apply non-linear damping for more controlled zooming
                        const dampingFactor = Math.min(0.3, normalizedZoomFactor * 0.5);
                        const zoomFactor = 1 + (rawZoomFactor - 1) * dampingFactor;
                        
                        if (verticalChange > horizontalChange * 1.2) { // Slight bias towards horizontal
                            // Vertical pinch - adjust price scale with improved stability
                            let plotScale = this.plotScales.get(targetPlotId) || 1.0;
                            const verticalZoomFactor = Math.exp((zoomFactor - 1) * 0.3); // Exponential scaling
                            plotScale *= verticalZoomFactor;
                            plotScale = Math.max(0.1, Math.min(10, plotScale));
                            this.plotScales.set(targetPlotId, plotScale);
                        } else {
                            // Horizontal pinch - adjust time scale with improved stability
                            const zoomStrength = 0.02; // Further reduced for smoother zooming
                            const zoomDirection = Math.exp((zoomFactor - 1) * zoomStrength);
                            const plotLayout = this.plotLayoutManager.getPlotLayout(targetPlotId);
                            const dataIndexAtPinch = Math.floor(
                                (smoothedPinchCenterX - plotLayout.x) / 
                                (plotLayout.width / this.dataViewport.visibleCount)
                            );
                            this.dataViewport.zoom(zoomDirection > 1 ? 1.03 : 0.97, dataIndexAtPinch);
                        }
                    }
                }

                this.pinchCenterX = smoothedPinchCenterX;
                this.pinchCenterY = smoothedPinchCenterY;
                this.initialPinchDistance = currentPinchDistance;
                this.render();
            }
        } else if (event.touches.length === 1) {
            const touch = event.touches[0];
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            // Get the main plot layout for proper positioning
            const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
            if (mainPlotLayout) {
                const barWidth = mainPlotLayout.width / this.dataViewport.visibleCount;
            // Only update crosshair position if in crosshair mode
            if (this.isCrosshairMode) {
                // Calculate which candlestick the touch is closest to
                const relativeX = touchX - mainPlotLayout.x;  // Adjust for plot area x-offset
                const dataIndex = Math.round(relativeX / barWidth - 0.5);
                
                // Ensure dataIndex stays within valid bounds
                const clampedIndex = Math.max(0, Math.min(this.dataViewport.visibleCount - 1, dataIndex));
                
                // Calculate exact center of the candlestick using getXPixel and adding half candle width
                const candleX = mainPlotLayout.x + getXPixel(this.dataViewport.startIndex + clampedIndex, this.dataViewport.startIndex, this.dataViewport.visibleCount, mainPlotLayout.width, barWidth);
                this.crosshairX = candleX + (barWidth / 2);
                this.crosshairY = touchY;
            } else if (this.isDragging) {
                // Calculate distance moved from initial touch
                const distanceX = Math.abs(touchX - this.initialTouchX);
                const distanceY = Math.abs(touchY - this.initialTouchY);
                const totalDistance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

                // If significant movement is detected, clear the timer and prevent crosshair mode
                if (totalDistance > 10 && this.touchHoldTimer) { // 10 pixels threshold
                    clearTimeout(this.touchHoldTimer);
                    this.touchHoldTimer = null;
                    this.isCrosshairMode = false; // Ensure crosshair mode is off
                    this.crosshairX = -1; // Hide crosshair immediately
                    this.crosshairY = -1;
                }
            }
        }
        
        if (this.isDraggingYAxis && this.resizingPlotId) {
            // Handle Y-axis dragging
            const deltaY = touchY - this.lastTouchY;
            this.lastTouchY = touchY;
                
                let plotScale = this.plotScales.get(this.resizingPlotId) || 1.0;
                const scaleFactor = Math.exp(-deltaY * 0.01);
                plotScale *= scaleFactor;
                plotScale = Math.max(0.1, Math.min(10, plotScale));
                this.plotScales.set(this.resizingPlotId, plotScale);
                
                this.render();
            } else if (this.isResizingPlot && this.resizingPlotId) {
                // Handle plot resize
                const deltaY = touchY - this.lastTouchY;
                this.lastTouchY = touchY;

                const plotIndex = this.options.plots.findIndex(p => p.id === this.resizingPlotId);
                let nextPlotIndex = plotIndex + 1;
                while (nextPlotIndex < this.options.plots.length && this.options.plots[nextPlotIndex].overlay) {
                    nextPlotIndex++;
                }

                if (plotIndex >= 0 && nextPlotIndex < this.options.plots.length) {
                    const plot = this.options.plots[plotIndex];
                    const nextPlot = this.options.plots[nextPlotIndex];
                    
                    const totalRatio = plot.heightRatio + nextPlot.heightRatio;
                    const plotLayout = this.plotLayoutManager.getPlotLayout(plot.id);
                    const pixelsPerRatio = plotLayout.height / plot.heightRatio;
                    const ratioChange = deltaY / pixelsPerRatio;
                    
                    const minRatio = totalRatio * 0.1;
                    const newRatio = Math.max(minRatio, Math.min(totalRatio - minRatio, plot.heightRatio + ratioChange));
                    
                    plot.heightRatio = newRatio;
                    nextPlot.heightRatio = totalRatio - newRatio;
                    
                    this.resize();
                    this.render();
                }
            } else if (this.isDragging) {
                // Handle chart dragging
                const deltaX = touchX - this.lastTouchX;
                const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
                const barWidth = mainPlotLayout ? mainPlotLayout.width / this.dataViewport.visibleCount : this.canvas.width / this.dataViewport.visibleCount;
                const scrollAmount = Math.round(deltaX / barWidth);

                // Handle dragging and crosshair modes
                if (!this.isCrosshairMode) {
                    // In dragging mode, only scroll if not in crosshair mode
                    if (scrollAmount !== 0) {
                        this.dataViewport.scroll(-scrollAmount);
                        this.lastTouchX = touchX;
                        this.render();
                    }
                } else {
                    // In crosshair mode, only update the crosshair position
                    const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
                    if (mainPlotLayout) {
                        const barWidth = mainPlotLayout.width / this.dataViewport.visibleCount;
                        const relativeX = touchX - mainPlotLayout.x;
                        const dataIndex = Math.round(relativeX / barWidth - 0.5);
                        const clampedIndex = Math.max(0, Math.min(this.dataViewport.visibleCount - 1, dataIndex));
                        const candleX = mainPlotLayout.x + getXPixel(
                            this.dataViewport.startIndex + clampedIndex,
                            this.dataViewport.startIndex,
                            this.dataViewport.visibleCount,
                            mainPlotLayout.width,
                            barWidth
                        );
                        this.crosshairX = candleX + (barWidth / 2);
                        this.crosshairY = touchY;
                        this.render();
                    }
                }
            }
        }
    }

    /**
     * Handles touch end events for mobile dragging.
     * @param {TouchEvent} event - The touch event.
     */
    handleTouchEnd(event) {
        event.preventDefault();
        
        // Clear the touch hold timer if it exists
        if (this.touchHoldTimer) {
            clearTimeout(this.touchHoldTimer);
            this.touchHoldTimer = null;
        }

        // Store the current touch count before resetting states
        const previousTouchCount = this.lastTouchCount;
        this.lastTouchCount = event.touches.length;

        // If we're transitioning from 2 fingers to 1 finger, preserve some states
        if (previousTouchCount === 2 && event.touches.length === 1) {
            // Reset only pinch-related states
            this.isPinching = false;
            this.initialPinchDistance = 0;
            this.lastPinchDistance = 0;
            
            // Re-initialize single touch tracking with the remaining finger
            const touch = event.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.lastTouchX = touch.clientX - rect.left;
            this.lastTouchY = touch.clientY - rect.top;
            this.isDragging = true; // Enable dragging for the remaining finger
        } else if (event.touches.length === 0) {
            // All fingers lifted, reset all states
            this.isDragging = false;
            this.isResizingPlot = false;
            this.isDraggingYAxis = false;
            this.resizingPlotId = null;
            this.isPinching = false;
            this.initialPinchDistance = 0;
            this.lastPinchDistance = 0;
            
            // Handle crosshair mode
            if (!this.isCrosshairMode) {
                this.crosshairX = -1;
                this.crosshairY = -1;
            }
            // Reset crosshair mode when all fingers are lifted
            this.isCrosshairMode = false;
        }

        this.render();
    }

    /**
     * Draws the chart name, code, and meta string on the top-left corner of the chart.
     */
    drawChartName() {
        const { chartName } = this.options;
        if (!chartName) {
            return;
        }

        const { name, code, metaString } = chartName;
        const { textColor } = this.currentTheme;
        const fontSize = this.canvas.width < 600 ? 10 : 14;
        const padding = 10;
        let yPos = 20;

        this.ctx.fillStyle = textColor;
        this.ctx.textAlign = 'left';

        if (name) {
            this.ctx.font = `bold ${fontSize + 2}px Arial`;
            this.ctx.fillText(name, padding, yPos);
            yPos += fontSize + 4;
        }

        if (code) {
            this.ctx.font = `${fontSize}px Arial`;
            this.ctx.fillText(code, padding, yPos);
            yPos += fontSize + 2;
        }

        if (metaString) {
            this.ctx.font = `italic ${fontSize - 1}px Arial`;
            this.ctx.fillText(metaString, padding, yPos);
        }
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
        const barWidth = mainPlotLayout.width / this.dataViewport.visibleCount;
        for (let i = 0; i < visibleData.length; i += labelInterval) {
            const dataPoint = visibleData[i];
            if (!dataPoint || !dataPoint.time) continue;

            const x = getXPixel(
                this.dataViewport.startIndex + i,
                this.dataViewport.startIndex,
                this.dataViewport.visibleCount,
                mainPlotLayout.width,
                barWidth
            );

            const date = new Date(dataPoint.time * 1000);
            // const label = formatDate(date);
            const label = date.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' });
            
            const labelX = mainPlotLayout.x + x + barWidth / 2;
            // Only draw if the label would be within the plot area
            if (labelX >= mainPlotLayout.x && labelX <= mainPlotLayout.x + mainPlotLayout.width) {
                this.ctx.fillText(label, labelX, xAxisY);
            }
        }
    }

    drawYAxisLabels(plotConfig, plotLayout, minPrice, maxPrice) {
        this.ctx.fillStyle = this.currentTheme.textColor;
        
        // Responsive font size based on canvas width
        const fontSize = this.canvas.width < 600 ? 10 : 12;
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';

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
            const x = plotLayout.x + plotLayout.width + 4;
            this.ctx.fillText(label, x, Math.round(y));
        });

        this.ctx.textBaseline = 'alphabetic'; // Reset baseline

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

        const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
        if (!mainPlotLayout) return;

        const barWidth = mainPlotLayout.width / this.dataViewport.visibleCount;
        const relativeX = this.crosshairX - mainPlotLayout.x;
        const dataIndexAtCrosshair = Math.max(0, Math.floor(relativeX / barWidth));
        const actualDataIndex = this.dataViewport.startIndex + dataIndexAtCrosshair;

        this.options.plots.forEach(plotConfig => {
            const plotLayout = this.plotLayoutManager.getPlotLayout(plotConfig.id);
            if (!plotLayout || plotConfig.overlay) return;

            const plotData = plotConfig.data && plotConfig.data.length > 0 ? plotConfig.data : visibleData;

            if (actualDataIndex >= 0 && actualDataIndex < plotData.length) {
                const dataPoint = plotData[actualDataIndex];

                this.ctx.fillStyle = this.currentTheme.overlayTextColor;
                this.ctx.font = '12px Arial';

                // Show value at cursor Y position to the right of crosshair
                if (this.crosshairY >= plotLayout.y && 
                    this.crosshairY <= plotLayout.y + plotLayout.height) {
                    const { minPrice, maxPrice } = this.calculatePriceRange(plotConfig, visibleData, this.dataViewport);
                    const cursorValue = getValueBasedOnY(
                        this.crosshairY,
                        plotLayout.y,
                        plotLayout.height,
                        minPrice,
                        maxPrice
                    );

                    // Format the value based on plot type and magnitude
                    let valueText;
                    if (plotConfig.type === 'volume') {
                        if (cursorValue >= 1000000) {
                            valueText = (cursorValue / 1000000).toFixed(2) + 'M';
                        } else if (cursorValue >= 1000) {
                            valueText = (cursorValue / 1000).toFixed(2) + 'K';
                        } else {
                            valueText = Math.round(cursorValue).toString();
                        }
                    } else {
                        // For price values, use appropriate decimal places
                        if (cursorValue >= 1000) {
                            valueText = cursorValue.toFixed(0);
                        } else if (cursorValue >= 100) {
                            valueText = cursorValue.toFixed(1);
                        } else if (cursorValue >= 10) {
                            valueText = cursorValue.toFixed(2);
                        } else {
                            valueText = cursorValue.toFixed(3);
                        }
                    }

                    this.ctx.textAlign = 'left';
                    this.ctx.textBaseline = 'middle';
                    const valueX = this.plotLayoutManager.getPlotTotalWidth() + 5;
                    this.ctx.fillText(valueText, valueX, Math.round(this.crosshairY));
                }

                // Show date at the bottom of crosshair
                if (plotConfig.id === 'main' && dataPoint.time !== undefined) {
                    const date = new Date(dataPoint.time * 1000);
                    const dateText = date.toLocaleDateString(undefined, { 
                        year: 'numeric', 
                        month: 'numeric', 
                        day: 'numeric'
                    });
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    // Position the date text 5 pixels below the bottom of the plot area
                    const dateY = this.plotLayoutManager.getPlotTotalHeight() + 15; // Use total height for bottom margin
                    this.ctx.fillText(dateText, this.crosshairX, dateY);
                }

                // Show summary in top-right corner with each plot on a new line
                const infoPlots = this.options.plots.filter(p => p.targetId === plotConfig.id || p.id === plotConfig.id);
                const infoTexts = [];

                infoPlots.forEach(infoPlot => {
                    const infoPlotData = infoPlot.data && infoPlot.data.length > 0 ? infoPlot.data : visibleData;
                    if (actualDataIndex >= 0 && actualDataIndex < infoPlotData.length) {
                        const infoDataPoint = infoPlotData[actualDataIndex];
                        const newText = Object.entries(infoDataPoint)
                            .map(([key, value]) => {
                                if (key === 'time' || key === 'date' || key === 'keyLabel') return null;
                                const formattedValue = typeof value === 'number' ? value.toFixed(2) : value;
                                const keyLabel = infoPlot.keyLabel?.trim().length > 0 
                                    ? infoPlot.keyLabel 
                                    : key.charAt(0).toUpperCase() + key.slice(1);

                                return `${keyLabel}: ${formattedValue}`;
                            })
                            .filter(Boolean)
                            .join(' | ');

                        if (newText) {
                            infoTexts.push(newText);
                        }
                    }
                });

                // Position text in the top-right corner of the plot, with multiple lines
                const lineHeight = 15;
                const padding = 10;
                const textX = plotLayout.x + plotLayout.width - padding; // padding from right edge
                
                this.ctx.textAlign = 'right';

                if (!infoPlots.some(p => p.id === 'main' || p.targetId === 'main')) {
                    const nonMainInfo = infoTexts.join(' | ');
                    infoTexts.length = 0;
                    infoTexts.push(nonMainInfo);
                }

                // Draw each info text on a new line
                infoTexts.forEach((text, index) => {
                    const textY = plotLayout.y + (index + 1) * lineHeight;
                    this.ctx.fillText(text, textX, textY);
                });
                this.ctx.textAlign = 'left'; // Reset alignment for other text
                this.ctx.textBaseline = 'alphabetic'; // Reset baseline
            }
        });
    }

        /**
     * Draw a signal block
     * @private
     */
    drawSignalBlock(plotLayout, startIndex, endIndex, style, minPrice, maxPrice, barWidth) {
        const startXPos = plotLayout.x + getXPixel(
            this.dataViewport.startIndex + startIndex,
            this.dataViewport.startIndex,
            this.dataViewport.visibleCount,
            plotLayout.width,
            barWidth
        );
    
        const endXPos = plotLayout.x + getXPixel(
            this.dataViewport.startIndex + endIndex + 1,
            this.dataViewport.startIndex,
            this.dataViewport.visibleCount,
            plotLayout.width,
            barWidth
        );
    
        const y = getYPixel(style.value, minPrice, maxPrice, plotLayout.height, plotLayout.y);
        
        // Draw block
        this.ctx.fillStyle = style.color;
        this.ctx.fillRect(
            startXPos,
            y - style.blockHeight / 2,
            endXPos - startXPos,
            style.blockHeight
        );
    
        // Draw signal line
        this.ctx.strokeStyle = style.lineColor;
        this.ctx.beginPath();
        this.ctx.moveTo(startXPos, y);
        this.ctx.lineTo(endXPos, y);
        this.ctx.stroke();
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

    ensureContainerSize(container) {
        if (container.clientHeight < 1) {
            container.style.height = `${window.innerHeight * 0.9}px`;
        }
        if (container.clientWidth < 1) {
            container.style.width = `${window.innerWidth * 0.9}px`;
        }
    }
}
export default StockChart;


