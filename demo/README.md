# Stock Chart Library Demos

This directory contains demo applications for the AI Stock View Chart library in both Vue and React frameworks.

## Prerequisites

Make sure you have built the main library first:

```bash
# From the root directory
npm install
npm run build
```

## Vue Demo

To run the Vue demo:

```bash
cd vue
npm install
npm run dev
```

The Vue demo will be available at http://localhost:3000

## React Demo

To run the React demo:

```bash
cd react
npm install
npm run dev
```

The React demo will be available at http://localhost:3001

## Features Demonstrated

Both demos showcase:
- Basic stock chart rendering
- Multiple technical indicators (SMA, EMA, MACD, Bollinger Bands)
- Sample stock data with OHLC values
- Responsive chart container
- Light theme

## Project Structure

```
demo/
├── vue/           # Vue 3 demo application
├── react/         # React 18 demo application
└── README.md      # This file
```

## Troubleshooting

If you encounter issues:

1. Make sure the main library is built (`dist/stock-chart.js` should exist)
2. Ensure all dependencies are installed in each demo directory
3. Check browser console for any error messages
4. Verify the ports 3000 (Vue) and 3001 (React) are available