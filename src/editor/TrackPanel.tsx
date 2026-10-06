import { TRACK_IDS } from '../core/types';
import { instrumentsFor } from '../core/instruments';
import { useEditor } from './store';
import * as I from '../ui/Icons';

/** Liste des 4 pistes : sélection, instrument, volume, vélocité par défaut, mute/solo. */
export function TrackPanel() {
  const comp = useEditor((s) => s.comp);
  const active = useEditor((s) => s.activeTrack);
  const setTrack = useEditor((s) => s.setTrack);
  const updateTrack = useEditor((s) => s.updateTrack);

  return (
    <div className="tracks">
      {TRACK_IDS.map((id, i) => {
        const t = comp.tracks[id];
        return (
          <div
            key={id}
            className={`track ${active === id ? 'active' : ''}`}
            style={{ ['--c' as string]: `var(--${id})` }}
            onClick={() => setTrack(id)}
          >
            <div className="track-head">
              <span className="track-dot" />
              <span className="track-name">{t.name}</span>
              <span className="track-count" title={`Raccourci : touche ${i + 1}`}>
                {t.notes.length} {id === 'drums' ? 'coup' : 'note'}
                {t.notes.length > 1 ? 's' : ''}
              </span>
              <div className="track-btns" onClick={(e) => e.stopPropagation()}>
                <button className={`ms ${t.muted ? 'on mute' : ''}`} title="Muet" onClick={() => updateTrack(id, { muted: !t.muted })}>
                  M
                </button>
                <button className={`ms ${t.solo ? 'on solo' : ''}`} title="Solo" onClick={() => updateTrack(id, { solo: !t.solo })}>
                  S
                </button>
              </div>
            </div>
            <div className="track-body" onClick={(e) => e.stopPropagation()}>
              <select className="select sm" value={t.instrument} onChange={(e) => updateTrack(id, { instrument: e.target.value })} title="Instrument">
                {instrumentsFor(id).map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.label}
                  </option>
                ))}
              </select>
              <label className="slider" title={`Volume ${Math.round(t.volume * 100)} %`}>
                <I.Speaker size={13} muted={t.muted || t.volume === 0} />
                <input className="range" type="range" min={0} max={1} step={0.01} value={t.volume} onChange={(e) => updateTrack(id, { volume: Number(e.target.value) })} />
              </label>
              <label className="slider" title={`Vélocité des nouvelles notes : ${Math.round(t.defaultVelocity * 127)}`}>
                <span className="vel-icon">V</span>
                <input
                  className="range"
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.01}
                  value={t.defaultVelocity}
                  onChange={(e) => updateTrack(id, { defaultVelocity: Number(e.target.value) })}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
