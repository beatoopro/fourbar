import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Note, TrackId } from '../core/types';
import { MELODIC_TRACK_IDS } from '../core/types';
import { BAR, BARS, LOOP_TICKS, PPQ, clamp, snapFloor, snapRound, snapTicks } from '../core/timing';
import { buildChord, detectChord, isBlackKey, isInScale, noteName } from '../core/theory';
import { uid } from '../core/composition';
import { engine } from '../audio/engine';
import { MAX_PITCH, MIN_PITCH, useEditor } from './store';
import { VelocityLane } from './VelocityLane';

export const KEY_W = 64;
export const RULER_H = 26;
const EDGE_PX = 7;

type Drag =
  | {
      kind: 'move';
      anchorId: string;
      startTick: number;
      startPitch: number;
      orig: Map<string, { start: number; pitch: number; duration: number }>;
      lastPitch: number;
      moved: boolean;
      toggleOnClick?: string;
    }
  | { kind: 'resize'; anchorId: string; anchorEnd: number; orig: Map<string, { start: number; duration: number }> }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; base: string[] }
  | { kind: 'erase' };

const PITCHES: number[] = [];
for (let p = MAX_PITCH; p >= MIN_PITCH; p--) PITCHES.push(p);

export function PianoRoll() {
  const comp = useEditor((s) => s.comp);
  const activeTrack = useEditor((s) => s.activeTrack);
  const selection = useEditor((s) => s.selection);
  const chordMode = useEditor((s) => s.chordMode);
  const snap = useEditor((s) => s.snap);
  const pxPerBeat = useEditor((s) => s.pxPerBeat);
  const rowH = useEditor((s) => s.rowHeight);
  const ghosts = useEditor((s) => s.ghosts);
  const scaleHighlight = useEditor((s) => s.scaleHighlight);
  const cursorTick = useEditor((s) => s.cursorTick);
  const hasClipboard = useEditor((s) => s.clipboard !== null);
  const chordType = useEditor((s) => s.chordType);
  const inversion = useEditor((s) => s.inversion);
  const chordLength = useEditor((s) => s.chordLength);

  const ppt = pxPerBeat / PPQ;
  const width = LOOP_TICKS * ppt;
  const height = PITCHES.length * rowH;
  const step = snapTicks(snap);
  const notes = comp.tracks[activeTrack].notes;
  const selSet = useMemo(() => new Set(selection), [selection]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  const velRef = useRef<HTMLDivElement>(null);
  const playheads = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [hover, setHover] = useState<{ tick: number; pitch: number } | null>(null);
  const [activeKey, setActiveKey] = useState<number | null>(null);

  /* ---------- Géométrie ---------- */
  const yOf = (pitch: number) => (MAX_PITCH - pitch) * rowH;
  const pos = (e: { clientX: number; clientY: number }) => {
    const r = contentRef.current!.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return { x, y, tick: clamp(x / ppt, 0, LOOP_TICKS - 1), pitch: clamp(MAX_PITCH - Math.floor(y / rowH), MIN_PITCH, MAX_PITCH) };
  };
  const hitTest = (x: number, pitch: number): { note: Note; edge: boolean } | null => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.pitch !== pitch) continue;
      const x0 = n.start * ppt;
      const x1 = (n.start + n.duration) * ppt;
      if (x >= x0 && x <= x1) {
        const edge = x1 - x <= Math.min(EDGE_PX, Math.max(3, (x1 - x0) / 3));
        return { note: n, edge };
      }
    }
    return null;
  };

  /* ---------- Synchronisation du défilement ---------- */
  const onScroll = () => {
    const el = scrollRef.current!;
    if (rulerRef.current) rulerRef.current.scrollLeft = el.scrollLeft;
    if (velRef.current) velRef.current.scrollLeft = el.scrollLeft;
    if (keysRef.current) keysRef.current.scrollTop = el.scrollTop;
  };

  // Ajustement initial : 4 mesures visibles et défilement centré autour de C4.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fit = clamp(Math.floor((el.clientWidth - 12) / (BARS * 4)), 36, 200);
    useEditor.getState().set('pxPerBeat', fit);
    const all = MELODIC_TRACK_IDS.flatMap((id) => comp.tracks[id].notes.map((n) => n.pitch));
    const center = all.length ? (Math.max(...all) + Math.min(...all)) / 2 : 60;
    el.scrollTop = yOf(Math.round(center)) - el.clientHeight / 2;
    onScroll();
  }, []);

  // Zoom : Ctrl/Cmd + molette (horizontal), Alt + molette (hauteur des lignes).
  useEffect(() => {
    const el = scrollRef.current!;
    const onWheel = (e: WheelEvent) => {
      const st = useEditor.getState();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const tickAtMouse = (el.scrollLeft + mx) / (st.pxPerBeat / PPQ);
        const next = clamp(st.pxPerBeat * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 24, 480);
        st.set('pxPerBeat', next);
        requestAnimationFrame(() => {
          el.scrollLeft = tickAtMouse * (next / PPQ) - mx;
        });
      } else if (e.altKey) {
        e.preventDefault();
        st.set('rowHeight', clamp(st.rowHeight + (e.deltaY < 0 ? 2 : -2), 10, 32));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const forwardWheel = (e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (!el || e.ctrlKey || e.metaKey) return;
    el.scrollTop += e.deltaY;
    el.scrollLeft += e.deltaX;
  };

  /* ---------- Tête de lecture ---------- */
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

  /* ---------- Son de prévisualisation ---------- */
  const preview = useCallback(
    (pitch: number, velocity?: number, track: TrackId = activeTrack) => {
      const st = useEditor.getState();
      void engine.preview(st.comp, track, pitch, velocity ?? st.comp.tracks[track].defaultVelocity);
    },
    [activeTrack],
  );

  /* ---------- Interactions souris ---------- */
  const startMove = (anchor: Note, tick: number, pitch: number, ids: string[], toggleOnClick?: string) => {
    const st = useEditor.getState();
    const orig = new Map<string, { start: number; pitch: number; duration: number }>();
    for (const n of st.comp.tracks[st.activeTrack].notes) if (ids.includes(n.id)) orig.set(n.id, { start: n.start, pitch: n.pitch, duration: n.duration });
    drag.current = { kind: 'move', anchorId: anchor.id, startTick: tick, startPitch: pitch, orig, lastPitch: pitch, moved: false, toggleOnClick };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1) return;
    const st = useEditor.getState();
    const { x, y, tick, pitch } = pos(e);
    contentRef.current!.setPointerCapture(e.pointerId);
    const hit = hitTest(x, pitch);

    // Clic droit : gomme (supprime la note survolée, puis toutes celles balayées).
    if (e.button === 2) {
      st.beginGesture();
      drag.current = { kind: 'erase' };
      if (hit) st.liveUpdate((ns) => ns.filter((n) => n.id !== hit.note.id), st.selection.filter((id) => id !== hit.note.id));
      return;
    }

    const additive = e.shiftKey;
    if (hit) {
      const n = hit.note;
      let ids = st.selection;
      let toggle: string | undefined;
      if (additive) {
        if (selSet.has(n.id)) toggle = n.id;
        else ids = [...ids, n.id];
      } else if (!selSet.has(n.id)) ids = [n.id];
      st.set('selection', ids);
      st.set('lastLength', n.duration);
      st.beginGesture();
      if (hit.edge && !additive) {
        const orig = new Map<string, { start: number; duration: number }>();
        for (const m of notes) if (ids.includes(m.id)) orig.set(m.id, { start: m.start, duration: m.duration });
        drag.current = { kind: 'resize', anchorId: n.id, anchorEnd: n.start + n.duration, orig };
      } else {
        startMove(n, tick, pitch, ids, toggle);
        preview(n.pitch, n.velocity);
      }
      return;
    }

    // Zone vide
    st.set('cursorTick', snapFloor(tick, step));
    const wantsMarquee = st.tool === 'select' || e.ctrlKey || e.metaKey;
    if (wantsMarquee) {
      drag.current = { kind: 'marquee', x0: x, y0: y, x1: x, y1: y, base: additive ? st.selection : [] };
      if (!additive) st.set('selection', []);
      return;
    }

    const start = snapFloor(tick, step);
    const vel = st.comp.tracks[st.activeTrack].defaultVelocity;
    st.beginGesture();
    if (st.chordMode) {
      const pitches = buildChord(pitch, st.chordType, st.inversion, st.comp.key.root, st.comp.key.scale).filter(
        (p) => p >= MIN_PITCH && p <= MAX_PITCH,
      );
      const duration = Math.min(st.chordLength, LOOP_TICKS - start);
      const created = pitches.map((p) => ({ id: uid(), pitch: p, start, duration, velocity: vel }));
      st.liveUpdate((ns) => [...ns, ...created], created.map((c) => c.id));
      const root = created.find((c) => c.pitch === Math.min(...pitches)) ?? created[0];
      startMove(root, tick, pitch, created.map((c) => c.id));
      // Les notes de l'accord sont jouées ensemble.
      created.forEach((c) => preview(c.pitch, vel));
    } else {
      const duration = Math.min(st.lastLength, LOOP_TICKS - start);
      const note: Note = { id: uid(), pitch, start, duration, velocity: vel };
      st.liveUpdate((ns) => [...ns, note], [note.id]);
      startMove(note, tick, pitch, [note.id]);
      preview(pitch, vel);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = useEditor.getState();
    const { x, y, tick, pitch } = pos(e);
    const d = drag.current;
    const free = e.altKey || st.snap === 'off';
    const content = contentRef.current!;

    if (!d) {
      // Survol : curseur adapté et aperçu de l'accord.
      const hit = hitTest(x, pitch);
      content.style.cursor = hit ? (hit.edge ? 'ew-resize' : 'grab') : st.tool === 'select' ? 'default' : 'crosshair';
      if (st.chordMode && !hit) {
        const t = snapFloor(tick, step);
        if (!hover || hover.tick !== t || hover.pitch !== pitch) setHover({ tick: t, pitch });
      } else if (hover) setHover(null);
      return;
    }

    if (d.kind === 'erase') {
      const hit = hitTest(x, pitch);
      if (hit) st.liveUpdate((ns) => ns.filter((n) => n.id !== hit.note.id), st.selection.filter((id) => id !== hit.note.id));
      return;
    }

    if (d.kind === 'marquee') {
      d.x1 = x;
      d.y1 = y;
      const rx = Math.min(d.x0, x);
      const ry = Math.min(d.y0, y);
      const rw = Math.abs(x - d.x0);
      const rh = Math.abs(y - d.y0);
      setMarquee({ x: rx, y: ry, w: rw, h: rh });
      const inside = notes
        .filter((n) => {
          const nx0 = n.start * ppt;
          const nx1 = (n.start + n.duration) * ppt;
          const ny0 = yOf(n.pitch);
          return nx1 >= rx && nx0 <= rx + rw && ny0 + rowH >= ry && ny0 <= ry + rh;
        })
        .map((n) => n.id);
      st.set('selection', [...new Set([...d.base, ...inside])]);
      return;
    }

    if (d.kind === 'move') {
      const anchor = d.orig.get(d.anchorId)!;
      const rawStart = anchor.start + (tick - d.startTick);
      const newStart = free ? Math.round(rawStart) : snapRound(rawStart, step);
      let dt = newStart - anchor.start;
      let dp = pitch - d.startPitch;
      const origs = [...d.orig.values()];
      dt = clamp(dt, -Math.min(...origs.map((o) => o.start)), Math.min(...origs.map((o) => LOOP_TICKS - o.start - o.duration)));
      dp = clamp(dp, MIN_PITCH - Math.min(...origs.map((o) => o.pitch)), MAX_PITCH - Math.max(...origs.map((o) => o.pitch)));
      if (dt !== 0 || dp !== 0) d.moved = true;
      st.liveUpdate((ns) =>
        ns.map((n) => {
          const o = d.orig.get(n.id);
          return o ? { ...n, start: o.start + dt, pitch: o.pitch + dp } : n;
        }),
      );
      if (anchor.pitch + dp !== d.lastPitch) {
        d.lastPitch = anchor.pitch + dp;
        if (d.orig.size <= 6) for (const o of d.orig.values()) preview(o.pitch + dp);
      }
      content.style.cursor = 'grabbing';
      return;
    }

    if (d.kind === 'resize') {
      const end = free ? Math.round(tick) : snapRound(tick, step);
      const delta = end - d.anchorEnd;
      const minLen = st.snap === 'off' ? 3 : Math.min(step, PPQ);
      st.liveUpdate((ns) =>
        ns.map((n) => {
          const o = d.orig.get(n.id);
          if (!o) return n;
          return { ...n, duration: clamp(o.duration + delta, Math.min(minLen, o.duration), LOOP_TICKS - o.start) };
        }),
      );
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const st = useEditor.getState();
    const d = drag.current;
    drag.current = null;
    setMarquee(null);
    contentRef.current?.releasePointerCapture?.(e.pointerId);
    if (!d) return;
    if (d.kind === 'move' && !d.moved && d.toggleOnClick) {
      st.set('selection', st.selection.filter((id) => id !== d.toggleOnClick));
    }
    if (d.kind === 'resize') {
      const n = st.comp.tracks[st.activeTrack].notes.find((m) => m.id === d.anchorId);
      if (n) st.set('lastLength', n.duration);
    }
    if (d.kind !== 'marquee') st.endGesture();
  };

  /* ---------- Rendu ---------- */
  const rows = useMemo(
    () =>
      PITCHES.map((p) => {
        const inScale = isInScale(p, comp.key.root, comp.key.scale);
        const isRoot = ((p - comp.key.root) % 12 + 12) % 12 === 0;
        let cls = 'row';
        if (isBlackKey(p)) cls += ' black';
        if (scaleHighlight) cls += inScale ? (isRoot ? ' root' : ' in') : ' out';
        if (p % 12 === 0) cls += ' c';
        return <div key={p} className={cls} style={{ height: rowH }} />;
      }),
    [comp.key.root, comp.key.scale, scaleHighlight, rowH],
  );

  const stepPx = step * ppt;
  const gridBg = {
    backgroundImage: [
      'linear-gradient(to right, var(--grid-bar) 1px, transparent 1px)',
      'linear-gradient(to right, var(--grid-beat) 1px, transparent 1px)',
      stepPx >= 6 && step < PPQ ? 'linear-gradient(to right, var(--grid-sub) 1px, transparent 1px)' : 'none',
    ].join(','),
    backgroundSize: `${BAR * ppt}px 100%, ${PPQ * ppt}px 100%, ${stepPx}px 100%`,
  };

  const hoverChord = useMemo(() => {
    if (!chordMode || !hover) return null;
    const pitches = buildChord(hover.pitch, chordType, inversion, comp.key.root, comp.key.scale);
    return { pitches, tick: hover.tick, len: Math.min(chordLength, LOOP_TICKS - hover.tick) };
  }, [chordMode, hover, comp.key, chordType, inversion, chordLength]);

  const color = `var(--${activeTrack})`;

  return (
    <div className="roll" style={{ ['--c' as string]: color }}>
      <div className="roll-corner">
        <span className="label">{noteName(MAX_PITCH)}</span>
      </div>
      <div className="roll-ruler" ref={rulerRef} onWheel={forwardWheel}>
        <div
          className="ruler-inner"
          style={{ width: width + 40 }}
          onPointerDown={(e) => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const tick = clamp((e.clientX - r.left) / ppt, 0, LOOP_TICKS - 1);
            const t = snapFloor(tick, step);
            useEditor.getState().set('cursorTick', t);
            if (engine.getState().playing && engine.getState().sourceId === 'editor') engine.seek(t);
          }}
        >
          {Array.from({ length: BARS * 4 }, (_, i) => (
            <div key={i} className={`ruler-beat ${i % 4 === 0 ? 'bar' : ''}`} style={{ left: i * PPQ * ppt, width: PPQ * ppt }}>
              {i % 4 === 0 ? <b>{i / 4 + 1}</b> : pxPerBeat > 50 ? <span>{`${Math.floor(i / 4) + 1}.${(i % 4) + 1}`}</span> : null}
            </div>
          ))}
          {/* Repères de la batterie (kick, snare/clap) pour caler basse et accords sur le groove. */}
          {ghosts &&
            comp.tracks.drums.notes
              .filter((n) => n.pitch === 36 || n.pitch === 38 || n.pitch === 39)
              .map((n) => <div key={n.id} className={`ruler-mark ${n.pitch === 36 ? 'kick' : 'snare'}`} style={{ left: n.start * ppt }} />)}
          {cursorTick !== null && hasClipboard && <div className="ruler-cursor" style={{ left: cursorTick * ppt }} />}
          <div className="playhead" ref={(el) => {
            playheads.current[0] = el;
          }} />
        </div>
      </div>

      <div className="roll-keys" ref={keysRef} onWheel={forwardWheel}>
        <div style={{ height, position: 'relative' }}>
          {PITCHES.map((p) => {
            const black = isBlackKey(p);
            const inScale = isInScale(p, comp.key.root, comp.key.scale);
            return (
              <div
                key={p}
                className={`key ${black ? 'black' : 'white'} ${scaleHighlight && inScale ? 'in' : ''} ${activeKey === p ? 'down' : ''}`}
                style={{ height: rowH }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setActiveKey(p);
                  preview(p);
                }}
                onPointerUp={() => setActiveKey(null)}
                onPointerLeave={() => setActiveKey(null)}
              >
                {(p % 12 === 0 || rowH >= 16) && <span className={p % 12 === 0 ? 'c' : ''}>{p % 12 === 0 || !black ? noteName(p) : ''}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="roll-scroll" ref={scrollRef} onScroll={onScroll}>
        <div
          className="roll-content"
          ref={contentRef}
          style={{ width, height }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => setHover(null)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="rows">{rows}</div>
          {[1, 3].map((b) => (
            <div key={b} className="bar-shade" style={{ left: b * BAR * ppt, width: BAR * ppt }} />
          ))}
          <div className="grid-lines" style={gridBg} />

          {ghosts &&
            MELODIC_TRACK_IDS.filter((id) => id !== activeTrack).map((id) =>
              comp.tracks[id].notes.map((n) => (
                <div
                  key={n.id}
                  className="note ghost"
                  style={{
                    left: n.start * ppt,
                    top: yOf(n.pitch),
                    width: Math.max(2, n.duration * ppt),
                    height: rowH,
                    ['--c' as string]: `var(--${id})`,
                  }}
                />
              )),
            )}

          {notes.map((n) => {
            const w = Math.max(3, n.duration * ppt);
            return (
              <div
                key={n.id}
                className={`note ${selSet.has(n.id) ? 'sel' : ''}`}
                style={{
                  left: n.start * ppt,
                  top: yOf(n.pitch),
                  width: w,
                  height: rowH,
                  ['--v' as string]: `${Math.round(35 + n.velocity * 65)}%`,
                }}
              >
                {w > 30 && rowH >= 13 && <span>{noteName(n.pitch)}</span>}
              </div>
            );
          })}

          {hoverChord &&
            hoverChord.pitches
              .filter((p) => p >= MIN_PITCH && p <= MAX_PITCH)
              .map((p) => (
                <div
                  key={`h${p}`}
                  className="note preview"
                  style={{ left: hoverChord.tick * ppt, top: yOf(p), width: hoverChord.len * ppt, height: rowH }}
                />
              ))}
          {hoverChord && (
            <div className="chord-hint" style={{ left: hoverChord.tick * ppt + 4, top: yOf(Math.max(...hoverChord.pitches)) - 20 }}>
              {detectChord(hoverChord.pitches) ?? noteName(hover!.pitch)}
            </div>
          )}

          {cursorTick !== null && hasClipboard && <div className="cursor-line" style={{ left: cursorTick * ppt }} />}
          {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
          <div className="playhead" ref={(el) => {
            playheads.current[1] = el;
          }} />
        </div>
      </div>

      <div className="roll-vel-label">
        <span className="label">Velocity</span>
      </div>
      <div className="roll-vel" ref={velRef} onWheel={forwardWheel}>
        <VelocityLane width={width} ppt={ppt} playheadRef={(el) => {
            playheads.current[2] = el;
          }} />
      </div>
    </div>
  );
}
