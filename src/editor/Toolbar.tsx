import { useState } from 'react';
import { CHORD_TYPES, PROGRESSIONS, detectChord } from '../core/theory';
import { BAR, PPQ, SNAP_OPTIONS, clamp } from '../core/timing';
import { DRUM_PATTERNS } from '../core/drums';
import { useEditor } from './store';
import * as I from '../ui/Icons';

const CHORD_LENGTHS = [
  { label: '1 bar', ticks: BAR },
  { label: '2 beats', ticks: PPQ * 2 },
  { label: '1 beat', ticks: PPQ },
  { label: '1/8', ticks: PPQ / 2 },
];

/** Barre d'outils du piano roll : outils, grille, accords, aides visuelles. */
export function Toolbar() {
  const s = useEditor();
  const [withBass, setWithBass] = useState(true);
  const selNotes = s.comp.tracks[s.activeTrack].notes.filter((n) => s.selection.includes(n.id));
  const chord = selNotes.length >= 3 ? detectChord(selNotes.map((n) => n.pitch)) : null;

  if (s.activeTrack === 'drums') return <DrumToolbar />;

  return (
    <div className="toolbar">
      <div className="tool-group" role="group" aria-label="Tools">
        <button className={`btn icon ${s.tool === 'draw' && !s.chordMode ? 'on' : ''}`} title="Pencil (D)" onClick={() => { s.set('tool', 'draw'); s.set('chordMode', false); }}>
          <I.Pencil />
        </button>
        <button className={`btn icon ${s.chordMode ? 'on' : ''}`} title="Chords (C)" onClick={() => { s.set('chordMode', !s.chordMode); s.set('tool', 'draw'); }}>
          <I.Chord />
        </button>
        <button className={`btn icon ${s.tool === 'select' ? 'on' : ''}`} title="Select (S), or Ctrl + drag" onClick={() => { s.set('tool', 'select'); s.set('chordMode', false); }}>
          <I.Cursor />
        </button>
      </div>

      <div className="tool-group">
        <span className="tool-label" title="Grid / snap">
          <I.Magnet size={14} />
        </span>
        <select className="select sm" value={s.snap} onChange={(e) => s.set('snap', e.target.value)} title="Snap (hold Alt while dragging to disable)">
          {SNAP_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn sm" onClick={s.quantize} title="Quantize the selection (or the whole track) to the grid (Q)">
          Q
        </button>
      </div>

      {s.chordMode && (
        <div className="tool-group chord-tools">
          <select className="select sm" value={s.chordType} onChange={(e) => s.set('chordType', e.target.value)} title="Chord type">
            {CHORD_TYPES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="seg" title="Inversion of placed chords: root position, 1st, 2nd, 3rd inversion">
            {[0, 1, 2, 3].map((i) => (
              <button key={i} className={s.inversion === i ? 'on' : ''} onClick={() => s.set('inversion', i)}>
                {i === 0 ? 'R' : i}
              </button>
            ))}
          </div>
          <select className="select sm" value={s.chordLength} onChange={(e) => s.set('chordLength', Number(e.target.value))} title="Chord length">
            {CHORD_LENGTHS.map((l) => (
              <option key={l.ticks} value={l.ticks}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="tool-group">
        <select
          className="select sm prog"
          value=""
          onChange={(e) => {
            if (e.target.value) s.insertProgression(e.target.value, withBass);
          }}
          title="Replaces the Chords track with a 4-chord progression in the chosen key"
        >
          <option value="">⚡ Progression…</option>
          {PROGRESSIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="check" title="Also generate the bass (root notes)">
          <input type="checkbox" checked={withBass} onChange={(e) => setWithBass(e.target.checked)} /> + bass
        </label>
      </div>

      <div className="tool-group">
        <span className="tool-label small">Inv.</span>
        <button className="btn sm icon" disabled={selNotes.length < 2} onClick={() => s.invertSelection(1)} title="Invert the selection upward (I)">
          <I.ArrowUp size={13} />
        </button>
        <button className="btn sm icon" disabled={selNotes.length < 2} onClick={() => s.invertSelection(-1)} title="Invert downward (Shift + I)">
          <I.ArrowDown size={13} />
        </button>
      </div>

      <div className="tool-group">
        <button className={`btn icon ${s.ghosts ? 'on' : ''}`} title="Ghost notes from other tracks (G)" onClick={() => s.set('ghosts', !s.ghosts)}>
          <I.Ghost />
        </button>
        <button className={`btn icon ${s.scaleHighlight ? 'on' : ''}`} title="Highlight the scale (H)" onClick={() => s.set('scaleHighlight', !s.scaleHighlight)}>
          <I.Scale />
        </button>
      </div>

      <div className="tool-group">
        <button className="btn icon" title="Zoom out (-)" onClick={() => s.set('pxPerBeat', clamp(s.pxPerBeat / 1.25, 24, 480))}>
          <I.ZoomOut />
        </button>
        <button className="btn icon" title="Zoom in (+), or Ctrl + wheel" onClick={() => s.set('pxPerBeat', clamp(s.pxPerBeat * 1.25, 24, 480))}>
          <I.ZoomIn />
        </button>
      </div>

      <div className="tool-status">
        {selNotes.length > 0 ? (
          <>
            <span>
              {selNotes.length} note{selNotes.length !== 1 ? 's' : ''}
            </span>
            {chord && <span className="tag accent">{chord}</span>}
          </>
        ) : (
          <span className="muted">{s.chordMode ? 'Click to place a chord' : s.tool === 'select' ? 'Drag to select' : 'Click to add a note'}</span>
        )}
      </div>
    </div>
  );
}

/** Barre d'outils de la grille de batterie. */
function DrumToolbar() {
  const s = useEditor();
  const [withFill, setWithFill] = useState(true);
  const hits = s.comp.tracks.drums.notes.length;

  return (
    <div className="toolbar">
      <div className="tool-group">
        <span className="tool-label" title="Grid resolution">
          <I.Magnet size={14} />
        </span>
        <select className="select sm" value={s.snap} onChange={(e) => s.set('snap', e.target.value)} title="Grid resolution: 1/16 for most styles, triplets or 1/32 for trap hi-hats">
          {SNAP_OPTIONS.filter((o) => o.ticks <= PPQ).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn sm" onClick={s.quantize} title="Quantize to the grid (Q)">
          Q
        </button>
      </div>

      <div className="tool-group">
        <select
          className="select sm prog"
          value=""
          onChange={(e) => {
            if (e.target.value) s.insertDrumPattern(e.target.value, withFill);
          }}
          title="Replaces the Drums track with a ready-made pattern (also sets the kit and swing)"
        >
          <option value="">🥁 Pattern…</option>
          {DRUM_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="check" title="Variation (break) in bar 4, when the pattern has one">
          <input type="checkbox" checked={withFill} onChange={(e) => setWithFill(e.target.checked)} /> + break
        </label>
      </div>

      <div className="tool-group">
        <button className="btn sm" disabled={!hits} onClick={s.repeatDrumBar} title="Copy bar 1 to bars 2, 3 and 4">
          Repeat bar 1
        </button>
        <button className="btn sm" disabled={!hits} onClick={s.humanize} title="Slightly vary hit velocity and timing (U)">
          Humanize
        </button>
      </div>

      <div className="tool-group">
        <button className={`btn icon ${s.ghosts ? 'on' : ''}`} title="Bass markers on the ruler (G)" onClick={() => s.set('ghosts', !s.ghosts)}>
          <I.Ghost />
        </button>
        <button className={`btn sm ${s.drumCompact ? 'on' : ''}`} title="Show only used rows" onClick={() => s.set('drumCompact', !s.drumCompact)}>
          Used rows
        </button>
      </div>

      <div className="tool-group">
        <button className="btn icon" title="Zoom out (-)" onClick={() => s.set('pxPerBeat', clamp(s.pxPerBeat / 1.25, 24, 480))}>
          <I.ZoomOut />
        </button>
        <button className="btn icon" title="Zoom in (+), or Ctrl + wheel" onClick={() => s.set('pxPerBeat', clamp(s.pxPerBeat * 1.25, 24, 480))}>
          <I.ZoomIn />
        </button>
      </div>

      <div className="tool-status">
        <span className="muted">Shift + click: accent · Alt + click: roll</span>
      </div>
    </div>
  );
}
