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
 * Represents the main StockChart class.
 * Provides rendering, interaction, and theming for financial charts.
 */
class StockChart {
    /**
     * Initializes a new StockChart instance.
     * @param {string} elementId - The ID of the HTML element to mount the chart to.
     * @param {object} options - Configuration options for the chart.
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
     * @param {HTMLElement} container - The HTML element to mount the chart to.
     * @param {object} options - Configuration options for the chart.
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

        this.dataViewport = new DataViewport(this.options.data, this.options.initialVisibleCandles);

        this.isDragging = false;
        this.lastMouseX = 0;
        this.crosshairX = -1;
        this.crosshairY = -1;
        this.minPrice = 0; // Will be updated in render
        this.maxPrice = 0; // Will be updated in render
        this.priceScale = 1.0; // vertical zoom/scale factor
        this.priceOffset = 0; // vertical offset for panning
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        // Custom event listener for external cursor sync
        window.addEventListener('broadcastCursor', e => {
            const { x, y } = e.detail;
            this.crosshairX = x;
            this.crosshairY = y;
            this.render();
        });
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.handleMouseOut.bind(this));
        this.canvas.addEventListener('wheel', this.handleMouseWheel.bind(this));
        this.canvas.addEventListener('dblclick', this.resetVerticalScale.bind(this));

        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === this.container) {
                    this.resize();
                }
            }
        });
        this.resizeObserver.observe(this.container);

        this.applyTheme(this.options.theme);
    }

    /**
     * Default options for the StockChart.
     * @type {object}
     */
    static defaultOptions = {
        theme: 'light', // 'light' or 'dark'
        chartType: 'candlestick', // 'candlestick' or 'line'
        data: [],
        plots: [
            { id: 'main', heightRatio: 0.7 },
            { id: 'volume', heightRatio: 0.3 }
        ],
        initialVisibleCandles: 100,
        // Add more default options as needed
    };

    static themes = { light: lightTheme, dark: darkTheme };

    /**
     * Resizes the canvas to match the container's dimensions and redraws the chart.
     */
    resize() {
        const { clientWidth, clientHeight } = this.container;
        this.canvas.width = clientWidth;
        this.canvas.height = clientHeight;
        this.plotLayoutManager.updateCanvasDimensions(clientWidth, clientHeight);
        this.render();
    }

    /**
     * Applies the specified theme to the chart.
     * @param {string} themeName - The name of the theme to apply ('light' or 'dark').
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

        // Determine min/max price for visible data
        // If minPrice and maxPrice are not set (first render or after data change), calculate them
        // Otherwise, use the existing minPrice and maxPrice for vertical scaling
        if (this.minPrice === 0 && this.maxPrice === 0) {
            let currentMinPrice = Infinity;
            let currentMaxPrice = -Infinity;
            visibleData.forEach(d => {
                currentMinPrice = Math.min(currentMinPrice, d.low);
                currentMaxPrice = Math.max(currentMaxPrice, d.high);
            });
            const priceRange = currentMaxPrice - currentMinPrice;
            const padding = priceRange * 0.1; // 10% padding
            this.minPrice = currentMinPrice - padding;
            this.maxPrice = currentMaxPrice + padding;
        }

        const minPrice = this.minPrice;
        const maxPrice = this.maxPrice;


        // Render plots based on layout
        this.options.plots.forEach(plotConfig => {
            const plotLayout = this.plotLayoutManager.getPlotLayout(plotConfig.id);
            if (plotLayout) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.rect(plotLayout.x, plotLayout.y, plotLayout.width, plotLayout.height);
                this.ctx.clip();

                // Draw plot background
                this.ctx.fillStyle = this.currentTheme.chartAreaBackground;
                this.ctx.fillRect(plotLayout.x, plotLayout.y, plotLayout.width, plotLayout.height);

                this.ctx.strokeStyle = this.currentTheme.gridColor;
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(plotLayout.x, plotLayout.y, plotLayout.width, plotLayout.height);

                // Draw data points
                if (plotConfig.id === 'main') {
                    visibleData.forEach((dataPoint, i) => {
                        const x = getXPixel(this.dataViewport.startIndex + i, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth);

                        const openY = getYPixel(dataPoint.open, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                        const highY = getYPixel(dataPoint.high, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                        const lowY = getYPixel(dataPoint.low, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                        const closeY = getYPixel(dataPoint.close, minPrice, maxPrice, plotLayout.height, plotLayout.y);

                        if (this.options.chartType === 'candlestick') {
                            drawCandlestick(
                                this.ctx,
                                dataPoint,
                                x,
                                openY,
                                highY,
                                lowY,
                                closeY,
                                barWidth * 0.7, // Adjust candlestick width
                                this.currentTheme
                            );
                        } else if (this.options.chartType === 'line') {
                            // For line chart, connect close prices
                            if (i > 0) {
                                const prevDataPoint = visibleData[i - 1];
                                const prevX = getXPixel(this.dataViewport.startIndex + i - 1, this.dataViewport.startIndex, this.dataViewport.visibleCount, plotLayout.width, barWidth);
                                const prevY = getYPixel(prevDataPoint.close, minPrice, maxPrice, plotLayout.height, plotLayout.y);
                                drawLine(
                                    this.ctx,
                                    prevX + barWidth / 2, prevY,
                                    x + barWidth / 2, closeY,
                                    this.currentTheme.lineColor,
                                    2
                                );
                            }
                        }
                    });
                }
            }
        }); // end forEach visibleData

        // Debug overlay
        this.ctx.fillText(`Canvas: ${this.canvas.width}x${this.canvas.height}`, 10, 60);

        // Draw crosshair
        if (this.crosshairX !== -1 && this.crosshairY !== -1) {
            this.ctx.strokeStyle = this.currentTheme.crosshairColor;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]); // Dashed line

            // Vertical line
            this.ctx.beginPath();
            this.ctx.moveTo(this.crosshairX, 0);
            this.ctx.lineTo(this.crosshairX, this.canvas.height);
            this.ctx.stroke();

            // Horizontal line (only in main plot for now)
            const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');
            if (mainPlotLayout && this.crosshairY >= mainPlotLayout.y && this.crosshairY <= mainPlotLayout.y + mainPlotLayout.height) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, this.crosshairY);
                this.ctx.lineTo(this.canvas.width, this.crosshairY);
                this.ctx.stroke();
            }
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
       this.isDragging = true;
       this.lastMouseX = event.clientX;
   }

   /**
    * Handles mouse out, clears crosshair and stops dragging.
    */

