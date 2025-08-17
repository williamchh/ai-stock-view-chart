import { initMACDState, updateMACD } from './macd.js';
import { initSMAState, updateSMA } from './sma.js';

/**
 * Calculate SMA for a series of data
 * @param {Array} data - Array of price data
 * @param {number} period - SMA period
 * @param {function} valueSelector - Function to select value from data point (default: d => d.close)
 * @returns {Array} Array of SMA values with timestamps
 */
export function calculateSMA(data, period, valueSelector = d => d.close) {
    let state = initSMAState(period);
    const smaData = [];

    for (const point of data) {
        const value = valueSelector(point);
        const result = updateSMA(value, state);
        smaData.push({
            time: point.time,
            value: result.value
        });
        state = result.state;
    }

    return smaData;
}

/**
 * Calculate MACD for a series of data
 * @param {Array} data - Array of price data
 * @param {number} fastPeriod - Fast EMA period (default: 12)
 * @param {number} slowPeriod - Slow EMA period (default: 26)
 * @param {number} signalPeriod - Signal EMA period (default: 9)
 * @returns {Array} Array of MACD values with timestamps
 */
export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    let state = initMACDState(fastPeriod, slowPeriod, signalPeriod);
    const macdData = [];

    for (const point of data) {
        const result = updateMACD(point.close, state);
        macdData.push({
            time: point.time,
            value: result.macdLine,
            signal: result.signalLine,
            histogram: result.histogram
        });
        state = result.state;
    }

    return macdData;
}
