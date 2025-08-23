/**
 * Maps StockBase interface data to StockData interface
 * @param {import('./asv-model.d.ts').Stockbase} stockBase - The source StockBase object
 * @returns {import('../src/stock-chart.d.ts').StockData} - The mapped StockData object
 */
export function mapStockBaseToStockData(stockBase) {
    const signals = [];

    // Add signals based on StockBase properties
    if (stockBase.isStrong) {
        signals.push({
            type: stockBase.isBuy === 1 ? 'support' : 'resistance',
            value: stockBase.close,
            description: stockBase.isBuy === 1 ? 'Strong Buy Signal' : 'Strong Sell Signal',
            strength: 1
        });
    }

    // Add MACD signals
    if (stockBase.isGoldMacd || stockBase.isRealGoldMacd) {
        signals.push({
            type: 'uptrend',
            value: stockBase.close,
            description: stockBase.isRealGoldMacd ? 'Real Gold MACD' : 'Gold MACD',
            strength: stockBase.isRealGoldMacd ? 1 : 0.8
        });
    }

    if (stockBase.isDownMacd || stockBase.isRealDownMacd) {
        signals.push({
            type: 'downtrend',
            value: stockBase.close,
            description: stockBase.isRealDownMacd ? 'Real Down MACD' : 'Down MACD',
            strength: stockBase.isRealDownMacd ? 1 : 0.8
        });
    }

    // Add SMA signals
    if (stockBase.isStrongUpSMA) {
        signals.push({
            type: 'uptrend',
            value: stockBase.close,
            description: 'Strong Uptrend SMA',
            strength: 0.9
        });
    }

    if (stockBase.isStrongDownSMA) {
        signals.push({
            type: 'downtrend',
            value: stockBase.close,
            description: 'Strong Downtrend SMA',
            strength: 0.9
        });
    }

    return {
        time: stockBase.date.getTime(),
        open: stockBase.open,
        high: stockBase.high,
        low: stockBase.low,
        close: stockBase.close,
        signals: signals.length > 0 ? signals : undefined
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