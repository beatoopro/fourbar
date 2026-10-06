/** Théorie musicale : notes, gammes, accords, renversements, progressions. */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(pitch: number): string {
  return `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

export const isBlackKey = (pitch: number) => [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);

export interface Scale {
  id: string;
  label: string;
  intervals: number[];
}

export const SCALES: Scale[] = [
  { id: 'major', label: 'Majeur', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', label: 'Mineur', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'dorian', label: 'Dorien', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixolydian', label: 'Mixolydien', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'harmonic-minor', label: 'Mineur harmonique', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'lydian', label: 'Lydien', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'phrygian', label: 'Phrygien', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'pentatonic-major', label: 'Penta majeure', intervals: [0, 2, 4, 7, 9] },
  { id: 'pentatonic-minor', label: 'Penta mineure', intervals: [0, 3, 5, 7, 10] },
  { id: 'blues', label: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
];

export function getScale(id: string): Scale {
  return SCALES.find((s) => s.id === id) ?? SCALES[0];
}

export function isInScale(pitch: number, root: number, scaleId: string): boolean {
  const pc = (((pitch - root) % 12) + 12) % 12;
  return getScale(scaleId).intervals.includes(pc);
}

export function keyLabel(root: number, scaleId: string): string {
  return `${NOTE_NAMES[root]} ${getScale(scaleId).label.toLowerCase()}`;
}

export interface ChordType {
  id: string;
  label: string;
  /** Intervalles en demi-tons. Vide pour les types « diatoniques » calculés depuis la gamme. */
  intervals: number[];
  /** Pour les accords diatoniques : nombre de tierces empilées. */
  stack?: number;
}

export const CHORD_TYPES: ChordType[] = [
  { id: 'diatonic3', label: 'Auto · triade', intervals: [], stack: 3 },
  { id: 'diatonic7', label: 'Auto · 7e', intervals: [], stack: 4 },
  { id: 'diatonic9', label: 'Auto · 9e', intervals: [], stack: 5 },
  { id: 'maj', label: 'Majeur', intervals: [0, 4, 7] },
  { id: 'min', label: 'Mineur', intervals: [0, 3, 7] },
  { id: 'dim', label: 'Diminué', intervals: [0, 3, 6] },
  { id: 'aug', label: 'Augmenté', intervals: [0, 4, 8] },
  { id: 'sus2', label: 'Sus2', intervals: [0, 2, 7] },
  { id: 'sus4', label: 'Sus4', intervals: [0, 5, 7] },
  { id: 'maj7', label: 'Maj7', intervals: [0, 4, 7, 11] },
  { id: 'm7', label: 'm7', intervals: [0, 3, 7, 10] },
  { id: '7', label: '7 (dom.)', intervals: [0, 4, 7, 10] },
  { id: 'm7b5', label: 'm7b5', intervals: [0, 3, 6, 10] },
  { id: 'add9', label: 'add9', intervals: [0, 4, 7, 14] },
  { id: 'madd9', label: 'm(add9)', intervals: [0, 3, 7, 14] },
  { id: 'maj9', label: 'Maj9', intervals: [0, 4, 7, 11, 14] },
  { id: 'm9', label: 'm9', intervals: [0, 3, 7, 10, 14] },
  { id: '6', label: '6', intervals: [0, 4, 7, 9] },
  { id: 'm6', label: 'm6', intervals: [0, 3, 7, 9] },
];

/** Empile des tierces dans la gamme à partir de la note donnée. */
function diatonicIntervals(rootPitch: number, keyRoot: number, scaleId: string, stack: number): number[] {
  const scale = getScale(scaleId).intervals;
  // Les gammes pentatoniques/blues ne se prêtent pas aux tierces : on retombe sur la gamme majeure/mineure.
  const base = scale.length === 7 ? scale : scale.includes(3) ? getScale('minor').intervals : getScale('major').intervals;
  const pc = (((rootPitch - keyRoot) % 12) + 12) % 12;
  const degree = base.indexOf(pc);
  if (degree < 0) {
    // Note hors gamme : accord majeur ou mineur simple.
    return stack >= 4 ? [0, 4, 7, 10] : [0, 4, 7];
  }
  const out: number[] = [];
  for (let i = 0; i < stack; i++) {
    const d = degree + i * 2;
    const octave = Math.floor(d / 7);
    out.push(base[d % 7] + octave * 12 - base[degree]);
  }
  return out;
}

export function chordIntervals(typeId: string, rootPitch: number, keyRoot: number, scaleId: string): number[] {
  const type = CHORD_TYPES.find((c) => c.id === typeId) ?? CHORD_TYPES[0];
  if (type.stack) return diatonicIntervals(rootPitch, keyRoot, scaleId, type.stack);
  return type.intervals;
}

/** Applique n renversements : la note la plus grave monte d'une octave, n fois. */
export function invert(pitches: number[], inversion: number): number[] {
  let out = [...pitches].sort((a, b) => a - b);
  const n = Math.max(0, Math.min(inversion, out.length - 1));
  for (let i = 0; i < n; i++) {
    const [low, ...rest] = out;
    out = [...rest, low + 12];
  }
  return out;
}

export function buildChord(
  rootPitch: number,
  typeId: string,
  inversion: number,
  keyRoot: number,
  scaleId: string,
): number[] {
  const pitches = chordIntervals(typeId, rootPitch, keyRoot, scaleId).map((i) => rootPitch + i);
  return invert(pitches, inversion);
}

export interface ProgressionPreset {
  id: string;
  label: string;
  /** Degrés de la gamme (0 = I). */
  degrees: number[];
  chordType: string;
  scale: 'major' | 'minor';
}

export const PROGRESSIONS: ProgressionPreset[] = [
  { id: 'pop', label: 'Pop · I–V–vi–IV', degrees: [0, 4, 5, 3], chordType: 'diatonic3', scale: 'major' },
  { id: 'sad', label: 'Mélancolique · vi–IV–I–V', degrees: [5, 3, 0, 4], chordType: 'diatonic3', scale: 'major' },
  { id: 'jazz', label: 'Jazz · ii–V–I–vi', degrees: [1, 4, 0, 5], chordType: 'diatonic7', scale: 'major' },
  { id: 'neosoul', label: 'Neo-soul · IV–iii–ii–I', degrees: [3, 2, 1, 0], chordType: 'diatonic9', scale: 'major' },
  { id: 'lofi', label: 'Lo-fi · ii–V–I–IV', degrees: [1, 4, 0, 3], chordType: 'diatonic7', scale: 'major' },
  { id: 'minor', label: 'Mineur · i–VI–III–VII', degrees: [0, 5, 2, 6], chordType: 'diatonic3', scale: 'minor' },
  { id: 'dark', label: 'Sombre · i–iv–VI–v', degrees: [0, 3, 5, 4], chordType: 'diatonic7', scale: 'minor' },
  { id: 'epic', label: 'Épique · VI–VII–i–i', degrees: [5, 6, 0, 0], chordType: 'diatonic3', scale: 'minor' },
];

/** Hauteur MIDI de la note de basse d'un degré, dans l'octave choisie. */
export function degreeRootPitch(keyRoot: number, scaleId: string, degree: number, octaveBase: number): number {
  const scale = getScale(scaleId).intervals;
  const base = scale.length === 7 ? scale : getScale(scale.includes(3) ? 'minor' : 'major').intervals;
  return octaveBase + keyRoot + base[degree % 7];
}

/**
 * Choisit pour chaque accord le renversement/octave le plus proche du précédent
 * (conduite des voix), pour obtenir des enchaînements fluides automatiquement.
 */
export function voiceLead(chords: number[][], center = 62): number[][] {
  const result: number[][] = [];
  let prev: number[] | null = null;
  for (const chord of chords) {
    const candidates: number[][] = [];
    for (let inv = 0; inv < chord.length; inv++) {
      const v = invert(chord, inv);
      for (const shift of [-24, -12, 0, 12]) candidates.push(v.map((p) => p + shift));
    }
    const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    let best = candidates[0];
    let bestScore = Infinity;
    for (const c of candidates) {
      if (c[0] < 45 || c[c.length - 1] > 84) continue;
      let score = Math.abs(avg(c) - center) * 0.6;
      if (prev) {
        const p = prev;
        score += c.reduce((s, n, i) => s + Math.abs(n - (p[i] ?? p[p.length - 1])), 0) / c.length;
      }
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    result.push(best);
    prev = best;
  }
  return result;
}

/** Reconnaît un accord à partir de hauteurs quelconques (ex. sélection de notes). */
export function detectChord(pitches: number[]): string | null {
  const pcs = [...new Set(pitches.map((p) => ((p % 12) + 12) % 12))];
  if (pcs.length < 3) return null;
  const bass = Math.min(...pitches) % 12;
  const table: [number[], string][] = [
    [[0, 4, 7], ''],
    [[0, 3, 7], 'm'],
    [[0, 3, 6], 'dim'],
    [[0, 4, 8], 'aug'],
    [[0, 2, 7], 'sus2'],
    [[0, 5, 7], 'sus4'],
    [[0, 4, 7, 11], 'maj7'],
    [[0, 3, 7, 10], 'm7'],
    [[0, 4, 7, 10], '7'],
    [[0, 3, 6, 10], 'm7b5'],
    [[0, 3, 6, 9], 'dim7'],
    [[0, 4, 7, 9], '6'],
    [[0, 3, 7, 9], 'm6'],
    [[0, 2, 4, 7], 'add9'],
    [[0, 2, 3, 7], 'm(add9)'],
    [[0, 2, 4, 7, 11], 'maj9'],
    [[0, 2, 3, 7, 10], 'm9'],
    [[0, 2, 4, 7, 10], '9'],
    [[0, 4, 11], 'maj7(no5)'],
    [[0, 3, 10], 'm7(no5)'],
    [[0, 4, 10], '7(no5)'],
    [[0, 2, 4, 11], 'maj9(no5)'],
    [[0, 2, 3, 10], 'm9(no5)'],
  ];
  // On privilégie la basse comme fondamentale, puis les autres notes.
  const roots = [bass, ...pcs.filter((p) => p !== bass)];
  for (const root of roots) {
    const rel = pcs.map((p) => (p - root + 12) % 12).sort((a, b) => a - b).join(',');
    const hit = table.find(([iv]) => iv.join(',') === rel);
    if (hit) return `${NOTE_NAMES[root]}${hit[1]}${root !== bass ? `/${NOTE_NAMES[bass]}` : ''}`;
  }
  return null;
}
