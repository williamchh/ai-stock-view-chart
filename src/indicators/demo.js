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
 * @description Generate random candlestick data with signals
 * @param {number} count 
 * @returns {Array} Array of candlestick data with signals
 */
export function generateCandlestickData(count) {
    const data = [];
    let lastClose = 200;
    let date = new Date('2015-01-01');
    let supportLevel = null;
    let resistanceLevel = null;
    let trendCount = 0;
    
    for (let i = 0; i < count; i++) {
        const open = lastClose + (Math.random() - 0.5) * 5;
        const close = open + (Math.random() - 0.5) * 10;
        const high = Math.max(open, close) + Math.random() * 5;
        const low = Math.min(open, close) - Math.random() * 5;
        const volume = Math.random() * 10000 + 1000;
        
        // Initialize signals array
        const signals = [];
        
        // Support level logic
        if (supportLevel === null || low < supportLevel * 0.98) {
            // Create new support level when price drops significantly
            supportLevel = low;
            trendCount = 0;
        } else if (low > supportLevel && low < supportLevel * 1.02) {
            // Add support signal when price tests support level
            signals.push({
                type: 'support',
                value: supportLevel
            });
        }
        
        // Resistance level logic
        if (resistanceLevel === null || high > resistanceLevel * 1.02) {
            // Create new resistance level when price rises significantly
            resistanceLevel = high;
            trendCount = 0;
        } else if (high < resistanceLevel && high > resistanceLevel * 0.98) {
            // Add resistance signal when price tests resistance level
            signals.push({
                type: 'resistance',
                value: resistanceLevel
            });
        }
        
        // Trend signals
        trendCount++;
        if (trendCount >= 5) {
            if (close > open && close > lastClose) {
                signals.push({
                    type: 'uptrend',
                    value: (low + supportLevel) / 2
                });
            } else if (close < open && close < lastClose) {
                signals.push({
                    type: 'downtrend',
                    value: (high + resistanceLevel) / 2
                });
            }
        }

        data.push({
            time: date.getTime() / 1000,
            open: open,
            high: high,
            low: low,
            close: close,
            volume: volume,
            signals: signals.length > 0 ? signals : undefined // Only add signals if there are any
        });
        
        lastClose = close;
        date.setDate(date.getDate() + 1);
    }
    return data;
}