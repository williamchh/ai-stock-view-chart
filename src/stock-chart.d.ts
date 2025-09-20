export interface Theme {
  background: string;
  chartAreaBackground: string;
  textColor: string;
  gridColor: string;
  lineColor: string;
  positiveColor: string;
  negativeColor: string;
  candleUp: string;
  candleDown: string;
  volumeColor: string;
  crosshairColor: string;
  overlayTextColor: string;
  candleBorderColor: string;
  borderColorUseBodyColor?: boolean;
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
    timeframe?: any; // e.g., 'daily', 'weekly', 'monthly'
    timestamp?: any; // Deprecated, use 'time' instead
    ID?: string; // Deprecated, use 'id' instead
    date?: string; // Deprecated, use 'time' instead
}

export interface PlotConfig {
    id: string;
    heightRatio: number;
    yPosition?: number;
    type: 'candlestick' | 'line' | 'volume' | 'histogram' | 'signal' | 'arrowLine' | string;
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
    indicator?: {
        id: string;
        [key: string]: any;
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

  /**
   * 
   * @param data 
   */
  updateMainPlotOriginalData(data: Array<StockData>): void;

  /**
   * Centers the chart on a specific date and draws a vertical line
   * @param timestamp - Unix timestamp (in seconds) to center on
   * @param options - Configuration options
   */
  centerOnDate(timestamp: number, options?: {
    lineColor?: string;
    lineWidth?: number;
    drawLine?: boolean;
  }): void;
}