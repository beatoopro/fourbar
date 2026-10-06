/** Résolution interne : 96 ticks par noire (divisible par 3 pour les triolets). */
export const PPQ = 96;
export const BEATS_PER_BAR = 4;
export const BAR = PPQ * BEATS_PER_BAR;
export const BARS = 4;
export const LOOP_TICKS = BAR * BARS;

export interface SnapOption {
  id: string;
  label: string;
  ticks: number;
}

export const SNAP_OPTIONS: SnapOption[] = [
  { id: '1/1', label: '1 mesure', ticks: BAR },
  { id: '1/2', label: '1/2', ticks: PPQ * 2 },
  { id: '1/4', label: '1/4', ticks: PPQ },
  { id: '1/8', label: '1/8', ticks: PPQ / 2 },
  { id: '1/16', label: '1/16', ticks: PPQ / 4 },
  { id: '1/32', label: '1/32', ticks: PPQ / 8 },
  { id: '1/4T', label: '1/4 triolet', ticks: (PPQ * 2) / 3 },
  { id: '1/8T', label: '1/8 triolet', ticks: PPQ / 3 },
  { id: '1/16T', label: '1/16 triolet', ticks: PPQ / 6 },
  { id: 'off', label: 'Libre', ticks: 1 },
];

export function snapTicks(id: string): number {
  return SNAP_OPTIONS.find((s) => s.id === id)?.ticks ?? PPQ / 4;
}

export const snapFloor = (t: number, step: number) => Math.floor(t / step) * step;
export const snapRound = (t: number, step: number) => Math.round(t / step) * step;
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function ticksToSeconds(ticks: number, bpm: number): number {
  return (ticks / PPQ) * (60 / bpm);
}
