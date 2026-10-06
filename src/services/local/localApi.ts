import type { Composition } from '../../core/types';
import { cloneComposition, normalizeComposition } from '../../core/composition';
import type { CommunityApi, FeedQuery, Publication, User } from '../types';
import { DEFAULT_ME, ME_ID, SEED_LIKED, SEED_USERS, buildSeedPublications } from './seed';

/**
 * Implémentation locale de CommunityApi : tout est stocké dans le localStorage
 * du navigateur. Les méthodes sont asynchrones comme le serait un appel réseau,
 * pour que le reste de l'application n'ait pas à changer avec une vraie API.
 */

const PREFIX = '4chords:v1:';
const KEYS = {
  seeded: `${PREFIX}seeded`,
  me: `${PREFIX}me`,
  pubs: `${PREFIX}publications`,
  likes: `${PREFIX}likes`,
  drafts: `${PREFIX}drafts`,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Stockage local indisponible ou plein', e);
  }
}

/** 2 : les loops de démonstration reçoivent une piste de batterie. */
const SEED_VERSION = 2;

export class LocalCommunityApi implements CommunityApi {
  constructor() {
    const seeded = read<number>(KEYS.seeded, 0);
    if (seeded === 0) this.reset();
    else if (seeded < SEED_VERSION) this.upgradeSeed();
  }

  /** Met à jour les loops de démonstration sans toucher aux publications, likes et écoutes de l'utilisateur. */
  private upgradeSeed() {
    const fresh = new Map(buildSeedPublications().map((p) => [p.id, p]));
    const pubs = this.pubs().map((p) => {
      const f = fresh.get(p.id);
      fresh.delete(p.id);
      return f ? { ...p, composition: f.composition } : p;
    });
    write(KEYS.pubs, [...pubs, ...fresh.values()]);
    write(KEYS.seeded, SEED_VERSION);
  }

  /** Réinitialise les données de démonstration (garde le profil). */
  reset() {
    write(KEYS.pubs, buildSeedPublications());
    write(KEYS.likes, SEED_LIKED);
    write(KEYS.seeded, SEED_VERSION);
  }

  /** Les données d'une version précédente (ex. loops à 3 pistes, sans batterie) sont remises au format courant à la lecture. */
  private pubs(): Publication[] {
    return read<Publication[]>(KEYS.pubs, []).map((p) => ({ ...p, composition: normalizeComposition(p.composition) }));
  }

  private drafts(): Composition[] {
    return read<Composition[]>(KEYS.drafts, []).map(normalizeComposition);
  }

  async getCurrentUser(): Promise<User> {
    return { ...DEFAULT_ME, ...read<Partial<User>>(KEYS.me, {}) };
  }

  async updateCurrentUser(patch: Partial<Pick<User, 'name' | 'bio'>>): Promise<User> {
    const me = { ...(await this.getCurrentUser()), ...patch };
    write(KEYS.me, me);
    return me;
  }

  async getUser(id: string): Promise<User | null> {
    if (id === ME_ID) return this.getCurrentUser();
    return SEED_USERS.find((u) => u.id === id) ?? null;
  }

  async listUsers(): Promise<User[]> {
    return [await this.getCurrentUser(), ...SEED_USERS];
  }

  async listPublications(q: FeedQuery = {}): Promise<Publication[]> {
    let list = this.pubs();
    const remixCounts = new Map<string, number>();
    for (const p of list) if (p.composition.remixOf) remixCounts.set(p.composition.remixOf, (remixCounts.get(p.composition.remixOf) ?? 0) + 1);

    if (q.ids) list = list.filter((p) => q.ids!.includes(p.id));
    if (q.authorId) list = list.filter((p) => p.authorId === q.authorId);
    if (q.remixesOnly) list = list.filter((p) => !!p.composition.remixOf);
    if (q.genre) list = list.filter((p) => p.composition.genres.includes(q.genre!));
    if (q.mood) list = list.filter((p) => p.composition.moods.includes(q.mood!));
    if (q.search?.trim()) {
      const users = await this.listUsers();
      const s = q.search.trim().toLowerCase();
      list = list.filter((p) => {
        const author = users.find((u) => u.id === p.authorId);
        return (
          p.composition.title.toLowerCase().includes(s) ||
          author?.name.toLowerCase().includes(s) ||
          author?.handle.toLowerCase().includes(s) ||
          p.composition.genres.some((g) => g.toLowerCase().includes(s))
        );
      });
    }
    const now = Date.now();
    const age = (p: Publication) => (now - new Date(p.publishedAt).getTime()) / 3600000;
    const score: Record<string, (p: Publication) => number> = {
      // Tendances : popularité amortie par l'âge (type « hot ranking »).
      trending: (p) => (p.likes + p.plays * 0.1 + (remixCounts.get(p.id) ?? 0) * 20 + 10) / Math.pow(age(p) + 2, 0.8),
      popular: (p) => p.likes,
      recent: (p) => new Date(p.publishedAt).getTime(),
      remixed: (p) => (remixCounts.get(p.id) ?? 0) * 1000 + p.likes,
    };
    const fn = score[q.sort ?? 'trending'];
    return [...list].sort((a, b) => fn(b) - fn(a));
  }

  async getPublication(id: string): Promise<Publication | null> {
    return this.pubs().find((p) => p.id === id) ?? null;
  }

  async publish(composition: Composition): Promise<Publication> {
    const pubs = this.pubs();
    const c = normalizeComposition(cloneComposition(composition));
    c.authorId = ME_ID;
    c.updatedAt = new Date().toISOString();
    const existing = pubs.find((p) => p.id === c.id);
    if (existing) {
      existing.composition = c;
      write(KEYS.pubs, pubs);
      return existing;
    }
    const pub: Publication = { id: c.id, composition: c, authorId: ME_ID, likes: 0, plays: 0, publishedAt: c.updatedAt };
    write(KEYS.pubs, [pub, ...pubs]);
    await this.deleteDraft(c.id);
    return pub;
  }

  async deletePublication(id: string): Promise<void> {
    write(KEYS.pubs, this.pubs().filter((p) => p.id !== id || p.authorId !== ME_ID));
  }

  async countRemixes(id: string): Promise<number> {
    return this.pubs().filter((p) => p.composition.remixOf === id).length;
  }

  async registerPlay(id: string): Promise<void> {
    const pubs = this.pubs();
    const p = pubs.find((x) => x.id === id);
    if (p) {
      p.plays += 1;
      write(KEYS.pubs, pubs);
    }
  }

  async getLikedIds(): Promise<string[]> {
    return read<string[]>(KEYS.likes, []);
  }

  async toggleLike(id: string): Promise<{ liked: boolean; likes: number }> {
    const likes = await this.getLikedIds();
    const pubs = this.pubs();
    const p = pubs.find((x) => x.id === id);
    const liked = !likes.includes(id);
    write(KEYS.likes, liked ? [...likes, id] : likes.filter((x) => x !== id));
    if (p) {
      p.likes = Math.max(0, p.likes + (liked ? 1 : -1));
      write(KEYS.pubs, pubs);
    }
    return { liked, likes: p?.likes ?? 0 };
  }

  async listDrafts(): Promise<Composition[]> {
    return this.drafts().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async saveDraft(composition: Composition): Promise<void> {
    const drafts = this.drafts().filter((d) => d.id !== composition.id);
    write(KEYS.drafts, [{ ...cloneComposition(composition), updatedAt: new Date().toISOString() }, ...drafts]);
  }

  async deleteDraft(id: string): Promise<void> {
    write(KEYS.drafts, this.drafts().filter((d) => d.id !== id));
  }
}
