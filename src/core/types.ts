/**
 * Modèle de données musical. Indépendant de l'UI et de l'audio :
 * c'est ce format qui est sauvegardé, publié et (plus tard) envoyé à une API.
 */

export type TrackId = 'chords' | 'melody' | 'bass' | 'drums';

export const TRACK_IDS: TrackId[] = ['chords', 'melody', 'bass', 'drums'];

/** Pistes mélodiques (hors batterie) : celles dont la hauteur des notes a un sens musical. */
export const MELODIC_TRACK_IDS: TrackId[] = ['chords', 'melody', 'bass'];

export interface Note {
  id: string;
  /** Hauteur MIDI (0-127). Piste Drums : numéro General MIDI de l'élément (36 kick, 38 snare…). */
  pitch: number;
  /** Position en ticks (PPQ = 96). */
  start: number;
  /** Durée en ticks. */
  duration: number;
  /** Vélocité 0..1 (exportée en 1..127). */
  velocity: number;
}

export interface Track {
  id: TrackId;
  name: string;
  /** Identifiant d'un preset d'instrument (voir audio/instruments). */
  instrument: string;
  /** Volume 0..1. */
  volume: number;
  muted: boolean;
  solo: boolean;
  /** Vélocité appliquée aux nouvelles notes de la piste. */
  defaultVelocity: number;
  notes: Note[];
}

export interface KeySignature {
  /** 0 = C ... 11 = B */
  root: number;
  scale: string;
}

export interface Composition {
  id: string;
  title: string;
  authorId: string;
  description?: string;
  genres: string[];
  moods: string[];
  bpm: number;
  /** Swing des doubles-croches, 0 (droit) à 1 (très chaloupé). Absent = 0. */
  swing?: number;
  key: KeySignature;
  tracks: Record<TrackId, Track>;
  /** Id de la composition d'origine si c'est un remix. */
  remixOf?: string;
  createdAt: string;
  updatedAt: string;
  /** Format des données, pour les migrations futures. */
  version: 1;
}
