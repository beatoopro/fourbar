import { useEffect, useRef, useState } from 'react';
import type { Composition } from '../core/types';
import { GENRES, MOODS } from './constants';
import { api, ME_ID, remixNoteBody, type Publication } from '../services';

/**
 * Publication en une étape : titre + genre suffisent. Ambiances facultatives ;
 * BPM, tonalité, auteur et date sont renseignés automatiquement.
 */
export function PublishDialog({
  comp,
  onClose,
  onPublished,
}: {
  comp: Composition;
  onClose: () => void;
  onPublished: (p: Publication) => void;
}) {
  const [title, setTitle] = useState(comp.title);
  const [genres, setGenres] = useState<string[]>(comp.genres);
  const [moods, setMoods] = useState<string[]>(comp.moods);
  const [busy, setBusy] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);
  /** Original d'un remix : on propose de prévenir son auteur par un commentaire. */
  const [original, setOriginal] = useState<Publication | null>(null);
  const [notify, setNotify] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    void api.getPublication(comp.id).then((p) => setIsUpdate(!!p));
    if (comp.remixOf) void api.getPublication(comp.remixOf).then((o) => setOriginal(o && o.authorId !== ME_ID ? o : null));
  }, [comp.id, comp.remixOf]);

  const toggle = (list: string[], v: string, max: number) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v].slice(-max);

  const canPublish = title.trim().length > 0 && genres.length > 0 && !busy;

  const submit = async () => {
    if (!canPublish) return;
    setBusy(true);
    const pub = await api.publish({ ...comp, title: title.trim(), genres, moods });
    if (original && notify && !isUpdate) {
      await api.addComment(original.id, { body: remixNoteBody(pub.composition.title), linkedPublicationId: pub.id }).catch(() => undefined);
    }
    onPublished(pub);
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          // Entrée publie depuis n'importe quel champ ou bouton du formulaire.
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <h2>{isUpdate ? 'Update post' : 'Publish'}</h2>
        <p className="sub">
          {comp.bpm} BPM · 4 bars · {comp.remixOf ? 'remix · ' : ''}visible in Explore
        </p>
        <div className="field">
          <span className="label">Name</span>
          <input ref={inputRef} className="input" value={title} maxLength={60} placeholder="My progression" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <span className="label">Genre</span>
          <div className="chips">
            {GENRES.map((g) => (
              <button type="button" key={g} className={`chip sm ${genres.includes(g) ? 'on' : ''}`} onClick={() => setGenres(toggle(genres, g, 2))}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Mood · optional</span>
          <div className="chips">
            {MOODS.map((m) => (
              <button type="button" key={m} className={`chip sm ${moods.includes(m) ? 'on' : ''}`} onClick={() => setMoods(toggle(moods, m, 3))}>
                {m}
              </button>
            ))}
          </div>
        </div>
        {original && !isUpdate && (
          <label className="check">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Leave a comment on “{original.composition.title}” to announce this remix
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!canPublish}>
            {isUpdate ? 'Update' : 'Publish'}
          </button>
        </div>
      </form>
    </div>
  );
}
