import { detectChord, getScale, NOTE_NAMES } from './theory';
import { BAR, BARS, PPQ } from './timing';
import { TRACK_IDS, type Composition, type KeySignature, type TrackId } from './types';

/**
 * Recherche avancée : filtres purs sur une composition (sans dépendance à l'API),
 * réutilisables par un futur backend, et (dé)sérialisation dans l'URL d'Explore.
 */

export type TrackRule = 'with' | 'without';
export type KeyMode = 'major' | 'minor';
export type DateRange = 'day' | 'week' | 'month';
export type Origin = 'original' | 'remix';

export interface AdvancedFilters {
  bpmMin?: number;
  bpmMax?: number;
  /** 0 = C ... 11 = B */
  keyRoot?: number;
  keyMode?: KeyMode;
  /** Accepte aussi la tonalité relative (C majeur ↔ A mineur). */
  relativeKey?: boolean;
  /** Nom ou @handle de l'artiste (appliqué par l'API, qui connaît les utilisateurs). */
  artist?: string;
  date?: DateRange;
  tracks?: Partial<Record<TrackId, TrackRule>>;
  instrument?: string;
  /** Progression en chiffres romains (« ii-V-I ») ou en accords (« Am F C G »). */
  progression?: string;
  origin?: Origin;
}

export const DATE_RANGES: { id: DateRange; label: string; days: number }[] = [
  { id: 'day', label: 'Last 24 hours', days: 1 },
  { id: 'week', label: 'This week', days: 7 },
  { id: 'month', label: 'This month', days: 30 },
];

/* ---------- Tonalité ---------- */

const MAJOR_FAMILY = ['major', 'lydian', 'mixolydian', 'pentatonic-major'];

/** Couleur majeure ou mineure d'une gamme (les modes sont rattachés à la plus proche). */
export function keyFamily(scaleId: string): KeyMode {
  return MAJOR_FAMILY.includes(scaleId) ? 'major' : 'minor';
}

export function matchesKey(key: KeySignature, f: Pick<AdvancedFilters, 'keyRoot' | 'keyMode' | 'relativeKey'>): boolean {
  if (f.keyRoot === undefined && !f.keyMode) return true;
  const family = keyFamily(key.scale);
  const direct = (f.keyRoot === undefined || key.root === f.keyRoot) && (!f.keyMode || family === f.keyMode);
  if (direct || !f.relativeKey || f.keyRoot === undefined) return direct;
  // Relative : C majeur ↔ A mineur (3 demi-tons sous la tonique majeure).
  const relMinor = key.root === (f.keyRoot + 9) % 12 && family === 'minor';
  const relMajor = key.root === (f.keyRoot + 3) % 12 && family === 'major';
  if (f.keyMode === 'major') return relMinor;
  if (f.keyMode === 'minor') return relMajor;
  return relMinor || relMajor;
}

/* ---------- Progression d'accords ---------- */

type Quality = 'maj' | 'min' | 'dim' | 'aug' | 'sus';

export interface DetectedChord {
  /** Classe de hauteur de la fondamentale (0 = C). */
  root: number;
  quality: Quality;
  name: string;
}

function qualityOf(suffix: string): Quality {
  if (/^(dim|°|o|ø|m7b5|m7-5)/.test(suffix)) return 'dim';
  if (/^(aug|\+)/.test(suffix)) return 'aug';
  if (/^sus/.test(suffix)) return 'sus';
  if (/^(m(?!aj)|min|-)/.test(suffix)) return 'min';
  return 'maj';
}

