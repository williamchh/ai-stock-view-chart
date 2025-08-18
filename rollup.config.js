import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

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
      },
      // UMD build
      {
        file: 'dist/stock-chart.umd.js',
        format: 'umd',
        name: 'StockChart',
        sourcemap: true
      },
      {
        file: 'dist/stock-chart.umd.min.js',
        format: 'umd',
        name: 'StockChart',
        sourcemap: true,
        compact: true
}
    ],
    plugins: [
      nodeResolve(),
      terser({
        compress: {
          drop_console: true,
          passes: 2
        },
        mangle: {
          properties: {
            regex: /^_/  // Only mangle properties that start with underscore
          }
        },
        format: {
          comments: false
        }
      }),
      copy({
        targets: [
          { src: 'src/stock-chart.d.ts', dest: 'dist' },
          { src: 'src/indicators/*.d.ts', dest: 'dist/indicators' }
        ]
      })
    ]
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
      },
      {
        file: `dist/indicators/${indicator}.umd.js`,
        format: 'umd',
        name: indicator.charAt(0).toUpperCase() + indicator.slice(1),
        sourcemap: true
      },
      {
        file: `dist/indicators/${indicator}.umd.min.js`,
        format: 'umd',
        name:  indicator.charAt(0).toUpperCase() + indicator.slice(1),
        sourcemap: true,
        compact: true
      }
    ],
    plugins: [
      nodeResolve(),
      terser({
        compress: {
          drop_console: true,
          passes: 2
        },
        mangle: {
          properties: {
            regex: /^_/  // Only mangle properties that start with underscore
          }
        },
        format: {
          comments: false
        }
      })
    ]
  });
});

export default configs;
