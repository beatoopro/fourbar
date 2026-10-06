import type { Note } from './types';
import { BAR, BARS, LOOP_TICKS, PPQ, clamp } from './timing';
import { uid } from './composition';

/**
 * Batterie : les coups sont des notes ordinaires dont la hauteur est le
 * numéro General MIDI de l'élément. Ce module (sans dépendance audio ni UI)
 * décrit les lignes du kit, les patterns par genre et le swing.
 */

export interface DrumLane {
  id: string;
  label: string;
  /** Note General MIDI (canal 10). */
  pitch: number;
}

/** Lignes de la grille, de l'aigu (haut) vers le grave (bas), comme dans un DAW. */
export const DRUM_LANES: DrumLane[] = [
  { id: 'crash', label: 'Crash', pitch: 49 },
  { id: 'ride', label: 'Ride', pitch: 51 },
  { id: 'open', label: 'Open hat', pitch: 46 },
  { id: 'hat', label: 'Closed hat', pitch: 42 },
  { id: 'perc', label: 'Shaker', pitch: 70 },
  { id: 'tomHi', label: 'High tom', pitch: 50 },
  { id: 'tomLo', label: 'Low tom', pitch: 45 },
  { id: 'clap', label: 'Clap', pitch: 39 },
  { id: 'snare', label: 'Snare', pitch: 38 },
  { id: 'kick', label: 'Kick', pitch: 36 },
];

export const DRUM_PITCHES = DRUM_LANES.map((l) => l.pitch);

export const laneByPitch = (pitch: number) => DRUM_LANES.find((l) => l.pitch === pitch);

/**
 * Ramène n'importe quelle note GM de batterie (import MIDI) sur l'une des
 * 10 lignes du kit. Renvoie null pour les notes sans équivalent raisonnable.
 */
export function mapDrumPitch(pitch: number): number | null {
  if (DRUM_PITCHES.includes(pitch)) return pitch;
  const table: Record<number, number> = {
    35: 36, // Acoustic bass drum
    37: 38, // Side stick
    40: 38, // Electric snare
    41: 45, 43: 45, 47: 45, // Toms graves
    48: 50, // Tom haut-medium
    44: 42, // Pedal hi-hat
    52: 49, 55: 49, 57: 49, // Chinese / splash / crash 2
    53: 51, 59: 51, // Ride bell / ride 2
    54: 70, 56: 70, 69: 70, 82: 70, // Tambourin, cowbell, cabasa, shaker
    60: 70, 61: 70, 62: 70, 63: 70, 64: 70, 75: 70, 76: 70, 77: 70, // Bongos, congas, claves, wood blocks
  };
  return table[pitch] ?? null;
}

/* ---------------------------------------------------------------------------
 * Swing
 * ------------------------------------------------------------------------- */

/** Décalage maximal d'une double-croche « faible » : 12 ticks = swing 75 % façon MPC. */
const MAX_SWING_TICKS = PPQ / 8;
const EIGHTH = PPQ / 2;
const SIXTEENTH = PPQ / 4;

/**
 * Applique le swing à une position : à l'intérieur de chaque croche, la
 * seconde double-croche est retardée et tout ce qui est entre les deux est
 * étiré proportionnellement (les roulements et les triolets suivent donc le
 * groove sans se chevaucher). Les temps et les croches ne bougent pas.
 */
export function swingTick(tick: number, swing: number | undefined): number {
  const s = clamp(swing ?? 0, 0, 1);
  if (s === 0) return tick;
  const d = s * MAX_SWING_TICKS;
  const base = Math.floor(tick / EIGHTH) * EIGHTH;
  const t = tick - base;
  const warped = t <= SIXTEENTH ? (t * (SIXTEENTH + d)) / SIXTEENTH : SIXTEENTH + d + ((t - SIXTEENTH) * (SIXTEENTH - d)) / SIXTEENTH;
  return base + warped;
}

