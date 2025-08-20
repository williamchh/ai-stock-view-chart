/**
 * Extract signal data from candlestick data
 * @param {Array<import("../stock-chart.js").StockData>} data - Original candlestick data
 * @returns {Object} Object containing extracted signal plots
 */
export function extractSignals(data) {
    const supportData = [];
    const resistanceData = [];
    const uptrendData = [];
    const downtrendData = [];

    data.forEach(candle => {
        const time = candle.time;
        if (candle.signals) {
            candle.signals.forEach(signal => {
                const signalPoint = { time, value: signal.value };
                
                switch (signal.type) {
                    case 'support':
                        supportData.push(signalPoint);
                        resistanceData.push({time, value: null});
                        uptrendData.push({time, value: null});
                        downtrendData.push({time, value: null});
                        break;
                    case 'resistance':
                        resistanceData.push(signalPoint);
                        supportData.push({time, value: null});
                        uptrendData.push({time, value: null});
                        downtrendData.push({time, value: null});
                        break;
                    case 'uptrend':
                        uptrendData.push(signalPoint);
                        supportData.push({time, value: null});
                        resistanceData.push({time, value: null});
                        downtrendData.push({time, value: null});
                        break;
                    case 'downtrend':
                        downtrendData.push(signalPoint);
                        supportData.push({time, value: null});
                        resistanceData.push({time, value: null});
                        uptrendData.push({time, value: null});
                        break;
                }
            });
        }
        else {
            supportData.push({time, value: null});
            resistanceData.push({time, value: null});
            uptrendData.push({time, value: null});
            downtrendData.push({time, value: null});
        }
    });

    return {
        support: {
            id: 'signal-support',
            type: 'signal',
            data: supportData,
            style: {
                color: 'rgba(0, 255, 0, 0.15)',
                lineColor: 'rgba(0, 255, 0, 0.5)',
                blockHeight: 20
            },
            labelKey: 'Support',
            overlay: true,
            targetId: 'main'
        },
        resistance: {
            id: 'signal-resistance',
            type: 'signal',
            data: resistanceData,
            style: {
                color: 'rgba(255, 0, 0, 0.15)',
                lineColor: 'rgba(255, 0, 0, 0.5)',
                blockHeight: 20
            },
            labelKey: 'Resistance',
            overlay: true,
            targetId: 'main'
        },
        uptrend: {
            id: 'signal-uptrend',
            type: 'signal',
            data: uptrendData,
            style: {
                color: 'rgba(0, 255, 255, 0.15)',
                lineColor: 'rgba(0, 255, 255, 0.5)',
                blockHeight: 20
            },
            labelKey: 'Uptrend',
            overlay: true,
            targetId: 'main'
        },
        downtrend: {
            id: 'signal-downtrend',
            type: 'signal',
            data: downtrendData,
            style: {
                color: 'rgba(255, 165, 0, 0.15)',
                lineColor: 'rgba(255, 165, 0, 0.5)',
                blockHeight: 20
            },
            labelKey: 'Downtrend',
            overlay: true,
            targetId: 'main'
        }
    };
}