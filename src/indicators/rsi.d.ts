export declare function initRSIState(period?: number): RSIState;
export declare function updateRSI(price: number, state: RSIState, isSamePeriod?: boolean): {
    value: number | null;
    state: RSIState;
};
export declare function serializeRSIState(state: RSIState): string;
export declare function deserializeRSIState(serializedState: string): RSIState;
export interface RSIState {
    period: number;
    gains: number[];
    losses: number[];
    avgGain: number;
    avgLoss: number;
    lastPrice: number | null;
}