/** Position et durée d'une note après swing (les fins de notes suivent aussi). */
export function swingNote(start: number, duration: number, swing: number | undefined): { start: number; duration: number } {
  if (!swing) return { start, duration };
  const s = swingTick(start, swing);
  const e = swingTick(start + duration, swing);
  return { start: s, duration: Math.max(1, e - s) };
}

/** Affichage façon boîte à rythmes : 0 → 50 %, 1 → 75 %. */
export const swingLabel = (swing: number) => `${Math.round(50 + clamp(swing, 0, 1) * 25)}%`;

/* ---------------------------------------------------------------------------
 * Patterns
 * ------------------------------------------------------------------------- */

/**
 * Notation compacte d'une mesure, une chaîne par ligne. Sa longueur fixe la
 * grille : 16 = doubles-croches, 12 = triolets de croches, 24 = triolets de
 * doubles-croches, 32 = triples-croches.
 *   X accent · x normal · o doux · g ghost note · . silence
 *   2 3 4 : roulement de 2, 3 ou 4 coups dans la case (hi-hats trap)
 */
type BarSpec = Partial<Record<DrumLane['id'], string>>;

export interface DrumPattern {
  id: string;
  label: string;
  genre: string;
  kit: string;
  swing: number;
  /** 1, 2 ou 4 mesures, répétées sur la boucle. */
  bars: BarSpec[];
  /** Variation de la mesure 4 (break), optionnelle. */
  fill?: BarSpec;
}

const VEL: Record<string, number> = { X: 1, x: 0.8, o: 0.58, g: 0.32 };

