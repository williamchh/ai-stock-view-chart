import { EMAState } from './ema.js';

export interface MACDState {
    fast: EMAState;
    slow: EMAState;
    signal: EMAState;
}

export function initMACDState(
    fastPeriod?: number,
    slowPeriod?: number,
    signalPeriod?: number
): MACDState;

export function updateMACD(
    close: number,
    state: MACDState,
    isSamePeriod?: boolean
): {
    macdLine: number | null;
    signalLine: number | null;
    histogram: number | null;
    state: MACDState;
};

export function serializeMACDState(state: MACDState): string;

export function deserializeMACDState(serializedState: string): MACDState;
