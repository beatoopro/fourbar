import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor } from './store';
import { createComposition } from '../core/composition';
import { BAR, PPQ } from '../core/timing';

const st = () => useEditor.getState();

describe('éditeur', () => {
  beforeEach(() => {
    st().load(createComposition('me'));
    st().set('snap', '1/16');
    st().set('lastLength', PPQ);
    st().set('chordType', 'maj');
    st().set('inversion', 0);
  });

  it('ajoute, annule et rétablit', () => {
    st().addNote(60, 0);
    st().addNote(62, PPQ);
    expect(st().comp.tracks.chords.notes).toHaveLength(2);
    st().undo();
    expect(st().comp.tracks.chords.notes).toHaveLength(1);
    st().redo();
    expect(st().comp.tracks.chords.notes).toHaveLength(2);
  });

  it('copie / colle et duplique', () => {
    const n = st().addNote(60, 0);
    st().set('selection', [n.id]);
    st().duplicate();
    const notes = st().comp.tracks.chords.notes;
    expect(notes).toHaveLength(2);
    expect(notes[1].start).toBe(PPQ);
    st().copy();
    st().set('cursorTick', BAR);
    st().paste();
    expect(st().comp.tracks.chords.notes.at(-1)!.start).toBe(BAR);
  });

  it('crée un accord avec renversement puis le renverse', () => {
    st().set('inversion', 1);
    const created = st().addChord(60, 0);
    expect(created.map((n) => n.pitch).sort()).toEqual([64, 67, 72]);
    st().invertSelection(1);
    expect(st().comp.tracks.chords.notes.map((n) => n.pitch).sort((a, b) => a - b)).toEqual([67, 72, 76]);
  });

  it('transpose, quantifie et règle la vélocité', () => {
    const n = st().addNote(60, 5, 50);
    st().set('selection', [n.id]);
    st().transpose(12);
    st().quantize();
    const q = st().comp.tracks.chords.notes[0];
    expect(q).toMatchObject({ pitch: 72, start: 0, duration: 48 });
    st().setVelocities({ [n.id]: 0.3 });
    expect(st().comp.tracks.chords.notes[0].velocity).toBeCloseTo(0.3);
  });

  it('insère une progression avec basse', () => {
    st().insertProgression('jazz', true);
    expect(st().comp.tracks.chords.notes).toHaveLength(16);
    expect(st().comp.tracks.bass.notes).toHaveLength(4);
    st().undo();
    expect(st().comp.tracks.chords.notes).toHaveLength(0);
  });

  it('garde les pistes séparées', () => {
    st().addNote(60, 0);
    st().setTrack('melody');
    st().addNote(72, 0);
    expect(st().comp.tracks.chords.notes).toHaveLength(1);
    expect(st().comp.tracks.melody.notes).toHaveLength(1);
  });
});
