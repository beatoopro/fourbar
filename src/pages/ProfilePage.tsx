import { useEffect, useState } from 'react';
import type { Composition } from '../core/types';
import { PublicationCard, MiniPreview } from '../community/PublicationCard';
import { useCommunity } from '../community/store';
import { useEditor } from '../editor/store';
import { engine } from '../audio/engine';
import { api, ME_ID, normalizeHandle, type Publication, type User } from '../services';
import { ensureAccount } from '../community/auth';
import { createComposition, noteCount } from '../core/composition';
import { Avatar, navigate, timeAgo, toast } from '../ui/common';
import * as I from '../ui/Icons';

type Tab = 'creations' | 'remixes' | 'likes' | 'drafts';

const GUEST: User = { id: ME_ID, name: 'Guest', handle: '', bio: '', color: '#3a3448', joinedAt: '' };

export function ProfilePage({ userId }: { userId: string }) {
  const me = useCommunity((s) => s.me);
  const ready = useCommunity((s) => s.ready);
  const signOut = useCommunity((s) => s.signOut);
  const isMe = userId === ME_ID || userId === me?.id;
  /** Visiteur sans compte sur « son » profil : on lui montre ses brouillons et l'invitation à s'inscrire. */
  const guest = isMe && ready && !me;
  const liked = useCommunity((s) => s.liked);
  const version = useCommunity((s) => s.version);
  const updateMe = useCommunity((s) => s.updateMe);
  const bump = useCommunity((s) => s.bump);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('creations');
  const [own, setOwn] = useState<Publication[]>([]);
  const [likedPubs, setLikedPubs] = useState<Publication[]>([]);
  const [drafts, setDrafts] = useState<Composition[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', handle: '', bio: '' });

  useEffect(() => {
    setTab(guest ? 'drafts' : 'creations');
  }, [userId, guest]);

  useEffect(() => {
    void (async () => {
      setUser(isMe ? me ?? GUEST : await api.getUser(userId));
      setOwn(isMe && !me ? [] : await api.listPublications({ authorId: isMe ? me!.id : userId, sort: 'recent' }));
      if (isMe) {
        setLikedPubs(await api.listPublications({ ids: [...liked], sort: 'recent' }));
        setDrafts(await api.listDrafts());
      }
    })();
  }, [userId, isMe, me, liked, version]);

  useEffect(() => () => {
    if (engine.getState().sourceId !== 'editor') engine.stop();
  }, []);

  if (!ready) return null;
  if (!user) return <div className="page empty">Profile not found.</div>;

  const doSignOut = async () => {
    // Le projet en cours non enregistré part dans les brouillons du compte avant de vider l'éditeur.
    const ed = useEditor.getState();
    if (ed.dirty && noteCount(ed.comp) > 0) await api.saveDraft({ ...ed.comp, title: ed.comp.title || 'Untitled' });
    engine.stop();
    await signOut();
    useEditor.getState().load(createComposition(ME_ID));
    toast('Signed out. Your loops and drafts stay on your account.');
    navigate('/explore');
  };

  const creations = own.filter((p) => !p.composition.remixOf);
  const remixes = own.filter((p) => p.composition.remixOf);
  const totalLikes = own.reduce((s, p) => s + p.likes, 0);
  const tabs: { id: Tab; label: string; count: number }[] = guest
    ? [{ id: 'drafts', label: 'Drafts', count: drafts.length }]
    : [
        { id: 'creations', label: 'Creations', count: creations.length },
        { id: 'remixes', label: 'Remixes', count: remixes.length },
        ...(isMe
          ? [
              { id: 'likes' as Tab, label: 'Liked', count: likedPubs.length },
              { id: 'drafts' as Tab, label: 'Drafts', count: drafts.length },
            ]
          : []),
      ];
  const list = tab === 'creations' ? creations : tab === 'remixes' ? remixes : tab === 'likes' ? likedPubs : [];

  return (
    <div className="page">
      {guest ? (
        <div className="profile-head">
          <Avatar user={GUEST} size={84} />
          <div className="profile-info">
            <h1>You’re browsing as a guest</h1>
            <p>Create a free account to publish your loops, like and comment. Your drafts come with you.</p>
          </div>
          <button className="btn primary" onClick={() => void ensureAccount({ kind: 'signin' })}>
            Sign in or create an account
          </button>
        </div>
      ) : (
        <div className="profile-head">
          <Avatar user={user} size={84} />
          <div className="profile-info">
            {editing ? (
              <form
                className="profile-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await updateMe({ name: form.name.trim() || user.name, handle: form.handle, bio: form.bio });
                    setEditing(false);
                  } catch (err) {
                    toast((err as Error).message);
                  }
                }}
              >
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus maxLength={40} />
                <input className="input" value={form.handle} onChange={(e) => setForm({ ...form, handle: normalizeHandle(e.target.value) })} maxLength={20} placeholder="username" aria-label="Username" />
                <input className="input" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={120} placeholder="Bio" />
                <div className="chips">
                  <button className="btn primary sm" type="submit">
                    Save
                  </button>
                  <button className="btn ghost sm" type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h1>
                  {user.name}
                  {isMe && (
                    <button
                      className="btn ghost sm"
                      onClick={() => {
                        setForm({ name: user.name, handle: user.handle, bio: user.bio });
                        setEditing(true);
                      }}
                    >
                      <I.Pencil size={13} /> Edit
                    </button>
                  )}
                </h1>
                <div className="muted">@{user.handle}</div>
                <p>{user.bio}</p>
              </>
            )}
            <div className="stats">
              <span>
                <b>{creations.length}</b> creations
              </span>
              <span>
                <b>{remixes.length}</b> remixes
              </span>
              <span>
                <b>{totalLikes}</b> likes received
              </span>
            </div>
          </div>
          {isMe && (
            <div className="profile-actions">
              <button className="btn primary" onClick={() => navigate('/create')}>
                <I.Plus size={15} /> Create
              </button>
              <button className="btn ghost sm" onClick={() => void doSignOut()}>
                Sign out
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label} <span>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'drafts' ? (
        drafts.length === 0 ? (
          <div className="empty">No drafts yet. Use “Save” in the editor to keep one.</div>
        ) : (
          <div className="grid">
            {drafts.map((d) => (
              <article key={d.id} className="card draft">
                <div
                  className="card-visual"
                  onClick={() => {
                    useEditor.getState().load(d);
                    navigate('/create');
                  }}
                >
                  <MiniPreview comp={d} />
                </div>
                <div className="card-body">
                  <div className="card-title">{d.title || 'Untitled'}</div>
                  <div className="muted small">
                    {d.bpm} BPM · edited {timeAgo(d.updatedAt)}
                  </div>
                </div>
                <div className="card-actions">
                  <button
                    className="act remix"
                    onClick={() => {
                      useEditor.getState().load(d);
                      navigate('/create');
                    }}
                  >
                    <I.Pencil size={14} /> Open
                  </button>
                  <button
                    className="act"
                    onClick={async () => {
                      if (!confirm('Delete this draft?')) return;
                      await api.deleteDraft(d.id);
                      bump();
                      toast('Draft deleted');
                    }}
                  >
                    <I.Trash size={14} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <div className="empty">
          {tab === 'likes' ? 'No liked loops yet. Like some in Explore.' : isMe ? 'Nothing published here yet.' : 'Nothing to show.'}
        </div>
      ) : (
        <div className="grid">
          {list.map((p) => (
            <PublicationCard key={p.id} pub={p} />
          ))}
        </div>
      )}
    </div>
  );
}
