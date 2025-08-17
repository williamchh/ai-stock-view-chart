
/**
 * @typedef {Object} SMAState
 * @property {number} period - The SMA period length
 * @property {number[]} window - Rolling window of prices for calculation
 * @property {number} sum - Current sum of values in the window
 */

/**
 * @typedef {Object} EMAState
 * @property {number} period - The EMA period length
 * @property {number} count - Number of values processed so far
 * @property {number} initialSum - Sum of initial values (for SMA phase)
 * @property {number|null} ema - Current EMA value (null during warmup)
 * @property {number|null} lastValue - Last value added to EMA (for same period updates)
 */

/**
 * @typedef {Object} MACDState
 * @property {EMAState} fast - Fast EMA state
 * @property {EMAState} slow - Slow EMA state
 * @property {EMAState} signal - Signal line EMA state
 */

/**
 * @typedef {Object} BollingerState
 * @property {number} period - The BB period length
 * @property {number} multiplier - Standard deviation multiplier
 * @property {number[]} window - Rolling window of prices
 * @property {number} sum - Sum of values in window
 * @property {number} sumSquares - Sum of squared values in window
 */

/**
 * @typedef {Object} DeMarkerState
 * @property {number} period - The DeMarker period length
 * @property {number|null} prevHigh - Previous period's high price
 * @property {number|null} prevLow - Previous period's low price
 * @property {SMAState} demaxSMA - SMA state for DeMax calculations
 * @property {SMAState} deminSMA - SMA state for DeMin calculations
 */

// SMA (Simple Moving Average)
/**
 * Initializes state for Simple Moving Average calculation
 * @param {number} period - Number of periods for SMA
 * @returns {SMAState} Initial SMA state
 */
function initSMAState(period) {
    return { 
        period, 
        window: [], 
        sum: 0 
    };
}

/**
 * Updates SMA calculation with new value
 * @param {number} value - New value to add to SMA
 * @param {SMAState} state - Current SMA state containing window
 * @returns {{value: number|null, state: SMAState}} Result with SMA value and new state
 * @property {number|null} value - SMA value (null during warmup period)
 * @property {SMAState} state - Updated state with new window
 */
function updateSMA(value, state, isSamePeriod = false) {
    let newWindow = [...state.window];
    let newSum = state.sum;

    if (isSamePeriod && newWindow.length > 0) {
        // Replace the last value
        const lastValue = newWindow[newWindow.length - 1];
        newWindow[newWindow.length - 1] = value;
        newSum = newSum - lastValue + value;
    } else {
        // Add a new value
        newWindow.push(value);
        newSum += value;
        if (newWindow.length > state.period) {
            const removed = newWindow.shift();
            newSum -= removed;
        }
    }

    return {
        value: newWindow.length === state.period ? newSum / state.period : null,
        state: {
            period: state.period,
            window: newWindow,
            sum: newSum
        }
    };
}

/**
 * Serializes SMA state for caching
 * @param {SMAState} state - Current SMA state
 * @returns {string} Serialized state as JSON string
 */
function serializeSMAState(state) {
    return JSON.stringify(state);
}

/**
 * Deserializes SMA state from cached string
 * @param {string} serializedState - Serialized SMA state
 * @returns {SMAState} Deserialized SMA state object
 */
function deserializeSMAState(serializedState) {
    return JSON.parse(serializedState);
}

// EMA (Exponential Moving Average)
/**
 * Initializes state for Exponential Moving Average calculation
 * @param {number} period - Number of periods for EMA
 * @returns {EMAState} Initial EMA state
 */
function initEMAState(period) {
    return { period, count: 0, initialSum: 0, ema: null, lastValue: null };
}

/**
 * Updates EMA calculation with new value
 * @param {number} value - New value to add to EMA
 * @param {EMAState} state - Current EMA state
 * @returns {{value: number|null, state: EMAState}} Result with EMA value and new state
 * @property {number|null} value - EMA value (null during warmup period)
 * @property {EMAState} state - Updated state with new EMA value
 */
