export interface StockBaseClient {
    id:             number;
    date:           Date;
    open:           number;
    high:           number;
    low:            number;
    close:          number;
    timeframe:      Timeframe;
    isBuy:          number;
    isStrong:       boolean;
    trigger:        number;
    type:           number;
    subType:        number;
    typeTrigger:    number | null;
    subTypeTrigger: number;
    referTf:        number | null;
}

export interface Stockbase {
    id:               number;
    date:             Date;
    open:             number;
    high:             number;
    low:              number;
    close:            number;
    timeframe:        Timeframe;
    sma08:            number;
    sma13:            number;
    sma21:            number;
    sma34:            number;
    sma52:            number;
    sma105:           number;
    upper:            number;
    lower:            number;
    macd:             number;
    signal:           number;
    deMarker:         number;
    isBuy:            number;
    isStrong:         boolean;
    trigger:          number | null;
    type:             number;
    subType:          number | null;
    typeTrigger:      number | null;
    subTypeTrigger:   number | null;
    referTf:          number;
    preparedType:     number | null;
    hasCollectMarked: number | null;
    isStrongUpSMA:    boolean;
    isStrongDownSMA:  boolean;
    isGoldMacd:       boolean;
    isDownMacd:       boolean;
    isRealGoldMacd:   boolean;
    isRealDownMacd:   boolean;
}

export interface Timeframe {
    timeframeID:   number;
    timeframeName: string;
}

export interface Retracement {
  direction: number
  endID: number
  fiboSequence: FiboSequence[]
  referenceLines: number[]
  safeMargins: number[]
  startID: number
  escapePrice: number
  target3: number
  prediction: Prediction
}

export interface Prediction {
  next: _Prediction
  stop: _Prediction
}

export interface _Prediction {
  item1: number
  item2: number
}

export interface FiboSequence {
    date:      Date;
    priceFrom: number;
    priceTo:   number;
    targetID:  number;
    distance:  number;
    target:    number;
    ratio:     number;
}

export interface Order {
    id:              string;
    target1:         number;
    target2:         number;
    target3:         number;
    stopLoss:        number;
    entry:           number;
    entryDate:       Date;
    tradeStatus:     number;
    productCode:     string;
    lots:            number;
    orderIdentifier: string;
    orderType:       number;
    referTf:         number;
}

export interface ASVResponse {
    stockbaseClients: StockBaseClient[];
    stockbases:       Stockbase[];
    retraceSequenceDic:     Retracement[];
    orders:           Order[];
}