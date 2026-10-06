import { BAR, LOOP_TICKS, PPQ } from '../core/timing';
import { encodeSharedLoop } from '../core/share';
import type { Publication, User } from '../services';
import { toast } from '../ui/common';

/** « Mesure 3 · temps 2 » à partir d'une position en ticks. */
export function anchorLabel(tick: number): string {
  return `Mesure ${Math.floor(tick / BAR) + 1} · temps ${Math.floor((tick % BAR) / PPQ) + 1}`;
}

/** Position arrondie au temps le plus proche (en restant dans la boucle). */
export function snapToBeat(tick: number): number {
  return Math.min(LOOP_TICKS - PPQ, Math.max(0, Math.round(tick / PPQ) * PPQ));
}

export function loopPath(id: string, focus?: 'comments'): string {
  return `/loop/${encodeURIComponent(id)}${focus ? `?focus=${focus}` : ''}`;
}

/**
 * Lien à partager. Les loops de démonstration existent chez tout le monde ;
 * les autres n'existent que dans ce navigateur tant qu'il n'y a pas de serveur,
 * donc on embarque la loop dans le lien.
 */
export async function shareUrl(pub: Publication, author: User | undefined): Promise<string> {
  const base = `${window.location.origin}${window.location.pathname}#/loop/${encodeURIComponent(pub.id)}`;
  if (pub.id.startsWith('seed_')) return base;
  const d = await encodeSharedLoop({
    composition: pub.composition,
    // « Vous » (profil jamais renommé) n'a pas de sens chez le destinataire.
    author: {
      name: author && author.name !== 'Vous' ? author.name : 'Anonyme',
      handle: author && author.handle !== 'vous' ? author.handle : 'anonyme',
      color: author?.color ?? '#8b5cf6',
    },
    publishedAt: pub.publishedAt,
  });
  return `${base}?d=${d}`;
}

/** Menu de partage natif sur mobile, sinon copie dans le presse-papiers. */
export async function shareLink(url: string, title: string) {
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if (touch && navigator.share) {
    try {
      await navigator.share({ title: `${title} · 4Chords`, url });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Lien copié');
  } catch {
    window.prompt('Copiez ce lien :', url);
  }
}
