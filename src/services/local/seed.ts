import type { Composition, Note } from '../../core/types';
import type { Publication, User } from '../types';
import { createComposition, uid } from '../../core/composition';
import { BAR, PPQ } from '../../core/timing';
import { chordIntervals, degreeRootPitch, getScale, voiceLead } from '../../core/theory';
import { buildPatternNotes, getDrumPattern, patternForGenre, humanizeNotes } from '../../core/drums';

/**
 * Données de démonstration : profils fictifs et compositions générées
 * de façon déterministe (même résultat à chaque premier lancement).
 */

export const ME_ID = 'me';

export const SEED_USERS: User[] = [
  { id: 'u_lina', name: 'Lina Moreau', handle: 'linabeats', bio: 'Lo-fi & jazz chords au réveil.', color: '#a78bfa', joinedAt: '2026-03-02' },
  { id: 'u_kenji', name: 'Kenji Arata', handle: 'kenji.wav', bio: 'House, garage, et tout ce qui fait bouger la tête.', color: '#5eead4', joinedAt: '2026-01-15' },
  { id: 'u_nora', name: 'Nora Vale', handle: 'noravale', bio: 'Compositrice à l’image. Cordes et nappes.', color: '#f0abfc', joinedAt: '2026-02-20' },
  { id: 'u_malik', name: 'Malik D.', handle: 'malikprod', bio: 'Trap / drill. 808 d’abord, questions ensuite.', color: '#fbbf24', joinedAt: '2026-04-11' },
  { id: 'u_sacha', name: 'Sacha Lenoir', handle: 'sachakeys', bio: 'Claviériste neo-soul. Voicings > tout.', color: '#93c5fd', joinedAt: '2025-12-08' },
  { id: 'u_ama', name: 'Ama Owusu', handle: 'amamusic', bio: 'R&B, pop et mélodies qui restent en tête.', color: '#fda4af', joinedAt: '2026-05-23' },
  { id: 'u_elio', name: 'Elio Brun', handle: 'elio', bio: 'Étudiant en jazz, je partage mes II-V-I.', color: '#86efac', joinedAt: '2026-06-30' },
  { id: 'u_jade', name: 'Jade Kim', handle: 'jadeloops', bio: 'Boom bap et samples imaginaires.', color: '#fdba74', joinedAt: '2026-07-14' },
];

export const DEFAULT_ME: User = {
  id: ME_ID,
  name: 'Vous',
  handle: 'vous',
  bio: 'Mes boucles sur 4Chords.',
  color: '#8b5cf6',
  joinedAt: new Date().toISOString().slice(0, 10),
};

// Générateur pseudo-aléatoire déterministe (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ChordStyle = 'sustain' | 'stabs' | 'offbeat' | 'push' | 'arp' | 'halfbar';
type BassStyle = 'root' | 'octave' | 'walking' | '808' | 'syncop' | 'none';

interface Spec {
  title: string;
  author: string;
  genre: string;
  moods: string[];
  bpm: number;
  root: number;
  scale: 'major' | 'minor' | 'dorian';
  degrees: number[];
  chordType: string;
  chordStyle: ChordStyle;
  bassStyle: BassStyle;
  melody: 0 | 1 | 2 | 3; // densité
  likes: number;
  daysAgo: number;
  chordInstrument?: string;
  melodyInstrument?: string;
  bassInstrument?: string;
}