function parseChordName(name: string): DetectedChord | null {
  const m = /^([A-Ga-g])([#b♯♭]?)([^/]*)/.exec(name);
  if (!m) return null;
  let root = NOTE_NAMES.indexOf(m[1].toUpperCase());
  if (m[2] === '#' || m[2] === '♯') root += 1;
  if (m[2] === 'b' || m[2] === '♭') root -= 1;
  return { root: (root + 12) % 12, quality: qualityOf(m[3]), name };
}

/**
 * Accords de la piste Chords, dans l'ordre, sans répétitions consécutives
 * (la boucle étant cyclique, un dernier accord égal au premier est fusionné).
 * Analyse temps par temps, puis demi-mesure et mesure entière quand un temps
 * seul ne suffit pas (arpèges, accords brisés). La note de la piste Bass jouée
 * en début de demi-mesure sert à choisir la fondamentale (Gm7 plutôt que Bb6).
 */
export function chordProgression(comp: Composition): DetectedChord[] {
  const notes = comp.tracks.chords.notes;
  if (notes.length === 0) return [];
  const bassNotes = comp.tracks.bass.notes;
  const MIN_OVERLAP = PPQ / 8;
  const bassAt = (t: number): number | undefined => {
    const sounding = bassNotes.filter((n) => n.start <= t && t < n.start + n.duration);
    const pool = sounding.length ? sounding : bassNotes.filter((n) => n.start >= t && n.start < t + PPQ);
    return pool.length ? Math.min(...pool.map((n) => n.pitch)) % 12 : undefined;
  };
  const triadOn = (root: number, pcs: Set<number>): DetectedChord | null => {
    // Dernier recours (ex. iii9 diatonique, absent de detectChord) : la triade bâtie sur la basse.
    if (!pcs.has(root) || !pcs.has((root + 7) % 12)) return null;
    const quality = pcs.has((root + 4) % 12) ? 'maj' : pcs.has((root + 3) % 12) ? 'min' : null;
    return quality ? { root, quality, name: `${NOTE_NAMES[root]}${quality === 'min' ? 'm' : ''}` } : null;
  };
  const detect = (from: number, to: number, hints: (number | undefined)[]) => {
    const pitches = notes
      .filter((n) => Math.min(n.start + n.duration, to) - Math.max(n.start, from) >= MIN_OVERLAP)
      .map((n) => n.pitch);
    if (pitches.length === 0) return null;
    const bassHints = [...new Set(hints.filter((h): h is number => h !== undefined))];
    // Une hauteur 0..11 est forcément la plus grave : detectChord la prend comme basse.
    for (const h of bassHints) {
      const chord = parseChordName(detectChord([h, ...pitches]) ?? '');
      if (chord?.root === h) return chord;
    }
    const plain = detectChord(pitches);
    if (plain) return parseChordName(plain);
    const pcs = new Set(pitches.map((p) => p % 12));
    for (const h of bassHints) {
      const chord = triadOn(h, pcs);
      if (chord) return chord;
    }
    return null;
  };
  const seq: DetectedChord[] = [];
  for (let bar = 0; bar < BARS; bar++) {
    const barStart = bar * BAR;
    const barHints = [bassAt(barStart)];
    for (let beat = 0; beat < 4; beat++) {
      const from = barStart + beat * PPQ;
      const half = barStart + (beat < 2 ? 0 : BAR / 2);
      const hints = [bassAt(half), ...barHints];
      const chord = detect(from, from + PPQ, hints) ?? detect(half, half + BAR / 2, hints) ?? detect(barStart, barStart + BAR, barHints);
      if (chord) seq.push(chord);
    }
  }
  const same = (a: DetectedChord, b: DetectedChord) => a.root === b.root && a.quality === b.quality;
  const out = seq.filter((c, i) => i === 0 || !same(c, seq[i - 1]));
  while (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
  return out;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** Les 7 degrés de la gamme de la loop (gammes pentatoniques ramenées au majeur/mineur). */
function sevenDegrees(scaleId: string): number[] {
  const iv = getScale(scaleId).intervals;
  return iv.length === 7 ? iv : getScale(keyFamily(scaleId)).intervals;
}

type ChordMatcher = (c: DetectedChord, key: KeySignature) => boolean;

function qualityMatches(want: Quality, got: Quality): boolean {
  // Un sus n'a pas de tierce : il convient quelle que soit la couleur demandée.
  return want === got || got === 'sus';
}

/** Convertit un élément de la recherche (« ii7 », « bVII », « Am7 ») en test d'accord. */
function parseToken(token: string): ChordMatcher | null {
  const roman = /^([b#♭♯]?)(vii|iii|vi|iv|ii|v|i|VII|III|VI|IV|II|V|I)(.*)$/.exec(token);
  if (roman) {
    const degree = ROMAN.indexOf(roman[2].toUpperCase());
    const acc = roman[1] === 'b' || roman[1] === '♭' ? -1 : roman[1] ? 1 : 0;
    const suffix = roman[3];
    let quality: Quality = roman[2] === roman[2].toUpperCase() ? 'maj' : 'min';
    if (/^(°|o|dim|ø)/.test(suffix)) quality = 'dim';
    else if (/^\+/.test(suffix)) quality = 'aug';
    else if (/^m(?!aj)/.test(suffix)) quality = 'min';
    return (c, key) =>
      (c.root - key.root + 12) % 12 === (sevenDegrees(key.scale)[degree] + acc + 12) % 12 && qualityMatches(quality, c.quality);
  }
  const chord = parseChordName(token);
  if (!chord) return null;
  return (c) => c.root === chord.root && qualityMatches(chord.quality, c.quality);
}

/** null si la recherche ne contient aucun accord reconnaissable. */
export function parseProgression(query: string): ChordMatcher[] | null {
  const tokens = query.split(/[\s,|>→–—-]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const matchers = tokens.map(parseToken);
  return matchers.every((m): m is ChordMatcher => m !== null) ? matchers : null;
}

/** La progression recherchée apparaît d'un bloc dans la boucle (en tenant compte du retour au début). */
export function matchesProgression(comp: Composition, query: string, progression = chordProgression(comp)): boolean {
  const matchers = parseProgression(query);
  if (!matchers) return false;
  const n = progression.length;
  if (n === 0) return false;
  for (let start = 0; start < n; start++) {
    if (matchers.every((m, j) => m(progression[(start + j) % n], comp.key))) return true;
  }
  return false;
}

/* ---------- Filtre complet ---------- */

const hasNotes = (comp: Composition, t: TrackId) => comp.tracks[t].notes.length > 0;

/** Tous les filtres sauf l'artiste, qui nécessite la liste des utilisateurs. */
export function matchesFilters(comp: Composition, publishedAt: string, f: AdvancedFilters, now = Date.now()): boolean {
  if (f.bpmMin !== undefined && comp.bpm < f.bpmMin) return false;
  if (f.bpmMax !== undefined && comp.bpm > f.bpmMax) return false;
  if (!matchesKey(comp.key, f)) return false;
  if (f.date) {
    const days = DATE_RANGES.find((d) => d.id === f.date)?.days ?? Infinity;
    if (now - new Date(publishedAt).getTime() > days * 86400000) return false;
  }
  for (const t of TRACK_IDS) {
    const rule = f.tracks?.[t];
    if (rule === 'with' && !hasNotes(comp, t)) return false;
    if (rule === 'without' && hasNotes(comp, t)) return false;
  }
  if (f.instrument && !TRACK_IDS.some((t) => hasNotes(comp, t) && comp.tracks[t].instrument === f.instrument)) return false;
  if (f.origin === 'original' && comp.remixOf) return false;
  if (f.origin === 'remix' && !comp.remixOf) return false;
  if (f.progression?.trim() && !matchesProgression(comp, f.progression)) return false;
  return true;
}

export function countActiveFilters(f: AdvancedFilters): number {
  return [
    f.bpmMin !== undefined || f.bpmMax !== undefined,
    f.keyRoot !== undefined || !!f.keyMode,
    !!f.artist?.trim(),
    !!f.date,
    ...TRACK_IDS.map((t) => !!f.tracks?.[t]),
    !!f.instrument,
    !!f.progression?.trim(),
    !!f.origin,
  ].filter(Boolean).length;
}

/* ---------- URL ---------- */

/** Écrit les filtres dans des paramètres d'URL lisibles (bpm=80-90, key=Am, with=drums…). */
export function filtersToParams(f: AdvancedFilters, params = new URLSearchParams()): URLSearchParams {
  if (f.bpmMin !== undefined || f.bpmMax !== undefined) params.set('bpm', `${f.bpmMin ?? ''}-${f.bpmMax ?? ''}`);
  if (f.keyRoot !== undefined || f.keyMode) {
    const root = f.keyRoot !== undefined ? NOTE_NAMES[f.keyRoot] : 'any';
    params.set('key', `${root}${f.keyMode === 'minor' ? 'm' : f.keyMode === 'major' ? 'M' : ''}`);
    if (f.relativeKey) params.set('rel', '1');
  }
  if (f.artist?.trim()) params.set('artist', f.artist.trim());
  if (f.date) params.set('date', f.date);
  for (const rule of ['with', 'without'] as const) {
    const list = TRACK_IDS.filter((t) => f.tracks?.[t] === rule);
    if (list.length) params.set(rule, list.join(','));
  }
  if (f.instrument) params.set('inst', f.instrument);
  if (f.progression?.trim()) params.set('prog', f.progression.trim());
  if (f.origin) params.set('origin', f.origin);
  return params;
}

export function filtersFromParams(params: URLSearchParams): AdvancedFilters {
  const f: AdvancedFilters = {};
  const num = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : undefined);
  const bpm = params.get('bpm')?.split('-');
  if (bpm) {
    f.bpmMin = num(bpm[0]);
    f.bpmMax = num(bpm[1]);
  }
  const key = /^(any|[A-G]#?)([mM]?)$/.exec(params.get('key') ?? '');
  if (key) {
    if (key[1] !== 'any') f.keyRoot = NOTE_NAMES.indexOf(key[1]);
    if (key[2]) f.keyMode = key[2] === 'm' ? 'minor' : 'major';
    if (params.get('rel') === '1') f.relativeKey = true;
  }
  if (params.get('artist')) f.artist = params.get('artist')!;
  const date = params.get('date');
  if (DATE_RANGES.some((d) => d.id === date)) f.date = date as DateRange;
  for (const rule of ['with', 'without'] as const) {
    for (const t of params.get(rule)?.split(',') ?? []) {
      if ((TRACK_IDS as string[]).includes(t)) f.tracks = { ...f.tracks, [t]: rule };
    }
  }
  if (params.get('inst')) f.instrument = params.get('inst')!;
  if (params.get('prog')) f.progression = params.get('prog')!;
  const origin = params.get('origin');
  if (origin === 'original' || origin === 'remix') f.origin = origin;
  return f;
}
