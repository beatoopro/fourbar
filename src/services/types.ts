import type { AdvancedFilters } from '../core/search';
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
  /** Recherche avancée (BPM, tonalité, pistes, progression…). */
  filters?: AdvancedFilters;
}

/** Erreur renvoyée par les actions qui demandent un compte (publier, liker, commenter…). */
export class AuthRequiredError extends Error {
  constructor() {
    super('You need an account for this.');
    this.name = 'AuthRequiredError';
  }
}

/** Connexion sans mot de passe : Google, ou e-mail + code à 6 chiffres. */
export type SignInMethod = { provider: 'google' } | { provider: 'email'; email: string; code: string };

export interface SignInResult {
  user: User;
  /** Premier passage : l'interface propose de choisir le nom et le pseudo. */
  isNew: boolean;
  /** Brouillons faits en invité, rattachés au compte à la connexion. */
  importedDrafts: number;
}

/** Pseudo (@handle) : 3 à 20 caractères, minuscules, chiffres, point et tiret bas. */
export const HANDLE_PATTERN = /^[a-z0-9._]{3,20}$/;

export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20);
}

export type ProfilePatch = Partial<Pick<User, 'name' | 'handle' | 'bio'>>;

export interface CommunityApi {
  // Authentification (simulée en V1). null = visiteur sans compte.
  getCurrentUser(): Promise<User | null>;
  /** Envoie le code de connexion par e-mail. `demoCode` n'existe qu'en mode local, faute d'envoi réel. */
  requestEmailCode(email: string): Promise<{ demoCode?: string }>;
  /** Connecte (ou crée le compte) et rattache les brouillons faits en invité. */
  signIn(method: SignInMethod): Promise<SignInResult>;
  signOut(): Promise<void>;
  isHandleAvailable(handle: string): Promise<boolean>;
  updateCurrentUser(patch: ProfilePatch): Promise<User>;

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

  // Brouillons (projets non publiés). En invité, ils restent dans le navigateur jusqu'à la connexion.
  listDrafts(): Promise<Composition[]>;
  saveDraft(composition: Composition): Promise<void>;
  deleteDraft(id: string): Promise<void>;
}