export const DRUM_PATTERNS: DrumPattern[] = [
  {
    id: 'basic',
    label: 'Basic · Starter',
    genre: 'Pop',
    kit: 'kit-dusty',
    swing: 0,
    bars: [{ kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' }],
    fill: { kick: 'x.......x.......', snare: '....x.......xoxX', hat: 'x.o.x.o.x.o.....' },
  },
  {
    id: 'pop',
    label: 'Pop · Radio',
    genre: 'Pop',
    kit: 'kit-house',
    swing: 0,
    bars: [
      { crash: 'x...............', kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' },
      { kick: 'x.......x.x...o.', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' },
    ],
    fill: { kick: 'x.......x.......', snare: '....x...........', tomHi: '........xo......', tomLo: '..........xoxo..', hat: 'x.o.x.o.' },
  },
  {
    id: 'lofi',
    label: 'Lo-fi · Lazy',
    genre: 'Lo-fi',
    kit: 'kit-dusty',
    swing: 0.6,
    bars: [{ kick: 'x.....o...x.....', snare: '....x.......x..g', hat: 'o.g.o.g.o.g.o.g.', perc: '......o.......o.' }],
    fill: { kick: 'x.....o...x.x...', snare: '....x.....g.x.og', hat: 'o.g.o.g.o.g.o.g.', open: '..............o.' },
  },
  {
    id: 'boombap',
    label: 'Boom bap · Classic',
    genre: 'Hip-hop',
    kit: 'kit-dusty',
    swing: 0.45,
    bars: [
      { kick: 'x......x..x.....', snare: '....X.......X...', hat: 'x.o.x.o.x.o.x.o.' },
      { kick: 'x......x..x..o..', snare: '....X.......X...', hat: 'x.o.x.o.x.o.x...', open: '..............o.' },
    ],
    fill: { kick: 'x......x..x.....', snare: '....X.......X.oX', hat: 'x.o.x.o.x.o.....' },
  },
  {
    id: 'trap',
    label: 'Trap · Hi-hat rolls',
    genre: 'Trap',
    kit: 'kit-808',
    swing: 0,
    bars: [
      { kick: 'x......x..x.....', clap: '........X.......', hat: 'x.o.x.o.x.o.3.o.' },
      { kick: 'x.....x...x..x..', clap: '........X.......', hat: 'x.o.x.o.x.o.x.44' },
    ],
    fill: { kick: 'x.....x.........', clap: '........X.....oX', hat: 'x.o.x.o.4.4.3333', open: '......o.........' },
  },
  {
    id: 'trap-triplets',
    label: 'Trap · Triplets',
    genre: 'Trap',
    kit: 'kit-808',
    swing: 0,
    bars: [
      { kick: 'x.........x.....', clap: '........X.......', hat: 'x.ox.ox.ox.oxooxooxooxoo' },
      { kick: 'x......x..x.....', clap: '........X.......', hat: 'x.o.x.o.x.o.x.o.' },
    ],
    fill: { kick: 'x.........x.....', clap: '........X...o.X.', hat: 'xooxooxooxooxxxxxxxxxxxx' },
  },
  {
    id: 'house',
    label: 'House · Four on the floor',
    genre: 'House',
    kit: 'kit-house',
    swing: 0.15,
    bars: [{ kick: 'x...x...x...x...', clap: '....x.......x...', open: '..x...x...x...x.', hat: 'o..o...o...o...o' }],
    fill: { kick: 'x...x...x...x...', clap: '....x.......x.xx', open: '..x...x...x.....', snare: '........o.o.xoxX' },
  },
  {
    id: 'deep-house',
    label: 'Deep house · Shaker',
    genre: 'House',
    kit: 'kit-house',
    swing: 0.35,
    bars: [{ kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', perc: 'oggoggoggoggoggo' }],
  },
  {
    id: 'rnb',
    label: 'R&B · Slow jam',
    genre: 'R&B',
    kit: 'kit-808',
    swing: 0.35,
    bars: [
      { kick: 'x......x.x......', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.3.', perc: '..........o.....' },
      { kick: 'x......x..x...o.', snare: '....x.......x...', hat: 'x.o.x.o.x.o.x.o.' },
    ],
  },
  {
    id: 'neosoul',
    label: 'Neo-soul · Ghost notes',
    genre: 'Neo-soul',
    kit: 'kit-dusty',
    swing: 0.55,
    bars: [{ kick: 'x......o..x.....', snare: '..g.x..g.g..x.g.', hat: 'x.o.x.o.x.o.x.o.' }],
    fill: { kick: 'x......o..x.....', snare: '..g.x..g.g..xgxX', hat: 'x.o.x.o.x.o.....' },
  },
  {
    id: 'jazz',
    label: 'Jazz · Ride swing',
    genre: 'Jazz',
    kit: 'kit-dusty',
    swing: 0,
    bars: [{ ride: 'x..x.ox..x.o', hat: '...x.....x..', kick: 'g..g..g..g..', snare: '.....g....g.' }],
    fill: { ride: 'x..x.ox..x.o', hat: '...x.....x..', kick: 'g..g..g..g..', snare: '..g..gx.gxoX' },
  },
  {
    id: 'dembow',
    label: 'Reggaeton · Dembow',
    genre: 'Pop',
    kit: 'kit-808',
    swing: 0,
    bars: [{ kick: 'x...x...x...x...', snare: '...x..x....x..x.', hat: 'x.o.x.o.x.o.x.o.' }],
  },
  {
    id: 'cinematic',
    label: 'Cinematic · Toms',
    genre: 'Cinematic',
    kit: 'kit-house',
    swing: 0,
    bars: [
      { crash: 'x...............', kick: 'x.......x.......', tomLo: 'x..o..x...o..o..', tomHi: '......o.......o.' },
      { kick: 'x.......x.......', tomLo: 'x..o..x...o..o..', tomHi: '......o.......o.' },
    ],
    fill: { kick: 'x.......x.......', tomLo: 'x..o..x.xoxoxoxo', tomHi: '......o.xoxoxoxo', snare: '............oxxX' },
  },
];

export const getDrumPattern = (id: string) => DRUM_PATTERNS.find((p) => p.id === id);

/** Pattern conseillé pour un genre (données de démo, brouillon de départ). */
export function patternForGenre(genre: string, variant = 0): DrumPattern {
  const list = DRUM_PATTERNS.filter((p) => p.genre === genre && p.id !== 'basic');
  if (!list.length) return DRUM_PATTERNS[0];
  return list[variant % list.length];
}

function barNotes(spec: BarSpec, offset: number): Note[] {
  const out: Note[] = [];
  for (const lane of DRUM_LANES) {
    const str = spec[lane.id];
    if (!str) continue;
    const step = BAR / str.length;
    [...str].forEach((ch, i) => {
      if (ch === '.') return;
      const start = offset + i * step;
      const roll = Number(ch);
      if (roll >= 2 && roll <= 4) {
        const sub = step / roll;
        for (let k = 0; k < roll; k++)
          out.push({ id: uid(), pitch: lane.pitch, start: Math.round(start + k * sub), duration: Math.max(1, Math.round(sub)), velocity: 0.62 + (k === 0 ? 0.12 : 0) });
      } else {
        out.push({ id: uid(), pitch: lane.pitch, start: Math.round(start), duration: Math.round(Math.min(step, PPQ / 4)), velocity: VEL[ch] ?? 0.8 });
      }
    });
  }
  return out;
}

/** Les 4 mesures d'un pattern, avec ou sans break en mesure 4. */
export function buildPatternNotes(p: DrumPattern, withFill: boolean): Note[] {
  const notes: Note[] = [];
  for (let bar = 0; bar < BARS; bar++) {
    const spec = withFill && p.fill && bar === BARS - 1 ? p.fill : p.bars[bar % p.bars.length];
    notes.push(...barNotes(spec, bar * BAR));
  }
  return notes;
}

/* ---------------------------------------------------------------------------
 * Outils d'édition (fonctions pures, utilisées par le store)
 * ------------------------------------------------------------------------- */

/** Remplace les mesures 2 à 4 par des copies de la mesure 1. */
export function repeatFirstBar(notes: Note[]): Note[] {
  const first = notes.filter((n) => n.start < BAR);
  const copies: Note[] = [];
  for (let bar = 1; bar < BARS; bar++) for (const n of first) copies.push({ ...n, id: uid(), start: n.start + bar * BAR });
  return [...first, ...copies];
}

/** Remplit une ligne à intervalle régulier (remplace ses coups existants). */
export function fillLane(notes: Note[], pitch: number, every: number, velocity: number): Note[] {
  const rest = notes.filter((n) => n.pitch !== pitch);
  const created: Note[] = [];
  for (let t = 0; t < LOOP_TICKS; t += every)
    created.push({ id: uid(), pitch, start: t, duration: Math.min(every, PPQ / 4), velocity: (t / every) % 2 ? velocity * 0.75 : velocity });
  return [...rest, ...created];
}

/**
 * Découpe un coup en roulement : 1 → 2 → 3 → 4 → 1 coup(s) dans la case.
 * `cellStart`/`cellLen` délimitent la case de la grille.
 */
export function cycleRoll(notes: Note[], pitch: number, cellStart: number, cellLen: number): Note[] {
  const inCell = notes.filter((n) => n.pitch === pitch && n.start >= cellStart && n.start < cellStart + cellLen);
  if (!inCell.length) return notes;
  const count = inCell.length >= 4 ? 1 : inCell.length + 1;
  const vel = Math.max(...inCell.map((n) => n.velocity));
  const rest = notes.filter((n) => !inCell.includes(n));
  const sub = cellLen / count;
  const created: Note[] = Array.from({ length: count }, (_, k) => ({
    id: uid(),
    pitch,
    start: Math.round(cellStart + k * sub),
    duration: Math.max(1, Math.round(sub)),
    velocity: k === 0 ? vel : clamp(vel * 0.82, 0.05, 1),
  }));
  return [...rest, ...created];
}

/** Petites variations de force et de placement, pour un jeu moins mécanique. */
export function humanizeNotes(notes: Note[], ids: Set<string> | null, rand: () => number = Math.random): Note[] {
  return notes.map((n) => {
    if (ids && !ids.has(n.id)) return n;
    const velocity = clamp(n.velocity * (1 + (rand() - 0.5) * 0.16), 0.05, 1);
    const start = clamp(Math.round(n.start + (rand() - 0.5) * 6), 0, LOOP_TICKS - 1);
    return { ...n, velocity, start, duration: Math.min(n.duration, LOOP_TICKS - start) };
  });
}
