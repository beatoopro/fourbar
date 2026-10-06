import type { Composition } from '../../core/types';
import { cloneComposition, normalizeComposition } from '../../core/composition';
import { LOOP_TICKS, PPQ } from '../../core/timing';
import { uid } from '../../core/composition';
import type { CommentSort, CommunityApi, FeedQuery, LoopComment, NewComment, Publication, User } from '../types';
import { COMMENT_MAX_LENGTH } from '../types';
import { DEFAULT_ME, ME_ID, SEED_LIKED, SEED_USERS, buildSeedPublications } from './seed';
import { SEED_COMMENT_LIKES, buildSeedComments, type StoredComment } from './seedComments';

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
  comments: `${PREFIX}comments`,
  commentLikes: `${PREFIX}commentLikes`,
  commentsSeeded: `${PREFIX}commentsSeeded`,
  reports: `${PREFIX}reports`,
};

interface Report {
  commentId: string;
  reason: string;
  at: string;
}

/** Nettoie le texte d'un commentaire : espaces de bord, lignes vides en série. */
function cleanBody(body: string): string {
  return body.trim().replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
}

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
    // Les commentaires de démo sont ajoutés à part, sans toucher aux publications existantes.
    if (!read<boolean>(KEYS.commentsSeeded, false)) this.seedComments();
  }

  private seedComments() {
    const existing = this.comments();
    const ids = new Set(existing.map((c) => c.id));
    write(KEYS.comments, [...existing, ...buildSeedComments(this.pubs()).filter((c) => !ids.has(c.id))]);
    write(KEYS.commentLikes, [...new Set([...read<string[]>(KEYS.commentLikes, []), ...SEED_COMMENT_LIKES])]);
    write(KEYS.commentsSeeded, true);
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
    write(KEYS.comments, []);
    this.seedComments();
  }

  /** Les données d'une version précédente (ex. loops à 3 pistes, sans batterie) sont remises au format courant à la lecture. */
  private pubs(): Publication[] {
    const counts = new Map<string, number>();
    for (const c of this.comments()) if (!c.deleted) counts.set(c.publicationId, (counts.get(c.publicationId) ?? 0) + 1);
    return read<Publication[]>(KEYS.pubs, []).map((p) => ({
      ...p,
      composition: normalizeComposition(p.composition),
      commentCount: counts.get(p.id) ?? 0,
    }));
  }

  private comments(): StoredComment[] {
    return read<StoredComment[]>(KEYS.comments, []);
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
    const pub: Publication = { id: c.id, composition: c, authorId: ME_ID, likes: 0, plays: 0, publishedAt: c.updatedAt, commentCount: 0 };
    write(KEYS.pubs, [pub, ...pubs]);
    await this.deleteDraft(c.id);
    return pub;
  }

  async deletePublication(id: string): Promise<void> {
    const pubs = this.pubs();
    if (!pubs.some((p) => p.id === id && p.authorId === ME_ID)) return;
    write(KEYS.pubs, pubs.filter((p) => p.id !== id));
    write(KEYS.comments, this.comments().filter((c) => c.publicationId !== id));
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

  async listComments(publicationId: string, sort: CommentSort = 'recent'): Promise<LoopComment[]> {
    const liked = new Set(read<string[]>(KEYS.commentLikes, []));
    const reported = new Set(read<Report[]>(KEYS.reports, []).map((r) => r.commentId));
    const all = this.comments().filter((c) => c.publicationId === publicationId && !reported.has(c.id));
    const view = (c: StoredComment): LoopComment => ({ ...c, likedByMe: liked.has(c.id) });
    const time = (c: StoredComment) => new Date(c.createdAt).getTime();
    const tops = all
      .filter((c) => !c.parentId)
      .sort(sort === 'top' ? (a, b) => b.likes - a.likes || time(b) - time(a) : (a, b) => time(b) - time(a));
    // Les réponses restent dans l'ordre chronologique, sous leur commentaire.
    const replies = all.filter((c) => c.parentId).sort((a, b) => time(a) - time(b));
    return [...tops, ...replies].map(view);
  }

  async addComment(publicationId: string, input: NewComment): Promise<LoopComment> {
    const body = cleanBody(input.body ?? '');
    if (!body) throw new Error('Le commentaire est vide.');
    if (body.length > COMMENT_MAX_LENGTH) throw new Error(`Le commentaire dépasse ${COMMENT_MAX_LENGTH} caractères.`);
    if (!this.pubs().some((p) => p.id === publicationId)) throw new Error('Loop introuvable.');
    const comments = this.comments();
    let parentId: string | null = null;
    if (input.parentId) {
      const parent = comments.find((c) => c.id === input.parentId && c.publicationId === publicationId);
      if (!parent) throw new Error('Le commentaire auquel vous répondez n’existe plus.');
      // Un seul niveau : répondre à une réponse ajoute au même fil.
      parentId = parent.parentId ?? parent.id;
    }
    let anchorTick: number | null = null;
    if (!parentId && input.anchorTick != null && Number.isFinite(input.anchorTick)) {
      anchorTick = Math.min(LOOP_TICKS - PPQ, Math.max(0, Math.round(input.anchorTick / PPQ) * PPQ));
    }
    const c: StoredComment = {
      id: uid('cm'),
      publicationId,
      authorId: ME_ID,
      parentId,
      body,
      anchorTick,
      ...(input.linkedPublicationId ? { linkedPublicationId: input.linkedPublicationId } : {}),
      likes: 0,
      createdAt: new Date().toISOString(),
      deleted: false,
    };
    write(KEYS.comments, [...comments, c]);
    return { ...c, likedByMe: false };
  }

  async deleteComment(commentId: string): Promise<void> {
    let comments = this.comments();
    const c = comments.find((x) => x.id === commentId);
    if (!c) return;
    const pub = this.pubs().find((p) => p.id === c.publicationId);
    if (c.authorId !== ME_ID && pub?.authorId !== ME_ID) throw new Error('Vous ne pouvez pas supprimer ce commentaire.');
    const hasReplies = comments.some((x) => x.parentId === c.id && !x.deleted);
    if (hasReplies) {
      // On garde la place du commentaire pour que les réponses restent lisibles.
      comments = comments.map((x) => (x.id === c.id ? { ...x, body: '', deleted: true, likes: 0 } : x));
    } else {
      comments = comments.filter((x) => x.id !== c.id);
      // Un parent déjà supprimé qui n'a plus de réponse disparaît aussi.
      const parent = comments.find((x) => x.id === c.parentId);
      if (parent?.deleted && !comments.some((x) => x.parentId === parent.id)) comments = comments.filter((x) => x.id !== parent.id);
    }
    write(KEYS.comments, comments);
  }

  async toggleCommentLike(commentId: string): Promise<{ liked: boolean; likes: number }> {
    const likes = read<string[]>(KEYS.commentLikes, []);
    const comments = this.comments();
    const c = comments.find((x) => x.id === commentId);
    if (!c || c.deleted) return { liked: false, likes: c?.likes ?? 0 };
    const liked = !likes.includes(commentId);
    write(KEYS.commentLikes, liked ? [...likes, commentId] : likes.filter((x) => x !== commentId));
    c.likes = Math.max(0, c.likes + (liked ? 1 : -1));
    write(KEYS.comments, comments);
    return { liked, likes: c.likes };
  }

  async reportComment(commentId: string, reason: string): Promise<void> {
    const reports = read<Report[]>(KEYS.reports, []).filter((r) => r.commentId !== commentId);
    write(KEYS.reports, [...reports, { commentId, reason: reason.trim().slice(0, 200), at: new Date().toISOString() }]);
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
