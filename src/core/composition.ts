import type { Composition, Note, Track, TrackId } from './types';
import { TRACK_IDS } from './types';
import { LOOP_TICKS, clamp } from './timing';
import { isDrumKit } from './instruments';

let counter = 0;
export function uid(prefix = 'n'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const TRACK_LABELS: Record<TrackId, string> = {
  chords: 'Chords',
  melody: 'Melody',
  bass: 'Bass',
  drums: 'Drums',
};

const DEFAULT_INSTRUMENT: Record<TrackId, string> = { chords: 'keys', melody: 'pluck', bass: 'round', drums: 'kit-dusty' };
const DEFAULT_VOLUME: Record<TrackId, number> = { chords: 0.7, melody: 0.75, bass: 0.8, drums: 0.8 };

export function createTrack(id: TrackId, notes: Note[] = []): Track {
  return {
    id,
    name: TRACK_LABELS[id],
    instrument: DEFAULT_INSTRUMENT[id],
    volume: DEFAULT_VOLUME[id],
    muted: false,
    solo: false,
    defaultVelocity: 0.8,
    notes,
  };
}

export function createComposition(authorId: string, partial: Partial<Composition> = {}): Composition {
  const now = new Date().toISOString();
  return {
    id: uid('c'),
    title: '',
    authorId,
    genres: [],
    moods: [],
    bpm: 90,
    swing: 0,
    key: { root: 0, scale: 'major' },
    tracks: {
      chords: createTrack('chords'),
      melody: createTrack('melody'),
      bass: createTrack('bass'),
      drums: createTrack('drums'),
    },
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...partial,
  };
}

export function cloneComposition(c: Composition): Composition {
  return JSON.parse(JSON.stringify(c)) as Composition;
}

/** Copie une composition pour remix : nouvel id, nouvel auteur, lien vers l'original. */
export function remixOf(original: Composition, authorId: string): Composition {
  const copy = cloneComposition(original);
  const now = new Date().toISOString();
  for (const id of TRACK_IDS) copy.tracks[id].notes = copy.tracks[id].notes.map((n) => ({ ...n, id: uid() }));
  return {
    ...copy,
    id: uid('c'),
    authorId,
    title: `${original.title} (remix)`,
    remixOf: original.id,
    createdAt: now,
    updatedAt: now,
  };
}

export function noteCount(c: Composition): number {
  return TRACK_IDS.reduce((s, id) => s + c.tracks[id].notes.length, 0);
}

/** Ambiances enregistrées avant le passage de l'interface en anglais. */
const LEGACY_MOODS: Record<string, string> = {
  Mélancolique: 'Melancholic',
  Joyeux: 'Happy',
  Sombre: 'Dark',
  Rêveur: 'Dreamy',
  Énergique: 'Energetic',
  Romantique: 'Romantic',
  Épique: 'Epic',
};

/** Valide/répare des données venant du stockage ou d'une API. */
export function normalizeComposition(raw: Composition): Composition {
  const base = createComposition(raw.authorId ?? 'unknown');
  const tracks = {} as Record<TrackId, Track>;
  for (const id of TRACK_IDS) {
    const t = raw.tracks?.[id];
    tracks[id] = {
      ...createTrack(id),
      ...t,
      id,
      // Un kit sur une piste mélodique (ou l'inverse) n'a pas de sens : on revient à l'instrument par défaut.
      instrument: t?.instrument && isDrumKit(t.instrument) === (id === 'drums') ? t.instrument : DEFAULT_INSTRUMENT[id],
      notes: (t?.notes ?? [])
        .filter((n) => Number.isFinite(n.pitch) && Number.isFinite(n.start) && n.duration > 0)
        .map((n) => ({
          id: n.id ?? uid(),
          pitch: clamp(Math.round(n.pitch), 0, 127),
          start: clamp(n.start, 0, LOOP_TICKS - 1),
          duration: clamp(n.duration, 1, LOOP_TICKS),
          velocity: clamp(n.velocity ?? 0.8, 0.01, 1),
        })),
    };
  }
  const moods = (raw.moods ?? []).map((m) => LEGACY_MOODS[m] ?? m);
  return { ...base, ...raw, tracks, moods, bpm: clamp(raw.bpm ?? 90, 40, 220), swing: clamp(Number(raw.swing) || 0, 0, 1), version: 1 };
}