const SPECS: Spec[] = [
  { title: 'Café du matin', author: 'u_lina', genre: 'Lo-fi', moods: ['Chill', 'Rêveur'], bpm: 78, root: 5, scale: 'major', degrees: [1, 4, 0, 3], chordType: 'diatonic7', chordStyle: 'push', bassStyle: 'root', melody: 1, likes: 214, daysAgo: 2 },
  { title: 'Late Night Tokyo', author: 'u_kenji', genre: 'House', moods: ['Énergique', 'Rêveur'], bpm: 124, root: 9, scale: 'minor', degrees: [0, 5, 2, 6], chordType: 'diatonic7', chordStyle: 'offbeat', bassStyle: 'octave', melody: 1, likes: 182, daysAgo: 1, chordInstrument: 'organ' },
  { title: 'Ombres', author: 'u_nora', genre: 'Cinematic', moods: ['Sombre', 'Épique'], bpm: 88, root: 2, scale: 'minor', degrees: [0, 5, 6, 0], chordType: 'diatonic3', chordStyle: 'arp', bassStyle: 'root', melody: 1, likes: 156, daysAgo: 5, chordInstrument: 'pad', melodyInstrument: 'bell' },
  { title: 'Crown', author: 'u_malik', genre: 'Trap', moods: ['Sombre', 'Énergique'], bpm: 142, root: 1, scale: 'minor', degrees: [0, 3, 5, 4], chordType: 'diatonic3', chordStyle: 'halfbar', bassStyle: '808', melody: 2, likes: 301, daysAgo: 3, chordInstrument: 'pad', melodyInstrument: 'bell' },
  { title: 'Velours', author: 'u_sacha', genre: 'Neo-soul', moods: ['Romantique', 'Chill'], bpm: 74, root: 3, scale: 'major', degrees: [3, 2, 1, 0], chordType: 'diatonic9', chordStyle: 'push', bassStyle: 'syncop', melody: 1, likes: 266, daysAgo: 4 },
  { title: 'Golden Hour', author: 'u_ama', genre: 'R&B', moods: ['Romantique', 'Rêveur'], bpm: 68, root: 8, scale: 'major', degrees: [3, 4, 2, 5], chordType: 'diatonic7', chordStyle: 'sustain', bassStyle: 'syncop', melody: 2, likes: 198, daysAgo: 6 },
  { title: 'Autumn II-V', author: 'u_elio', genre: 'Jazz', moods: ['Mélancolique', 'Chill'], bpm: 118, root: 10, scale: 'major', degrees: [1, 4, 0, 5], chordType: 'diatonic7', chordStyle: 'stabs', bassStyle: 'walking', melody: 2, likes: 143, daysAgo: 8 },
  { title: 'Dusty Tape', author: 'u_jade', genre: 'Hip-hop', moods: ['Chill', 'Mélancolique'], bpm: 88, root: 4, scale: 'minor', degrees: [0, 3, 5, 4], chordType: 'diatonic7', chordStyle: 'stabs', bassStyle: 'syncop', melody: 1, likes: 175, daysAgo: 2 },
  { title: 'Summer Radio', author: 'u_ama', genre: 'Pop', moods: ['Joyeux', 'Énergique'], bpm: 112, root: 7, scale: 'major', degrees: [0, 4, 5, 3], chordType: 'diatonic3', chordStyle: 'offbeat', bassStyle: 'octave', melody: 3, likes: 240, daysAgo: 1, melodyInstrument: 'lead' },
  { title: 'Pluie fine', author: 'u_lina', genre: 'Lo-fi', moods: ['Mélancolique', 'Chill'], bpm: 72, root: 2, scale: 'dorian', degrees: [0, 3, 0, 4], chordType: 'diatonic7', chordStyle: 'sustain', bassStyle: 'root', melody: 1, likes: 121, daysAgo: 12, chordInstrument: 'keys' },
  { title: 'Warehouse 6AM', author: 'u_kenji', genre: 'House', moods: ['Énergique'], bpm: 126, root: 0, scale: 'minor', degrees: [0, 0, 5, 6], chordType: 'diatonic7', chordStyle: 'offbeat', bassStyle: 'octave', melody: 0, likes: 97, daysAgo: 15, bassInstrument: 'analog' },
  { title: 'Northern Lights', author: 'u_nora', genre: 'Cinematic', moods: ['Épique', 'Rêveur'], bpm: 80, root: 0, scale: 'major', degrees: [5, 3, 0, 4], chordType: 'diatonic3', chordStyle: 'sustain', bassStyle: 'root', melody: 1, likes: 188, daysAgo: 9, chordInstrument: 'pad', melodyInstrument: 'bell' },
  { title: 'Midnight Drill', author: 'u_malik', genre: 'Trap', moods: ['Sombre'], bpm: 144, root: 6, scale: 'minor', degrees: [0, 5, 3, 4], chordType: 'diatonic3', chordStyle: 'halfbar', bassStyle: '808', melody: 2, likes: 156, daysAgo: 7, melodyInstrument: 'pluck' },
  { title: 'Sunday Service', author: 'u_sacha', genre: 'Neo-soul', moods: ['Joyeux', 'Romantique'], bpm: 82, root: 5, scale: 'major', degrees: [3, 4, 2, 5], chordType: 'diatonic9', chordStyle: 'push', bassStyle: 'syncop', melody: 2, likes: 209, daysAgo: 11, chordInstrument: 'organ' },
  { title: 'Blue Monday Waltz… en 4/4', author: 'u_elio', genre: 'Jazz', moods: ['Chill', 'Joyeux'], bpm: 132, root: 0, scale: 'major', degrees: [0, 5, 1, 4], chordType: 'diatonic7', chordStyle: 'stabs', bassStyle: 'walking', melody: 2, likes: 88, daysAgo: 20 },
  { title: 'Concrete', author: 'u_jade', genre: 'Hip-hop', moods: ['Sombre', 'Énergique'], bpm: 92, root: 9, scale: 'minor', degrees: [0, 6, 5, 6], chordType: 'diatonic3', chordStyle: 'stabs', bassStyle: 'syncop', melody: 1, likes: 132, daysAgo: 10, bassInstrument: 'round' },
  { title: 'Slow Dance', author: 'u_ama', genre: 'R&B', moods: ['Romantique', 'Mélancolique'], bpm: 64, root: 1, scale: 'major', degrees: [5, 3, 0, 4], chordType: 'diatonic9', chordStyle: 'sustain', bassStyle: 'syncop', melody: 1, likes: 167, daysAgo: 14 },
  { title: 'Bright Side', author: 'u_kenji', genre: 'Pop', moods: ['Joyeux'], bpm: 118, root: 2, scale: 'major', degrees: [0, 3, 5, 4], chordType: 'diatonic3', chordStyle: 'offbeat', bassStyle: 'octave', melody: 3, likes: 110, daysAgo: 18, melodyInstrument: 'lead' },
  { title: 'Lettre à Paris', author: 'u_nora', genre: 'Cinematic', moods: ['Mélancolique', 'Romantique'], bpm: 70, root: 4, scale: 'minor', degrees: [0, 5, 3, 4], chordType: 'diatonic3', chordStyle: 'arp', bassStyle: 'root', melody: 1, likes: 145, daysAgo: 22, chordInstrument: 'keys' },
  { title: 'Study Session', author: 'u_lina', genre: 'Lo-fi', moods: ['Chill', 'Rêveur'], bpm: 84, root: 7, scale: 'major', degrees: [3, 2, 1, 4], chordType: 'diatonic9', chordStyle: 'push', bassStyle: 'root', melody: 2, likes: 260, daysAgo: 25 },
  { title: 'Neon Smoke', author: 'u_malik', genre: 'Hip-hop', moods: ['Sombre', 'Chill'], bpm: 86, root: 11, scale: 'minor', degrees: [0, 3, 0, 5], chordType: 'diatonic7', chordStyle: 'halfbar', bassStyle: '808', melody: 1, likes: 76, daysAgo: 28 },
  { title: 'Ascension', author: 'u_sacha', genre: 'Neo-soul', moods: ['Rêveur', 'Épique'], bpm: 90, root: 10, scale: 'dorian', degrees: [0, 3, 4, 3], chordType: 'diatonic9', chordStyle: 'sustain', bassStyle: 'syncop', melody: 2, likes: 59, daysAgo: 30, chordInstrument: 'pad' },
];

