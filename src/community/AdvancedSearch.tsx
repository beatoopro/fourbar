import { DATE_RANGES, keyFamily, parseProgression, type AdvancedFilters, type TrackRule } from '../core/search';
import { INSTRUMENTS } from '../core/instruments';
import { NOTE_NAMES } from '../core/theory';
import { TRACK_IDS, type Composition, type TrackId } from '../core/types';
import * as I from '../ui/Icons';

/** Panneau « Advanced » d'Explore et rappel des filtres actifs sous forme de chips. */

const TRACK_LABELS: Record<TrackId, string> = { chords: 'Chords', melody: 'Melody', bass: 'Bass', drums: 'Drums' };
const NEXT_RULE: Record<'any' | TrackRule, TrackRule | undefined> = { any: 'with', with: 'without', without: undefined };

type Change = (patch: Partial<AdvancedFilters>) => void;

function toNum(v: string): number | undefined {
  const n = Math.round(Number(v));
  return v.trim() === '' || !(n >= 1) ? undefined : Math.min(n, 300);
}

export function AdvancedPanel({
  filters: f,
  onChange,
  onReset,
  project,
}: {
  filters: AdvancedFilters;
  onChange: Change;
  onReset: () => void;
  /** Projet ouvert dans l'éditeur, pour « Match my project » (absent s'il est vide). */
  project: Composition | null;
}) {
  const setTrack = (t: TrackId) => onChange({ tracks: { ...f.tracks, [t]: NEXT_RULE[f.tracks?.[t] ?? 'any'] } });

  return (
    <div className="adv-panel">
      <div className="adv-grid">
        <div className="adv-field">
          <span className="label">BPM</span>
          <div className="adv-row">
            <input className="input" type="number" min={1} max={300} placeholder="from" aria-label="BPM from" value={f.bpmMin ?? ''} onChange={(e) => onChange({ bpmMin: toNum(e.target.value) })} />
            <span className="adv-dash">to</span>
            <input className="input" type="number" min={1} max={300} placeholder="to" aria-label="BPM to" value={f.bpmMax ?? ''} onChange={(e) => onChange({ bpmMax: toNum(e.target.value) })} />
          </div>
        </div>

        <div className="adv-field">
          <span className="label">Key</span>
          <div className="adv-row">
            <select className="select" aria-label="Key root" value={f.keyRoot ?? ''} onChange={(e) => onChange({ keyRoot: e.target.value === '' ? undefined : Number(e.target.value) })}>
              <option value="">Any key</option>
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
            <select className="select" aria-label="Key mode" value={f.keyMode ?? ''} onChange={(e) => onChange({ keyMode: (e.target.value || undefined) as AdvancedFilters['keyMode'] })}>
              <option value="">Major or minor</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
          <label className={`adv-check ${f.keyRoot === undefined ? 'disabled' : ''}`}>
            <input type="checkbox" disabled={f.keyRoot === undefined} checked={!!f.relativeKey} onChange={(e) => onChange({ relativeKey: e.target.checked || undefined })} />
            Include relative key
          </label>
        </div>

        <div className="adv-field">
          <span className="label">Artist</span>
          <input className="input" placeholder="Name or @handle" value={f.artist ?? ''} onChange={(e) => onChange({ artist: e.target.value || undefined })} />
        </div>

        <div className="adv-field">
          <span className="label">Date</span>
          <select className="select" value={f.date ?? ''} onChange={(e) => onChange({ date: (e.target.value || undefined) as AdvancedFilters['date'] })}>
            <option value="">Any date</option>
            {DATE_RANGES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="adv-field wide">
          <span className="label">Chord progression</span>
          <input className="input" placeholder="ii-V-I  or  Am F C G" value={f.progression ?? ''} onChange={(e) => onChange({ progression: e.target.value || undefined })} />
          {f.progression?.trim() && !parseProgression(f.progression) ? (
            <span className="adv-hint error">Not recognised. Try “ii-V-I”, “i VI III VII” or “Am F C G”.</span>
          ) : (
            <span className="adv-hint">Roman numerals follow each loop's key (lowercase = minor). Chord names match any extension: Am finds Am7.</span>
          )}
        </div>

        <div className="adv-field">
          <span className="label">Instrument</span>
          <select className="select" value={f.instrument ?? ''} onChange={(e) => onChange({ instrument: e.target.value || undefined })}>
            <option value="">Any instrument</option>
            {TRACK_IDS.map((t) => (
              <optgroup key={t} label={TRACK_LABELS[t]}>
                {INSTRUMENTS.filter((i) => i.track === t).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="adv-field">
          <span className="label">Type</span>
          <div className="seg">
            {(
              [
                [undefined, 'All'],
                ['original', 'Originals'],
                ['remix', 'Remixes'],
              ] as const
            ).map(([id, label]) => (
              <button key={label} className={f.origin === id ? 'on' : ''} onClick={() => onChange({ origin: id })}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="adv-field wide">
          <span className="label">Tracks</span>
          <div className="chips">
            {TRACK_IDS.map((t) => {
              const rule = f.tracks?.[t];
              return (
                <button
                  key={t}
                  className={`chip track-rule ${t} ${rule ?? ''}`}
                  title="Click to require, exclude or ignore this track"
                  onClick={() => setTrack(t)}
                >
                  {rule === 'with' ? `With ${t}` : rule === 'without' ? `No ${t}` : TRACK_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>


        <div className="adv-actions">
          {project && (
            <button
              className="btn sm"
              title={`BPM ${project.bpm - 5}–${project.bpm + 5}, ${NOTE_NAMES[project.key.root]} ${keyFamily(project.key.scale)} or its relative`}
              onClick={() =>
                onChange({
                  bpmMin: project.bpm - 5,
                  bpmMax: project.bpm + 5,
                  keyRoot: project.key.root,
                  keyMode: keyFamily(project.key.scale),
                  relativeKey: true,
                })
              }
            >
              <I.Wand size={14} /> Match my project
            </button>
          )}
          <button className="btn sm ghost" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/** Une chip par filtre avancé actif, avec une croix pour le retirer. */
export function ActiveFilters({ filters: f, onChange }: { filters: AdvancedFilters; onChange: Change }) {
  const items: { key: string; label: string; clear: Partial<AdvancedFilters> }[] = [];
  if (f.bpmMin !== undefined || f.bpmMax !== undefined) {
    const label = f.bpmMin !== undefined && f.bpmMax !== undefined ? `${f.bpmMin}–${f.bpmMax} BPM` : f.bpmMin !== undefined ? `≥ ${f.bpmMin} BPM` : `≤ ${f.bpmMax} BPM`;
    items.push({ key: 'bpm', label, clear: { bpmMin: undefined, bpmMax: undefined } });
  }
  if (f.keyRoot !== undefined || f.keyMode) {
    const root = f.keyRoot !== undefined ? NOTE_NAMES[f.keyRoot] : 'Any key';
    const label = `${root}${f.keyMode ? ` ${f.keyMode}` : ''}${f.relativeKey && f.keyRoot !== undefined ? ' + relative' : ''}`;
    items.push({ key: 'key', label, clear: { keyRoot: undefined, keyMode: undefined, relativeKey: undefined } });
  }
  if (f.artist?.trim()) items.push({ key: 'artist', label: `By ${f.artist.trim()}`, clear: { artist: undefined } });
  if (f.date) items.push({ key: 'date', label: DATE_RANGES.find((d) => d.id === f.date)!.label, clear: { date: undefined } });
  for (const t of TRACK_IDS) {
    const rule = f.tracks?.[t];
    if (rule) items.push({ key: t, label: rule === 'with' ? `With ${t}` : `No ${t}`, clear: { tracks: { ...f.tracks, [t]: undefined } } });
  }
  if (f.instrument) {
    const label = INSTRUMENTS.find((i) => i.id === f.instrument)?.label ?? f.instrument;
    items.push({ key: 'inst', label, clear: { instrument: undefined } });
  }
  if (f.progression?.trim()) items.push({ key: 'prog', label: `Chords: ${f.progression.trim()}`, clear: { progression: undefined } });
  if (f.origin) items.push({ key: 'origin', label: f.origin === 'remix' ? 'Remixes only' : 'Originals only', clear: { origin: undefined } });
  if (items.length === 0) return null;

  return (
    <div className="chips active-filters">
      {items.map((it) => (
        <button key={it.key} className="chip sm on" title="Remove this filter" onClick={() => onChange(it.clear)}>
          {it.label}
          <I.Close size={11} />
        </button>
      ))}
    </div>
  );
}
