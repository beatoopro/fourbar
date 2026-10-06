import { useState } from 'react';
import { CHORD_TYPES, PROGRESSIONS, detectChord } from '../core/theory';
import { BAR, PPQ, SNAP_OPTIONS, clamp } from '../core/timing';
import { DRUM_PATTERNS } from '../core/drums';
import { useEditor } from './store';
import * as I from '../ui/Icons';

const CHORD_LENGTHS = [
  { label: '1 mesure', ticks: BAR },
  { label: '2 temps', ticks: PPQ * 2 },
  { label: '1 temps', ticks: PPQ },
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
      <div className="tool-group" role="group" aria-label="Outils">
        <button className={`btn icon ${s.tool === 'draw' && !s.chordMode ? 'on' : ''}`} title="Crayon (D)" onClick={() => { s.set('tool', 'draw'); s.set('chordMode', false); }}>
          <I.Pencil />
        </button>
        <button className={`btn icon ${s.chordMode ? 'on' : ''}`} title="Accords (C)" onClick={() => { s.set('chordMode', !s.chordMode); s.set('tool', 'draw'); }}>
          <I.Chord />
        </button>
        <button className={`btn icon ${s.tool === 'select' ? 'on' : ''}`} title="Sélection (S) — ou Ctrl + glisser" onClick={() => { s.set('tool', 'select'); s.set('chordMode', false); }}>
          <I.Cursor />
        </button>
      </div>

      <div className="tool-group">
        <span className="tool-label" title="Grille / magnétisme">
          <I.Magnet size={14} />
        </span>
        <select className="select sm" value={s.snap} onChange={(e) => s.set('snap', e.target.value)} title="Magnétisme (Alt pendant un glisser pour le désactiver)">
          {SNAP_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn sm" onClick={s.quantize} title="Quantifier la sélection (ou toute la piste) sur la grille (Q)">
          Q
        </button>
      </div>

      {s.chordMode && (
        <div className="tool-group chord-tools">
          <select className="select sm" value={s.chordType} onChange={(e) => s.set('chordType', e.target.value)} title="Type d'accord">
            {CHORD_TYPES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <div className="seg" title="Renversement des accords posés : position fondamentale, 1er, 2e, 3e renversement">
            {[0, 1, 2, 3].map((i) => (
              <button key={i} className={s.inversion === i ? 'on' : ''} onClick={() => s.set('inversion', i)}>
                {i === 0 ? 'F' : i}
              </button>
            ))}
          </div>
          <select className="select sm" value={s.chordLength} onChange={(e) => s.set('chordLength', Number(e.target.value))} title="Durée des accords">
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
          title="Remplace la piste Chords par une progression de 4 accords dans la tonalité choisie"
        >
          <option value="">⚡ Progression…</option>
          {PROGRESSIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="check" title="Générer aussi la basse (fondamentales)">
          <input type="checkbox" checked={withBass} onChange={(e) => setWithBass(e.target.checked)} /> + basse
        </label>
      </div>

      <div className="tool-group">
        <span className="tool-label small">Renv.</span>
        <button className="btn sm icon" disabled={selNotes.length < 2} onClick={() => s.invertSelection(1)} title="Renverser la sélection vers le haut (I)">
          <I.ArrowUp size={13} />
        </button>
        <button className="btn sm icon" disabled={selNotes.length < 2} onClick={() => s.invertSelection(-1)} title="Renverser vers le bas (Maj + I)">
          <I.ArrowDown size={13} />
        </button>
      </div>

      <div className="tool-group">
        <button className={`btn icon ${s.ghosts ? 'on' : ''}`} title="Ghost notes des autres pistes (G)" onClick={() => s.set('ghosts', !s.ghosts)}>
          <I.Ghost />
        </button>
        <button className={`btn icon ${s.scaleHighlight ? 'on' : ''}`} title="Surligner la gamme (H)" onClick={() => s.set('scaleHighlight', !s.scaleHighlight)}>
          <I.Scale />
        </button>
      </div>

      <div className="tool-group">
        <button className="btn icon" title="Dézoomer (-)" onClick={() => s.set('pxPerBeat', clamp(s.pxPerBeat / 1.25, 24, 480))}>
          <I.ZoomOut />
        </button>
        <button className="btn icon" title="Zoomer (+) — ou Ctrl + molette" onClick={() => s.set('pxPerBeat', clamp(s.pxPerBeat * 1.25, 24, 480))}>
          <I.ZoomIn />
        </button>
      </div>

      <div className="tool-status">
        {selNotes.length > 0 ? (
          <>
            <span>
              {selNotes.length} note{selNotes.length > 1 ? 's' : ''}
            </span>
            {chord && <span className="tag accent">{chord}</span>}
          </>
        ) : (
          <span className="muted">{s.chordMode ? 'Cliquez pour poser un accord' : s.tool === 'select' ? 'Glissez pour sélectionner' : 'Cliquez pour ajouter une note'}</span>
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
        <span className="tool-label" title="Résolution de la grille">
          <I.Magnet size={14} />
        </span>
        <select className="select sm" value={s.snap} onChange={(e) => s.set('snap', e.target.value)} title="Résolution de la grille : 1/16 pour la plupart des styles, triolets ou 1/32 pour les hi-hats trap">
          {SNAP_OPTIONS.filter((o) => o.ticks <= PPQ).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn sm" onClick={s.quantize} title="Quantifier sur la grille (Q)">
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
          title="Remplace la piste Drums par un pattern prêt à l'emploi (règle aussi le kit et le swing)"
        >
          <option value="">🥁 Pattern…</option>
          {DRUM_PATTERNS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="check" title="Variation (break) en mesure 4, quand le pattern en propose une">
          <input type="checkbox" checked={withFill} onChange={(e) => setWithFill(e.target.checked)} /> + break
        </label>
      </div>

      <div className="tool-group">
        <button className="btn sm" disabled={!hits} onClick={s.repeatDrumBar} title="Copier la mesure 1 sur les mesures 2, 3 et 4">
          Répéter la mesure 1
        </button>
        <button className="btn sm" disabled={!hits} onClick={s.humanize} title="Varier légèrement la force et le placement des coups (U)">
          Humaniser
        </button>
      </div>

      <div className="tool-group">
        <button className={`btn icon ${s.ghosts ? 'on' : ''}`} title="Repères de la basse sur la règle (G)" onClick={() => s.set('ghosts', !s.ghosts)}>
          <I.Ghost />
        </button>
        <button className={`btn sm ${s.drumCompact ? 'on' : ''}`} title="N'afficher que les lignes utilisées" onClick={() => s.set('drumCompact', !s.drumCompact)}>
          Lignes utilisées
        </button>
      </div>

      <div className="tool-group">
        <button className="btn icon" title="Dézoomer (-)" onClick={() => s.set('pxPerBeat', clamp(s.pxPerBeat / 1.25, 24, 480))}>
          <I.ZoomOut />
        </button>
        <button className="btn icon" title="Zoomer (+) — ou Ctrl + molette" onClick={() => s.set('pxPerBeat', clamp(s.pxPerBeat * 1.25, 24, 480))}>
          <I.ZoomIn />
        </button>
      </div>

      <div className="tool-status">
        <span className="muted">Maj + clic : accent · Alt + clic : roulement</span>
      </div>
    </div>
  );
}
