import { useEffect, useState } from 'react';
import type { Composition } from '../core/types';
import { PublicationCard, MiniPreview } from '../community/PublicationCard';
import { useCommunity } from '../community/store';
import { useEditor } from '../editor/store';
import { engine } from '../audio/engine';
import { api, ME_ID, type Publication, type User } from '../services';
import { Avatar, navigate, timeAgo, toast } from '../ui/common';
import * as I from '../ui/Icons';

type Tab = 'creations' | 'remixes' | 'likes' | 'drafts';

export function ProfilePage({ userId }: { userId: string }) {
  const isMe = userId === ME_ID;
  const me = useCommunity((s) => s.me);
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
  const [form, setForm] = useState({ name: '', bio: '' });

  useEffect(() => {
    setTab('creations');
  }, [userId]);

  useEffect(() => {
    void (async () => {
      setUser(isMe ? me : await api.getUser(userId));
      setOwn(await api.listPublications({ authorId: userId, sort: 'recent' }));
      if (isMe) {
        setLikedPubs(await api.listPublications({ ids: [...liked], sort: 'recent' }));
        setDrafts(await api.listDrafts());
      }
    })();
  }, [userId, isMe, me, liked, version]);

  useEffect(() => () => {
    if (engine.getState().sourceId !== 'editor') engine.stop();
  }, []);

  if (!user) return <div className="page empty">Profil introuvable.</div>;

  const creations = own.filter((p) => !p.composition.remixOf);
  const remixes = own.filter((p) => p.composition.remixOf);
  const totalLikes = own.reduce((s, p) => s + p.likes, 0);
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'creations', label: 'Créations', count: creations.length },
    { id: 'remixes', label: 'Remixes', count: remixes.length },
    ...(isMe
      ? [
          { id: 'likes' as Tab, label: 'Favoris', count: likedPubs.length },
          { id: 'drafts' as Tab, label: 'Brouillons', count: drafts.length },
        ]
      : []),
  ];
  const list = tab === 'creations' ? creations : tab === 'remixes' ? remixes : tab === 'likes' ? likedPubs : [];

  return (
    <div className="page">
      <div className="profile-head">
        <Avatar user={user} size={84} />
        <div className="profile-info">
          {editing ? (
            <form
              className="profile-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await updateMe({ name: form.name.trim() || 'Vous', bio: form.bio });
                setEditing(false);
              }}
            >
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus maxLength={40} />
              <input className="input" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={120} placeholder="Bio" />
              <div className="chips">
                <button className="btn primary sm" type="submit">
                  Enregistrer
                </button>
                <button className="btn ghost sm" type="button" onClick={() => setEditing(false)}>
                  Annuler
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
                      setForm({ name: user.name, bio: user.bio });
                      setEditing(true);
                    }}
                  >
                    <I.Pencil size={13} /> Modifier
                  </button>
                )}
              </h1>
              <div className="muted">@{user.handle}</div>
              <p>{user.bio}</p>
            </>
          )}
          <div className="stats">
            <span>
              <b>{creations.length}</b> créations
            </span>
            <span>
              <b>{remixes.length}</b> remixes
            </span>
            <span>
              <b>{totalLikes}</b> j’aime reçus
            </span>
          </div>
        </div>
        {isMe && (
          <button className="btn primary" onClick={() => navigate('/create')}>
            <I.Plus size={15} /> Créer
          </button>
        )}
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label} <span>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'drafts' ? (
        drafts.length === 0 ? (
          <div className="empty">Aucun brouillon. Utilisez « Enregistrer » dans l’éditeur pour en garder un.</div>
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
                  <div className="card-title">{d.title || 'Sans titre'}</div>
                  <div className="muted small">
                    {d.bpm} BPM · modifié {timeAgo(d.updatedAt)}
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
                    <I.Pencil size={14} /> Ouvrir
                  </button>
                  <button
                    className="act"
                    onClick={async () => {
                      if (!confirm('Supprimer ce brouillon ?')) return;
                      await api.deleteDraft(d.id);
                      bump();
                      toast('Brouillon supprimé');
                    }}
                  >
                    <I.Trash size={14} /> Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <div className="empty">
          {tab === 'likes' ? 'Aucun favori pour le moment. Aimez des boucles dans Explore.' : isMe ? 'Rien de publié ici pour le moment.' : 'Rien à afficher.'}
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
