import type { CommunityApi } from './types';
import { LocalCommunityApi } from './local/localApi';

/**
 * Point d'entrée unique de la couche de données.
 * Pour passer à un vrai backend : remplacer cette ligne par
 * `export const api: CommunityApi = new HttpCommunityApi(baseUrl, auth)`.
 */
export const api: CommunityApi = new LocalCommunityApi();

export { ME_ID } from './local/seed';
export type { CommunityApi, SignInMethod, SignInResult, ProfilePatch, Publication, User, FeedQuery, FeedSort, LoopComment, CommentSort, NewComment } from './types';
export { AuthRequiredError, HANDLE_PATTERN, normalizeHandle, COMMENT_MAX_LENGTH, remixNoteBody } from './types';
