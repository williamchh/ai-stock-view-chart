
// DeMarker Indicator

/**
 * @typedef {Object} DeMarkerState
 * @property {number} period - The DeMarker period length
 * @property {number|null} prevHigh - Previous period's high price
 * @property {number|null} prevLow - Previous period's low price
 * @property {import("./sma.js").SMAState} demaxSMA - SMA state for DeMax calculations
 * @property {import("./sma.js").SMAState} deminSMA - SMA state for DeMin calculations
 */


import { deserializeSMAState, initSMAState, serializeSMAState, updateSMA } from "./sma.js";

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
    initDeMarkerState,
    updateDeMarker,
    serializeDeMarkerState,
    deserializeDeMarkerState,
}