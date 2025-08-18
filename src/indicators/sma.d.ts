export interface SMAState {
    period: number;
    window: number[];
    sum: number;
}

export function initSMAState(period: number): SMAState;

export function updateSMA(
    value: number,
    state: SMAState,
    isSamePeriod?: boolean
): {
    value: number | null;
    state: SMAState;
};

export function serializeSMAState(state: SMAState): string;

export function deserializeSMAState(serializedState: string): SMAState;
