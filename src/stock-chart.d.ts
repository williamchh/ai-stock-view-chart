export interface StockChartOptions {
  theme?: 'light' | 'dark';
  chartName?: ChartName;
  chartType?: 'candlestick' | 'line';
  plots?: Array<PlotConfig>;
  initialVisibleCandles?: number;
}

export interface ChartName {
  name?: string;
  code?: string;
  metaString?: string;
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
    yPosition?: number;
    type: 'candlestick' | 'line' | 'volume' | 'histogram';
    overlay?: boolean;
    targetId?: string; // ID of the plot to overlay on top of
    data: Array<StockData | number | any>;
    keyLabel?: string;
    style?: {
        lineColor?: string;
        lineWidth?: number;
        fillColor?: string;
        opacity?: number;
        positiveColor?: string;
        negativeColor?: string;
    };
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