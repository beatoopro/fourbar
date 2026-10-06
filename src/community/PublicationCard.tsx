import { useEffect, useRef, useState } from 'react';
import type { Composition } from '../core/types';
import { MELODIC_TRACK_IDS, TRACK_IDS } from '../core/types';
import { LOOP_TICKS } from '../core/timing';
import { keyLabel } from '../core/theory';
import { remixOf } from '../core/composition';
import { downloadMidi } from '../core/midi';
import { engine } from '../audio/engine';
import { useEditor } from '../editor/store';
import { api, ME_ID, type Publication } from '../services';
import { Avatar, navigate, timeAgo, toast, useEngineState } from '../ui/common';
import { useCommunity } from './store';
import * as I from '../ui/Icons';
import { loopPath } from './loopLink';

/** Bande de la batterie en bas de l'aperçu : cymbales/hats, snare/clap/toms, kick. */
const DRUM_ROW: Record<number, number> = { 49: 0, 51: 0, 46: 0, 42: 0, 70: 0, 50: 1, 45: 1, 39: 1, 38: 1, 36: 2 };
const DRUM_BAND = 7;

/**
 * Aperçu visuel simplifié : les notes des pistes mélodiques dans un mini piano
 * roll SVG, et le groove de la batterie en points sur une bande en bas.
 */
export function MiniPreview({ comp, playingId }: { comp: Composition; playingId?: string }) {
  const drums = comp.tracks.drums.notes;
  const H = drums.length ? 40 - DRUM_BAND - 1 : 40;
  const all = MELODIC_TRACK_IDS.flatMap((id) => comp.tracks[id].notes);
  const min = all.length ? Math.min(...all.map((n) => n.pitch)) - 2 : 40;
  const max = all.length ? Math.max(...all.map((n) => n.pitch)) + 2 : 80;
  const range = Math.max(24, max - min);
  const lineRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    if (!playingId) return;
    let raf = 0;
    const loop = () => {
      const t = engine.getTick();
      if (lineRef.current && t !== null) {
        const x = (t / LOOP_TICKS) * 100;
        lineRef.current.setAttribute('x1', String(x));
        lineRef.current.setAttribute('x2', String(x));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playingId]);

  return (
    <svg className="mini" viewBox="0 0 100 40" preserveAspectRatio="none">
      {[25, 50, 75].map((x) => (
        <line key={x} x1={x} x2={x} y1={0} y2={40} className="mini-bar" />
      ))}
      {MELODIC_TRACK_IDS.map((id) =>
        comp.tracks[id].notes.map((n) => (
          <rect
            key={n.id}
            x={(n.start / LOOP_TICKS) * 100}
            y={((max - n.pitch) / range) * H - 0.6}
            width={Math.max(0.6, (n.duration / LOOP_TICKS) * 100 - 0.3)}
            height={Math.max(1.1, H / range - 0.2)}
            rx={0.4}
            fill={`var(--${id})`}
            opacity={0.45 + n.velocity * 0.5}
          />
        )),
      )}
      {drums.map((n) => (
        <rect
          key={n.id}
          className="mini-hit"
          x={(n.start / LOOP_TICKS) * 100}
          y={40 - DRUM_BAND + (DRUM_ROW[n.pitch] ?? 0) * (DRUM_BAND / 3) + 0.3}
          width={0.7}
          height={DRUM_BAND / 3 - 0.6}
          rx={0.2}
          fill="var(--drums)"
          opacity={0.35 + n.velocity * 0.6}
        />
      ))}
      {playingId && <line ref={lineRef} x1={0} x2={0} y1={0} y2={40} className="mini-head" />}
    </svg>
  );
}

/** Ouvre une composition dans l'éditeur sous forme de remix. */
export function openRemix(pub: Publication) {
  const ed = useEditor.getState();
  if (ed.dirty && TRACK_IDS.some((id) => ed.comp.tracks[id].notes.length) && !confirm('Ouvrir ce remix dans l’éditeur ? Le brouillon en cours non enregistré sera remplacé.')) return;
  engine.stop();
  // Remixer sa propre création : on l'édite directement (mise à jour de la publication).
  ed.load(pub.authorId === ME_ID ? pub.composition : remixOf(pub.composition, ME_ID));
  navigate('/create');
}

export function PublicationCard({ pub, highlight }: { pub: Publication; highlight?: boolean }) {
  const users = useCommunity((s) => s.users);
  const liked = useCommunity((s) => s.liked.has(pub.id));
  const toggleLike = useCommunity((s) => s.toggleLike);
  const engineState = useEngineState();
  const [likes, setLikes] = useState(pub.likes);
  const [original, setOriginal] = useState<Publication | null>(null);
  const playing = engineState.playing && engineState.sourceId === pub.id;
  const c = pub.composition;
  const author = users[pub.authorId];

  useEffect(() => setLikes(pub.likes), [pub.likes]);
  useEffect(() => {
    if (c.remixOf) void api.getPublication(c.remixOf).then(setOriginal);
  }, [c.remixOf]);

  const play = async () => {
    if (!playing) void api.registerPlay(pub.id);
    await engine.toggle(c, pub.id);
  };

  return (
    <article className={`card ${playing ? 'playing' : ''} ${highlight ? 'highlight' : ''}`}>
      <div className="card-visual" onClick={() => void play()}>
        <MiniPreview comp={c} playingId={playing ? pub.id : undefined} />
        <button className="card-play" aria-label={playing ? 'Arrêter' : 'Écouter'}>
          {playing ? <I.Stop size={16} /> : <I.Play size={16} />}
        </button>
      </div>
      <div className="card-body">
        <button className="card-title" title={c.title} onClick={() => navigate(loopPath(pub.id))}>
          {c.title}
        </button>
        <button className="card-author" onClick={() => navigate(`/profile/${pub.authorId}`)}>
          <Avatar user={author} size={18} />
          <span>{author?.name ?? 'Inconnu'}</span>
          <span className="muted">· {timeAgo(pub.publishedAt)}</span>
        </button>
        {original && (
          <button className="card-remix-of" onClick={() => navigate(loopPath(original.id))}>
            <I.Remix size={12} /> Remix de « {original.composition.title} »
          </button>
        )}
        <div className="card-tags">
          {c.genres.map((g) => (
            <span key={g} className="tag accent">
              {g}
            </span>
          ))}
          <span className="tag">{c.bpm} BPM</span>
          <span className="tag">{keyLabel(c.key.root, c.key.scale)}</span>
          {c.moods.slice(0, 1).map((m) => (
            <span key={m} className="tag">
              {m}
            </span>
          ))}
        </div>
      </div>
      <div className="card-actions">
        <button
          className={`act ${liked ? 'liked' : ''}`}
          onClick={async () => setLikes(await toggleLike(pub))}
          title={liked ? 'Retirer des favoris' : 'J’aime'}
        >
          <I.Heart size={15} filled={liked} /> {likes}
        </button>
        <button className="act" onClick={() => navigate(loopPath(pub.id, 'comments'))} title="Commentaires">
          <I.Comment size={15} /> {pub.commentCount}
        </button>
        <button
          className="act"
          onClick={() => {
            downloadMidi(c);
            toast('MIDI téléchargé');
          }}
          title="Télécharger le MIDI"
        >
          <I.Download size={15} /> MIDI
        </button>
        <button className="act remix" onClick={() => openRemix(pub)} title="Ouvrir dans l’éditeur">
          <I.Remix size={15} /> {pub.authorId === ME_ID ? 'Éditer' : 'Remix'}
        </button>
      </div>
    </article>
  );
}
