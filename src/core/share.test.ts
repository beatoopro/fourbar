import { describe, expect, it } from 'vitest';
import { createComposition } from './composition';
import { decodeSharedLoop, encodeSharedLoop } from './share';

describe('lien de partage', () => {
  it('fait l’aller-retour d’une loop dans l’adresse', async () => {
    const c = createComposition('me', { title: 'Ma loop', bpm: 97, genres: ['Jazz'] });
    for (let i = 0; i < 32; i++) c.tracks.chords.notes.push({ id: `n${i}`, pitch: 60 + (i % 7), start: i * 48, duration: 48, velocity: 0.8 });
    c.tracks.drums.notes.push({ id: 'k', pitch: 36, start: 0, duration: 24, velocity: 1 });
    const author = { name: 'Victor', handle: 'victor', color: '#8b5cf6' };
    const d = await encodeSharedLoop({ composition: c, author, publishedAt: '2026-10-06T10:00:00.000Z' });
    expect(d).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(d.length).toBeLessThan(1500);
    const back = await decodeSharedLoop(d);
    expect(back?.author).toEqual(author);
    expect(back?.composition.title).toBe('Ma loop');
    expect(back?.composition.bpm).toBe(97);
    expect(back?.composition.tracks.chords.notes.map((n) => [n.pitch, n.start])).toEqual(c.tracks.chords.notes.map((n) => [n.pitch, n.start]));
    expect(back?.composition.tracks.drums.notes).toHaveLength(1);
  });

  it('refuse un lien abîmé', async () => {
    expect(await decodeSharedLoop('pas-un-lien')).toBeNull();
    expect(await decodeSharedLoop('')).toBeNull();
  });
});
