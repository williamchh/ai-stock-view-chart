/**
 * Maps StockBase interface data to StockData interface
 * @param {import('./asv-model.d.ts').Stockbase} stockBase - The source StockBase object
 * @returns {import('../src/stock-chart.d.ts').StockData} - The mapped StockData object
 */
export function mapStockBaseToStockData(stockBase) {
    let signal = null;

    if (stockBase.isBuy === 0) {
        signal = {
            type: 'resistance',
            value: stockBase.trigger,
            description: 'Sell Signal',
            strength: 1
        };
    }
    else if (stockBase.isBuy === 1) {
        signal = {
            type: 'support',
            value: stockBase.trigger,
            description: 'Buy Signal',
            strength: 1
        };
    }
    else if (stockBase.isBuy === 2) {
        signal = {
            type: 'weak-resistance',
            value: stockBase.trigger,
            description: 'Downtrend Signal',
            strength: 1
        };
    }
    else if (stockBase.isBuy === 3) {
        signal = {
            type: 'weak-support',
            value: stockBase.trigger,
            description: 'Uptrend Signal',
            strength: 1
        };
    }
    else if (stockBase.isBuy === 5) {
        signal = {
            type: 'hold',
            value: stockBase.trigger,
            description: 'Hold Signal',
            strength: 1
        };
    }

    return {
        time: stockBase.date.getTime(),
        open: stockBase.open,
        high: stockBase.high,
        low: stockBase.low,
        close: stockBase.close,
        id: stockBase.id,
        signals: signal ? signal : undefined
    };
}

/**
 * Maps an array of StockBase objects to an array of StockData objects
 * @param {Array<import('./asv-model.d.ts').Stockbase>} stockBases - Array of StockBase objects
 * @returns {Array<import('../src/stock-chart.d.ts').StockData>} - Array of mapped StockData objects
 */
export function mapStockBasesToStockData(stockBases) {
    return stockBases.map(mapStockBaseToStockData);
}