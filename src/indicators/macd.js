// MACD (Moving Average Convergence Divergence)
    /**
 * @typedef {Object} MACDState
 * @property {import("./ema").EMAState} fast - Fast EMA state
 * @property {import("./ema").EMAState} slow - Slow EMA state
 * @property {import("./ema").EMAState} signal - Signal line EMA state
 */

import { initEMAState, updateEMA } from "./ema.js";

/**
 * Initializes state for MACD calculation
 * @param {number} fastPeriod - Fast EMA period
 * @param {number} slowPeriod - Slow EMA period
 * @param {number} signalPeriod - Signal line EMA period
 * @returns {MACDState} Initial MACD state
 */
function initMACDState(fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    return {
        fast: initEMAState(fastPeriod),
        slow: initEMAState(slowPeriod),
        signal: initEMAState(signalPeriod)
    };
}

/**
 * Updates MACD calculation with new closing price
 * @param {number} close - New closing price
 * @param {MACDState} state - Current MACD state
 * @returns {{macdLine: number|null, signalLine: number|null, histogram: number|null, state: MACDState}} Result with MACD values and new state
 * @property {number|null} macdLine - MACD line value (null during warmup)
 * @property {number|null} signalLine - Signal line value (null during warmup)
 * @property {number|null} histogram - Histogram value (null during warmup)
 * @property {MACDState} state - Updated MACD state with new EMA states
 */
function updateMACD(close, state, isSamePeriod = false) {
    const fastEMA = updateEMA(close, state.fast, isSamePeriod);
    const slowEMA = updateEMA(close, state.slow, isSamePeriod);
    const macdLine = (fastEMA.value !== null && slowEMA.value !== null) 
        ? fastEMA.value - slowEMA.value 
        : null;

    let signalEMA = { value: null, state: state.signal };
    if (macdLine !== null) {
        signalEMA = updateEMA(macdLine, state.signal, isSamePeriod);
    }

    const histogram = (macdLine !== null && signalEMA.value !== null) 
        ? macdLine - signalEMA.value 
        : null;

    return {
        macdLine,
        signalLine: signalEMA.value,
        histogram,
        state: {
            fast: fastEMA.state,
            slow: slowEMA.state,
            signal: signalEMA.state
        }
    };
}

/**
 * Serializes MACD state for caching
 * @param {MACDState} state - Current MACD state
 * @returns {string} Serialized state as JSON string
 */
function serializeMACDState(state) {
    return JSON.stringify(state);
}

/**
 * Deserializes MACD state from cached string
 * @param {string} serializedState - Serialized MACD state
 * @returns {MACDState} Deserialized MACD state object
 */
function deserializeMACDState(serializedState) {
    return JSON.parse(serializedState);
}

export {
    initMACDState,
    updateMACD,
    serializeMACDState,
    deserializeMACDState
}