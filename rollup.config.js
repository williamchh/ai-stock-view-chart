import { nodeResolve } from '@rollup/plugin-node-resolve';
import { default as terser } from '@rollup/plugin-terser';
import { default as copy } from 'rollup-plugin-copy';

const indicators = [
  'bollingband',
  'demarket',
  'demo',
  'ema',
  'macd',
  'sma'
];

const models = {
  'asv-model': 'src/models/mappers/asv-mapper.js'
};

const themes = [
  'dark',
  'light'
];

const utils = [
  'data',
  'drawing-item',
  'drawing-panel',
  'drawing',
  'helpers',
  'layout'
];

const terserOptions = {
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
};

const isBuildingUmd = process.env.BUILD === 'umd';

const configs = [
  // Main chart configuration
  {
    input: 'src/stock-chart.js',
    output: isBuildingUmd ? [
      // UMD build
      {
        file: 'dist/stock-chart.umd.min.js',
        format: 'umd',
        name: 'StockChart',
        sourcemap: true,
        compact: true
      }
    ] : [
      // NPM build
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
    plugins: [
      nodeResolve(),
      terser(terserOptions),
      copy({
        targets: [
          { src: 'src/stock-chart.d.ts', dest: 'dist' },
          { src: 'src/indicators/*.d.ts', dest: 'dist/indicators' },
          { src: 'src/models/**/*.d.ts', dest: 'dist/models' },
          { src: 'src/utils/*.d.ts', dest: 'dist/utils' },
          { src: 'src/themes/*.js', dest: 'dist/themes' }
        ]
      })
    ]
  }
];

// Add configurations for each indicator
indicators.forEach(indicator => {
  configs.push({
    input: `src/indicators/${indicator}.js`,
    output: isBuildingUmd ? [
      {
        file: `dist/indicators/${indicator}.umd.min.js`,
        format: 'umd',
        name: indicator.charAt(0).toUpperCase() + indicator.slice(1),
        sourcemap: true,
        compact: true
      }
    ] : [
      {
        file: `dist/indicators/${indicator}.min.js`,
        format: 'es',
        sourcemap: true,
        compact: true
      }
    ],
    plugins: [
      nodeResolve(),
      terser(terserOptions),
      copy({
        targets: [
          { src: `src/indicators/${indicator}.d.ts`, dest: `dist/indicators` }
        ]
      })
    ]
  });
});

// Add configurations for models
Object.entries(models).forEach(([name, input]) => {
  configs.push({
    input,
    output: isBuildingUmd ? [
      {
        file: `dist/models/${name}.umd.min.js`,
        format: 'umd',
        name: name.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(''),
        sourcemap: true,
        compact: true
      }
    ] : [
      {
        file: `dist/models/${name}.min.js`,
        format: 'es',
        sourcemap: true,
        compact: true
      }
    ],
    plugins: [
      nodeResolve(),
      terser(terserOptions),
      copy({
        targets: [
          { src: `src/models/${name}.d.ts`, dest: 'dist/models' }
        ]
      })
    ]
  });
});

// Add configurations for utils
utils.forEach(util => {
  configs.push({
    input: `src/utils/${util}.js`,
    output: isBuildingUmd ? [
      {
        file: `dist/utils/${util}.umd.min.js`,
        format: 'umd',
        name: util.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(''),
        sourcemap: true,
        compact: true
      }
    ] : [
      {
        file: `dist/utils/${util}.min.js`,
        format: 'es',
        sourcemap: true,
        compact: true
      }
    ],
    plugins: [nodeResolve(), terser(terser)]
  });
});

// Add configurations for themes
themes.forEach(theme => {
  configs.push({
    input: `src/themes/${theme}.js`,
    output: isBuildingUmd ? [
      {
        file: `dist/themes/${theme}.umd.min.js`,
        format: 'umd',
        name: theme.charAt(0).toUpperCase() + theme.slice(1) + 'Theme',
        sourcemap: true,
        compact: true
      }
    ] : [
      {
        file: `dist/themes/${theme}.min.js`,
        format: 'es',
        sourcemap: true,
        compact: true
      }
    ],
    plugins: [nodeResolve(), terser(terser)]
  });
});

export default configs;
