import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Note } from '../core/types';
import { BAR, BARS, LOOP_TICKS, PPQ, clamp, snapFloor, snapTicks } from '../core/timing';
import { DRUM_LANES, cycleRoll, type DrumLane } from '../core/drums';
import { uid } from '../core/composition';
import { engine } from '../audio/engine';
import { useEditor } from './store';
import { VelocityLane } from './VelocityLane';

export const LANE_W = 112;
const MIN_ROW = 30;
const MAX_ROW = 46;
const ACCENT = 1;

type Drag =
  | { kind: 'paint'; visited: Set<string>; velocity: number }
  | { kind: 'erase' }
  | { kind: 'pending'; note: Note; x0: number; y0: number }
  | { kind: 'velocity'; note: Note; y0: number };

/**
 * Grille de batterie : une ligne nommée par élément du kit, un clic = un coup.
 * La résolution suit le magnétisme de l'éditeur (1/16 par défaut, triolets,
 * 1/32…) et les coups hors grille s'affichent à leur vraie position.
 *
 *   Clic : ajouter / retirer · Glisser : peindre ou gommer une rangée
 *   Glisser verticalement sur un coup : force · Maj + clic : accent
 *   Alt + clic : roulement (2, 3, 4 coups dans la case) · Clic droit : gomme
 */
