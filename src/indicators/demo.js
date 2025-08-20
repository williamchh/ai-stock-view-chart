import { initMACDState, updateMACD } from './macd.js';
import { initSMAState, updateSMA } from './sma.js';
import { initRSIState, updateRSI } from './rsi.js';

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
            macd: result.macdLine,
            signal: result.signalLine,
            histogram: result.histogram
        });
        state = result.state;
    }

    return macdData;
}

/**
 * Calculate RSI for a series of data
 * @param {Array} data - Array of price data
 * @param {number} period - RSI period
 * @returns {Array} Array of RSI values with timestamps
 */
export function calculateRSI(data, period = 14) {
    let state = initRSIState(period);
    const rsiData = [];

    for (const point of data) {
        const result = updateRSI(point.close, state);
        rsiData.push({
            time: point.time,
            value: result.value
        });
        state = result.state;
    }

    return rsiData;
}

/**
 * @description Generate random candlestick data
 * @param {number} count 
 * @returns {Array} Array of candlestick data
 */
export function generateCandlestickData(count) {
    const data = [];
    let lastClose = 200;
    let date = new Date('2015-01-01');
    for (let i = 0; i < count; i++) {
    const open = lastClose + (Math.random() - 0.5) * 5;
    const close = open + (Math.random() - 0.5) * 10;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    const volume = Math.random() * 10000 + 1000;
    data.push({
        time: date.getTime() / 1000,
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume
    });
    lastClose = close;
    date.setDate(date.getDate() + 1);
    }
    return data;
}