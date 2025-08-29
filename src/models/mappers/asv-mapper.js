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

        let minPrediction = null, maxPrediction = null;
        if (retracement.prediction.next != null && retracement.prediction?.stop != null) {
            minPrediction = Math.min(retracement.prediction.next.item1, retracement.prediction.stop.item1);
            maxPrediction = Math.max(retracement.prediction.next.item1, retracement.prediction.stop.item1);
            
            // find last sequence is pointing to up or down, which needs to compare one before
            const last = fiboSequence[fiboSequence.length - 1];
            const fiboNums = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];
            const nextDistanceIndex = fiboNums.indexOf(last.distance) + 1;
            const nextDistance = nextDistanceIndex < fiboNums.length ? fiboNums[nextDistanceIndex] : null;
            if (fiboSequence.length > 1) {
                const beforeLast = fiboSequence[fiboSequence.length - 2];
                if (last.ratio > beforeLast.ratio) {
                    // up
                    fiboSequence.push({
                        date: null,
                        distance: nextDistance == null ? last.distance : nextDistance,
                        priceFrom: last.priceFrom,
                        priceTo: last.priceTo,
                        ratio: minPrediction == last.ratio ? beforeLast.ratio : minPrediction,
                        target: last.target,
                        targetID: last.targetID
                    });
                    fiboSequence.push({
                        date: null,
                        distance: nextDistance == null ? last.distance : nextDistance,
                        priceFrom: last.priceFrom,
                        priceTo: last.priceTo,
                        ratio: maxPrediction,
                        target: last.target,
                        targetID: last.targetID
                    });
                } else {
                    // down
                    fiboSequence.push({
                        date: null,
                        distance: nextDistance == null ? last.distance : nextDistance,
                        priceFrom: last.priceFrom,
                        priceTo: last.priceTo,
                        ratio: maxPrediction == last.ratio ? beforeLast.ratio : maxPrediction,
                        target: last.target,
                        targetID: last.targetID
                    });
                    fiboSequence.push({
                        date: null,
                        distance: nextDistance == null ? last.distance : nextDistance,
                        priceFrom: last.priceFrom,
                        priceTo: last.priceTo,
                        ratio: minPrediction,
                        target: last.target,
                        targetID: last.targetID
                    });
                }
            }
            else {
                if (times < 0) {
                    fiboSequence.push({
                        date: null,
                        distance: nextDistance == null ? last.distance : nextDistance,
                        priceFrom: last.priceFrom,
                        priceTo: last.priceTo,
                        ratio: minPrediction == last.ratio ? minPrediction - 0.145 : minPrediction,
                        target: last.target,
                        targetID: last.targetID
                    });
                    fiboSequence.push({
                        date: null,
                        distance: nextDistance == null ? last.distance : nextDistance,
                        priceFrom: last.priceFrom,
                        priceTo: last.priceTo,
                        ratio: maxPrediction == last.ratio ? maxPrediction + 0.145 : maxPrediction,
                        target: last.target,
                        targetID: last.targetID
                    });
                }
                else {
                    fiboSequence.push({
                        date: null,
                        distance: nextDistance == null ? last.distance : nextDistance,
                        priceFrom: last.priceFrom,
                        priceTo: last.priceTo,
                        ratio: maxPrediction,
                        target: last.target,
                        targetID: last.targetID
                    });
                    fiboSequence.push({
                        date: null,
                        distance: nextDistance == null ? last.distance : nextDistance,
                        priceFrom: last.priceFrom,
                        priceTo: last.priceTo,
                        ratio: minPrediction,
                        target: last.target,
                        targetID: last.targetID
                    });
                }
            }
        }

        let lastFiboDate = null;
        let last = { targetID: null }; // Initialize last with a default value
        for (const s of fiboSequence) {
            const hasNextSequence = fiboSequence.indexOf(s) < fiboSequence.length - 1;
            if (!hasNextSequence) break;
            const next = fiboSequence[fiboSequence.indexOf(s) + 1];

            if (s.date == null) {
                const predictionFiboSequences = fiboSequence.filter(f => f.date == null);
                if (predictionFiboSequences.length < 2) break;
                const previousDate = new Date(lastFiboDate * 1000);
                const bases = stockDatas.filter(d => d.time * 1000 >= previousDate.valueOf());
                if (bases.length === 0) break;

                const ratio1 = predictionFiboSequences[0].ratio;
                const ratio2 = predictionFiboSequences[1].ratio;

                if (bases.length > 4) {
                    const midIndex = Math.floor(bases.length / 2);
                    const firstHalf = bases.slice(0, midIndex);
                    const secondHalf = bases.slice(midIndex - 1); // include midIndex in second half

                    const targetFirstHalf = retracement.escapePrice + total * ratio1 * times;
                    const targetSecondHalf = retracement.escapePrice + total * ratio2 * times;

                    const stepValueFirstHalf = (targetFirstHalf - _start) / (firstHalf.length - 1);
                    const stepValueSecondHalf = (targetSecondHalf - targetFirstHalf) / (secondHalf.length - 1);
                
                    firstHalf.forEach((b, i) => {
                        b.fiboZoneLines ??= [];
                        b.fiboZoneLines.push({
                            time: b.time,
                            value: _start + stepValueFirstHalf * i,
                            id: Number(firstHalf[0].id),
                            isPrediction: true
                        });
                    });
                
                    secondHalf.forEach((b, i) => {
                        b.fiboZoneLines ??= [];
                        b.fiboZoneLines.push({
                            time: b.time,
                            value: targetFirstHalf + stepValueSecondHalf * i,
                            id: Number(secondHalf[0].id),
                            isPrediction: true
                        });
                    });
                } else {
                    const target = retracement.escapePrice + total * next.ratio * times;
                    const diff = target - _start;
                    const stepValue = diff / (bases.length - 1);
                
                    bases.forEach((b, i) => {
                        b.fiboZoneLines ??= [];
                        b.fiboZoneLines.push({
                            time: b.time,
                            value: _start + stepValue * i,
                            id: Number(bases[0].id),
                            isPrediction: true
                        });
                    });
                }
                
                break;
            }
            else {
                _start = retracement.escapePrice + total * s.ratio * times;

                const bases = stockDatas.filter(d => d.time  >= new Date(s.date).valueOf() / 1000 && 
                d.time <= new Date(next.date).valueOf() / 1000);
                
                if (bases.length === 0) continue;
                lastFiboDate = bases[bases.length - 1].time;
    
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
            }
            
            fs = s;
        }

        
    }
    return stockDatas;
};