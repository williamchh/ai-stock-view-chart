/**
 * Screenshot utility for capturing and downloading chart as WebP format.
 */

/**
 * Captures the chart canvas and downloads it as a WebP image
 * @param canvas - The canvas element to capture
 * @param filename - Optional filename for the download (default: 'stock-chart.webp')
 */
export function downloadChartAsWebP(canvas: HTMLCanvasElement, filename?: string): Promise<void>;

/**
 * Creates a screenshot SVG overlay icon
 * @param size - Size of the icon in pixels
 */
export function getScreenshotIcon(size?: number): string;
