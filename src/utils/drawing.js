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
 * @param {object} theme - The current theme object.
 */
export function drawCandlestick(ctx, data, x, openY, highY, lowY, closeY, width, theme) {
    const isBullish = data.close > data.open;
    const bodyColor = isBullish ? theme.candleUp : theme.candleDown;
    const borderColor = theme.candleBorder;

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