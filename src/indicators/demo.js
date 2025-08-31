import { initMACDState, updateMACD } from './macd.js';
import { initSMAState, updateSMA } from './sma.js';
import { initRSIState, updateRSI } from './rsi.js';
import { initBollingerBandState, updateBollingerBands } from './bollingband.js';
import { initEMAState, updateEMA } from './ema.js';
import { initDeMarkerState, updateDeMarker } from './demarket.js';

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
 * Calculate Bollinger Bands for a series of data
 * @param {Array} data - Array of price data
 * @param {number} period - Bollinger Bands period
 * @param {number} standardDeviationMultiplier - Standard deviation multiplier (default: 2)
 * @returns {Array} Array of Bollinger Bands with timestamps
 */
export function calculateBollingerBands(data, period, standardDeviationMultiplier = 2) {
    let band = initBollingerBandState(period, standardDeviationMultiplier);
    let midLine = initSMAState(period);
    const bollingerBands = [];

    for (const point of data) {
        const result = updateBollingerBands(point.close, band);
        const midResult = updateSMA(point.close, midLine);
        bollingerBands.push({
            time: point.time,
            upper: result.upper,
            lower: result.lower,
            middle: midResult.value
        });
        band = result.state;
        midLine = midResult.state;
    }

    return bollingerBands;
}

/**
 * Calculate EMA for a series of data
 * @param {Array} data - Array of price data
 * @param {number} period - EMA period
 * @returns {Array} Array of EMA values with timestamps
 */
export function calculateEMA(data, period) {
    let ema = initEMAState(period);
    const emaData = [];

    for (const point of data) {
        const result = updateEMA(point.close, ema);
        emaData.push({
            time: point.time,
            value: result.value
        });
        ema = result.state;
    }

    return emaData;
}

export function calculateDeMarker(data, period = 14) {
    let state = initDeMarkerState(period);
    const deMarkerData = [];

    for (const point of data) {
        const result = updateDeMarker(point.high, point.low, state);
        deMarkerData.push({
            time: point.time,
            value: result.value
        });
        state = result.state;
    }

    return deMarkerData;
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
    
    // Signal context to maintain state across iterations
    const signalContext = {
        supportLevel: null,
        resistanceLevel: null,
        supportTouches: 0,
        resistanceTouches: 0,
        trendDirection: 0, // -1 down, 0 sideways, 1 up
        trendStrength: 0
    };
    
    // Price history for moving averages and momentum
    const priceHistory = [];

    for (let i = 0; i < count; i++) {
    
        const open = lastClose + (Math.random() - 0.5) * 5;
        const close = open + (Math.random() - 0.5) * 10;
        const high = Math.max(open, close) + Math.random() * 5;
        const low = Math.min(open, close) - Math.random() * 5;
        const volume = Math.random() * 10000 + 1000;
        
        // Update price history
        priceHistory.push(close);
        if (priceHistory.length > 50) priceHistory.shift(); // Keep last 50 periods
        
        // Generate signals using the extracted function
        const candleData = {
            open, high, low, close, volume,
            priceHistory, data, lastClose
        };
        
        const signals = generateTradingSignals(candleData, signalContext, i);
        
        data.push({
            time: date.getTime() / 1000,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: Math.round(volume),
            signals: signals.length > 0 ? signals[0] : undefined
        });
        
        lastClose = close;
        date.setDate(date.getDate() + 1);


    }
    
    return data;
}

let value = null;
function generateTradingSignals(candleData, signalContext, index) {
    const signals = [];
    if (index % 100 >= 15 && index % 100 <= 23) {
        if (index % 100 == 15) value = candleData.close;
        signals.push({
            type: 'support',
            value: value || candleData.close,
            description: `Signal at ${value}`
        })
    }
    else if (index % 100 >= 32 && index % 100 <= 39) {
        if (index % 100 == 32) value = candleData.close;
        signals.push({
            type: 'resistance',
            value: value,
            description: `Signal at ${value}`
        });
    }
    else if (index % 100 >= 45 && index % 100 <= 50) {
        if (index % 100 == 45) value = candleData.close;
        signals.push({
            type: 'uptrend',
            value: value,
            description: `Signal at ${value}`
        });
    }
    else {
        signals.push({
            type: 'unknown',
            value: null,
            description: `Unknown signal at ${candleData.close}`
        });
    }

    return signals;
}