import type { Composition } from './types';
import { TRACK_IDS } from './types';
import { normalizeComposition } from './composition';

/**
 * Lien de partage autonome : la loop est compressée dans l'adresse.
 * Tant qu'il n'y a pas de serveur, c'est ce qui permet d'ouvrir chez quelqu'un
 * d'autre une loop qui n'existe que dans votre navigateur.
 */

export interface SharedAuthor {
  name: string;
  handle: string;
  color: string;
}

export interface SharedLoop {
  composition: Composition;
  author: SharedAuthor;
  publishedAt: string;
}

interface Payload {
  v: 1;
  c: unknown;
  u: SharedAuthor;
  p: string;
}

/** Au-delà, le lien est refusé (une loop de 4 mesures tient largement en dessous). */
const MAX_ENCODED = 60_000;

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Retire ce qui se reconstruit à l'ouverture (ids de notes, noms de pistes) pour raccourcir le lien. */
function compact(c: Composition) {
  const tracks = Object.fromEntries(
    TRACK_IDS.map((id) => {
      const { name: _name, notes, ...t } = c.tracks[id];
      return [id, { ...t, notes: notes.map((n) => [n.pitch, n.start, n.duration, Math.round(n.velocity * 100) / 100]) }];
    }),
  );
  return { ...c, tracks };
}

function expand(raw: Record<string, unknown>): Composition {
  const tracks = (raw.tracks ?? {}) as Record<string, { notes?: unknown[] }>;
  for (const t of Object.values(tracks)) {
    t.notes = (Array.isArray(t.notes) ? t.notes : []).map((n) => {
      const [pitch, start, duration, velocity] = Array.isArray(n) ? n : [];
      return { pitch, start, duration, velocity };
    });
  }
  return normalizeComposition(raw as unknown as Composition);
}

export async function encodeSharedLoop(loop: SharedLoop): Promise<string> {
  const payload: Payload = { v: 1, c: compact(loop.composition), u: loop.author, p: loop.publishedAt };
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(payload)), new CompressionStream('deflate-raw')));
}

/** Renvoie null si le lien est abîmé ou ne vient pas de 4Chords. */
export async function decodeSharedLoop(data: string): Promise<SharedLoop | null> {
  try {
    if (!data || data.length > MAX_ENCODED) return null;
    const json = new TextDecoder().decode(await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw')));
    const p = JSON.parse(json) as Payload;
    if (p?.v !== 1 || typeof p.c !== 'object' || !p.c) return null;
    const composition = expand(p.c as Record<string, unknown>);
    const str = (v: unknown, max: number, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
    const color = typeof p.u?.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(p.u.color) ? p.u.color : '#8b5cf6';
    return {
      composition: { ...composition, title: str(composition.title, 60, 'Sans titre') },
      author: { name: str(p.u?.name, 40, 'Anonyme'), handle: str(p.u?.handle, 30, 'anonyme'), color },
      publishedAt: !Number.isNaN(Date.parse(p.p)) ? p.p : composition.createdAt,
    };
  } catch {
    return null;
  }
}
