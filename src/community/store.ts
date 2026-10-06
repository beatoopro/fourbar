import { create } from 'zustand';
import { api, type Publication, type User } from '../services';

/** État communautaire partagé entre les pages (utilisateur courant, favoris, annuaire). */
interface CommunityState {
  me: User | null;
  users: Record<string, User>;
  liked: Set<string>;
  /** Incrémenté à chaque changement de données, pour rafraîchir les listes. */
  version: number;
  init(): Promise<void>;
  toggleLike(pub: Publication): Promise<number>;
  updateMe(patch: Partial<Pick<User, 'name' | 'bio'>>): Promise<void>;
  bump(): void;
}

export const useCommunity = create<CommunityState>((set, get) => ({
  me: null,
  users: {},
  liked: new Set(),
  version: 0,
  async init() {
    const [me, users, liked] = await Promise.all([api.getCurrentUser(), api.listUsers(), api.getLikedIds()]);
    set({ me, users: Object.fromEntries(users.map((u) => [u.id, u])), liked: new Set(liked) });
  },
  async toggleLike(pub) {
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
  bump() {
    set({ version: get().version + 1 });
  },
}));
