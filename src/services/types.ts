import type { Composition } from '../core/types';

/**
 * Contrat de la couche de données communautaire.
 * La V1 utilise LocalCommunityApi (localStorage + données de démo).
 * Pour brancher un vrai backend (Supabase, API REST…), il suffit d'écrire une
 * autre implémentation de cette interface et de la sélectionner dans services/index.ts.
 */

export interface User {
  id: string;
  name: string;
  handle: string;
  bio: string;
  /** Couleur de l'avatar généré (pas d'images externes en V1). */
  color: string;
  joinedAt: string;
}

export interface Publication {
  id: string;
  composition: Composition;
  authorId: string;
  likes: number;
  plays: number;
  publishedAt: string;
}

export type FeedSort = 'trending' | 'popular' | 'recent' | 'remixed';

export interface FeedQuery {
  genre?: string | null;
  mood?: string | null;
  search?: string;
  sort?: FeedSort;
  authorId?: string;
  /** Uniquement les remixes (composition.remixOf défini). */
  remixesOnly?: boolean;
  ids?: string[];
}

export interface CommunityApi {
  // Authentification (simulée en V1)
  getCurrentUser(): Promise<User>;
  updateCurrentUser(patch: Partial<Pick<User, 'name' | 'bio'>>): Promise<User>;

  // Utilisateurs
  getUser(id: string): Promise<User | null>;
  listUsers(): Promise<User[]>;

  // Publications
  listPublications(query?: FeedQuery): Promise<Publication[]>;
  getPublication(id: string): Promise<Publication | null>;
  publish(composition: Composition): Promise<Publication>;
  deletePublication(id: string): Promise<void>;
  countRemixes(id: string): Promise<number>;
  registerPlay(id: string): Promise<void>;

  // Favoris
  getLikedIds(): Promise<string[]>;
  toggleLike(id: string): Promise<{ liked: boolean; likes: number }>;

  // Brouillons (projets non publiés)
  listDrafts(): Promise<Composition[]>;
  saveDraft(composition: Composition): Promise<void>;
  deleteDraft(id: string): Promise<void>;
}
