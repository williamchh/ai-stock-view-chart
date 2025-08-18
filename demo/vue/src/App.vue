<template>
  <div id="app">
    <h1>AI Stock View Chart Vue Demo</h1>
    <div id="chartContainer" class="chart-container"></div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { generateCandlestickData } from '../../../dist/indicators/demo.js'

export default {
  name: 'App',
  setup() {
    const chartContainer = ref(null)
    import ('../../../dist/indicators/demo.js')

    onMounted(() => {
      // Import the stock chart library
      import('../../../dist/stock-chart.js').then((module) => {
        const StockChart = module.default
        
        // Sample data
        const data = generateCandlestickData(500)

        StockChart.init('chartContainer', {
          theme: 'dark',
          chartName: {
            name: 'Test Vue AI Stock View chart',
            code: 'vue'
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
          
        })
      })
    })

    return {
      chartContainer
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

.chart-container {
  width: 100%;
  height: 600px;
  margin: 20px auto;
  max-width: 1200px;
}
</style>