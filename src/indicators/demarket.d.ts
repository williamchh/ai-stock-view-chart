export interface DeMarkerState {
    period: number;
    deMax: number[];
    deMin: number[];
    prevHigh: number | null;
    prevLow: number | null;
}

export function initDeMarkerState(period: number): DeMarkerState;

export function updateDeMarker(
    high: number,
    low: number,
    state: DeMarkerState,
    isSamePeriod?: boolean
): {
    value: number | null;
    state: DeMarkerState;
};

export function serializeDeMarkerState(state: DeMarkerState): string;

export function deserializeDeMarkerState(serializedState: string): DeMarkerState;