   /**
    * Handles mouse up, stops dragging state.
    */

   /**
    * Handles mouse move events for updating viewport and broadcasting cursor.
    * @param {MouseEvent} event
    */

   /**
    * Handles mouse move events for dragging and crosshair.
    * @param {MouseEvent} event - The mouse event.
    */
   handleMouseMove(event) {
       const rect = this.canvas.getBoundingClientRect();
       this.crosshairX = event.clientX - rect.left;
       this.crosshairY = event.clientY - rect.top;

       if (this.isDragging) {
           const deltaX = event.clientX - this.lastMouseX;
           const scrollAmount = Math.round(deltaX / (this.canvas.width / this.dataViewport.visibleCount));
           this.dataViewport.scroll(-scrollAmount); // Negative to scroll opposite of mouse movement
           this.lastMouseX = event.clientX;
       }
       // Broadcast cursor position to other listening charts
       const broadcastEvent = new CustomEvent('broadcastCursor', { detail: { x: this.crosshairX, y: this.crosshairY } });
       window.dispatchEvent(broadcastEvent);
       this.render();
   }

   /**
    * Handles mouse up events.
    */
   handleMouseUp() {
       this.isDragging = false;
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
    * Displays price and indicator overlay text near crosshair.
    */

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
    * Displays price and indicator information at the crosshair position.
    */
   displayInfoOverlay() {
       const visibleData = this.dataViewport.getVisibleData();
       if (visibleData.length === 0) return;

       const barWidth = this.canvas.width / this.dataViewport.visibleCount;
       const dataIndexAtCrosshair = Math.floor(this.crosshairX / barWidth);
       const actualDataIndex = this.dataViewport.startIndex + dataIndexAtCrosshair;

       if (actualDataIndex >= 0 && actualDataIndex < this.options.data.length) {
           const dataPoint = this.options.data[actualDataIndex];
           const mainPlotLayout = this.plotLayoutManager.getPlotLayout('main');

           if (mainPlotLayout) {
               this.ctx.fillStyle = this.currentTheme.overlayTextColor;
               this.ctx.font = '12px Arial';

               let infoText = `Date: ${dataPoint.date || 'N/A'}`;
               infoText += ` Open: ${dataPoint.open.toFixed(2)}`;
               infoText += ` High: ${dataPoint.high.toFixed(2)}`;
               infoText += ` Low: ${dataPoint.low.toFixed(2)}`;
               infoText += ` Close: ${dataPoint.close.toFixed(2)}`;
               infoText += ` Volume: ${dataPoint.volume || 'N/A'}`;

               // Position the tooltip near the crosshair, avoiding going off-canvas
               const textWidth = this.ctx.measureText(infoText).width;
               const textHeight = 14; // Approximate line height

               let textX = this.crosshairX + 10;
               let textY = this.crosshairY - 10;

               if (textX + textWidth > this.canvas.width) {
                   textX = this.crosshairX - textWidth - 10;
               }
               if (textY < 0) {
                   textY = this.crosshairY + textHeight + 10;
               }

               this.ctx.fillText(infoText, textX, textY);
           }
       }
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