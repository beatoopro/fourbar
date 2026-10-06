import { create } from 'zustand';
import { useCommunity } from './store';

/**
 * Demande de compte « au bon moment » : une action qui a besoin d'un compte
 * appelle ensureAccount(), la fenêtre de connexion s'ouvre, et l'action reprend
 * toute seule une fois connecté (la promesse renvoie true), sinon false.
 */

export type AuthReason =
  | { kind: 'publish'; title: string }
  | { kind: 'like' }
  | { kind: 'comment' }
  | { kind: 'report' }
  | { kind: 'download' }
  | { kind: 'signin' };

interface AuthPromptState {
  reason: AuthReason | null;
  resolve: ((ok: boolean) => void) | null;
}

export const useAuthPrompt = create<AuthPromptState>(() => ({ reason: null, resolve: null }));

export function ensureAccount(reason: AuthReason): Promise<boolean> {
  if (useCommunity.getState().me) return Promise.resolve(true);
  return new Promise((resolve) => {
    useAuthPrompt.getState().resolve?.(false);
    useAuthPrompt.setState({ reason, resolve });
  });
}

export function closeAuthPrompt(ok: boolean) {
  const { resolve } = useAuthPrompt.getState();
  useAuthPrompt.setState({ reason: null, resolve: null });
  resolve?.(ok);
}

/* ---------- Téléchargements : le premier est libre, ensuite compte gratuit ---------- */
const GUEST_DOWNLOADS_KEY = '4chords:v1:guestDownloads';
export const FREE_GUEST_DOWNLOADS = 1;

function guestDownloads(): number {
  try {
    return Number(localStorage.getItem(GUEST_DOWNLOADS_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** À appeler avant chaque téléchargement (MIDI ou WAV). */
export async function ensureDownloadAllowed(): Promise<boolean> {
  if (useCommunity.getState().me) return true;
  const n = guestDownloads();
  if (n < FREE_GUEST_DOWNLOADS) {
    try {
      localStorage.setItem(GUEST_DOWNLOADS_KEY, String(n + 1));
    } catch {
      /* stockage indisponible : le téléchargement passe quand même */
    }
    return true;
  }
  return ensureAccount({ kind: 'download' });
}