function updateEMA(value, state, isSamePeriod = false) {
    const newState = { ...state };

    if (isSamePeriod && newState.ema !== null && newState.lastValue !== null) {
        // For same period updates, recalculate using the previous EMA without the last value
        const smoothingFactor = 2 / (newState.period + 1);
        const prevEMA = (newState.ema - newState.lastValue * smoothingFactor) / (1 - smoothingFactor);
        newState.ema = value * smoothingFactor + prevEMA * (1 - smoothingFactor);
        newState.lastValue = value;
    } else if (!isSamePeriod) {
        if (newState.count < newState.period) {
            newState.initialSum += value;
            newState.count++;
            if (newState.count === newState.period) {
                newState.ema = newState.initialSum / newState.period;
            }
        } else {
            const smoothingFactor = 2 / (newState.period + 1);
            newState.ema = value * smoothingFactor + newState.ema * (1 - smoothingFactor);
        }
        newState.lastValue = value;
    }
    
    return { value: newState.ema, state: newState };
}

/**
 * Serializes EMA state for caching
 * @param {EMAState} state - Current EMA state
 * @returns {string} Serialized state as JSON string
 */
function serializeEMAState(state) {
    return JSON.stringify(state);
}

/**
 * Deserializes EMA state from cached string
 * @param {string} serializedState - Serialized EMA state
 * @returns {EMAState} Deserialized EMA state object
 */
function deserializeEMAState(serializedState) {
    return JSON.parse(serializedState);
}

// MACD (Moving Average Convergence Divergence)
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

// Bollinger Bands
/**
 * Initializes state for Bollinger Bands calculation
 * @param {number} period - Number of periods for BB
 * @param {number} multiplier - Standard deviation multiplier for bands
 * @returns {BollingerState} Initial Bollinger Bands state
 */
function initBollingerState(period = 20, multiplier = 2) {
    return { period, multiplier, window: [], sum: 0, sumSquares: 0 };
}

/**
 * Calculates Bollinger Bands
 * @param {number} price - New price value to add
 * @param {BollingerState} state - Current BB state
 * @param {boolean} isSamePeriod - Whether this is an update to the same period
 * @param {boolean} useSampleStdDev - Whether to use sample standard deviation (N-1) instead of population (N)
 * @returns {{middle: number|null, upper: number|null, lower: number|null, state: BollingerState}}
 */
function updateBollinger(price, state, isSamePeriod = false, useSampleStdDev = false) {
    let newWindow = [...state.window];
    let newSum = state.sum;
    let newSumSquares = state.sumSquares;

    if (isSamePeriod && newWindow.length > 0) {
        const lastValue = newWindow[newWindow.length - 1];
        newWindow[newWindow.length - 1] = price;
        newSum = newSum - lastValue + price;
        newSumSquares = newSumSquares - (lastValue * lastValue) + (price * price);
    } else {
        newWindow.push(price);
        newSum += price;
        newSumSquares += price * price;
        if (newWindow.length > state.period) {
            const removed = newWindow.shift();
            newSum -= removed;
            newSumSquares -= removed * removed;
        }
    }

    let middle = null, upper = null, lower = null;
    if (newWindow.length === state.period) {
        middle = newSum / state.period;
        
        // Choose between population (N) or sample (N-1) standard deviation
        const denominator = useSampleStdDev ? state.period - 1 : state.period;
        const variance = (newSumSquares / denominator) - (middle * middle * state.period / denominator);
        const stdDev = Math.sqrt(Math.max(0, variance));
        
        upper = middle + state.multiplier * stdDev;
        lower = middle - state.multiplier * stdDev;
    }

    return {
        middle,
        upper,
        lower,
        state: { 
            period: state.period, 
            multiplier: state.multiplier, 
            window: newWindow, 
            sum: newSum, 
            sumSquares: newSumSquares 
        }
    };
}

/**
 * Serializes Bollinger Bands state for caching
 * @param {BollingerState} state - Current Bollinger Bands state
 * @returns {string} Serialized state as JSON string
 */
function serializeBollingerState(state) {
    return JSON.stringify(state);
}

/**
 * Deserializes Bollinger Bands state from cached string
 * @param {string} serializedState - Serialized Bollinger Bands state
 * @returns {BollingerState} Deserialized Bollinger Bands state object
 */
