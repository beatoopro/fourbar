import { useRef } from 'react';
import { useEditor } from './store';

export const VEL_H = 88;
const PAD = 8;

/**
 * Panneau de vélocité : une barre par note de la piste active.
 * Cliquer-glisser « peint » la vélocité des notes traversées ; si des notes
 * sont sélectionnées, seules celles-ci sont modifiées.
 */
export function VelocityLane({ width, ppt, playheadRef }: { width: number; ppt: number; playheadRef: (el: HTMLDivElement | null) => void }) {
  const notes = useEditor((s) => s.comp.tracks[s.activeTrack].notes);
  const selection = useEditor((s) => s.selection);
  const ref = useRef<HTMLDivElement>(null);
  const lastX = useRef<number | null>(null);
  const sel = new Set(selection);
  const usable = VEL_H - PAD * 2;

  const paint = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const x = clientX - r.left;
    const value = 1 - (clientY - r.top - PAD) / usable;
    const first = lastX.current === null;
    const from = Math.min(lastX.current ?? x, x) - 5;
    const to = Math.max(lastX.current ?? x, x) + 5;
    lastX.current = x;
    const st = useEditor.getState();
    const all = st.comp.tracks[st.activeTrack].notes;
    const pool = st.selection.length ? all.filter((n) => st.selection.includes(n.id)) : all;
    let targets = pool.filter((n) => n.start * ppt >= from && n.start * ppt <= to);
    if (!targets.length && first) {
      // Clic à côté d'une barre : on prend la plus proche.
      let best: number | null = null;
      for (const n of pool) {
        const d = Math.abs(n.start * ppt - x);
        if (d < 12 && (best === null || d < Math.abs(best * ppt - x))) best = n.start;
      }
      if (best !== null) targets = pool.filter((n) => n.start === best);
    }
    if (targets.length) st.setVelocities(Object.fromEntries(targets.map((n) => [n.id, value])));
  };

  return (
    <div
      ref={ref}
      className="vel-inner"
      style={{ width: width + 40, height: VEL_H }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        useEditor.getState().beginGesture();
        lastX.current = null;
        paint(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) paint(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        lastX.current = null;
        useEditor.getState().endGesture();
      }}
    >
      <div className="vel-guides" style={{ width }} />
      {[...notes]
        .sort((a, b) => Number(sel.has(a.id)) - Number(sel.has(b.id)))
        .map((n) => {
          const h = Math.max(2, n.velocity * usable);
          return (
            <div
              key={n.id}
              className={`vel-bar ${sel.has(n.id) ? 'sel' : ''} ${selection.length && !sel.has(n.id) ? 'dim' : ''}`}
              style={{ left: n.start * ppt, height: h, bottom: PAD }}
              title={`Velocity ${Math.round(n.velocity * 127)}`}
            />
          );
        })}
      <div className="playhead" ref={playheadRef} />
    </div>
  );
}
