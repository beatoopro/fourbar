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
  /** Nombre de commentaires (calculé par l'API, comme `likes`, pour ne pas charger les commentaires dans le fil). */
  commentCount: number;
}

/** Commentaire sous une loop. Nommé LoopComment pour ne pas masquer le type DOM global `Comment`. */
export interface LoopComment {
  id: string;
  publicationId: string;
  authorId: string;
  /** Commentaire parent si c'est une réponse (un seul niveau de réponses). */
  parentId: string | null;
  body: string;
  /** Moment de la boucle visé, en ticks (arrondi au temps). Reste juste si un remix change le BPM. */
  anchorTick: number | null;
  /** Loop liée (ex. le remix annoncé par « J'ai remixé cette loop »). */
  linkedPublicationId?: string;
  likes: number;
  /** Calculé pour l'utilisateur courant, comme le ferait un backend. */
  likedByMe: boolean;
  createdAt: string;
  /** Suppression « douce » : le texte est vidé mais le fil de réponses est conservé. */
  deleted: boolean;
}

export type CommentSort = 'recent' | 'top';

export interface NewComment {
  body: string;
  parentId?: string | null;
  anchorTick?: number | null;
  linkedPublicationId?: string;
}

export const COMMENT_MAX_LENGTH = 500;

/** Texte du commentaire laissé sur l'original quand on publie un remix. */
export function remixNoteBody(title: string): string {
  return `🔁 I remixed this loop: “${title}”`;
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

  // Commentaires
  /** Liste plate (commentaires et réponses) ; l'interface regroupe par `parentId`. */
  listComments(publicationId: string, sort?: CommentSort): Promise<LoopComment[]>;
  addComment(publicationId: string, input: NewComment): Promise<LoopComment>;
  /** Autorisé pour l'auteur du commentaire et pour l'auteur de la loop. */
  deleteComment(commentId: string): Promise<void>;
  toggleCommentLike(commentId: string): Promise<{ liked: boolean; likes: number }>;
  /** Signale un commentaire (V1 : enregistré localement et masqué pour soi). */
  reportComment(commentId: string, reason: string): Promise<void>;

  // Brouillons (projets non publiés)
  listDrafts(): Promise<Composition[]>;
  saveDraft(composition: Composition): Promise<void>;
  deleteDraft(id: string): Promise<void>;
}
