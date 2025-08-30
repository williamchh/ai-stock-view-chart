

// Bollinger Bands
/**
 * @typedef {Object} BollingerState
 * @property {number} period - The BB period length
 * @property {number} multiplier - Standard deviation multiplier
 * @property {number[]} window - Rolling window of prices
 * @property {number} sum - Sum of values in window
 * @property {number} sumSquares - Sum of squared values in window
 */


/**
 * Initializes state for Bollinger Bands calculation
 * @param {number} period - Number of periods for BB
 * @param {number} multiplier - Standard deviation multiplier for bands
 * @returns {BollingerState} Initial Bollinger Bands state
 */
export function initBollingerBandState(period = 20, multiplier = 2) {
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
export function updateBollingerBands(price, state, isSamePeriod = false, useSampleStdDev = false) {
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
export function serializeBollingerBandState(state) {
    return JSON.stringify(state);
}

/**
 * Deserializes Bollinger Bands state from cached string
 * @param {string} serializedState - Serialized Bollinger Bands state
 * @returns {BollingerState} Deserialized Bollinger Bands state object
 */
export function deserializeBollingerBandState(serializedState) {
    return JSON.parse(serializedState);
}
