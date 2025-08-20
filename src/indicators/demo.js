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
        // More realistic price movement with trending behavior
        const volatility = 0.02 + Math.random() * 0.03; // 2-5% volatility
        const trendBias = signalContext.trendDirection * 0.003 * signalContext.trendStrength; // Trend influence
        const randomWalk = (Math.random() - 0.5) * volatility;
        
        const priceChange = lastClose * (trendBias + randomWalk);
        const open = lastClose + (Math.random() - 0.5) * lastClose * 0.01; // Small gap
        const close = open + priceChange;
        
        // High and low with more realistic wicks
        const bodySize = Math.abs(close - open);
        const upperWick = Math.random() * bodySize * 0.5 + bodySize * 0.1;
        const lowerWick = Math.random() * bodySize * 0.5 + bodySize * 0.1;
        
        const high = Math.max(open, close) + upperWick;
        const low = Math.min(open, close) - lowerWick;
        const volume = Math.random() * 8000 + 2000 + (Math.abs(priceChange) / lastClose * 50000);
        
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
            signals: signals.length > 0 ? signals : undefined
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
    else {
        if (index % 100 == 24) value = candleData.close;
        signals.push({
            type: 'resistance',
            value: value,
            description: `Signal at ${value}`
        })
    }

    return signals;
}

        // /**
        //  * Generate trading signals for a single candle
        //  * @param {Object} candleData - Current candle data and context
        //  * @param {Object} signalContext - Persistent signal context
        //  * @param {number} index - Current candle index
        //  * @returns {import('../stock-chart.js').Signal[]} Array of signals
        //  */
        // function generateTradingSignals(candleData, signalContext, index) {
        //     const { open, high, low, close, volume, priceHistory, data, lastClose } = candleData;
        //     const signals = [];
            
        //     // Update support and resistance levels
        //     if (index > 10) {
        //         const recentPeriod = Math.min(20, priceHistory.length);
        //         const recentPrices = priceHistory.slice(-recentPeriod);
        //         const recentHigh = Math.max(...recentPrices);
        //         const recentLow = Math.min(...recentPrices);
                
        //         // Update support level
        //         if (!signalContext.supportLevel || (low <= recentLow * 1.005 && recentLow < signalContext.supportLevel * 0.98)) {
        //             signalContext.supportLevel = Math.round(recentLow * 100) / 100; // Round to 2 decimals for consistency
        //             signalContext.supportTouches = 1;
        //         }
                
        //         // Update resistance level  
        //         if (!signalContext.resistanceLevel || (high >= recentHigh * 0.995 && recentHigh > signalContext.resistanceLevel * 1.02)) {
        //             signalContext.resistanceLevel = Math.round(recentHigh * 100) / 100;
        //             signalContext.resistanceTouches = 1;
        //         }
                
        //         // Support signal - when price is near support
        //         if (signalContext.supportLevel && low <= signalContext.supportLevel * 1.02 && close >= signalContext.supportLevel * 0.98) {
        //             signalContext.supportTouches++;
        //             signals.push({
        //                 type: 'support',
        //                 value: signalContext.supportLevel,
        //                 strength: Math.min(signalContext.supportTouches, 5),
        //                 description: `Support at ${signalContext.supportLevel}`
        //             });
        //         }
                
        //         // Resistance signal - when price is near resistance
        //         if (signalContext.resistanceLevel && high >= signalContext.resistanceLevel * 0.98 && close <= signalContext.resistanceLevel * 1.02) {
        //             signalContext.resistanceTouches++;
        //             signals.push({
        //                 type: 'resistance',
        //                 value: signalContext.resistanceLevel,
        //                 strength: Math.min(signalContext.resistanceTouches, 5),
        //                 description: `Resistance at ${signalContext.resistanceLevel}`
        //             });
        //         }
        //     }
            
        //     // Trend detection
        //     if (priceHistory.length >= 10) {
        //         const shortMA = priceHistory.slice(-5).reduce((a, b) => a + b) / 5;
        //         const longMA = priceHistory.slice(-10).reduce((a, b) => a + b) / 10;
        //         const currentTrend = Math.round((shortMA - longMA) * 1000) / 1000; // Round for consistency
                
        //         // Update trend
        //         const prevTrend = signalContext.trendDirection;
        //         if (shortMA > longMA * 1.01) {
        //             signalContext.trendDirection = 1;
        //             signalContext.trendStrength = Math.min(signalContext.trendStrength + 0.1, 1);
        //         } else if (shortMA < longMA * 0.99) {
        //             signalContext.trendDirection = -1;
        //             signalContext.trendStrength = Math.min(signalContext.trendStrength + 0.1, 1);
        //         } else {
        //             signalContext.trendDirection = 0;
        //             signalContext.trendStrength = Math.max(signalContext.trendStrength - 0.1, 0);
        //         }
                
        //         // Continuous trend signals with same value for blocks
        //         if (signalContext.trendDirection !== 0 && signalContext.trendStrength > 0.3) {
        //             const trendValue = Math.round(currentTrend * 1000) / 1000; // Consistent trend value
                    
        //             if (signalContext.trendDirection === 1) {
        //                 signals.push({
        //                     type: 'uptrend',
        //                     value: Math.abs(trendValue), // Use absolute trend strength as value
        //                     strength: Math.round(signalContext.trendStrength * 5),
        //                     description: `Bullish trend`
        //                 });
        //             } else {
        //                 signals.push({
        //                     type: 'downtrend',
        //                     value: Math.abs(trendValue),
        //                     strength: Math.round(signalContext.trendStrength * 5),
        //                     description: `Bearish trend`
        //                 });
        //             }
        //         }
        //     }
            
        //     // Breakout signals
        //     // if (signalContext.supportLevel && signalContext.resistanceLevel && index > 20) {
        //     //     if (close > signalContext.resistanceLevel && volume > 5000 && Math.random() < 0.2) {
        //     //         signals.push({
        //     //             type: 'breakout_bullish',
        //     //             value: signalContext.resistanceLevel,
        //     //             strength: 4,
        //     //             description: `Bullish breakout above ${signalContext.resistanceLevel}`
        //     //         });
        //     //     }
                
        //     //     if (close < signalContext.supportLevel && volume > 5000 && Math.random() < 0.2) {
        //     //         signals.push({
        //     //             type: 'breakout_bearish', 
        //     //             value: signalContext.supportLevel,
        //     //             strength: 4,
        //     //             description: `Bearish breakdown below ${signalContext.supportLevel}`
        //     //         });
        //     //     }
        //     // }
            
        //     // // Volume spike signals - use volume level as value for continuity
        //     // const avgVolume = data.slice(-10).reduce((sum, candle) => sum + (candle.volume || 0), 0) / Math.min(10, data.length);
        //     // if (volume > avgVolume * 1.8) {
        //     //     const volumeLevel = Math.round(volume / 1000) * 1000; // Round to nearest thousand
        //     //     signals.push({
        //     //         type: 'volume_spike',
        //     //         value: volumeLevel,
        //     //         strength: Math.min(Math.floor(volume / avgVolume), 5),
        //     //         description: `High volume: ${Math.round(volume)}`
        //     //     });
        //     // }
            
        //     return signals;
        // }

