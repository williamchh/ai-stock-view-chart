
/**
 * @typedef {Object} SMAState
 * @property {number} period - The SMA period length
 * @property {number[]} window - Rolling window of prices for calculation
 * @property {number} sum - Current sum of values in the window
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





export {
    initSMAState,
    updateSMA,
    serializeSMAState,
    deserializeSMAState,



};