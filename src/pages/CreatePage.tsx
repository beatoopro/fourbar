import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../editor/store';
import { PianoRoll } from '../editor/PianoRoll';
import { DrumGrid } from '../editor/DrumGrid';
import { Toolbar } from '../editor/Toolbar';
import { TrackPanel } from '../editor/TrackPanel';
import { ShortcutsHelp } from '../editor/ShortcutsHelp';
import { engine } from '../audio/engine';
import { renderWav } from '../audio/wav';
import { NOTE_NAMES, SCALES } from '../core/theory';
import { clamp, snapTicks } from '../core/timing';
import { swingLabel } from '../core/drums';
import { TRACK_IDS } from '../core/types';
import { createComposition, noteCount } from '../core/composition';
import { downloadBlob, downloadMidi, midiFileName, midiToComposition } from '../core/midi';
import { PublishDialog } from '../community/PublishDialog';
import { loopPath } from '../community/loopLink';
import { useCommunity } from '../community/store';
import { ensureAccount, ensureDownloadAllowed } from '../community/auth';
import { api, ME_ID } from '../services';
import { navigate, toast, useEngineState } from '../ui/common';
import * as I from '../ui/Icons';

const REMINDER_KEY = '4chords:v1:guestReminderDismissed';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* stockage indisponible */
  }
}

