/**
 * @fileoverview Screenshot utility for capturing and downloading chart as WebP format.
 * @author H Chen
 */

/**
 * Captures the chart canvas and downloads it as a WebP image
 * @param {HTMLCanvasElement} canvas - The canvas element to capture
 * @param {string} filename - Optional filename for the download (default: 'stock-chart.webp')
 * @returns {Promise<void>}
 */
export async function downloadChartAsWebP(canvas, filename = 'ai-stock-view-chart.webp') {
    try {
        // Convert canvas to blob with webp format
        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                return;
            }

            // Create a temporary URL for the blob
            const url = URL.createObjectURL(blob);

            // Create a temporary link element and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();

            // Cleanup
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 'image/webp', 0.95); // 0.95 is the quality setting for WebP

    } catch (error) {
        console.error('Error downloading chart as WebP:', error);
    }
}

/**
 * Creates a screenshot SVG overlay icon
 * @param {number} size - Size of the icon in pixels
 * @returns {string} SVG string for the screenshot icon
 */
export function getScreenshotIcon(size = 18) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
}