function deserializeBollingerState(serializedState) {
    return JSON.parse(serializedState);
}

// DeMarker Indicator
/**
 * Initializes state for DeMarker calculation
 * @param {number} period - Number of periods for DeMarker
 * @returns {DeMarkerState} Initial DeMarker state
 */
function initDeMarkerState(period = 14) {
    return {
        period,
        prevHigh: null,
        prevLow: null,
        demaxSMA: initSMAState(period),
        deminSMA: initSMAState(period)
    };
}

/**
 * Updates DeMarker calculation with new high and low prices
 * @param {number} high - New high price
 * @param {number} low - New low price
 * @param {DeMarkerState} state - Current DeMarker state
 * @returns {{demarker: number|null, state: DeMarkerState}} Result with DeMarker value and new state
 * @property {number|null} demarker - DeMarker value (null during warmup)
 * @property {DeMarkerState} state - Updated DeMarker state with new prevHigh, prevLow, and SMA states
 */
function updateDeMarker(high, low, state, isSamePeriod = false) {
    let demax = 0, demin = 0;
    
    // Calculate DeMax and DeMin values
    if (state.prevHigh !== null && state.prevLow !== null && !isSamePeriod) {
        demax = Math.max(0, high - state.prevHigh);
        demin = Math.max(0, state.prevLow - low);
    } else if (state.prevHigh !== null && state.prevLow !== null && isSamePeriod) {
        // For same period, recalculate with new values but keep previous period reference
        demax = Math.max(0, high - state.prevHigh);
        demin = Math.max(0, state.prevLow - low);
    }

    // Update SMA calculations only if we have calculated demax/demin
    let demaxSMA = { value: null, state: state.demaxSMA };
    let deminSMA = { value: null, state: state.deminSMA };
    
    if (state.prevHigh !== null && state.prevLow !== null) {
        demaxSMA = updateSMA(demax, state.demaxSMA, isSamePeriod);
        deminSMA = updateSMA(demin, state.deminSMA, isSamePeriod);
    }

    // Calculate DeMarker value
    let demarker = null;
    if (demaxSMA.value !== null && deminSMA.value !== null) {
        const sum = demaxSMA.value + deminSMA.value;
        demarker = sum !== 0 ? demaxSMA.value / sum : 0.5; // Default to 0.5 when sum is 0
    }

    // Update state
    const newState = {
        period: state.period,
        prevHigh: isSamePeriod ? state.prevHigh : high,
        prevLow: isSamePeriod ? state.prevLow : low,
        demaxSMA: demaxSMA.state,
        deminSMA: deminSMA.state
    };

    return {
        demarker,
        state: newState
    };
}

/**
 * Serializes DeMarker state for caching
 * @param {DeMarkerState} state - Current DeMarker state
 * @returns {string} Serialized state as JSON string
 */
function serializeDeMarkerState(state) {
    return JSON.stringify({
        period: state.period,
        prevHigh: state.prevHigh,
        prevLow: state.prevLow,
        demaxSMA: serializeSMAState(state.demaxSMA),
        deminSMA: serializeSMAState(state.deminSMA)
    });
}

/**
 * Deserializes DeMarker state from cached string
 * @param {string} serializedState - Serialized DeMarker state
 * @returns {DeMarkerState} Deserialized DeMarker state object
 */
function deserializeDeMarkerState(serializedState) {
    const parsed = JSON.parse(serializedState);
    return {
        period: parsed.period,
        prevHigh: parsed.prevHigh,
        prevLow: parsed.prevLow,
        demaxSMA: deserializeSMAState(parsed.demaxSMA),
        deminSMA: deserializeSMAState(parsed.deminSMA)
    };
}


export {
    initSMAState,
    updateSMA,
    serializeSMAState,
    deserializeSMAState,
    initEMAState,
    updateEMA,
    serializeEMAState,
    deserializeEMAState,
    initMACDState,
    updateMACD,
    serializeMACDState,
    deserializeMACDState,
    initBollingerState,
    updateBollinger,
    serializeBollingerState,
    deserializeBollingerState,
    initDeMarkerState,
    updateDeMarker,
    serializeDeMarkerState,
    deserializeDeMarkerState,
};