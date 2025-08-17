# AI Stock View Chart

An interactive stock charting library supporting candlestick and line charts, multiple plots, crosshair synchronization, overlays for price and technical indicators, and light/dark themes.

## Features

- 📈 Candlestick and line chart support
- 🖱️ Crosshair with cursor broadcasting across multiple charts
- 🔍 Zoom and pan interactions
- 🎨 Theming (light and dark)
- 📊 Overlay layer for price details and indicators
- 📐 Responsive layout with automatic resizing

## Installation

```bash
npm install ai-stock-view-chart
```

or using yarn:

```bash
yarn add ai-stock-view-chart
```

## Usage

Include the library and create a chart:

```html
<div id="chart-container" style="width:800px;height:400px;"></div>
<script type="module">
  import StockChart from 'ai-stock-view-chart';

  const data = [
    { date: '2025-01-01', open: 100, high: 110, low: 95, close: 105, volume: 5000 },
    { date: '2025-01-02', open: 105, high: 115, low: 100, close: 110, volume: 6000 },
    // more candlesticks...
  ];

  StockChart.init('chart-container', {
    theme: 'light',
    chartType: 'candlestick',
    data,
    initialVisibleCandles: 50
  });
</script>
```

## Development

Open the demo app to explore the features:

```bash
npm run demo
```

Or open [`demo/index.html`](demo/index.html) directly in a browser.

## API

### StockChart.init(elementId, options)

- `elementId`: The DOM element ID where the chart will be mounted.
- `options`:
  - `theme`: `"light"` or `"dark"`
  - `chartType`: `"candlestick"` or `"line"`
  - `data`: Array of OHLC+volume data
  - `initialVisibleCandles`: Number of candles to show initially
  - `plots`: Definitions of chart regions (e.g., price, volume)

## License

MIT © 2025 Will