/**
 * @fileoverview Utility functions for drawing on the canvas.
 * @author H Chen
 */

/**
 * Draws a candlestick on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {object} data - The candlestick data (open, high, low, close).
 * @param {number} x - The x-coordinate for the candlestick.
 * @param {number} openY - The y-coordinate for the open price.
 * @param {number} highY - The y-coordinate for the high price.
 * @param {number} lowY - The y-coordinate for the low price.
 * @param {number} closeY - The y-coordinate for the close price.
 * @param {number} width - The width of the candlestick body.
 * @param {import("../stock-chart.js").Theme} theme - The current theme object.
 */
export function drawCandlestick(ctx, data, x, openY, highY, lowY, closeY, width, theme) {
    const isBullish = data.close > data.open;
    const bodyColor = isBullish ? theme.candleUp : theme.candleDown;
    let borderColor = theme.candleBorderColor || theme.textColor; 
    if (theme.borderColorUseBodyColor) {
        borderColor = bodyColor;
    }

    // Draw wick
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, highY);
    ctx.lineTo(x + width / 2, lowY);
    ctx.stroke();

    // Draw body
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.fillRect(x, Math.min(openY, closeY), width, Math.abs(openY - closeY));
    ctx.strokeRect(x, Math.min(openY, closeY), width, Math.abs(openY - closeY));
}

/**
 * Draws a line segment on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} x1 - The x-coordinate of the start point.
 * @param {number} y1 - The y-coordinate of the start point.
 * @param {number} x2 - The x-coordinate of the end point.
 * @param {number} y2 - The y-coordinate of the end point.
 * @param {string} color - The color of the line.
 * @param {number} lineWidth - The width of the line.
 */
export function drawLine(ctx, x1, y1, x2, y2, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

/**
 * Draws an arrow on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} fromx - The x-coordinate of the start point.
 * @param {number} fromy - The y-coordinate of the start point.
 * @param {number} tox - The x-coordinate of the end point.
 * @param {number} toy - The y-coordinate of the end point.
 * @param {string} lineStyle - The style of the line (solid, dashed, etc.).
 * @returns {void}
 */
export function drawArrow(ctx, fromx, fromy, tox, toy, lineStyle = 'solid') {
        if (!ctx) {
            return;
        }
    
        if (fromx > this.priceAxisWidth) {
            return 
        }
    
        tox += this.candleWidth / 2;
    
        ctx.strokeStyle = this.textColor;
        ctx.fillStyle = this.textColor;  // Add this for filled arrowhead
        ctx.lineWidth = 1;
        const headlen = 10; // length of head in pixels
        const dx = tox - fromx;
        const dy = toy - fromy;
        const angle = Math.atan2(dy, dx);
        let newToX = tox;
        let newToY = toy;
        let drawArrow = true;
        
        if (tox > this.priceAxisWidth) {
            const intersection = this.calculateIntersectionPointWithPriceAxis(fromx, fromy, tox, toy);
            newToX = intersection?.x || tox;
            newToY = intersection?.y || toy;
            drawArrow = false;
        }
    
        // Draw the line
        ctx.beginPath();
        ctx.moveTo(fromx, fromy);
        ctx.lineTo(newToX, newToY);
        // apply line style
        if (lineStyle === 'solid') {
            ctx.setLineDash([]);
        }
        else if (lineStyle === 'dashed') {
            ctx.setLineDash([3, 5]);
        }
        else if (lineStyle === 'groove') {
            ctx.setLineDash([3, 8]);
        }
        
        ctx.stroke();
    
        // Draw the arrowhead
        if (drawArrow) {
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(newToX, newToY);
            ctx.lineTo(
                newToX - headlen * Math.cos(angle - Math.PI / 6),
                newToY - headlen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(newToX, newToY);
            ctx.lineTo(
                newToX - headlen * Math.cos(angle + Math.PI / 6),
                newToY - headlen * Math.sin(angle + Math.PI / 6)
            );
            // ctx.closePath();
            ctx.stroke();  // Fill the arrowhead instead of stroke
        }
    
        ctx.lineWidth = 1;
    }