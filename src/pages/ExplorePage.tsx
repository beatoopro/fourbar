import { useEffect, useState } from 'react';
import { GENRES, MOODS, SORTS } from '../community/constants';
import { PublicationCard } from '../community/PublicationCard';
import { useCommunity } from '../community/store';
import { api, type FeedSort, type Publication } from '../services';
import { engine } from '../audio/engine';
import { navigate } from '../ui/common';
import * as I from '../ui/Icons';

export function ExplorePage({ highlight }: { highlight?: string | null }) {
  const [genre, setGenre] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [sort, setSort] = useState<FeedSort>(highlight ? 'recent' : 'trending');
  const [search, setSearch] = useState('');
  const [pubs, setPubs] = useState<Publication[] | null>(null);
  const version = useCommunity((s) => s.version);

  useEffect(() => {
    let alive = true;
    void api.listPublications({ genre, mood, sort, search }).then((p) => alive && setPubs(p));
    return () => {
      alive = false;
    };
    // `version` force un rafraîchissement quand les données changent (like, publication…).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, mood, sort, search, sort === 'popular' ? version : 0]);

  useEffect(() => () => {
    // Arrêter l'aperçu en quittant la page (sauf lecture de l'éditeur).
    if (engine.getState().sourceId !== 'editor') engine.stop();
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Explore</h1>
          <p>Écoutez, aimez et remixez les boucles de la communauté.</p>
        </div>
        <div className="search">
          <I.Search size={15} />
          <input className="input" placeholder="Titre, artiste, genre…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="filters">
        <div className="chips genre-chips">
          <button className={`chip ${genre === null ? 'on' : ''}`} onClick={() => setGenre(null)}>
            Tout
          </button>
          {GENRES.map((g) => (
            <button key={g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => setGenre(genre === g ? null : g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="filters-row">
          <div className="chips">
            <span className="label">Ambiance</span>
            {MOODS.map((m) => (
              <button key={m} className={`chip sm ${mood === m ? 'on' : ''}`} onClick={() => setMood(mood === m ? null : m)}>
                {m}
              </button>
            ))}
          </div>
          <div className="seg sort">
            {SORTS.map((s) => (
              <button key={s.id} className={sort === s.id ? 'on' : ''} onClick={() => setSort(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pubs === null ? null : pubs.length === 0 ? (
        <div className="empty">
          Aucune boucle ne correspond à ces filtres.
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => navigate('/create')}>
              Créer la première
            </button>
          </div>
        </div>
      ) : (
        <div className="grid">
          {pubs.map((p) => (
            <PublicationCard key={p.id} pub={p} highlight={p.id === highlight} />
          ))}
        </div>
      )}
    </div>
  );
}
