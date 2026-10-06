import { create } from 'zustand';
import { ensureAccount } from './auth';
import { api, type Publication, type SignInMethod, type SignInResult, type User } from '../services';

/** État communautaire partagé entre les pages (utilisateur courant, favoris, annuaire). */
interface CommunityState {
  /** null = visiteur sans compte. */
  me: User | null;
  /** init() terminé : évite d'afficher « invité » le temps du chargement. */
  ready: boolean;
  users: Record<string, User>;
  liked: Set<string>;
  /** Incrémenté à chaque changement de données, pour rafraîchir les listes. */
  version: number;
  init(): Promise<void>;
  /** Renvoie le nouveau nombre de likes, ou null si l'invité n'a pas créé de compte. */
  toggleLike(pub: Publication): Promise<number | null>;
  updateMe(patch: Partial<Pick<User, 'name' | 'handle' | 'bio'>>): Promise<void>;
  signIn(method: SignInMethod): Promise<SignInResult>;
  signOut(): Promise<void>;
  bump(): void;
}

export const useCommunity = create<CommunityState>((set, get) => ({
  me: null,
  ready: false,
  users: {},
  liked: new Set(),
  version: 0,
  async init() {
    const [me, users, liked] = await Promise.all([api.getCurrentUser(), api.listUsers(), api.getLikedIds()]);
    set({ me, ready: true, users: Object.fromEntries(users.map((u) => [u.id, u])), liked: new Set(liked) });
  },
  async toggleLike(pub) {
    if (!(await ensureAccount({ kind: 'like' }))) return null;
    const { liked, likes } = await api.toggleLike(pub.id);
    const next = new Set(get().liked);
    if (liked) next.add(pub.id);
    else next.delete(pub.id);
    set({ liked: next, version: get().version + 1 });
    return likes;
  },
  async updateMe(patch) {
    const me = await api.updateCurrentUser(patch);
    set({ me, users: { ...get().users, [me.id]: me }, version: get().version + 1 });
  },
  async signIn(method) {
    const result = await api.signIn(method);
    await get().init();
    set({ version: get().version + 1 });
    return result;
  },
  async signOut() {
    await api.signOut();
    await get().init();
    set({ version: get().version + 1 });
  },
  bump() {
    set({ version: get().version + 1 });
  },
}));
