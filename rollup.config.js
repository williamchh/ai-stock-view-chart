import { nodeResolve } from '@rollup/plugin-node-resolve';

const indicators = [
  'bollingband',
  'demarket',
  'demo',
  'ema',
  'macd',
  'sma'
];

const configs = [
  // Main chart configuration
  {
    input: 'src/stock-chart.js',
    output: [
      {
        file: 'dist/stock-chart.js',
        format: 'es',
        sourcemap: true
      },
      {
        file: 'dist/stock-chart.min.js',
        format: 'es',
        sourcemap: true,
        compact: true
      }
    ],
    plugins: [nodeResolve()]
  }
];

// Add configurations for each indicator
indicators.forEach(indicator => {
  configs.push({
    input: `src/indicators/${indicator}.js`,
    output: [
      {
        file: `dist/indicators/${indicator}.js`,
        format: 'es',
        sourcemap: true
      },
      {
        file: `dist/indicators/${indicator}.min.js`,
        format: 'es',
        sourcemap: true,
        compact: true
      }
    ],
    plugins: [nodeResolve()]
  });
});

export default configs;