const CHORD_RHYTHMS: Record<Exclude<ChordStyle, 'arp'>, [number, number][]> = {
  sustain: [[0, BAR - 8]],
  stabs: [[0, 132], [228, 60], [288, 84]],
  offbeat: [[48, 36], [144, 36], [240, 36], [336, 36]],
  push: [[0, 168], [180, 12], [216, 156]],
  halfbar: [[0, 180], [192, 180]],
};

const MELODY_RHYTHMS: [number, number][][] = [
  [],
  [[0, 72], [96, 48], [192, 144]],
  [[0, 48], [48, 48], [144, 72], [240, 48], [288, 96]],
  [[0, 24], [48, 48], [96, 24], [144, 48], [192, 72], [288, 24], [336, 48]],
];

function buildComposition(spec: Spec, index: number): Composition {
  const rand = rng(1000 + index * 97);
  const scaleId = spec.scale;
  const comp = createComposition(spec.author, {
    id: `seed_${index + 1}`,
    title: spec.title,
    genres: [spec.genre],
    moods: spec.moods,
    bpm: spec.bpm,
    key: { root: spec.root, scale: scaleId },
  });
  if (spec.chordInstrument) comp.tracks.chords.instrument = spec.chordInstrument;
  if (spec.melodyInstrument) comp.tracks.melody.instrument = spec.melodyInstrument;
  if (spec.bassInstrument) comp.tracks.bass.instrument = spec.bassInstrument;
  if (spec.bassStyle === '808') comp.tracks.bass.instrument = 'sub';

  const roots = spec.degrees.map((d) => degreeRootPitch(spec.root, scaleId, d, 48));
  const chords = voiceLead(
    roots.map((r) => chordIntervals(spec.chordType, r, spec.root, scaleId).map((i) => r + i)),
    spec.chordStyle === 'arp' ? 64 : 62,
  );
  const vel = (base: number) => Math.min(1, Math.max(0.2, base + (rand() - 0.5) * 0.14));
  const add = (arr: Note[], pitch: number, start: number, duration: number, velocity: number) =>
    arr.push({ id: uid(), pitch, start, duration, velocity });

  // Accords
  const cn: Note[] = [];
  chords.forEach((chord, bar) => {
    const off = bar * BAR;
    if (spec.chordStyle === 'arp') {
      const seq = [...chord, chord[1] + 12, ...chord.slice().reverse()];
      for (let i = 0; i < 8; i++) add(cn, seq[i % seq.length], off + i * 48, 46, vel(i % 2 ? 0.55 : 0.7));
    } else {
      for (const [s, d] of CHORD_RHYTHMS[spec.chordStyle]) chord.forEach((p) => add(cn, p, off + s, d, vel(0.68)));
    }
  });
  comp.tracks.chords.notes = cn;

  // Basse
  const bn: Note[] = [];
  const bassBase = (r: number) => (r % 12) + (spec.bassStyle === '808' ? 24 : 36);
  roots.forEach((r, bar) => {
    const off = bar * BAR;
    const b = bassBase(r);
    const next = bassBase(roots[(bar + 1) % roots.length]);
    switch (spec.bassStyle) {
      case 'root':
        add(bn, b, off, 168, vel(0.8));
        add(bn, b, off + 192, 168, vel(0.7));
        break;
      case 'octave':
        for (let i = 0; i < 4; i++) add(bn, i % 2 ? b + 12 : b, off + i * 96 + 48, 40, vel(0.78));
        break;
      case 'walking': {
        const scale = getScale(scaleId).intervals;
        const fifth = b + 7;
        const passing = b + scale[2];
        const approach = next + (rand() > 0.5 ? 1 : -1);
        [b, passing, fifth, approach].forEach((p, i) => add(bn, p, off + i * 96, 88, vel(i === 0 ? 0.82 : 0.7)));
        break;
      }
      case '808':
        add(bn, b, off, 270, vel(0.9));
        add(bn, b, off + 288, 48, vel(0.75));
        add(bn, b + 12, off + 336, 40, vel(0.7));
        break;
      case 'syncop':
        add(bn, b, off, 132, vel(0.82));
        add(bn, b, off + 144, 36, vel(0.6));
        add(bn, b + 7, off + 216, 60, vel(0.7));
        add(bn, b, off + 288, 84, vel(0.72));
        break;
      default:
        break;
    }
  });
  comp.tracks.bass.notes = bn;

  // Mélodie : notes d'accord sur les temps forts, gamme ailleurs, mouvement conjoint.
  const mn: Note[] = [];
  const rhythm = MELODY_RHYTHMS[spec.melody];
  const scaleNotes: number[] = [];
  for (let p = 60; p <= 86; p++) if (getScale(scaleId).intervals.includes((p - spec.root + 120) % 12)) scaleNotes.push(p);
  let idx = Math.floor(scaleNotes.length / 2);
  chords.forEach((chord, bar) => {
    const off = bar * BAR;
    const chordPcs = chord.map((p) => p % 12);
    rhythm.forEach(([s, d], i) => {
      if (i > 0 && rand() < 0.18) return;
      idx = Math.max(2, Math.min(scaleNotes.length - 3, idx + Math.round((rand() - 0.5) * 4)));
      let pitch = scaleNotes[idx];
      if (s % 96 === 0) {
        // Temps fort : on aimante vers la note d'accord la plus proche.
        for (const k of [0, -1, 1, -2, 2, -3, 3]) {
          const c = scaleNotes[idx + k];
          if (c !== undefined && chordPcs.includes(c % 12)) {
            pitch = c;
            break;
          }
        }
        idx = scaleNotes.indexOf(pitch);
      }
      add(mn, pitch, off + s, d, vel(s % 96 === 0 ? 0.78 : 0.62));
    });
  });
  comp.tracks.melody.notes = mn;

  applyDrums(comp, spec.genre, index, rand);

  const date = new Date(Date.now() - spec.daysAgo * 86400000 - index * 3600000).toISOString();
  comp.createdAt = date;
  comp.updatedAt = date;
  return comp;
}

