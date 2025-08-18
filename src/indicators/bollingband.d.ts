export interface BollingerBandState {
    smaWindow: number[];
    period: number;
    sum: number;
    stdDevMultiplier: number;
}

export function initBollingerBandState(
    period: number,
    stdDevMultiplier?: number
): BollingerBandState;

export function updateBollingerBands(
    value: number,
    state: BollingerBandState,
    isSamePeriod?: boolean
): {
    middle: number | null;
    upper: number | null;
    lower: number | null;
    state: BollingerBandState;
};

export function serializeBollingerBandState(state: BollingerBandState): string;

export function deserializeBollingerBandState(serializedState: string): BollingerBandState;