export function DrumGrid() {
  const notes = useEditor((s) => s.comp.tracks.drums.notes);
  const selection = useEditor((s) => s.selection);
  const snap = useEditor((s) => s.snap);
  const pxPerBeat = useEditor((s) => s.pxPerBeat);
  const compact = useEditor((s) => s.drumCompact);
  const ghosts = useEditor((s) => s.ghosts);
  const bassNotes = useEditor((s) => s.comp.tracks.bass.notes);
  const cursorTick = useEditor((s) => s.cursorTick);
  const hasClipboard = useEditor((s) => s.clipboard !== null);

  const ppt = pxPerBeat / PPQ;
  const width = LOOP_TICKS * ppt;
  const free = snap === 'off';
  const cell = free ? PPQ / 4 : snapTicks(snap);
  const selSet = useMemo(() => new Set(selection), [selection]);

  const lanes = useMemo(() => {
    if (!compact) return DRUM_LANES;
    const used = new Set(notes.map((n) => n.pitch));
    const shown = DRUM_LANES.filter((l) => used.has(l.pitch) || ['kick', 'snare', 'hat'].includes(l.id));
    return shown;
  }, [compact, notes]);
  // Les lignes s'agrandissent pour occuper la hauteur disponible.
  const [viewH, setViewH] = useState(0);
  const ROW_H = clamp(Math.floor(viewH / lanes.length), MIN_ROW, MAX_ROW);
  const height = lanes.length * ROW_H;

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const velRef = useRef<HTMLDivElement>(null);
  const playheads = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const [hover, setHover] = useState<{ lane: number; tick: number } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);

  /* ---------- Géométrie ---------- */
  const pos = (e: { clientX: number; clientY: number }) => {
    const r = contentRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const tick = clamp(x / ppt, 0, LOOP_TICKS - 1);
    const laneIdx = clamp(Math.floor(y / ROW_H), 0, lanes.length - 1);
    return { x, y, tick, laneIdx, lane: lanes[laneIdx], cellStart: snapFloor(tick, cell) };
  };
  const hitW = (n: Note) => Math.max(6, Math.min(n.duration, cell) * ppt - 2);
  const hitTest = (lane: DrumLane, x: number, cellStart: number): Note | null => {
    const all = useEditor.getState().comp.tracks.drums.notes;
    for (let i = all.length - 1; i >= 0; i--) {
      const n = all[i];
      if (n.pitch === lane.pitch && x >= n.start * ppt && x <= n.start * ppt + hitW(n)) return n;
    }
    // Petits coups (roulements) : n'importe lequel dans la case.
    return all.find((n) => n.pitch === lane.pitch && n.start >= cellStart && n.start < cellStart + cell) ?? null;
  };

  const preview = (pitch: number, velocity: number) => {
    void engine.preview(useEditor.getState().comp, 'drums', pitch, velocity);
  };

  /* ---------- Défilement, zoom initial, tête de lecture ---------- */
  const onScroll = () => {
    const el = scrollRef.current!;
    if (rulerRef.current) rulerRef.current.scrollLeft = el.scrollLeft;
    if (velRef.current) velRef.current.scrollLeft = el.scrollLeft;
    if (lanesRef.current) lanesRef.current.scrollTop = el.scrollTop;
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    const fit = clamp(Math.floor((el.clientWidth - 12) / (BARS * 4)), 36, 200);
    useEditor.getState().set('pxPerBeat', fit);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const st = engine.getState();
      const tick = st.playing && st.sourceId === 'editor' ? engine.getTick() : null;
      const ppt_ = useEditor.getState().pxPerBeat / PPQ;
      for (const el of playheads.current) {
        if (!el) continue;
        if (tick === null) el.style.display = 'none';
        else {
          el.style.display = 'block';
          el.style.transform = `translateX(${tick * ppt_}px)`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (menu === null) return;
    const close = () => setMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  /* ---------- Interactions ---------- */
  const addHit = (lane: DrumLane, start: number, velocity: number): Note => {
    const n: Note = { id: uid(), pitch: lane.pitch, start, duration: Math.max(1, Math.min(cell, PPQ / 4, LOOP_TICKS - start)), velocity };
    useEditor.getState().liveUpdate((ns) => [...ns, n], []);
    preview(lane.pitch, velocity);
    return n;
  };
  const removeHit = (id: string) => {
    const st = useEditor.getState();
    st.liveUpdate((ns) => ns.filter((n) => n.id !== id), st.selection.filter((s) => s !== id));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1) return;
    const st = useEditor.getState();
    const { x, y, tick, lane, cellStart } = pos(e);
    const start = free ? Math.round(tick) : cellStart;
    const hit = hitTest(lane, x, cellStart);
    const defVel = st.comp.tracks.drums.defaultVelocity;
    contentRef.current!.setPointerCapture(e.pointerId);
    st.set('cursorTick', cellStart);
    if (!e.ctrlKey && !e.metaKey) st.set('selection', []);

    // Clic droit : gomme.
    if (e.button === 2) {
      st.beginGesture();
      drag.current = { kind: 'erase' };
      if (hit) removeHit(hit.id);
      return;
    }

    // Alt + clic : roulement dans la case (1 → 2 → 3 → 4 → 1).
    if (e.altKey) {
      const base = hit ? snapFloor(hit.start, cell) : cellStart;
      st.commit((ns) => {
        const seeded = hit || free ? ns : [...ns, { id: uid(), pitch: lane.pitch, start: base, duration: cell, velocity: defVel }];
        return cycleRoll(seeded, lane.pitch, base, cell);
      });
      preview(lane.pitch, hit?.velocity ?? defVel);
      return;
    }

    // Maj + clic : accent (ou retour à la force par défaut).
    if (e.shiftKey) {
      if (hit) {
        const v = hit.velocity >= ACCENT - 0.02 ? defVel : ACCENT;
        st.commit((ns) => ns.map((n) => (n.id === hit.id ? { ...n, velocity: v } : n)));
        preview(lane.pitch, v);
        return;
      }
      st.beginGesture();
      addHit(lane, start, ACCENT);
      drag.current = { kind: 'paint', visited: new Set([`${lane.pitch}:${cellStart}`]), velocity: ACCENT };
      return;
    }

    st.beginGesture();
    if (hit) {
      drag.current = { kind: 'pending', note: hit, x0: x, y0: y };
      return;
    }
    addHit(lane, start, defVel);
    drag.current = { kind: 'paint', visited: new Set([`${lane.pitch}:${cellStart}`]), velocity: defVel };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y, tick, laneIdx, lane, cellStart } = pos(e);
    const d = drag.current;
    if (!d) {
      if (!hover || hover.lane !== laneIdx || hover.tick !== cellStart) setHover({ lane: laneIdx, tick: cellStart });
      return;
    }
    if (d.kind === 'pending') {
      // On décide au premier mouvement : vertical = force, vers une autre case = gomme.
      if (Math.abs(y - d.y0) > 5 && Math.abs(x - d.x0) < Math.max(8, cell * ppt)) drag.current = { kind: 'velocity', note: d.note, y0: d.y0 };
      else if (Math.abs(x - d.x0) > cell * ppt * 0.6 || laneIdx !== lanes.findIndex((l) => l.pitch === d.note.pitch)) {
        removeHit(d.note.id);
        drag.current = { kind: 'erase' };
        const hit = hitTest(lane, x, cellStart);
        if (hit) removeHit(hit.id);
      }
      return;
    }
    if (d.kind === 'velocity') {
      const v = clamp(d.note.velocity + (d.y0 - y) / 90, 0.05, 1);
      useEditor.getState().liveUpdate((ns) => ns.map((n) => (n.id === d.note.id ? { ...n, velocity: v } : n)));
      return;
    }
    if (d.kind === 'erase') {
      const hit = hitTest(lane, x, cellStart);
      if (hit) removeHit(hit.id);
      return;
    }
    if (d.kind === 'paint') {
      const key = `${lane.pitch}:${cellStart}`;
      if (d.visited.has(key)) return;
      d.visited.add(key);
      if (!hitTest(lane, x, cellStart)) addHit(lane, free ? Math.round(tick) : cellStart, d.velocity);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const st = useEditor.getState();
    const d = drag.current;
    drag.current = null;
    contentRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d) return;
    if (d.kind === 'pending') removeHit(d.note.id); // simple clic sur un coup : on le retire
    if (d.kind === 'velocity') {
      const n = st.comp.tracks.drums.notes.find((m) => m.id === d.note.id);
      if (n) preview(n.pitch, n.velocity);
    }
    st.endGesture();
  };

  /* ---------- Rendu ---------- */
  const stepPx = cell * ppt;
  const gridBg = {
    backgroundImage: [
      'linear-gradient(to right, var(--grid-bar) 1px, transparent 1px)',
      'linear-gradient(to right, var(--grid-beat) 1px, transparent 1px)',
      stepPx >= 6 ? 'linear-gradient(to right, var(--grid-sub) 1px, transparent 1px)' : 'none',
      `linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)`,
    ].join(','),
    backgroundSize: `${BAR * ppt}px 100%, ${PPQ * ppt}px 100%, ${stepPx}px 100%, 100% ${ROW_H}px`,
  };
  const laneIndex = new Map(lanes.map((l, i) => [l.pitch, i]));
  const bassMarks = ghosts ? bassNotes : [];

  const laneAction = (lane: DrumLane, action: 'clear' | number) => {
    const st = useEditor.getState();
    if (action === 'clear') st.editDrums((ns) => ns.filter((n) => n.pitch !== lane.pitch));
    else st.fillDrumLane(lane.pitch, action);
    setMenu(null);
  };

  return (
    <div className="roll drums" style={{ ['--c' as string]: 'var(--drums)' }}>
      <div className="roll-corner">
        <span className="label">Kit</span>
      </div>
      <div className="roll-ruler" ref={rulerRef}>
        <div
          className="ruler-inner"
          style={{ width: width + 40 }}
          onPointerDown={(e) => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const t = snapFloor(clamp((e.clientX - r.left) / ppt, 0, LOOP_TICKS - 1), cell);
            useEditor.getState().set('cursorTick', t);
            if (engine.getState().playing && engine.getState().sourceId === 'editor') engine.seek(t);
          }}
        >
          {Array.from({ length: BARS * 4 }, (_, i) => (
            <div key={i} className={`ruler-beat ${i % 4 === 0 ? 'bar' : ''}`} style={{ left: i * PPQ * ppt, width: PPQ * ppt }}>
              {i % 4 === 0 ? <b>{i / 4 + 1}</b> : pxPerBeat > 50 ? <span>{`${Math.floor(i / 4) + 1}.${(i % 4) + 1}`}</span> : null}
            </div>
          ))}
          {/* Repères de la basse : pour caler le kick sur la ligne de basse. */}
          {bassMarks.map((n) => (
            <div key={n.id} className="ruler-mark bass" style={{ left: n.start * ppt }} />
          ))}
          {cursorTick !== null && hasClipboard && <div className="ruler-cursor" style={{ left: cursorTick * ppt }} />}
          <div className="playhead" ref={(el) => {
            playheads.current[0] = el;
          }} />
        </div>
      </div>

      <div className="roll-keys drum-lanes" ref={lanesRef}>
        <div style={{ height, position: 'relative' }}>
          {lanes.map((l, i) => (
            <div key={l.id} className={`lane-name ${hover?.lane === i ? 'hover' : ''} ${flash === i ? 'down' : ''}`} style={{ height: ROW_H }}>
              <button
                className="lane-play"
                title={`Play ${l.label}`}
                onPointerDown={() => {
                  setFlash(i);
                  preview(l.pitch, useEditor.getState().comp.tracks.drums.defaultVelocity);
                }}
                onPointerUp={() => setFlash(null)}
                onPointerLeave={() => setFlash(null)}
              >
                {l.label}
              </button>
              <button
                className="lane-more"
                title="Fill or clear the row"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setMenu(menu === i ? null : i)}
              >
                ⋯
              </button>
              {menu === i && (
                <div className="menu lane-menu" onPointerDown={(e) => e.stopPropagation()}>
                  <button onClick={() => laneAction(l, PPQ)}>
                    <b>Every beat</b>
                    <span>1/4</span>
                  </button>
                  <button onClick={() => laneAction(l, PPQ / 2)}>
                    <b>Every 8th</b>
                    <span>1/8</span>
                  </button>
                  <button onClick={() => laneAction(l, PPQ / 4)}>
                    <b>Every 16th</b>
                    <span>1/16</span>
                  </button>
                  <button onClick={() => laneAction(l, 'clear')}>
                    <b>Clear the row</b>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="roll-scroll" ref={scrollRef} onScroll={onScroll}>
        <div
          className="roll-content drum-content"
          ref={contentRef}
          style={{ width, height }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {Array.from({ length: BARS * 4 }, (_, i) => (
            <div key={i} className={`beat-shade ${i % 2 ? 'odd' : ''}`} style={{ left: i * PPQ * ppt, width: PPQ * ppt }} />
          ))}
          <div className="grid-lines" style={gridBg} />
          {hover && !drag.current && (
            <div className="drum-hover" style={{ left: hover.tick * ppt, top: hover.lane * ROW_H, width: stepPx, height: ROW_H }} />
          )}
          {notes.map((n) => {
            const row = laneIndex.get(n.pitch);
            if (row === undefined) return null;
            return (
              <div
                key={n.id}
                className={`hit ${selSet.has(n.id) ? 'sel' : ''} ${n.velocity >= ACCENT - 0.02 ? 'accent' : ''}`}
                style={{
                  left: n.start * ppt + 1,
                  top: row * ROW_H + 4,
                  width: hitW(n),
                  height: ROW_H - 8,
                  ['--v' as string]: `${Math.round(25 + n.velocity * 75)}%`,
                }}
              />
            );
          })}
          {cursorTick !== null && hasClipboard && <div className="cursor-line" style={{ left: cursorTick * ppt }} />}
          <div className="playhead" ref={(el) => {
            playheads.current[1] = el;
          }} />
        </div>
      </div>

      <div className="roll-vel-label">
        <span className="label">Velocity</span>
      </div>
      <div className="roll-vel" ref={velRef}>
        <VelocityLane width={width} ppt={ppt} playheadRef={(el) => {
            playheads.current[2] = el;
          }} />
      </div>
    </div>
  );
}
