import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { buildChord, detectChord, invert, isInScale, voiceLead } from './theory';
import { compositionToMidi, midiToComposition } from './midi';
import { createComposition } from './composition';
import { BAR, PPQ } from './timing';
import { buildSeedPublications } from '../services/local/seed';

describe('théorie', () => {
  it('construit les accords diatoniques', () => {
    // C majeur : degré II (D) en 7e = Dm7
    expect(buildChord(62, 'diatonic7', 0, 0, 'major')).toEqual([62, 65, 69, 72]);
    expect(detectChord([62, 65, 69, 72])).toBe('Dm7');
    // Degré V en triade = G
    expect(detectChord(buildChord(55, 'diatonic3', 0, 0, 'major'))).toBe('G');
  });

  it('gère les renversements', () => {
    expect(invert([60, 64, 67], 1)).toEqual([64, 67, 72]);
    expect(invert([60, 64, 67], 2)).toEqual([67, 72, 76]);
    expect(detectChord([64, 67, 72])).toBe('C/E');
  });

  it('identifie les notes de la gamme', () => {
    expect(isInScale(64, 0, 'major')).toBe(true);
    expect(isInScale(63, 0, 'major')).toBe(false);
    expect(isInScale(63, 0, 'minor')).toBe(true);
  });

  it('conduit les voix sans grands sauts', () => {
    const v = voiceLead([
      [60, 64, 67],
      [67, 71, 74],
    ]);
    const jump = Math.abs(v[1][0] - v[0][0]);
    expect(jump).toBeLessThanOrEqual(7);
  });
});

describe('MIDI', () => {
  it('conserve pistes, positions, durées et vélocités', () => {
    const c = createComposition('me', { title: 'Test', bpm: 97 });
    c.tracks.chords.notes = [{ id: 'a', pitch: 60, start: 0, duration: BAR, velocity: 0.5 }];
    c.tracks.melody.notes = [{ id: 'b', pitch: 72, start: PPQ / 3, duration: PPQ / 6, velocity: 1 }];
    c.tracks.bass.notes = [{ id: 'c', pitch: 36, start: BAR * 3 + PPQ / 8, duration: PPQ / 8, velocity: 0.25 }];
    const midi = new Midi(compositionToMidi(c));
    expect(midi.tracks.map((t) => t.name)).toEqual(['Chords', 'Melody', 'Bass']);
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(97);
    expect(midi.tracks[1].notes[0].ticks).toBe(160); // triolet de croche exact à 480 PPQ
    expect(midi.tracks[2].notes[0].durationTicks).toBe(60);
    expect(midi.tracks[0].notes[0].velocity).toBeCloseTo(0.5, 1);

    const back = midiToComposition(compositionToMidi(c).buffer as ArrayBuffer, 'me');
    expect(back.tracks.melody.notes[0]).toMatchObject({ pitch: 72, start: 32, duration: 16 });
    expect(back.tracks.bass.notes[0]).toMatchObject({ pitch: 36, start: BAR * 3 + 12, duration: 12 });
  });
});

describe('données de démonstration', () => {
  it('génère des compositions valides', () => {
    const pubs = buildSeedPublications();
    expect(pubs.length).toBeGreaterThan(20);
    for (const p of pubs) {
      const all = [...p.composition.tracks.chords.notes, ...p.composition.tracks.bass.notes];
      expect(all.length).toBeGreaterThan(0);
      for (const n of all) {
        expect(n.start + n.duration).toBeLessThanOrEqual(BAR * 4);
        expect(n.pitch).toBeGreaterThanOrEqual(24);
      }
    }
  });
});
