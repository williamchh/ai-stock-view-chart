export interface Theme {
  background: string;
  chartAreaBackground: string;
  textColor: string;
  gridColor: string;
  lineColor: string;
  positiveColor: string;
  negativeColor: string;
  volumeColor: string;
  crosshairColor: string;
  overlayTextColor: string;
  candleBorderColor: string;
}

export interface StockChartOptions {
  theme?: 'light' | 'dark' | Theme;
  chartName?: ChartName;
  chartType?: 'candlestick' | 'line';
  plots?: Array<PlotConfig>;
  initialVisibleCandles?: number;
  showDrawingToolbar?: boolean;
}

export interface ChartName {
  name?: string;
  code?: string;
  metaString?: string;
}

export interface Signal {
    type: 'support' | 'resistance' | 'uptrend' | 'downtrend' | string;
    value: number;
    description?: string;
    strength?: number;
}

export interface StockData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    signals?: Signal[];
}

export interface PlotConfig {
    id: string;
    heightRatio: number;
    yPosition?: number;
    type: 'candlestick' | 'line' | 'volume' | 'histogram' | 'signal';
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

export interface PlotLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Main interface for StockChart library
 */
export default class StockChart {
  static init(elementId: string, options: StockChartOptions): StockChart;
  constructor(container: HTMLElement, options: StockChartOptions);
  applyTheme(theme: 'light' | 'dark' | Theme): void;
  resize(): void;
  render(): void;
  /**
   * Updates the stock data for all plots at once
   * @param plots - Array of plot configurations to update
   */
  updateStockData(plots: Array<PlotConfig>): void;
  /**
   * Updates the chart name information
   * @param chartName - The new chart name information
   */
  updateChartName(chartName: ChartName): void;
}