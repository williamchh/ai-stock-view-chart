// EMA (Exponential Moving Average)
/**
 * @typedef {Object} EMAState
 * @property {number} period - The EMA period length
 * @property {number} count - Number of values processed so far
 * @property {number} initialSum - Sum of initial values (for SMA phase)
 * @property {number|null} ema - Current EMA value (null during warmup)
 * @property {number|null} lastValue - Last value added to EMA (for same period updates)
 */


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

export {
    initEMAState,
    updateEMA,
    serializeEMAState,
    deserializeEMAState,
}