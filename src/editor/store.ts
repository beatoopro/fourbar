import { create } from 'zustand';
import type { Composition, Note, Track, TrackId } from '../core/types';
import { TRACK_IDS } from '../core/types';
import { BAR, LOOP_TICKS, PPQ, clamp, snapRound, snapTicks } from '../core/timing';
import { cloneComposition, normalizeComposition, uid } from '../core/composition';
import {
  PROGRESSIONS,
  buildChord,
  chordIntervals,
  degreeRootPitch,
  invert,
  voiceLead,
} from '../core/theory';
import { buildStarterDraft } from '../services/local/seed';
import { DRUM_LANES, buildPatternNotes, fillLane, getDrumPattern, humanizeNotes, repeatFirstBar } from '../core/drums';

/**
 * État de l'éditeur (piano roll). Toutes les modifications de notes passent
 * par `commit` (une étape d'annulation) ou par `beginGesture`/`liveUpdate`/
 * `endGesture` pour les glisser-déposer (une seule étape pour tout le geste).
 */

export const MIN_PITCH = 24; // C1
export const MAX_PITCH = 108; // C8

type NotesSnapshot = Record<TrackId, Note[]>;

interface HistoryEntry {
  notes: NotesSnapshot;
  activeTrack: TrackId;
  selection: string[];
}

export type Tool = 'draw' | 'select';

interface Clipboard {
  notes: Note[]; // positions relatives au début de la sélection
  span: number;
}

export interface EditorState {
  comp: Composition;
  activeTrack: TrackId;
  selection: string[];
  tool: Tool;
  chordMode: boolean;
  chordType: string;
  inversion: number;
  chordLength: number;
  snap: string;
  pxPerBeat: number;
  rowHeight: number;
  ghosts: boolean;
  scaleHighlight: boolean;
  /** Grille de batterie : n'afficher que les lignes utilisées. */
  drumCompact: boolean;
  lastLength: number;
  clipboard: Clipboard | null;
  cursorTick: number | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  gesture: HistoryEntry | null;
  /** Modifié depuis le dernier enregistrement explicite. */
  dirty: boolean;

  load(comp: Composition): void;
  set<K extends keyof EditorState>(key: K, value: EditorState[K]): void;
  setTrack(id: TrackId): void;
  updateTrack(id: TrackId, patch: Partial<Omit<Track, 'notes' | 'id'>>): void;
  updateComp(patch: Partial<Pick<Composition, 'title' | 'bpm' | 'swing' | 'key' | 'genres' | 'moods' | 'description'>>): void;

  commit(fn: (notes: Note[]) => Note[], selection?: string[]): void;
  beginGesture(): void;
  liveUpdate(fn: (notes: Note[]) => Note[], selection?: string[]): void;
  endGesture(): void;

  undo(): void;
  redo(): void;

  addNote(pitch: number, start: number, duration?: number): Note;
  addChord(rootPitch: number, start: number): Note[];
  deleteNotes(ids: string[]): void;
  deleteSelection(): void;
  selectAll(): void;
  copy(): void;
  cut(): void;
  paste(): void;
  duplicate(): void;
  transpose(semitones: number): void;
  nudge(ticks: number): void;
  resizeBy(ticks: number): void;
  quantize(): void;
  invertSelection(direction: 1 | -1): void;
  setVelocities(values: Record<string, number>): void;
  insertProgression(presetId: string, withBass: boolean): void;
  /** Batterie : chaque action est une étape d'annulation. */
  insertDrumPattern(patternId: string, withFill: boolean): void;
  editDrums(fn: (notes: Note[]) => Note[]): void;
  repeatDrumBar(): void;
  fillDrumLane(pitch: number, every: number): void;
  humanize(): void;
  markSaved(): void;
}

const notesOf = (c: Composition): NotesSnapshot =>
  Object.fromEntries(TRACK_IDS.map((id) => [id, c.tracks[id].notes])) as NotesSnapshot;

function withNotes(c: Composition, track: TrackId, notes: Note[]): Composition {
  return {
    ...c,
    updatedAt: new Date().toISOString(),
    tracks: { ...c.tracks, [track]: { ...c.tracks[track], notes } },
  };
}

function applySnapshot(c: Composition, snap: NotesSnapshot): Composition {
  const tracks = { ...c.tracks };
  for (const id of TRACK_IDS) tracks[id] = { ...tracks[id], notes: snap[id] };
  return { ...c, tracks };
}

const HISTORY_LIMIT = 200;
const DRAFT_KEY = '4chords:v1:current';

function loadInitial(): Composition {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return normalizeComposition(JSON.parse(raw));
  } catch {
    /* brouillon illisible : on repart d'un brouillon neuf */
  }
  return buildStarterDraft();
}

