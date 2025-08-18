import React, { useEffect, useRef } from 'react';
import { generateCandlestickData } from '../../../src/indicators/demo.js';

function App() {
  const chartContainerRef = useRef(null);

  useEffect(() => {
    const loadChart = async () => {
      try {
        // Generate sample data using the same function as Vue demo
        const data = generateCandlestickData(500);

        // Import the chart dynamically
        const { default: StockChart } = await import('../../../src/stock-chart.js');
        
        // Initialize chart using the ref's DOM element
        if (chartContainerRef.current) {
          StockChart.init('chart-container', {
            theme: 'light',
            chartName: {
              name: 'Test React AI Stock View chart',
              code: 'ASV chart'
            },
            initialVisibleCandles: 100,
            plots: [
              {
                id: 'main',
                type: 'candlestick',
                data: data,
                heightRatio: 1
              }
            ]
          });
        }
      } catch (error) {
        console.error('Error loading stock chart:', error);
      }
    }

    loadChart();
  }, []);

  return (
    <div className="App">
      <h1>Stock Chart React Demo</h1>
      <div ref={chartContainerRef} id="chart-container" className="chart-container"></div>
    </div>
  );
}

export default App;