export interface StockChartOptions {
  theme?: 'light' | 'dark';
  chartType?: 'candlestick' | 'line';
  data: Array<StockData>;
  plots?: Array<PlotConfig>;
  initialVisibleCandles?: number;
}

export interface StockData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export interface PlotConfig {
    id: string;
    heightRatio: number;
}

/**
 * Main interface for StockChart library
 */
export default class StockChart {
  static init(elementId: string, options: StockChartOptions): StockChart;
  constructor(container: HTMLElement, options: StockChartOptions);
  applyTheme(themeName: 'light' | 'dark'): void;
  resize(): void;
  render(): void;
}