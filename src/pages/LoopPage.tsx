import { useEffect, useRef, useState } from 'react';
import { LOOP_TICKS, PPQ } from '../core/timing';
import { keyLabel } from '../core/theory';
import { downloadBlob, downloadMidi, midiFileName } from '../core/midi';
import { decodeSharedLoop, type SharedAuthor } from '../core/share';
import { renderWav } from '../audio/wav';
import { engine } from '../audio/engine';
import { MiniPreview, PublicationCard, openRemix } from '../community/PublicationCard';
import { Comments } from '../community/Comments';
import { useCommunity } from '../community/store';
import { anchorLabel, loopPath, shareLink, shareUrl } from '../community/loopLink';
import { ensureDownloadAllowed } from '../community/auth';
import { api, type LoopComment, type Publication } from '../services';
import { Avatar, navigate, timeAgo, toast, useEngineState } from '../ui/common';
import * as I from '../ui/Icons';

/** Page d'une loop : écoute, infos, partage, remixes et commentaires. */
export function LoopPage({ id, data, focus }: { id: string; data: string | null; focus: string | null }) {
  const users = useCommunity((s) => s.users);
  const likedSet = useCommunity((s) => s.liked);
  const toggleLike = useCommunity((s) => s.toggleLike);
  const me = useCommunity((s) => s.me);
  const version = useCommunity((s) => s.version);
  const engineState = useEngineState();
  const [pub, setPub] = useState<Publication | null | undefined>(undefined);
  /** Auteur d'une loop ouverte depuis un lien partagé (inconnu de ce navigateur). */
  const [sharedAuthor, setSharedAuthor] = useState<SharedAuthor | null>(null);
  const [original, setOriginal] = useState<Publication | null>(null);
  const [remixes, setRemixes] = useState<Publication[]>([]);
  const [comments, setComments] = useState<LoopComment[]>([]);
  const [likes, setLikes] = useState(0);
  const [beat, setBeat] = useState<number | null>(null);
  const [rendering, setRendering] = useState(false);
  const scrolled = useRef(false);

  useEffect(() => {
    let alive = true;
    scrolled.current = false;
    void (async () => {
      const local = await api.getPublication(id);
      if (local) {
        if (alive) {
          setPub(local);
          setSharedAuthor(null);
          setLikes(local.likes);
        }
        return;
      }
      const shared = data ? await decodeSharedLoop(data) : null;
      if (!alive) return;
      if (!shared) return setPub(null);
      setSharedAuthor(shared.author);
      setPub({
        id,
        composition: { ...shared.composition, id },
        authorId: `shared:${shared.author.handle}`,
        likes: 0,
        plays: 0,
        publishedAt: shared.publishedAt,
        commentCount: 0,
      });
    })();
    return () => {
      alive = false;
    };
  }, [id, data]);

  // Original (si remix) et remixes de cette loop. Rechargés quand les données changent (publication d'un remix…).
  useEffect(() => {
    if (!pub) return;
    const origId = pub.composition.remixOf;
    if (origId) void api.getPublication(origId).then(setOriginal);
    else setOriginal(null);
    void api.listPublications({ remixesOnly: true, sort: 'popular' }).then((list) => setRemixes(list.filter((p) => p.composition.remixOf === pub.id)));
  }, [pub, version]);

  useEffect(() => {
    if (pub && focus === 'comments' && !scrolled.current) {
      scrolled.current = true;
      requestAnimationFrame(() => document.getElementById('comments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [pub, focus]);

  const playing = !!pub && engineState.playing && engineState.sourceId === pub.id;

  // Temps courant (pour les repères et les commentaires ancrés). Ne re-rend qu'à chaque changement de temps.
  useEffect(() => {
    if (!playing) return setBeat(null);
    const timer = setInterval(() => {
      const t = engine.getTick();
      setBeat(t === null ? null : Math.floor(t / PPQ));
    }, 60);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => () => {
    if (engine.getState().sourceId !== 'editor') engine.stop();
  }, []);

  if (pub === undefined) return null;
  if (pub === null)
    return (
      <div className="page empty">
        This loop can’t be found. It may have been deleted, or the link is incomplete.
        <div style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => navigate('/explore')}>
            Back to Explore
          </button>
        </div>
      </div>
    );

  const c = pub.composition;
  const shared = !!sharedAuthor;
  const author = sharedAuthor ?? users[pub.authorId];
  const liked = likedSet.has(pub.id);
  const anchored = comments.filter((x) => x.anchorTick !== null && !x.deleted);

  const play = async () => {
    if (!playing && !shared) void api.registerPlay(pub.id);
    await engine.toggle(c, pub.id);
  };

  const playAt = async (tick: number) => {
    if (!playing) {
      if (!shared) void api.registerPlay(pub.id);
      await engine.play(c, pub.id);
    }
    engine.seek(tick);
  };

  const wav = async () => {
    if (!(await ensureDownloadAllowed())) return;
    setRendering(true);
    try {
      downloadBlob(await renderWav(c), midiFileName(c).replace(/\.mid$/, '.wav'), 'audio/wav');
    } catch (e) {
      console.error(e);
      toast('WAV render failed');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="page loop-page">
      <button className="back" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/explore'))}>
        <I.ArrowLeft size={15} /> Back
      </button>

      <div className={`loop-hero ${playing ? 'playing' : ''}`}>
        <div
          className="loop-visual"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            void playAt(Math.floor(((e.clientX - r.left) / r.width) * LOOP_TICKS));
          }}
          title="Click to play from here"
        >
          <MiniPreview comp={c} playingId={playing ? pub.id : undefined} />
          <div className="loop-markers">
            {anchored.map((m) => {
              const on = beat !== null && beat * PPQ >= m.anchorTick! && beat * PPQ < m.anchorTick! + 2 * PPQ;
              const u = users[m.authorId];
              return (
                <button
                  key={m.id}
                  className={`loop-marker ${on ? 'on' : ''}`}
                  style={{ left: `${(m.anchorTick! / LOOP_TICKS) * 100}%`, background: u?.color ?? 'var(--accent)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void playAt(m.anchorTick!);
                    document.getElementById(`cm-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  title={`${u?.name ?? ''} · ${anchorLabel(m.anchorTick!)}: ${m.body}`}
                />
              );
            })}
          </div>
          <div className="loop-bars" aria-hidden>
            {[1, 2, 3, 4].map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        </div>

        <div className="loop-info">
          <button className="loop-play" onClick={() => void play()} aria-label={playing ? 'Stop' : 'Play'}>
            {playing ? <I.Stop size={20} /> : <I.Play size={20} />}
          </button>
          <div className="loop-titles">
            <h1>{c.title}</h1>
            {shared ? (
              <span className="card-author">
                <Avatar user={author} size={20} />
                <span>{author?.name}</span>
                <span className="muted">· {timeAgo(pub.publishedAt)}</span>
              </span>
            ) : (
              <button className="card-author" onClick={() => navigate(`/profile/${pub.authorId}`)}>
                <Avatar user={author} size={20} />
                <span>{author?.name ?? 'Unknown'}</span>
                <span className="muted">· {timeAgo(pub.publishedAt)}</span>
              </button>
            )}
            {original && (
              <button className="card-remix-of" onClick={() => navigate(loopPath(original.id))}>
                <I.Remix size={12} /> Remix of “{original.composition.title}”
              </button>
            )}
          </div>
        </div>

        <div className="card-tags">
          {c.genres.map((g) => (
            <span key={g} className="tag accent">
              {g}
            </span>
          ))}
          <span className="tag">{c.bpm} BPM</span>
          <span className="tag">{keyLabel(c.key.root, c.key.scale)}</span>
          {c.moods.map((m) => (
            <span key={m} className="tag">
              {m}
            </span>
          ))}
          {!shared && <span className="tag">{pub.plays} plays</span>}
        </div>
        {c.description && <p className="loop-desc">{c.description}</p>}

        <div className="loop-actions">
          {!shared && (
            <button
              className={`btn ${liked ? 'liked' : ''}`}
              onClick={async () => {
                const n = await toggleLike(pub);
                if (n !== null) setLikes(n);
              }}
              title={liked ? 'Unlike' : 'Like'}
            >
              <I.Heart size={15} filled={liked} /> {likes}
            </button>
          )}
          <button
            className="btn"
            onClick={async () => shareLink(shared ? window.location.href : await shareUrl(pub, users[pub.authorId]), c.title)}
          >
            <I.Share size={15} /> Share
          </button>
          <button
            className="btn"
            onClick={async () => {
              if (!(await ensureDownloadAllowed())) return;
              downloadMidi(c);
              toast('MIDI downloaded');
            }}
          >
            <I.Download size={15} /> MIDI
          </button>
          <button className="btn" onClick={() => void wav()} disabled={rendering}>
            <I.Wave size={15} /> {rendering ? 'Rendering…' : 'WAV'}
          </button>
          <button className="btn primary" onClick={() => openRemix(pub)}>
            <I.Remix size={15} /> {pub.authorId === me?.id ? 'Edit' : 'Remix'}
          </button>
        </div>
      </div>

      {shared ? (
        <div className="loop-note">
          This loop was shared with you by link. You can listen to it, download the MIDI or remix it. Comments will show up
          here once Fourbar has online accounts.
        </div>
      ) : (
        <Comments pub={pub} activeTick={beat === null ? null : beat * PPQ} onPlayAt={(t) => void playAt(t)} onChange={setComments} />
      )}

      {remixes.length > 0 && (
        <section className="loop-remixes">
          <h2>
            Remixes <span className="muted">{remixes.length}</span>
          </h2>
          <div className="grid">
            {remixes.map((r) => (
              <PublicationCard key={r.id} pub={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
