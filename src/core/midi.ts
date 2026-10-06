import { Midi } from '@tonejs/midi';
import type { Composition } from './types';
import { MELODIC_TRACK_IDS, TRACK_IDS } from './types';
import { PPQ } from './timing';
import { getInstrumentMeta } from './instruments';
import { getScale } from './theory';
import { uid, createComposition, normalizeComposition } from './composition';
import { mapDrumPitch, swingNote } from './drums';

/**
 * Export MIDI (format 1) : une piste par piste de la composition, avec
 * positions, durées et vélocités exactes, tempo, signature 4/4 et tonalité.
 * La batterie part sur le canal 10 (index 9), reconnu comme kit GM par les DAW.
 * Le swing est intégré aux positions pour que le fichier sonne comme dans 4Chords.
 */
export function compositionToMidi(c: Composition): Uint8Array {
  const midi = new Midi();
  const ratio = midi.header.ppq / PPQ; // 480 / 96 = 5, conversion exacte
  midi.header.name = c.title || 'Untitled';
  midi.header.setTempo(c.bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
  const scale = getScale(c.key.scale);
  if (scale.id === 'major' || scale.id === 'minor') {
    // L'événement MIDI encode le nombre d'altérations : pour le mineur, on passe par le relatif majeur.
    const majorPc = (c.key.root + (scale.id === 'minor' ? 3 : 0)) % 12;
    const names = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    midi.header.keySignatures.push({ ticks: 0, key: names[majorPc], scale: scale.id });
  }
  midi.header.update();

  TRACK_IDS.forEach((id, index) => {
    const t = c.tracks[id];
    const track = midi.addTrack();
    track.name = t.name;
    track.channel = id === 'drums' ? 9 : index;
    track.instrument.number = id === 'drums' ? 0 : getInstrumentMeta(t.instrument).gmProgram;
    for (const n of [...t.notes].sort((a, b) => a.start - b.start)) {
      const { start, duration } = swingNote(n.start, n.duration, c.swing);
      track.addNote({
        midi: n.pitch,
        ticks: Math.round(start * ratio),
        durationTicks: Math.max(1, Math.round(duration * ratio)),
        velocity: n.velocity,
      });
    }
  });
  return midi.toArray();
}

export function midiFileName(c: Composition): string {
  const base = (c.title || 'composition').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return `${base.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'composition'}-${c.bpm}bpm.mid`;
}

export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadMidi(c: Composition) {
  downloadBlob(compositionToMidi(c) as BlobPart, midiFileName(c), 'audio/midi');
}

/**
 * Import MIDI : les 3 premières pistes mélodiques non vides deviennent Chords,
 * Melody, Bass ; les pistes du canal 10 deviennent la piste Drums (4 premières mesures).
 */
export function midiToComposition(data: ArrayBuffer, authorId: string): Composition {
  const midi = new Midi(data);
  const ratio = PPQ / midi.header.ppq;
  const comp = createComposition(authorId, {
    title: midi.header.name || 'Import MIDI',
    bpm: Math.round(midi.header.tempos[0]?.bpm ?? 90),
  });
  const convert = (notes: (typeof midi.tracks)[number]['notes']) =>
    notes
      .map((n) => ({
        id: uid(),
        pitch: n.midi,
        start: Math.round(n.ticks * ratio),
        duration: Math.max(1, Math.round(n.durationTicks * ratio)),
        velocity: n.velocity,
      }))
      .filter((n) => n.start < PPQ * 16);
  const tracks = midi.tracks.filter((t) => t.notes.length > 0 && t.channel !== 9).slice(0, 3);
  tracks.forEach((t, i) => {
    comp.tracks[MELODIC_TRACK_IDS[i]].notes = convert(t.notes);
  });
  const drums = midi.tracks.filter((t) => t.notes.length > 0 && t.channel === 9).flatMap((t) => t.notes);
  comp.tracks.drums.notes = convert(drums).flatMap((n) => {
    const pitch = mapDrumPitch(n.pitch);
    return pitch === null ? [] : [{ ...n, pitch, duration: Math.min(n.duration, PPQ / 4) }];
  });
  return normalizeComposition(comp);
}