/** Batterie de démo : un pattern du genre, légèrement humanisé (déterministe). */
function applyDrums(comp: Composition, genre: string, variant: number, rand: () => number) {
  const p = patternForGenre(genre, variant);
  comp.tracks.drums.instrument = p.kit;
  comp.tracks.drums.notes = humanizeNotes(buildPatternNotes(p, variant % 2 === 0), null, rand);
  comp.swing = p.swing;
}

export function buildSeedPublications(): Publication[] {
  const pubs = SPECS.map((spec, i) => {
    const composition = buildComposition(spec, i);
    return {
      id: composition.id,
      composition,
      authorId: spec.author,
      likes: spec.likes,
      plays: spec.likes * 6 + ((i * 37) % 200),
      publishedAt: composition.createdAt,
      commentCount: 0,
    };
  });

  // Quelques remixes de démonstration pour illustrer la fonctionnalité.
  const remix = (sourceIdx: number, author: string, title: string, patch: (c: Composition) => void, likes: number, daysAgo: number) => {
    const src = pubs[sourceIdx].composition;
    const c: Composition = JSON.parse(JSON.stringify(src));
    c.id = `seed_remix_${sourceIdx}_${author}`;
    c.authorId = author;
    c.title = title;
    c.remixOf = src.id;
    patch(c);
    if (c.genres[0] !== src.genres[0]) applyDrums(c, c.genres[0], sourceIdx + 1, rng(sourceIdx * 31 + likes));
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
    c.createdAt = date;
    c.updatedAt = date;
    pubs.push({ id: c.id, composition: c, authorId: author, likes, plays: likes * 5, publishedAt: date, commentCount: 0 });
  };
  remix(0, 'u_jade', 'Café du matin (boom bap flip)', (c) => {
    c.bpm = 90;
    c.genres = ['Hip-hop'];
    c.tracks.bass.instrument = 'round';
  }, 64, 1);
  remix(4, 'u_ama', 'Velours (slow jam)', (c) => {
    c.bpm = 66;
    c.genres = ['R&B'];
    c.tracks.chords.instrument = 'pad';
  }, 41, 2);
  remix(3, 'u_kenji', 'Crown (house edit)', (c) => {
    c.bpm = 124;
    c.genres = ['House'];
    c.tracks.chords.instrument = 'organ';
    c.tracks.bass.instrument = 'analog';
  }, 52, 3);
  remix(0, 'u_elio', 'Café du matin, version trio', (c) => {
    c.genres = ['Jazz'];
    c.bpm = 112;
  }, 23, 4);
  return pubs;
}

