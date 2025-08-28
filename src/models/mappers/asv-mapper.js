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
            strength: 1,
            referTf: stockBase.referTf
        };
    }
    else if (stockBase.isBuy === 1) {
        signal = {
            type: 'support',
            value: stockBase.trigger,
            description: 'Buy Signal',
            strength: 1,
            referTf: stockBase.referTf
        };
    }
    else if (stockBase.isBuy === 2) {
        signal = {
            type: 'weak-resistance',
            value: stockBase.trigger,
            description: 'Downtrend Signal',
            strength: 1,
            referTf: stockBase.referTf
        };
    }
    else if (stockBase.isBuy === 3) {
        signal = {
            type: 'weak-support',
            value: stockBase.trigger,
            description: 'Uptrend Signal',
            strength: 1,
            referTf: stockBase.referTf
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
        time: stockBase.date.getTime() / 1000,
        open: stockBase.open,
        high: stockBase.high,
        low: stockBase.low,
        close: stockBase.close,
        id: stockBase.id,
        signals: signal ? signal : undefined,
        referenceLines: [{
            id: stockBase.id,
            time: stockBase.date.getTime() / 1000,
            type: 'reference',
            value: null
        }],
        safeMargins: [
            {
                id: stockBase.id,
                time: stockBase.date.getTime() / 1000,
                type: 'safe-margin',
                value: null
            }
        ]

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

    for (const retracement of elegibleRetracements) {
        const { fiboSequence } = retracement;
        let fs = fiboSequence[0];

        let _start = retracement.escapePrice;
        let total = retracement.target3 - retracement.escapePrice;
        let times = 1;
        if (retracement.direction == 2) { // down
            total = retracement.escapePrice - retracement.target3;
            times = -1;
        }

        for (const s of fiboSequence) {
            const hasNextSequence = fiboSequence.indexOf(s) < fiboSequence.length - 1;
            if (!hasNextSequence) break;
            const next = fiboSequence[fiboSequence.indexOf(s) + 1];
            _start = retracement.escapePrice + total * s.ratio * times;
            const bases = stockDatas.filter(d => d.time  >= new Date(s.date).valueOf() / 1000 && 
                d.time <= new Date(next.date).valueOf() / 1000);

            if (bases.length === 0) continue;

            const target = retracement.escapePrice + total * next.ratio * times;
            const diff = target - _start;
            const stepValue = diff / (bases.length - 1);

            bases.forEach((b, i) => {

                b.fiboZoneLines ??= [];
                b.fiboZoneLines.push({
                    id: s.targetID,
                    time: b.time,
                    value: _start + stepValue * i,
                });

                if (retracement.referenceLines && retracement.referenceLines.length > 0) {
                    b.referenceLines ??= [];
                    retracement.referenceLines.forEach(r => {
                        
                        b.referenceLines.push({
                            id: retracement.startID,
                            time: b.time,
                            type: 'reference',
                            value: r
                        });
                    })
                }

                if (retracement.safeMargins && retracement.safeMargins.length > 0) {
                    b.safeMargins ??= [];
                    retracement.safeMargins.forEach(f => {
                        b.safeMargins.push({
                            id: retracement.startID,
                            time: b.time,
                            type: 'safe-margin',
                            value: f
                        });
                    })
                }
            });

            // if (retracement.prediction?.next?.item1) {
            //     debugger;
            //     const nextRatio = retracement.prediction.next.item1;
            //     const stopRatio = retracement.prediction.stop.item1;

            //     const nextValue = retracement.escapePrice + total * nextRatio * times;
            //     const stopValue = retracement.escapePrice + total * stopRatio * times;
            // }
            
            fs = s;
        }

        
    }
    return stockDatas;
};