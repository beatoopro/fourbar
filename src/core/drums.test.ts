import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { DRUM_LANES, DRUM_PATTERNS, buildPatternNotes, cycleRoll, mapDrumPitch, repeatFirstBar, swingTick } from './drums';
import { compositionToMidi, midiToComposition } from './midi';
import { createComposition, normalizeComposition } from './composition';
import { BAR, LOOP_TICKS, PPQ } from './timing';
import type { Composition } from './types';

describe('patterns de batterie', () => {
  it('sont bien formés', () => {
    const laneIds = new Set(DRUM_LANES.map((l) => l.id));
    for (const p of DRUM_PATTERNS) {
      for (const bar of [...p.bars, ...(p.fill ? [p.fill] : [])]) {
        for (const [lane, str] of Object.entries(bar)) {
          expect(laneIds.has(lane), `${p.id}: ligne ${lane}`).toBe(true);
          expect(BAR % str!.length, `${p.id}/${lane}: longueur ${str!.length}`).toBe(0);
          expect(str, `${p.id}/${lane}`).toMatch(/^[Xxog.234]+$/);
        }
      }
      const notes = buildPatternNotes(p, true);
      expect(notes.length).toBeGreaterThan(8);
      for (const n of notes) {
        expect(n.start).toBeGreaterThanOrEqual(0);
        expect(n.start).toBeLessThan(LOOP_TICKS);
        expect(Number.isInteger(n.start)).toBe(true);
      }
    }
  });

  it('place les coups sur la grille et gère les roulements', () => {
    const trap = DRUM_PATTERNS.find((p) => p.id === 'trap')!;
    const notes = buildPatternNotes(trap, false);
    const hats = notes.filter((n) => n.pitch === 42 && n.start < BAR).map((n) => n.start);
    // Case 12 du premier temps : roulement de 3 coups (triolets de triples-croches).
    expect(hats).toEqual(expect.arrayContaining([288, 296, 304]));
    expect(notes.filter((n) => n.pitch === 39).map((n) => n.start)).toEqual([192, BAR + 192, 2 * BAR + 192, 3 * BAR + 192]);
  });

  it('répète la mesure 1 et cycle les roulements', () => {
    const notes = repeatFirstBar([{ id: 'a', pitch: 36, start: 0, duration: 24, velocity: 0.8 }, { id: 'b', pitch: 38, start: BAR + 96, duration: 24, velocity: 0.8 }]);
    expect(notes.map((n) => n.start).sort((a, b) => a - b)).toEqual([0, BAR, 2 * BAR, 3 * BAR]);
    let cell = cycleRoll([{ id: 'h', pitch: 42, start: 48, duration: 24, velocity: 0.8 }], 42, 48, 24);
    expect(cell.map((n) => n.start)).toEqual([48, 60]);
    cell = cycleRoll(cell, 42, 48, 24);
    cell = cycleRoll(cell, 42, 48, 24);
    expect(cell.map((n) => n.start)).toEqual([48, 54, 60, 66]);
    expect(cycleRoll(cell, 42, 48, 24)).toHaveLength(1);
  });

  it('ramène les notes GM sur les lignes du kit', () => {
    expect(mapDrumPitch(35)).toBe(36);
    expect(mapDrumPitch(40)).toBe(38);
    expect(mapDrumPitch(44)).toBe(42);
    expect(mapDrumPitch(46)).toBe(46);
    expect(mapDrumPitch(100)).toBeNull();
  });
});

describe('swing', () => {
  it('retarde les doubles-croches faibles sans toucher aux croches', () => {
    expect(swingTick(0, 0.5)).toBe(0);
    expect(swingTick(48, 0.5)).toBe(48);
    expect(swingTick(24, 0)).toBe(24);
    expect(swingTick(24, 1)).toBe(36); // 75 % façon MPC
    expect(swingTick(24 + 96, 0.5)).toBe(30 + 96);
  });

  it('préserve l’ordre des notes', () => {
    let prev = -1;
    for (let t = 0; t < BAR; t++) {
      const s = swingTick(t, 0.8);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
});

describe('piste Drums', () => {
  it('s’ajoute aux anciennes compositions', () => {
    const old = createComposition('me') as Partial<Composition>;
    const tracks = { ...old.tracks! } as Partial<Composition['tracks']>;
    delete tracks.drums;
    delete old.swing;
    const c = normalizeComposition({ ...old, tracks } as Composition);
    expect(c.tracks.drums.notes).toEqual([]);
    expect(c.tracks.drums.instrument.startsWith('kit-')).toBe(true);
    expect(c.swing).toBe(0);
  });

  it('s’exporte sur le canal 10 avec le swing intégré, et se réimporte', () => {
    const c = createComposition('me', { bpm: 90, swing: 1 });
    c.tracks.drums.notes = [
      { id: 'k', pitch: 36, start: 0, duration: PPQ / 4, velocity: 1 },
      { id: 'h', pitch: 42, start: PPQ / 4, duration: PPQ / 4, velocity: 0.5 },
    ];
    const midi = new Midi(compositionToMidi(c));
    const drums = midi.tracks.find((t) => t.name === 'Drums')!;
    expect(drums.channel).toBe(9);
    expect(drums.instrument.percussion).toBe(true);
    expect(drums.notes.map((n) => n.ticks)).toEqual([0, 180]); // 36 ticks × 5
    const back = midiToComposition(compositionToMidi(c).buffer as ArrayBuffer, 'me');
    expect(back.tracks.drums.notes.map((n) => [n.pitch, n.start])).toEqual([[36, 0], [42, 36]]);
    expect(back.tracks.chords.notes).toEqual([]);
  });
});
