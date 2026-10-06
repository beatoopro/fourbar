import { Fragment, useEffect, useRef, useState } from 'react';
import { BAR, BEATS_PER_BAR, BARS, PPQ } from '../core/timing';
import { engine } from '../audio/engine';
import { api, COMMENT_MAX_LENGTH, type CommentSort, type LoopComment, type Publication } from '../services';
import { Avatar, navigate, timeAgo, toast } from '../ui/common';
import { useCommunity } from './store';
import { ensureAccount } from './auth';
import { anchorLabel, loopPath, snapToBeat } from './loopLink';
import * as I from '../ui/Icons';

/** Nombre de réponses visibles avant « Voir les N réponses ». */
const VISIBLE_REPLIES = 2;

/** Met en valeur les @mentions dans le texte (le texte reste du texte : pas de HTML interprété). */
function Body({ text }: { text: string }) {
  return (
    <p className="cm-body">
      {text.split(/(@[\w.-]+)/g).map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="cm-mention">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

/** Sélecteur mesure / temps pour l'ancrage d'un commentaire. */
function AnchorPicker({ tick, onChange }: { tick: number; onChange: (t: number) => void }) {
  const bar = Math.floor(tick / BAR);
  const beat = Math.floor((tick % BAR) / PPQ);
  return (
    <span className="cm-anchor-pick">
      <select className="input sm" value={bar} onChange={(e) => onChange(Number(e.target.value) * BAR + beat * PPQ)} aria-label="Bar">
        {Array.from({ length: BARS }, (_, i) => (
          <option key={i} value={i}>
            Bar {i + 1}
          </option>
        ))}
      </select>
      <select className="input sm" value={beat} onChange={(e) => onChange(bar * BAR + Number(e.target.value) * PPQ)} aria-label="Beat">
        {Array.from({ length: BEATS_PER_BAR }, (_, i) => (
          <option key={i} value={i}>
            Beat {i + 1}
          </option>
        ))}
      </select>
    </span>
  );
}

function Composer({
  pubId,
  parentId,
  initial = '',
  allowAnchor,
  autoFocus,
  placeholder,
  onDone,
  onCancel,
}: {
  pubId: string;
  parentId?: string;
  initial?: string;
  allowAnchor: boolean;
  autoFocus?: boolean;
  placeholder: string;
  onDone: (c: LoopComment) => void;
  onCancel?: () => void;
}) {
  const me = useCommunity((s) => s.me);
  const [body, setBody] = useState(initial);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  // L'ancrage automatique ne s'applique qu'une fois : si on retire la puce, on ne la remet pas.
  const autoAnchored = useRef(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(initial.length, initial.length);
  }, [autoFocus, initial]);

  const playheadTick = () => {
    const s = engine.getState();
    const t = s.playing && s.sourceId === pubId ? engine.getTick() : null;
    return t === null ? null : snapToBeat(t);
  };

  const onFocus = () => {
    if (!allowAnchor || autoAnchored.current || anchor !== null) return;
    const t = playheadTick();
    if (t !== null) {
      autoAnchored.current = true;
      setAnchor(t);
    }
  };

  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      // Le texte reste dans le champ pendant la connexion, puis il est posté.
      if (!(await ensureAccount({ kind: 'comment' }))) return;
      const c = await api.addComment(pubId, { body, parentId, anchorTick: allowAnchor ? anchor : null });
      setBody('');
      setAnchor(null);
      setPicking(false);
      autoAnchored.current = false;
      onDone(c);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const left = COMMENT_MAX_LENGTH - body.length;

  return (
    <form
      className={`cm-composer ${parentId ? 'reply' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Avatar user={me} size={parentId ? 24 : 30} />
      <div className="cm-composer-main">
        <textarea
          ref={ref}
          className="input"
          rows={body.includes('\n') ? 3 : 1}
          value={body}
          maxLength={COMMENT_MAX_LENGTH}
          placeholder={placeholder}
          onFocus={onFocus}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie, Maj+Entrée va à la ligne. Les raccourcis de l'éditeur ne s'appliquent pas ici.
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
            if (e.key === 'Escape') onCancel?.();
          }}
        />
        <div className="cm-composer-bar">
          {allowAnchor &&
            (anchor === null ? (
              <button
                type="button"
                className="cm-chip ghost"
                onClick={() => {
                  setAnchor(playheadTick() ?? 0);
                  setPicking(true);
                }}
                title="Attach the comment to a moment in the loop"
              >
                <I.Pin size={12} /> Add a moment
              </button>
            ) : (
              <span className="cm-chip">
                <button type="button" onClick={() => setPicking(!picking)} title="Change the moment">
                  <I.Pin size={12} /> {anchorLabel(anchor)}
                </button>
                <button type="button" onClick={() => (setAnchor(null), setPicking(false))} aria-label="Remove the moment">
                  <I.Close size={11} />
                </button>
              </span>
            ))}
          {picking && anchor !== null && <AnchorPicker tick={anchor} onChange={setAnchor} />}
          <span className="cm-spacer" />
          {left < 80 && <span className={`cm-left ${left < 0 ? 'over' : ''}`}>{left}</span>}
          {onCancel && (
            <button type="button" className="btn ghost sm" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn primary sm" disabled={!body.trim() || busy}>
            {parentId ? 'Reply' : 'Post'}
          </button>
        </div>
      </div>
    </form>
  );
}

export function Comments({
  pub,
  activeTick,
  onPlayAt,
  onChange,
}: {
  pub: Publication;
  /** Position de lecture courante (arrondie au temps), pour mettre en avant les commentaires concernés. */
  activeTick: number | null;
  onPlayAt: (tick: number) => void;
  /** Appelé quand la liste change (pour les repères sur l'aperçu et le compteur). */
  onChange: (comments: LoopComment[]) => void;
}) {
  const users = useCommunity((s) => s.users);
  const bump = useCommunity((s) => s.bump);
  const meId = useCommunity((s) => s.me?.id ?? null);
  const [sort, setSort] = useState<CommentSort>('recent');
  const [comments, setComments] = useState<LoopComment[] | null>(null);
  const [replyTo, setReplyTo] = useState<{ threadId: string; mention: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [linkedTitles, setLinkedTitles] = useState<Record<string, string>>({});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const load = async () => {
    const list = await api.listComments(pub.id, sort);
    setComments(list);
    onChangeRef.current(list);
  };

  useEffect(() => {
    setComments(null);
    setReplyTo(null);
    setExpanded(new Set());
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub.id, sort, meId]);

  // Titres des loops liées (« J'ai remixé cette loop »), pour afficher un lien lisible.
  useEffect(() => {
    const ids = [...new Set((comments ?? []).map((c) => c.linkedPublicationId).filter((x): x is string => !!x))];
    if (!ids.length) return;
    void api.listPublications({ ids }).then((ps) => setLinkedTitles(Object.fromEntries(ps.map((p) => [p.id, p.composition.title]))));
  }, [comments]);

  const changed = async () => {
    await load();
    bump();
  };

  if (!comments) return null;

  const tops = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);
  const total = comments.filter((c) => !c.deleted).length;
  const loopIsMine = meId !== null && pub.authorId === meId;

  const item = (c: LoopComment, threadId: string) => {
    const author = users[c.authorId];
    const mine = meId !== null && c.authorId === meId;
    const active = activeTick !== null && c.anchorTick !== null && activeTick >= c.anchorTick && activeTick < c.anchorTick + 2 * PPQ;
    if (c.deleted) {
      return (
        <div className="cm-item deleted" key={c.id}>
          <span className="cm-deleted">Comment deleted</span>
        </div>
      );
    }
    return (
      <div className={`cm-item ${active ? 'active' : ''}`} key={c.id} id={`cm-${c.id}`}>
        <button className="cm-avatar" onClick={() => navigate(`/profile/${c.authorId}`)} aria-label={author?.name}>
          <Avatar user={author} size={c.parentId ? 24 : 30} />
        </button>
        <div className="cm-main">
          <div className="cm-head">
            <button className="cm-name" onClick={() => navigate(`/profile/${c.authorId}`)}>
              {author?.name ?? 'Unknown'}
            </button>
            {c.authorId === pub.authorId && <span className="cm-badge">Author</span>}
            <span className="muted">{timeAgo(c.createdAt)}</span>
            {c.anchorTick !== null && (
              <button className="cm-chip" onClick={() => onPlayAt(c.anchorTick!)} title="Play from this moment">
                <I.Play size={10} /> {anchorLabel(c.anchorTick)}
              </button>
            )}
          </div>
          <Body text={c.body} />
          {c.linkedPublicationId && (
            <button className="cm-linked" onClick={() => navigate(loopPath(c.linkedPublicationId!))}>
              <I.Remix size={12} /> Listen to “{linkedTitles[c.linkedPublicationId] ?? 'the remix'}”
            </button>
          )}
          <div className="cm-actions">
            <button
              className={c.likedByMe ? 'liked' : ''}
              onClick={async () => {
                if (!(await ensureAccount({ kind: 'like' }))) return;
                const r = await api.toggleCommentLike(c.id);
                setComments((list) => list?.map((x) => (x.id === c.id ? { ...x, likedByMe: r.liked, likes: r.likes } : x)) ?? null);
              }}
              aria-label={c.likedByMe ? 'Unlike' : 'Like'}
            >
              <I.Heart size={13} filled={c.likedByMe} /> {c.likes > 0 ? c.likes : ''}
            </button>
            <button onClick={() => setReplyTo({ threadId, mention: c.parentId && !mine ? `@${author?.handle ?? ''} ` : '' })}>Reply</button>
            {(mine || loopIsMine) && (
              <button
                onClick={async () => {
                  if (!confirm(mine ? 'Delete your comment?' : 'Delete this comment from your loop?')) return;
                  await api.deleteComment(c.id);
                  await changed();
                  toast('Comment deleted');
                }}
              >
                Delete
              </button>
            )}
            {!mine && (
              <button
                className="cm-report"
                onClick={async () => {
                  if (!(await ensureAccount({ kind: 'report' }))) return;
                  if (!confirm('Report this comment? It will be hidden for you.')) return;
                  await api.reportComment(c.id, 'inappropriate');
                  await load();
                  toast('Thanks, the comment has been reported');
                }}
                title="Report"
              >
                <I.Flag size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="comments" id="comments">
      <div className="comments-head">
        <h2>
          Comments <span className="muted">{total}</span>
        </h2>
        {tops.length > 1 && (
          <div className="seg sm">
            <button className={sort === 'recent' ? 'on' : ''} onClick={() => setSort('recent')}>
              Recent
            </button>
            <button className={sort === 'top' ? 'on' : ''} onClick={() => setSort('top')}>
              Top
            </button>
          </div>
        )}
      </div>

      <Composer
        pubId={pub.id}
        allowAnchor
        placeholder={total ? 'Add a comment…' : 'Be the first to comment on this loop…'}
        onDone={() => void changed()}
      />

      <div className="cm-list">
        {tops.map((c) => {
          const replies = repliesOf(c.id);
          const open = expanded.has(c.id) || replies.length <= VISIBLE_REPLIES;
          return (
            <div className="cm-thread" key={c.id}>
              {item(c, c.id)}
              {replies.length > 0 && (
                <div className="cm-replies">
                  {open ? (
                    replies.map((r) => item(r, c.id))
                  ) : (
                    <button className="cm-more" onClick={() => setExpanded(new Set([...expanded, c.id]))}>
                      View {replies.length} replies
                    </button>
                  )}
                </div>
              )}
              {replyTo?.threadId === c.id && (
                <div className="cm-replies">
                  <Composer
                    key={replyTo.mention}
                    pubId={pub.id}
                    parentId={c.id}
                    initial={replyTo.mention}
                    allowAnchor={false}
                    autoFocus
                    placeholder="Your reply…"
                    onCancel={() => setReplyTo(null)}
                    onDone={() => {
                      setReplyTo(null);
                      setExpanded(new Set([...expanded, c.id]));
                      void changed();
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
