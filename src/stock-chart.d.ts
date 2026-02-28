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
  showTimeframeButtons?: boolean;
  emitCandleClick?: boolean;
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

export interface CandleClickEventDetail {
  data: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    signals?: Signal[];
  };
  index: number;
  plotId: string;
  originalEvent: MouseEvent | TouchEvent;
  position: { x: number; y: number };
}

export interface CandleClickEvent extends CustomEvent<CandleClickEventDetail> {}

export interface Position {
  timestamp: number | Date;
  price: number;
  orderType: 'buy' | 'sell';
  lots?: number;
  id?: string;
}

export interface PositionUpdate {
  timestamp?: number | Date;
  price?: number;
  orderType?: 'buy' | 'sell';
  lots?: number;
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
  crosshairX: number;
  crosshairY: number;
  currentTheme: Theme;
  
  // Internal properties used by ClickHandler
  plotLayoutManager: any;
  dataViewport: any;
  options: StockChartOptions;
  canvas: HTMLCanvasElement;
  
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
   * Updates the original data for the main plot
   * @param data - Array of stock data
   */
  updateMainPlotOriginalData(data: Array<StockData>): void;

  /**
   * Centers the chart on a specific date and draws a vertical line
   * @param timestamp - Unix timestamp (in milliseconds) to center on
   * @param options - Configuration options
   */
  centerOnDate(timestamp: number, options?: {
    lineColor?: string;
    lineWidth?: number;
    drawLine?: boolean;
  }): void;

  /**
   * Finds the index of a data point by timestamp using binary search
   * @param time - Unix timestamp (in seconds) to search for
   * @param data - Array of data to search in
   * @returns The index of the data point, or -1 if not found
   */
  findTimeIndex(time: number, data: Array<StockData>): number;

  /**
   * Enable or disable candle click event emission
   * @param enabled - Whether to enable candle click events
   */
  setCandleClickEnabled(enabled: boolean): void;

  /**
   * Check if candle click events are enabled
   */
  isCandleClickEnabled(): boolean;

  /**
   * Adds a position marker to the chart
   * @param position - The position to add
   * @returns The ID of the added position
   */
  addPosition(position: Position): string;

  /**
   * Adds multiple position markers to the chart at once
   * @param positions - Array of positions to add
   * @returns Array of IDs of the added positions
   */
  addPositions(positions: Position[]): string[];

  /**
   * Removes a position marker by ID
   * @param id - The ID of the position to remove
   * @returns True if position was found and removed
   */
  removePosition(id: string): boolean;

  /**
   * Updates an existing position marker
   * @param id - The ID of the position to update
   * @param updates - The fields to update
   * @returns True if position was found and updated
   */
  updatePosition(id: string, updates: PositionUpdate): boolean;

  /**
   * Clears all position markers
   */
  clearPositions(): void;

  /**
   * Gets all position markers
   * @returns Array of all positions
   */
  getPositions(): Array<any>;
}