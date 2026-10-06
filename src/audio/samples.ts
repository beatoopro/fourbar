import * as Tone from 'tone';

/**
 * Banques d'échantillons servies depuis public/samples (aucun service externe).
 * Un fichier toutes les tierces mineures, nommé par sa note MIDI : Tone.Sampler
 * transpose le plus proche pour les notes intermédiaires.
 * Sources et licences : public/samples/CREDITS.md.
 */
export interface SampleBank {
  dir: string;
  notes: number[];
}

const every3 = (from: number, to: number) => Array.from({ length: Math.floor((to - from) / 3) + 1 }, (_, i) => from + i * 3);

export const SAMPLE_BANKS: Record<string, SampleBank> = {
  piano: { dir: 'piano', notes: every3(24, 108) },
  epiano: { dir: 'epiano', notes: every3(36, 93) },
  'bass-finger': { dir: 'bass-finger', notes: every3(24, 69) },
  'bass-upright': { dir: 'bass-upright', notes: every3(24, 69) },
  // Ride de batterie : ici les fichiers sont nommés par vélocité MIDI maximale (couches douce et forte).
  ride: { dir: 'ride', notes: [64, 127] },
};

export type DecodedBank = Map<number, AudioBuffer>;

const loaded = new Map<string, DecodedBank>();
const pending = new Map<string, Promise<DecodedBank | null>>();

/** Banque déjà décodée, ou undefined si elle n'est pas (encore) disponible. */
export function getLoadedBank(bank: string): DecodedBank | undefined {
  return loaded.get(bank);
}

/**
 * Charge et décode une banque une seule fois (les AudioBuffer décodés sont
 * réutilisables dans n'importe quel contexte, y compris le rendu hors-ligne).
 * Renvoie null en cas d'échec : l'instrument garde alors son synthé de secours.
 */
export function loadBank(bank: string): Promise<DecodedBank | null> {
  const def = SAMPLE_BANKS[bank];
  if (!def) return Promise.resolve(null);
  let p = pending.get(bank);
  if (!p) {
    const base = `${import.meta.env.BASE_URL}samples/${def.dir}/`;
    const ctx = Tone.getContext();
    p = Promise.all(
      def.notes.map(async (n) => {
        const res = await fetch(`${base}${n}.mp3`);
        if (!res.ok) throw new Error(`Échantillon introuvable : ${def.dir}/${n}.mp3`);
        return [n, await ctx.decodeAudioData(await res.arrayBuffer())] as const;
      }),
    ).then(
      (entries) => {
        const decoded: DecodedBank = new Map(entries);
        loaded.set(bank, decoded);
        return decoded;
      },
      (err) => {
        console.warn('Échantillons indisponibles, synthé de secours utilisé', err);
        pending.delete(bank); // nouvel essai au prochain chargement
        return null;
      },
    );
    pending.set(bank, p);
  }
  return p;
}
