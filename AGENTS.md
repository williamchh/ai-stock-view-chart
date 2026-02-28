# AGENTS.md

This file contains guidelines for agentic coding assistants working on this repository.

## Build Commands

**Main Build**
```bash
npm run build              # Build both npm and UMD versions
npm run build:npm          # Build ES modules for npm distribution
npm run build:umd          # Build UMD bundle for browser
npm start                  # Start dev server on demo (serves current directory)
```

**Demo Applications**
```bash
# Vue demo
cd demo/vue && npm run dev     # Start Vue dev server
cd demo/vue && npm run build   # Build Vue demo

# React demo  
cd demo/react && npm run dev   # Start React dev server
cd demo/react && npm run build # Build React demo
```

**Note:** No test suite is currently configured. When adding tests, add test commands to package.json.

## Project Structure

```
src/
├── stock-chart.js          # Main entry point and StockChart class
├── stock-chart.d.ts        # TypeScript type definitions
├── indicators/             # Technical indicator calculations (EMA, SMA, RSI, MACD, etc.)
├── models/                 # Data mappers and model definitions
├── themes/                 # Theme configurations (light/dark)
└── utils/                  # Utility modules (data, layout, drawing, helpers)
```

## Code Style Guidelines

### Imports
- Use ES6 module syntax: `import { foo } from './foo.js'`
- Always include `.js` extension in import paths (required by ES modules)
- Group imports: third-party libraries first, then local imports
- Use default exports for classes (`export default class StockChart`)
- Use named exports for utilities (`export { foo, bar }`)

### Formatting & Style
- **No formal formatter** (no Prettier/ESLint configured)
- Follow existing patterns in the codebase
- Use 4-space indentation (observed in main files)
- Use camelCase for variables, functions, and methods (`updateEMA`, `getVisibleData`)
- Use PascalCase for classes and constructors (`StockChart`, `PlotLayoutManager`)
- Use kebab-case for file names (`stock-chart.js`, `drawing-panel.js`)
- Prefer `const` over `let` when possible
- Use arrow functions for callbacks and anonymous functions

### Documentation
- **Required**: JSDoc comments for all public functions, classes, and methods
- Use `@param {type} name description` for parameters
- Use `@returns {type} description` for return values
- Use `@typedef` for custom type definitions in JS files
- Add `@fileoverview` at the top of module files
- Example:
  ```javascript
   /**
    * Gets all position markers
    * @returns Array of all positions
    */
   getPositions(): Array<any>;

   /**
    * Exports all chart data including candlestick data, indicators, and configurations
    * @returns Exported chart data object with all data and configurations
    */
   exportChartData(): ExportedChartData;

}

/**
 * @typedef {Object} ExportedChartData
 * @property {Array<ExportedStockData>} data - Array of merged K-line and indicator data
 * @property {number} exportTime - Timestamp of export
 */

/**
 * @typedef {Object} ExportedStockData
 * @property {number} time - Unix timestamp (seconds)
 * @property {number} open - Opening price
 * @property {number} high - Highest price
 * @property {number} low - Lowest price
 * @property {number} close - Closing price
 * @property {number} [volume] - Trading volume
 * @property {number|string} [id] - Optional ID
 * @property {Array<IndicatorValue>} indicators - Array of indicator values for this timestamp
 */

/**
 * @typedef {Object} IndicatorValue
 * @property {string} name - Indicator name (e.g., 'rsi', 'macd', 'sma')
 * @property {Object} [settings] - Indicator configuration settings
 * @property {number|Object} value - Indicator value(s) - may be null during warmup
 */
  ```
- Throw `Error` objects for invalid configuration or data
- Catch errors in async functions with `try-catch` and log appropriately

### Code Organization
- **Class structure**:
  1. Static properties
  2. Constructor
  3. Public methods
  4. Private methods (marked with `@private` JSDoc tag)
  5. Event handlers

- **Module structure**:
  1. File overview comment
  2. Imports
  3. Type definitions/typedefs
  4. Constants
  5. Functions/classes
  6. Exports

### Canvas & Rendering
- Use `ctx.save()` and `ctx.restore()` for context state management
- Clear canvas with `ctx.clearRect()` before rendering
- Use `ctx.beginPath()` before drawing paths
- Set styles (color, line width) before drawing operations
- Clip to plot areas using `ctx.clip()` to prevent overflow

### Event Handling
- Bind methods to instance: `this.handleMouseDown = this.handleMouseDown.bind(this)`
- Use event delegation where appropriate
- Clean up event listeners in `destroy()` methods
- Use passive event listeners for scroll/touch where possible
- Store bound handlers for cleanup: `this.handleMouseDownBound = this.handleMouseDown.bind(this)`

### State Management
- Use classes to manage state (`DataViewport`, `DrawingPanel`)
- Store state in instance properties (`this.dataViewport`, `this.drawings`)
- Use Maps for keyed data (`this.plotScales`, `this.positions`)
- Persist settings to `localStorage` for user preferences
- Persist drawings to `IndexedDB` for complex data

### Performance
- Use `requestAnimationFrame` for animations (if needed)
- Debounce resize events with `setTimeout` (observed 100ms delay)
- Use `ResizeObserver` for container size changes
- Minimize DOM manipulations - batch where possible
- Cache calculated values that don't change frequently

### Theme Support
- All colors must support both light and dark themes
- Access theme colors via `this.currentTheme.property`
- Apply theme to canvas background and UI elements
- Provide fallback colors in code (e.g., `|| '#ffffff'`)

### Adding New Features
1. Add TypeScript definitions to corresponding `.d.ts` file
2. Implement feature in JS with full JSDoc comments
3. Add JSDoc `@typedef` for complex types
4. Export named functions or classes as appropriate
5. Update rollup config if adding new modules to build
6. Test in demo applications (Vue/React)

### Best Practices
- Keep functions focused and single-purpose
- Avoid deeply nested conditionals - return early
- Use destructuring for object properties when helpful
- Prefer array methods (`map`, `filter`, `reduce`) over for loops
- Add comments for non-obvious logic
- Don't add code comments unless asked
