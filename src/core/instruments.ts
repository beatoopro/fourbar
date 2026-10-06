import type { TrackId } from './types';

/**
 * Métadonnées des instruments (sans dépendance audio).
 * Le son lui-même est défini dans audio/instruments.ts.
 * `gmProgram` sert à l'export MIDI pour que les DAW choisissent un son proche.
 */
export interface InstrumentMeta {
  id: string;
  label: string;
  track: TrackId;
  gmProgram: number;
}

export const INSTRUMENTS: InstrumentMeta[] = [
  { id: 'keys', label: 'Soft Keys', track: 'chords', gmProgram: 4 },
  { id: 'pad', label: 'Warm Pad', track: 'chords', gmProgram: 89 },
  { id: 'organ', label: 'Velvet Organ', track: 'chords', gmProgram: 16 },
  { id: 'pluck', label: 'Glass Pluck', track: 'melody', gmProgram: 46 },
  { id: 'bell', label: 'Bell', track: 'melody', gmProgram: 11 },
  { id: 'lead', label: 'Soft Lead', track: 'melody', gmProgram: 80 },
  { id: 'sub', label: 'Sub Bass', track: 'bass', gmProgram: 38 },
  { id: 'analog', label: 'Analog Bass', track: 'bass', gmProgram: 39 },
  { id: 'round', label: 'Round Bass', track: 'bass', gmProgram: 33 },
];

export function instrumentsFor(track: TrackId): InstrumentMeta[] {
  // Tous les instruments sont disponibles sur toutes les pistes, ceux de la piste en premier.
  return [...INSTRUMENTS.filter((i) => i.track === track), ...INSTRUMENTS.filter((i) => i.track !== track)];
}

export function getInstrumentMeta(id: string): InstrumentMeta {
  return INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0];
}
