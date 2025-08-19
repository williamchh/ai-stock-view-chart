// RSI (Relative Strength Index)
/**
 * @typedef {Object} RSIState
 * @property {number} period - The RSI period length
 * @property {number[]} gains - Rolling window of gains
 * @property {number[]} losses - Rolling window of losses
 * @property {number} avgGain - Average gain
 * @property {number} avgLoss - Average loss
 * @property {number|null} lastPrice - Last price seen
 */

/**
 * Initializes state for Relative Strength Index calculation
 * @param {number} period - Number of periods for RSI
 * @returns {RSIState} Initial RSI state
 */
function initRSIState(period = 14) {
    return { period, gains: [], losses: [], avgGain: 0, avgLoss: 0, lastPrice: null };
}

/**
 * Updates RSI calculation with new price
 * @param {number} price - New price to add to RSI
 * @param {RSIState} state - Current RSI state
 * @returns {{value: number|null, state: RSIState}} Result with RSI value and new state
 */
function updateRSI(price, state, isSamePeriod = false) {
    const newState = { ...state };

    if (newState.lastPrice === null) {
        newState.lastPrice = price;
        return { value: null, state: newState };
    }

    const change = price - newState.lastPrice;
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);

    if (!isSamePeriod) {
        newState.gains.push(gain);
        newState.losses.push(loss);

        if (newState.gains.length > newState.period) {
            newState.gains.shift();
            newState.losses.shift();
        }
    } else {
        if (newState.gains.length > 0) {
            newState.gains[newState.gains.length - 1] = gain;
            newState.losses[newState.losses.length - 1] = loss;
        }
    }
    
    newState.lastPrice = price;

    if (newState.gains.length === newState.period) {
        if (newState.avgGain === 0) { // First calculation
            newState.avgGain = newState.gains.reduce((a, b) => a + b, 0) / newState.period;
            newState.avgLoss = newState.losses.reduce((a, b) => a + b, 0) / newState.period;
        } else { // Wilder's Smoothing
            newState.avgGain = (newState.avgGain * (newState.period - 1) + gain) / newState.period;
            newState.avgLoss = (newState.avgLoss * (newState.period - 1) + loss) / newState.period;
        }

        if (newState.avgLoss === 0) {
            return { value: 100, state: newState };
        }

        const rs = newState.avgGain / newState.avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        return { value: rsi, state: newState };
    }

    return { value: null, state: newState };
}

/**
 * Serializes RSI state for caching
 * @param {RSIState} state - Current RSI state
 * @returns {string} Serialized state as JSON string
 */
function serializeRSIState(state) {
    return JSON.stringify(state);
}

/**
 * Deserializes RSI state from cached string
 * @param {string} serializedState - Serialized RSI state
 * @returns {RSIState} Deserialized RSI state object
 */
function deserializeRSIState(serializedState) {
    return JSON.parse(serializedState);
}

export {
    initRSIState,
    updateRSI,
    serializeRSIState,
    deserializeRSIState,
}