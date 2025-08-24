/**
 * Maps StockBase interface data to StockData interface
 * @param {import('../asv-model.js').Stockbase} stockBase - The source StockBase object
 * @returns {import('../../stock-chart.js').StockData} - The mapped StockData object
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
 * @param {import('../asv-model.js').ASVResponse} response - ASVResponse object
 * @returns {Array<import('../../stock-chart.js').StockData>} - Array of mapped StockData objects
 */
export function mapStockBasesToStockData(response) {
    
    let stockDatas = response.stockbaseClients && response.stockbaseClients.length 
        ? response.stockbaseClients.map(mapStockBaseToStockData)
        : [];

    const retracements = Object.values(response.retraceSequenceDic).flat();
    stockDatas = getFiboZones(stockDatas, retracements);
    debugger
    return stockDatas;
}

/**
 *
 * @param {Array<import('../../stock-chart.js').StockData>} stockDatas
 * @param {Array<import('../asv-model.js').Retracement>} retracements
 * @returns {Array<import('../../stock-chart.js').StockData>}
 */
const getFiboZones = (stockDatas, retracements) => {

    const elegibleRetracements = retracements.filter(f => f.fiboSequence && f.fiboSequence.length > 1);
    // Implementation of getFiboZones function
    for (const retracement of elegibleRetracements) {
        const { fiboSequence } = retracement;
        let fs = fiboSequence[0];
        const wkFiboSequences = fiboSequence.slice(1);
        for (const s of wkFiboSequences) {
            const bases = stockDatas.filter(d => new Date(d.time).valueOf() >= new Date(fs.date).valueOf() && 
                new Date(d.time).valueOf() <= new Date(s.date).valueOf());
            
            if (bases.length === 0) continue;

            const fsTarget = fs.target;
            const sTarget = s.target;
            const max = Math.max(fsTarget, sTarget);
            const min = Math.min(fsTarget, sTarget);
            const diff = max - min;
            let stepValue = diff / bases.length;

            if (s.target < fs.target) {
                stepValue *= -1;
            }

            bases.forEach((b, i) => {
                b.fiboZoneLine = {
                    id: fs.targetID,
                    time: b.time,
                    value: min + stepValue * (i + 1)
                }
            });

            fs = s;
        }

        
    }
    return stockDatas;
};