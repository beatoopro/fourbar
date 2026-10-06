import { useEffect, useRef, useState } from 'react';
import { GENRES, MOODS, SORTS } from '../community/constants';
import { PublicationCard } from '../community/PublicationCard';
import { ActiveFilters, AdvancedPanel } from '../community/AdvancedSearch';
import { useCommunity } from '../community/store';
import { api, type FeedSort, type Publication } from '../services';
import { engine } from '../audio/engine';
import { countActiveFilters, filtersFromParams, filtersToParams, type AdvancedFilters } from '../core/search';
import { TRACK_IDS } from '../core/types';
import { useEditor } from '../editor/store';
import { navigate } from '../ui/common';
import * as I from '../ui/Icons';

interface ExploreState {
  genre: string | null;
  mood: string | null;
  sort: FeedSort;
  search: string;
  filters: AdvancedFilters;
}

/** Toute la recherche vit dans l'URL (#/explore?genre=Jazz&bpm=80-90…) : on peut la partager ou y revenir. */
function stateFromQuery(query: URLSearchParams): ExploreState {
  const sort = SORTS.find((s) => s.id === query.get('sort'))?.id;
  return {
    genre: query.get('genre'),
    mood: query.get('mood'),
    sort: sort ?? (query.get('highlight') ? 'recent' : 'trending'),
    search: query.get('q') ?? '',
    filters: filtersFromParams(query),
  };
}

function stateToQuery(s: ExploreState): string {
  const params = new URLSearchParams();
  if (s.search.trim()) params.set('q', s.search.trim());
  if (s.genre) params.set('genre', s.genre);
  if (s.mood) params.set('mood', s.mood);
  if (s.sort !== 'trending') params.set('sort', s.sort);
  return filtersToParams(s.filters, params).toString();
}

export function ExplorePage({ query }: { query: URLSearchParams }) {
  const queryString = query.toString();
  const highlight = query.get('highlight');
  const [state, setState] = useState(() => stateFromQuery(query));
  const { genre, mood, sort, search, filters } = state;
  const [advancedOpen, setAdvancedOpen] = useState(() => countActiveFilters(filters) > 0);
  const [pubs, setPubs] = useState<Publication[] | null>(null);
  const version = useCommunity((s) => s.version);
  const project = useEditor((s) => s.comp);
  const hasProject = TRACK_IDS.some((t) => project.tracks[t].notes.length > 0);
  const written = useRef(queryString);
  const set = (patch: Partial<ExploreState>) => setState((s) => ({ ...s, ...patch }));
  const setFilters = (patch: Partial<AdvancedFilters>) => setState((s) => ({ ...s, filters: { ...s.filters, ...patch } }));
  const activeCount = countActiveFilters(filters);

  // Navigation externe (lien partagé, clic sur « Explore ») : on repart de l'URL.
  useEffect(() => {
    if (queryString === written.current) return;
    written.current = queryString;
    setState(stateFromQuery(new URLSearchParams(queryString)));
  }, [queryString]);

  // Les filtres sont recopiés dans l'URL sans créer d'entrée d'historique à chaque frappe.
  useEffect(() => {
    const next = stateToQuery(state);
    if (next === written.current) return;
    written.current = next;
    window.history.replaceState(null, '', `#/explore${next ? `?${next}` : ''}`);
  }, [state]);

  useEffect(() => {
    let alive = true;
    void api.listPublications({ genre, mood, sort, search, filters }).then((p) => alive && setPubs(p));
    return () => {
      alive = false;
    };
    // `version` force un rafraîchissement quand les données changent (like, publication…).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, sort === 'popular' ? version : 0]);

  useEffect(() => () => {
    // Arrêter l'aperçu en quittant la page (sauf lecture de l'éditeur).
    if (engine.getState().sourceId !== 'editor') engine.stop();
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Explore</h1>
          <p>Listen to, like and remix loops from the community.</p>
        </div>
        <div className="search-bar">
          <div className="search">
            <I.Search size={15} />
            <input className="input" placeholder="Title, artist, genre…" value={search} onChange={(e) => set({ search: e.target.value })} />
          </div>
          <button className={`btn adv-toggle ${advancedOpen ? 'on' : ''}`} onClick={() => setAdvancedOpen(!advancedOpen)} aria-expanded={advancedOpen}>
            <I.Sliders size={15} /> Advanced
            {activeCount > 0 && <span className="adv-count">{activeCount}</span>}
          </button>
        </div>
      </div>

      {advancedOpen && (
        <AdvancedPanel filters={filters} onChange={setFilters} onReset={() => set({ filters: {} })} project={hasProject ? project : null} />
      )}

      <div className="filters">
        <div className="chips genre-chips">
          <button className={`chip ${genre === null ? 'on' : ''}`} onClick={() => set({ genre: null })}>
            All
          </button>
          {GENRES.map((g) => (
            <button key={g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => set({ genre: genre === g ? null : g })}>
              {g}
            </button>
          ))}
        </div>
        <div className="filters-row">
          <div className="chips">
            <span className="label">Mood</span>
            {MOODS.map((m) => (
              <button key={m} className={`chip sm ${mood === m ? 'on' : ''}`} onClick={() => set({ mood: mood === m ? null : m })}>
                {m}
              </button>
            ))}
          </div>
          <div className="seg sort">
            {SORTS.map((s) => (
              <button key={s.id} className={sort === s.id ? 'on' : ''} onClick={() => set({ sort: s.id })}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <ActiveFilters filters={filters} onChange={setFilters} />
      </div>

      {pubs === null ? null : pubs.length === 0 ? (
        <div className="empty">
          No loops match these filters.
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
            {activeCount > 0 && (
              <button className="btn" onClick={() => set({ filters: {} })}>
                Clear advanced filters
              </button>
            )}
            <button className="btn primary" onClick={() => navigate('/create')}>
              Create the first one
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
