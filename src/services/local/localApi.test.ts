import { beforeEach, describe, expect, it } from 'vitest';
import { LocalCommunityApi } from './localApi';

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} as Storage;

/** Loop au format V1 : 3 pistes, pas de batterie. */
const v1Comp = (id: string) => ({
  id,
  title: 'Ancienne loop',
  authorId: 'me',
  bpm: 90,
  genres: [],
  moods: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  tracks: {
    chords: { id: 'chords', instrument: 'piano', volume: 0.8, notes: [{ id: 'n1', pitch: 60, start: 0, duration: 96, velocity: 0.8 }] },
    melody: { id: 'melody', instrument: 'piano', volume: 0.8, notes: [] },
    bass: { id: 'bass', instrument: 'piano', volume: 0.8, notes: [] },
  },
});

describe('données locales d’une version précédente', () => {
  beforeEach(() => {
    store.clear();
    store.set('4chords:v1:seeded', '1');
    store.set('4chords:v1:publications', JSON.stringify([{ id: 'mine', composition: v1Comp('mine'), authorId: 'me', likes: 0, plays: 0, publishedAt: '2026-10-01T00:00:00.000Z' }]));
    store.set('4chords:v1:drafts', JSON.stringify([v1Comp('d1')]));
  });

  it('ajoute la piste batterie aux publications et brouillons V1', async () => {
    const api = new LocalCommunityApi();
    const mine = await api.getPublication('mine');
    expect(mine?.composition.tracks.drums.notes).toEqual([]);
    expect(mine?.composition.tracks.chords.notes).toHaveLength(1);
    const [draft] = await api.listDrafts();
    expect(draft.tracks.drums.notes).toEqual([]);
  });
});
