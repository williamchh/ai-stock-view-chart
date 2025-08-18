export interface EMAState {
    period: number;
    smoothingFactor: number;
    previousEMA: number | null;
}

export function initEMAState(period: number): EMAState;

export function updateEMA(
    value: number,
    state: EMAState,
    isSamePeriod?: boolean
): {
    value: number | null;
    state: EMAState;
};

export function serializeEMAState(state: EMAState): string;

export function deserializeEMAState(serializedState: string): EMAState;