export function CreatePage() {
  const comp = useEditor((s) => s.comp);
  const dirty = useEditor((s) => s.dirty);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const drums = useEditor((s) => s.activeTrack === 'drums');
  const engineState = useEngineState();
  const playing = engineState.playing && engineState.sourceId === 'editor';
  const [publishing, setPublishing] = useState(false);
  const [help, setHelp] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [rendering, setRendering] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bump = useCommunity((s) => s.bump);
  const me = useCommunity((s) => s.me);
  const ready = useCommunity((s) => s.ready);
  const [guestDrafts, setGuestDrafts] = useState(0);
  const [reminderDismissed, setReminderDismissed] = useState(() => readFlag(REMINDER_KEY));

  // Rappel doux, une seule fois : à partir de 3 brouillons, l'invité apprend qu'ils ne sont que dans ce navigateur.
  useEffect(() => {
    if (ready && !me) void api.listDrafts().then((d) => setGuestDrafts(d.length));
  }, [ready, me]);
  const showReminder = ready && !me && !reminderDismissed && guestDrafts >= 3;
  const dismissReminder = () => {
    setReminderDismissed(true);
    writeFlag(REMINDER_KEY);
  };

  // Le moteur suit les modifications en temps réel pendant la lecture.
  useEffect(() => {
    if (playing) engine.update(comp);
  }, [comp, playing]);

  // Arrêt de la lecture en quittant l'éditeur.
  useEffect(() => () => {
    if (engine.getState().sourceId === 'editor') engine.stop();
  }, []);

  const togglePlay = () => void engine.toggle(useEditor.getState().comp, 'editor');

  /* ---------- Raccourcis clavier ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable], .modal')) return;
      const st = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const step = snapTicks(st.snap);
      let handled = true;

      if (e.code === 'Space') togglePlay();
      else if (mod && k === 'z' && !e.shiftKey) st.undo();
      else if ((mod && k === 'z' && e.shiftKey) || (mod && k === 'y')) st.redo();
      else if (mod && k === 'c') st.copy();
      else if (mod && k === 'x') st.cut();
      else if (mod && k === 'v') st.paste();
      else if (mod && k === 'd') st.duplicate();
      else if (mod && k === 'a') st.selectAll();
      else if (mod && k === 's') void save();
      else if (mod) handled = false;
      else if (k === 'delete' || k === 'backspace') st.deleteSelection();
      else if (k === 'arrowup') st.transpose(e.shiftKey ? 12 : 1);
      else if (k === 'arrowdown') st.transpose(e.shiftKey ? -12 : -1);
      else if (k === 'arrowright') e.shiftKey ? st.resizeBy(step) : st.nudge(step);
      else if (k === 'arrowleft') e.shiftKey ? st.resizeBy(-step) : st.nudge(-step);
      else if (k === '1' || k === '2' || k === '3' || k === '4') st.setTrack(TRACK_IDS[Number(k) - 1]);
      else if (k === 'd' || k === 'p' || k === 'b') {
        st.set('tool', 'draw');
        st.set('chordMode', false);
      } else if (k === 's' || k === 'e') {
        st.set('tool', 'select');
        st.set('chordMode', false);
      } else if (k === 'c' && st.activeTrack !== 'drums') {
        st.set('chordMode', !st.chordMode);
        st.set('tool', 'draw');
      } else if (k === 'i') st.invertSelection(e.shiftKey ? -1 : 1);
      else if (k === 'q') st.quantize();
      else if (k === 'u') st.humanize();
      else if (k === 'g') st.set('ghosts', !st.ghosts);
      else if (k === 'h') st.set('scaleHighlight', !st.scaleHighlight);
      else if (k === '+' || k === '=') st.set('pxPerBeat', clamp(st.pxPerBeat * 1.25, 24, 480));
      else if (k === '-') st.set('pxPerBeat', clamp(st.pxPerBeat / 1.25, 24, 480));
      else if (k === 'escape') {
        st.set('selection', []);
        st.set('chordMode', false);
        st.set('cursorTick', null);
        setHelp(false);
      } else if (k === '?') setHelp((h) => !h);
      else handled = false;

      if (handled) e.preventDefault();
    };
    // Après un choix dans une liste ou un curseur, on rend le focus au piano roll
    // pour que les raccourcis (Espace, 1/2/3…) restent actifs.
    const onChange = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'SELECT' || (t as HTMLInputElement).type === 'range' || (t as HTMLInputElement).type === 'checkbox') t.blur();
    };
    // Évite qu'Espace ne « clique » aussi sur le dernier bouton cliqué.
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (btn && !btn.closest('.modal')) btn.blur();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('change', onChange);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('change', onChange);
      document.removeEventListener('click', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Actions projet ---------- */
  const save = async () => {
    const c = useEditor.getState().comp;
    await api.saveDraft({ ...c, title: c.title || 'Untitled' });
    useEditor.getState().markSaved();
    bump();
    if (useCommunity.getState().me) toast('Project saved to your profile');
    else {
      toast('Project saved in this browser');
      setGuestDrafts((await api.listDrafts()).length);
    }
  };

  const newProject = () => {
    if (noteCount(useEditor.getState().comp) > 0 && useEditor.getState().dirty && !confirm('Start a new project? Unsaved changes to the draft will be lost.')) return;
    engine.stop();
    useEditor.getState().load(createComposition(ME_ID, { bpm: comp.bpm, key: comp.key }));
  };

  const exportMidi = async () => {
    setExportOpen(false);
    if (await ensureDownloadAllowed()) downloadMidi(useEditor.getState().comp);
  };

  const exportWav = async () => {
    setExportOpen(false);
    if (!(await ensureDownloadAllowed())) return;
    setRendering(true);
    try {
      const blob = await renderWav(useEditor.getState().comp);
      downloadBlob(blob, midiFileName(comp).replace(/\.mid$/, '.wav'), 'audio/wav');
    } catch (e) {
      console.error(e);
      toast('WAV render failed');
    } finally {
      setRendering(false);
    }
  };

  const importMidi = async (file: File) => {
    try {
      const c = midiToComposition(await file.arrayBuffer(), ME_ID);
      if (!c.title || c.title === 'Import MIDI') c.title = file.name.replace(/\.midi?$/i, '');
      useEditor.getState().load(c);
      toast('MIDI imported (first 4 bars, drums on channel 10)');
    } catch {
      toast('Unreadable MIDI file');
    }
  };

  return (
    <div className="create">
      <div className="create-head">
        <input
          className="title-input"
          value={comp.title}
          placeholder="Untitled"
          onChange={(e) => useEditor.getState().updateComp({ title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {comp.remixOf && <span className="tag accent">Remix</span>}

        <div className="transport">
          <button className={`btn play ${playing ? 'on' : ''}`} onClick={togglePlay} title="Play / stop (Space)">
            {playing ? <I.Stop size={14} /> : <I.Play size={14} />}
          </button>
          <label className="bpm" title="Tempo (BPM)">
            <input
              type="number"
              min={40}
              max={220}
              value={comp.bpm}
              onChange={(e) => useEditor.getState().updateComp({ bpm: clamp(Number(e.target.value) || 90, 40, 220) })}
            />
            <span>BPM</span>
          </label>
          <label className="swing" title="16th-note swing, on all tracks (50% = straight)">
            <span>Swing</span>
            <input
              className="range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={comp.swing ?? 0}
              onChange={(e) => useEditor.getState().updateComp({ swing: Number(e.target.value) })}
            />
            <b>{swingLabel(comp.swing ?? 0)}</b>
          </label>
          <div className="key-select" title="Key (used for scale highlighting and auto chords)">
            <select className="select sm" value={comp.key.root} onChange={(e) => useEditor.getState().updateComp({ key: { ...comp.key, root: Number(e.target.value) } })}>
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
            <select className="select sm" value={comp.key.scale} onChange={(e) => useEditor.getState().updateComp({ key: { ...comp.key, scale: e.target.value } })}>
              {SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="head-actions">
          <button className="btn ghost sm icon" disabled={!canUndo} onClick={() => useEditor.getState().undo()} title="Undo (Ctrl+Z)">
            <I.Undo size={15} />
          </button>
          <button className="btn ghost sm icon" disabled={!canRedo} onClick={() => useEditor.getState().redo()} title="Redo (Ctrl+Shift+Z)">
            <I.Redo size={15} />
          </button>
          <span className="divider" />
          <button className="btn ghost sm" onClick={() => setHelp(true)} title="Keyboard shortcuts (?)">
            <I.Keyboard size={15} />
          </button>
          <button className="btn ghost sm" onClick={newProject} title="New project">
            <I.Plus size={15} /> <span className="hide-sm">New</span>
          </button>
          <button className="btn ghost sm" onClick={() => void save()} title="Save to my profile (Ctrl+S)">
            <I.Save size={15} /> <span className="hide-sm">{dirty ? 'Save' : 'Saved'}</span>
          </button>
          <div className="menu-wrap">
            <button className="btn sm" onClick={() => setExportOpen((o) => !o)} disabled={rendering}>
              <I.Download size={15} /> {rendering ? 'Rendering…' : 'Export'}
            </button>
            {exportOpen && (
              <div className="menu" onMouseLeave={() => setExportOpen(false)}>
                <button onClick={() => void exportMidi()}>
                  <b>MIDI</b>
                  <span>4 tracks, drums on channel 10</span>
                </button>
                <button onClick={() => void exportWav()}>
                  <b>WAV</b>
                  <span>4-bar audio loop</span>
                </button>
                <button onClick={() => { setExportOpen(false); fileRef.current?.click(); }}>
                  <b>Import MIDI…</b>
                  <span>Replaces the draft</span>
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".mid,.midi,audio/midi"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importMidi(f);
                e.target.value = '';
              }}
            />
          </div>
          <button className="btn primary sm" onClick={() => setPublishing(true)} disabled={noteCount(comp) === 0}>
            <I.Upload size={15} /> Publish
          </button>
        </div>
      </div>

      {showReminder && (
        <div className="guest-banner" role="status">
          <span>Your loops are only saved in this browser. Create a free account to find them anywhere.</span>
          <button
            className="btn primary sm"
            onClick={async () => {
              if (await ensureAccount({ kind: 'signin' })) dismissReminder();
            }}
          >
            Create an account
          </button>
          <button className="auth-close" onClick={dismissReminder} aria-label="Dismiss">
            <I.Close size={14} />
          </button>
        </div>
      )}
      <div className="create-body">
        <TrackPanel />
        <div className="editor">
          <Toolbar />
          {drums ? <DrumGrid /> : <PianoRoll />}
        </div>
      </div>

      {publishing && (
        <PublishDialog
          comp={comp}
          onClose={() => setPublishing(false)}
          onPublished={(p) => {
            setPublishing(false);
            useEditor.getState().updateComp({ title: p.composition.title, genres: p.composition.genres, moods: p.composition.moods });
            useEditor.getState().markSaved();
            bump();
            toast('Published! Your loop is now visible in Explore.');
            navigate(loopPath(p.id));
          }}
        />
      )}
      {help && <ShortcutsHelp onClose={() => setHelp(false)} />}
    </div>
  );
}