// function generateTradingSignals(candleData, signalContext, index) {
//     const {
//         open, high, low, close, volume,
//         priceHistory, data, lastClose
//     } = candleData;
    
//     const {
//         supportLevel, resistanceLevel, supportTouches, resistanceTouches,
//         trendDirection, trendStrength
//     } = signalContext;
    
//     const signals = [];
    
//     // Update support and resistance levels more realistically
//     if (index > 10) { // Need some history first
//         // Find local highs and lows over recent periods
//         const recentPeriod = Math.min(20, priceHistory.length);
//         const recentPrices = priceHistory.slice(-recentPeriod);
//         const recentHigh = Math.max(...recentPrices);
//         const recentLow = Math.min(...recentPrices);
        
//         // Update support level
//         if (supportLevel === null || (low <= recentLow * 1.005 && recentLow < supportLevel * 0.98)) {
//             signalContext.supportLevel = recentLow;
//             signalContext.supportTouches = 1;
//         }
        
//         // Update resistance level
//         if (resistanceLevel === null || (high >= recentHigh * 0.995 && recentHigh > resistanceLevel * 1.02)) {
//             signalContext.resistanceLevel = recentHigh;
//             signalContext.resistanceTouches = 1;
//         }
        
//         // Support signal - when price bounces off support
//         if (signalContext.supportLevel && low <= signalContext.supportLevel * 1.01 && close > low && close > signalContext.supportLevel) {
//             signalContext.supportTouches++;
//             if (signalContext.supportTouches >= 2 && Math.random() < 0.7) { // 70% chance to signal
//                 signals.push({
//                     type: 'support',
//                     value: signalContext.supportLevel,
//                     strength: Math.min(signalContext.supportTouches, 5), // Max strength of 5
//                     description: `Support level at ${signalContext.supportLevel.toFixed(2)}`
//                 });
//             }
//         }
        