export const useEditor = create<EditorState>((set, get) => {
  const entry = (): HistoryEntry => {
    const s = get();
    return { notes: notesOf(s.comp), activeTrack: s.activeTrack, selection: s.selection };
  };

  const pushHistory = (e: HistoryEntry) =>
    set((s) => ({ past: [...s.past.slice(-HISTORY_LIMIT + 1), e], future: [], dirty: true }));

  const selected = () => {
    const s = get();
    const ids = new Set(s.selection);
    return s.comp.tracks[s.activeTrack].notes.filter((n) => ids.has(n.id));
  };

  const step = () => snapTicks(get().snap);

  return {
    comp: loadInitial(),
    activeTrack: 'chords',
    selection: [],
    tool: 'draw',
    chordMode: false,
    chordType: 'diatonic3',
    inversion: 0,
    chordLength: BAR,
    snap: '1/16',
    pxPerBeat: 64,
    rowHeight: 18,
    ghosts: true,
    scaleHighlight: true,
    drumCompact: false,
    lastLength: PPQ,
    clipboard: null,
    cursorTick: null,
    past: [],
    future: [],
    gesture: null,
    dirty: false,

    load(comp) {
      set({ comp: normalizeComposition(cloneComposition(comp)), selection: [], past: [], future: [], dirty: false, cursorTick: null });
    },

    set(key, value) {
      set({ [key]: value } as Partial<EditorState>);
    },

    setTrack(id) {
      if (id !== get().activeTrack) set({ activeTrack: id, selection: [] });
    },

    updateTrack(id, patch) {
      const c = get().comp;
      set({ comp: { ...c, tracks: { ...c.tracks, [id]: { ...c.tracks[id], ...patch } } }, dirty: true });
    },

    updateComp(patch) {
      set({ comp: { ...get().comp, ...patch, updatedAt: new Date().toISOString() }, dirty: true });
    },

    commit(fn, selection) {
      const s = get();
      pushHistory(entry());
      const notes = fn(s.comp.tracks[s.activeTrack].notes);
      set({ comp: withNotes(get().comp, s.activeTrack, notes), selection: selection ?? get().selection });
    },

    beginGesture() {
      set({ gesture: entry() });
    },

    liveUpdate(fn, selection) {
      const s = get();
      const notes = fn(s.comp.tracks[s.activeTrack].notes);
      set({ comp: withNotes(s.comp, s.activeTrack, notes), selection: selection ?? s.selection });
    },

    endGesture() {
      const s = get();
      const g = s.gesture;
      if (!g) return;
      set({ gesture: null });
      const changed = TRACK_IDS.some((id) => g.notes[id] !== s.comp.tracks[id].notes);
      if (changed) pushHistory(g);
    },

    undo() {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return;
      set({
        past: s.past.slice(0, -1),
        future: [entry(), ...s.future],
        comp: applySnapshot(s.comp, prev.notes),
        activeTrack: prev.activeTrack,
        selection: prev.selection,
        dirty: true,
      });
    },

    redo() {
      const s = get();
      const next = s.future[0];
      if (!next) return;
      set({
        future: s.future.slice(1),
        past: [...s.past, entry()],
        comp: applySnapshot(s.comp, next.notes),
        activeTrack: next.activeTrack,
        selection: next.selection,
        dirty: true,
      });
    },

    addNote(pitch, start, duration) {
      const s = get();
      const d = duration ?? s.lastLength;
      const note: Note = {
        id: uid(),
        pitch: clamp(pitch, MIN_PITCH, MAX_PITCH),
        start: clamp(start, 0, LOOP_TICKS - 1),
        duration: clamp(d, 1, LOOP_TICKS - start),
        velocity: s.comp.tracks[s.activeTrack].defaultVelocity,
      };
      s.commit((notes) => [...notes, note], [note.id]);
      return note;
    },

    addChord(rootPitch, start) {
      const s = get();
      const pitches = buildChord(rootPitch, s.chordType, s.inversion, s.comp.key.root, s.comp.key.scale).filter(
        (p) => p >= MIN_PITCH && p <= MAX_PITCH,
      );
      const duration = Math.min(s.chordLength, LOOP_TICKS - start);
      const vel = s.comp.tracks[s.activeTrack].defaultVelocity;
      const created = pitches.map((pitch) => ({ id: uid(), pitch, start, duration, velocity: vel }));
      s.commit((notes) => [...notes, ...created], created.map((n) => n.id));
      return created;
    },

    deleteNotes(ids) {
      if (!ids.length) return;
      const set_ = new Set(ids);
      get().commit((notes) => notes.filter((n) => !set_.has(n.id)), get().selection.filter((id) => !set_.has(id)));
    },

    deleteSelection() {
      get().deleteNotes(get().selection);
    },

    selectAll() {
      const s = get();
      set({ selection: s.comp.tracks[s.activeTrack].notes.map((n) => n.id) });
    },

    copy() {
      const sel = selected();
      if (!sel.length) return;
      const min = Math.min(...sel.map((n) => n.start));
      const max = Math.max(...sel.map((n) => n.start + n.duration));
      const span = Math.max(step(), Math.ceil((max - min) / step()) * step());
      set({ clipboard: { notes: sel.map((n) => ({ ...n, start: n.start - min })), span } });
    },

    cut() {
      get().copy();
      get().deleteSelection();
    },

    paste() {
      const s = get();
      if (!s.clipboard) return;
      let at = s.cursorTick;
      if (at === null) {
        // Sans position choisie : on colle juste après la sélection courante (ou au début).
        const sel = selected();
        at = sel.length ? Math.max(...sel.map((n) => n.start + n.duration)) : 0;
        at = snapRound(at, step());
      }
      if (at >= LOOP_TICKS) at = 0;
      const created = s.clipboard.notes
        .map((n) => ({ ...n, id: uid(), start: n.start + at! }))
        .filter((n) => n.start < LOOP_TICKS)
        .map((n) => ({ ...n, duration: Math.min(n.duration, LOOP_TICKS - n.start) }));
      s.commit((notes) => [...notes, ...created], created.map((n) => n.id));
      set({ cursorTick: Math.min(LOOP_TICKS, at + s.clipboard.span) });
    },

    duplicate() {
      const sel = selected();
      if (!sel.length) return;
      const min = Math.min(...sel.map((n) => n.start));
      const max = Math.max(...sel.map((n) => n.start + n.duration));
      // Longueur arrondie à la grille pour que la copie tombe en place (ex. 1 mesure).
      const span = Math.max(step(), Math.ceil((max - min) / step()) * step());
      const created = sel
        .map((n) => ({ ...n, id: uid(), start: n.start + span }))
        .filter((n) => n.start < LOOP_TICKS)
        .map((n) => ({ ...n, duration: Math.min(n.duration, LOOP_TICKS - n.start) }));
      if (!created.length) return;
      get().commit((notes) => [...notes, ...created], created.map((n) => n.id));
    },

    transpose(semi) {
      const ids = new Set(get().selection);
      if (!ids.size) return;
      if (get().activeTrack === 'drums') {
        // Batterie : ↑ ↓ font passer les coups sur la ligne voisine.
        const dir = semi > 0 ? -1 : 1;
        get().commit((notes) =>
          notes.map((n) => {
            if (!ids.has(n.id)) return n;
            const i = DRUM_LANES.findIndex((l) => l.pitch === n.pitch);
            const lane = DRUM_LANES[clamp((i < 0 ? DRUM_LANES.length - 1 : i) + dir, 0, DRUM_LANES.length - 1)];
            return { ...n, pitch: lane.pitch };
          }),
        );
        return;
      }
      get().commit((notes) =>
        notes.map((n) => (ids.has(n.id) ? { ...n, pitch: clamp(n.pitch + semi, MIN_PITCH, MAX_PITCH) } : n)),
      );
    },

    nudge(ticks) {
      const ids = new Set(get().selection);
      if (!ids.size) return;
      get().commit((notes) =>
        notes.map((n) => (ids.has(n.id) ? { ...n, start: clamp(n.start + ticks, 0, LOOP_TICKS - n.duration) } : n)),
      );
    },

    resizeBy(ticks) {
      const ids = new Set(get().selection);
      if (!ids.size) return;
      const min = step();
      get().commit((notes) =>
        notes.map((n) =>
          ids.has(n.id) ? { ...n, duration: clamp(n.duration + ticks, Math.min(min, n.duration), LOOP_TICKS - n.start) } : n,
        ),
      );
    },

    quantize() {
      const s = get();
      const st = step();
      const ids = new Set(s.selection.length ? s.selection : s.comp.tracks[s.activeTrack].notes.map((n) => n.id));
      s.commit((notes) =>
        notes.map((n) => {
          if (!ids.has(n.id)) return n;
          const start = clamp(snapRound(n.start, st), 0, LOOP_TICKS - st);
          const duration = clamp(Math.max(st, snapRound(n.duration, st)), st, LOOP_TICKS - start);
          return { ...n, start, duration };
        }),
      );
    },

    invertSelection(direction) {
      const sel = selected();
      if (sel.length < 2) return;
      // Renversement groupé par position : chaque accord (notes qui commencent ensemble) est renversé.
      const groups = new Map<number, Note[]>();
      sel.forEach((n) => groups.set(n.start, [...(groups.get(n.start) ?? []), n]));
      const changes = new Map<string, number>();
      for (const g of groups.values()) {
        if (g.length < 2) continue;
        const sorted = [...g].sort((a, b) => a.pitch - b.pitch);
        const low = sorted[0];
        const high = sorted[sorted.length - 1];
        if (direction === 1) {
          // La note la plus grave passe au-dessus de toutes les autres.
          let p = low.pitch;
          while (p <= high.pitch) p += 12;
          changes.set(low.id, clamp(p, MIN_PITCH, MAX_PITCH));
        } else {
          let p = high.pitch;
          while (p >= low.pitch) p -= 12;
          changes.set(high.id, clamp(p, MIN_PITCH, MAX_PITCH));
        }
      }
      get().commit((notes) => notes.map((n) => (changes.has(n.id) ? { ...n, pitch: changes.get(n.id)! } : n)));
    },

    setVelocities(values) {
      get().liveUpdate((notes) => notes.map((n) => (n.id in values ? { ...n, velocity: clamp(values[n.id], 0.02, 1) } : n)));
    },

    insertProgression(presetId, withBass) {
      const s = get();
      const preset = PROGRESSIONS.find((p) => p.id === presetId);
      if (!preset) return;
      pushHistory({ notes: notesOf(s.comp), activeTrack: s.activeTrack, selection: s.selection });
      // La progression s'adapte à la tonalité ; si le mode ne correspond pas, on bascule majeur/mineur.
      let key = s.comp.key;
      const isMinorish = ['minor', 'dorian', 'phrygian', 'harmonic-minor', 'pentatonic-minor', 'blues'].includes(key.scale);
      if (preset.scale === 'minor' && !isMinorish) key = { ...key, scale: 'minor' };
      if (preset.scale === 'major' && isMinorish) key = { ...key, scale: 'major' };
      const roots = preset.degrees.map((d) => degreeRootPitch(key.root, key.scale, d, 48));
      let chords = voiceLead(roots.map((r) => chordIntervals(preset.chordType, r, key.root, key.scale).map((i) => r + i)));
      if (s.inversion > 0) chords = chords.map((c) => invert(c, s.inversion));
      const vel = s.comp.tracks.chords.defaultVelocity;
      const chordNotes: Note[] = chords.flatMap((ch, bar) =>
        ch.map((pitch) => ({ id: uid(), pitch, start: bar * BAR, duration: BAR - PPQ / 8, velocity: vel })),
      );
      let comp = withNotes({ ...s.comp, key }, 'chords', chordNotes);
      if (withBass) {
        const bassVel = s.comp.tracks.bass.defaultVelocity;
        const bassNotes = roots.map((r, bar) => ({
          id: uid(),
          pitch: (r % 12) + 36,
          start: bar * BAR,
          duration: BAR - PPQ / 4,
          velocity: bassVel,
        }));
        comp = withNotes(comp, 'bass', bassNotes);
      }
      set({ comp, activeTrack: 'chords', selection: chordNotes.map((n) => n.id) });
    },

    insertDrumPattern(patternId, withFill) {
      const p = getDrumPattern(patternId);
      if (!p) return;
      const s = get();
      pushHistory(entry());
      const notes = buildPatternNotes(p, withFill);
      const comp = withNotes(s.comp, 'drums', notes);
      // Le pattern règle aussi le kit et le swing conseillés (modifiables ensuite).
      set({
        comp: { ...comp, swing: p.swing, tracks: { ...comp.tracks, drums: { ...comp.tracks.drums, instrument: p.kit } } },
        activeTrack: 'drums',
        selection: [],
      });
    },

    editDrums(fn) {
      const s = get();
      pushHistory(entry());
      set({ comp: withNotes(s.comp, 'drums', fn(s.comp.tracks.drums.notes)) });
    },

    repeatDrumBar() {
      get().editDrums(repeatFirstBar);
    },

    fillDrumLane(pitch, every) {
      const vel = get().comp.tracks.drums.defaultVelocity;
      get().editDrums((notes) => fillLane(notes, pitch, every, vel));
    },

    humanize() {
      const s = get();
      const ids = s.selection.length ? new Set(s.selection) : null;
      s.commit((notes) => humanizeNotes(notes, ids));
    },

    markSaved() {
      set({ dirty: false });
    },
  };
});

// Sauvegarde automatique du brouillon en cours (débouncée).
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useEditor.subscribe((s, prev) => {
  if (s.comp === prev.comp) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(useEditor.getState().comp));
    } catch {
      /* stockage plein : ignoré */
    }
  }, 300);
});

// Accès en console pour le débogage (mode développement uniquement).
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __editor: typeof useEditor }).__editor = useEditor;
