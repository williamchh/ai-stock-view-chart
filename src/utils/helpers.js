
/**
 * Get the color associated with a specific signal type.
 * @param {string} type - The type of the signal (e.g., 'support', 'resistance').
 * @returns {string} The RGBA color string associated with the signal type.
 */
export function getSignalTypeColor(type) {
    switch (type) {
        case 'support':
            return 'rgba(0, 255, 0, 0.75)';
        case 'resistance':
            return 'rgba(255, 0, 0, 0.75)';
        case 'uptrend':
            return 'rgba(0, 255, 255, 0.75)';
        case 'downtrend':
            return 'rgba(255, 165, 0, 0.75)';
        default:
            return 'rgba(0, 0, 0, 0.75)';
    }
}