//         // Resistance signal - when price rejects from resistance
//         if (signalContext.resistanceLevel && high >= signalContext.resistanceLevel * 0.99 && close < high && close < signalContext.resistanceLevel) {
//             signalContext.resistanceTouches++;
//             if (signalContext.resistanceTouches >= 2 && Math.random() < 0.7) {
//                 signals.push({
//                     type: 'resistance',
//                     value: signalContext.resistanceLevel,
//                     strength: Math.min(signalContext.resistanceTouches, 5),
//                     description: `Resistance level at ${signalContext.resistanceLevel.toFixed(2)}`
//                 });
//             }
//         }
//     }
    
//     // Trend detection using moving averages
//     if (priceHistory.length >= 10) {
//         const shortMA = priceHistory.slice(-5).reduce((a, b) => a + b) / 5;
//         const longMA = priceHistory.slice(-10).reduce((a, b) => a + b) / 10;
        
//         // Update trend direction
//         const prevTrend = signalContext.trendDirection;
//         if (shortMA > longMA * 1.01) {
//             signalContext.trendDirection = 1;
//             signalContext.trendStrength = Math.min(signalContext.trendStrength + 0.1, 1);
//         } else if (shortMA < longMA * 0.99) {
//             signalContext.trendDirection = -1;
//             signalContext.trendStrength = Math.min(signalContext.trendStrength + 0.1, 1);
//         } else {
//             signalContext.trendDirection = 0;
//             signalContext.trendStrength = Math.max(signalContext.trendStrength - 0.05, 0);
//         }
        
//         // Trend change signals
//         if (prevTrend !== signalContext.trendDirection && signalContext.trendStrength > 0.3 && Math.random() < 0.4) {
//             if (signalContext.trendDirection === 1) {
//                 signals.push({
//                     type: 'bullish_trend',
//                     value: close,
//                     strength: Math.round(signalContext.trendStrength * 5),
//                     description: `Bullish trend emerging`
//                 });
//             } else if (signalContext.trendDirection === -1) {
//                 signals.push({
//                     type: 'bearish_trend',
//                     value: close,
//                     strength: Math.round(signalContext.trendStrength * 5),
//                     description: `Bearish trend emerging`
//                 });
//             }
//         }
//     }
    
//     // Breakout signals
//     if (signalContext.supportLevel && signalContext.resistanceLevel && index > 20) {
//         // Breakout above resistance
//         if (close > signalContext.resistanceLevel && volume > 5000 && Math.random() < 0.3) {
//             signals.push({
//                 type: 'breakout_bullish',
//                 value: signalContext.resistanceLevel,
//                 strength: 4,
//                 description: `Bullish breakout above ${signalContext.resistanceLevel.toFixed(2)}`
//             });
//             signalContext.resistanceLevel = null; // Reset resistance after breakout
//             signalContext.resistanceTouches = 0;
//         }
        
//         // Breakdown below support
//         if (close < signalContext.supportLevel && volume > 5000 && Math.random() < 0.3) {
//             signals.push({
//                 type: 'breakout_bearish',
//                 value: signalContext.supportLevel,
//                 strength: 4,
//                 description: `Bearish breakdown below ${signalContext.supportLevel.toFixed(2)}`
//             });
//             signalContext.supportLevel = null; // Reset support after breakdown
//             signalContext.supportTouches = 0;
//         }
//     }
    
//     // Reversal signals based on price action
//     if (index > 5) {
//         const bodySize = Math.abs(close - open);
//         const totalRange = high - low;
//         const upperShadow = high - Math.max(open, close);
//         const lowerShadow = Math.min(open, close) - low;
        
//         // Hammer/Doji patterns for reversals
//         if (bodySize < totalRange * 0.3 && Math.random() < 0.2) {
//             if (lowerShadow > bodySize * 2 && close < lastClose * 0.98) {
//                 signals.push({
//                     type: 'reversal_bullish',
//                     value: low,
//                     strength: 3,
//                     description: `Potential bullish reversal pattern`
//                 });
//             } else if (upperShadow > bodySize * 2 && close > lastClose * 1.02) {
//                 signals.push({
//                     type: 'reversal_bearish',
//                     value: high,
//                     strength: 3,
//                     description: `Potential bearish reversal pattern`
//                 });
//             }
//         }
//     }
    
//     // Volume spike signals
//     const avgVolume = data.slice(-10).reduce((sum, candle) => sum + (candle.volume || 0), 0) / Math.min(10, data.length);
//     if (volume > avgVolume * 2 && Math.random() < 0.3) {
//         signals.push({
//             type: 'volume_spike',
//             value: close,
//             strength: Math.min(Math.floor(volume / avgVolume), 5),
//             description: `High volume activity`
//         });
//     }
    
//     return signals;
// }