/** Quelques favoris et publications pour que « Mon profil » ne soit pas vide au premier lancement. */
export const SEED_LIKED = ['seed_1', 'seed_5', 'seed_7'];

export function buildStarterDraft(): Composition {
  const c = createComposition(ME_ID, { title: '', bpm: 90, key: { root: 0, scale: 'major' } });
  // Brouillon de départ : une progression simple pour entendre quelque chose tout de suite.
  const roots = [0, 4, 5, 3].map((d) => degreeRootPitch(0, 'major', d, 48));
  const chords = voiceLead(roots.map((r) => chordIntervals('diatonic3', r, 0, 'major').map((i) => r + i)));
  chords.forEach((ch, bar) =>
    ch.forEach((p) => c.tracks.chords.notes.push({ id: uid(), pitch: p, start: bar * BAR, duration: BAR - PPQ / 4, velocity: 0.72 })),
  );
  roots.forEach((r, bar) =>
    c.tracks.bass.notes.push({ id: uid(), pitch: (r % 12) + 36, start: bar * BAR, duration: BAR - PPQ / 2, velocity: 0.8 }),
  );
  // Et un rythme simple, pour entendre la batterie dès la première lecture.
  const basic = getDrumPattern('basic')!;
  c.tracks.drums.instrument = basic.kit;
  c.tracks.drums.notes = buildPatternNotes(basic, true);
  return c;
}
