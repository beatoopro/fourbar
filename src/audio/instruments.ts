import * as Tone from 'tone';
import { isDrumKit } from '../core/instruments';
import { createDrumKit } from './drums';
import { getLoadedBank, loadBank, type DecodedBank } from './samples';

/**
 * Instruments : piano, piano électrique et basses jouent de vrais
 * échantillons (public/samples, licences dans CREDITS.md) ; les autres sont
 * synthétisés avec Tone.js. Chaque instrument échantillonné garde un synthé
 * de secours, joué tant que ses fichiers chargent ou s'ils sont introuvables.
 * Les fabriques utilisent le contexte Tone courant, ce qui permet de les
 * réutiliser telles quelles pour le rendu hors-ligne (export WAV).
 */
export interface InstrumentVoice {
  output: Tone.ToneAudioNode;
  /** Résolue quand l'instrument joue son vrai son (échantillons chargés ou synthé de secours). */
  ready?: Promise<void>;
  trigger(pitch: number, durationSec: number, time: number, velocity: number): void;
  releaseAll(): void;
  dispose(): void;
}

type Poly = Tone.PolySynth;

function voice(synth: Poly, chain: Tone.ToneAudioNode[] = []): InstrumentVoice {
  synth.maxPolyphony = 48;
  let last: Tone.ToneAudioNode = synth;
  for (const node of chain) {
    last.connect(node);
    last = node;
  }
  return {
    output: last,
    trigger(pitch, dur, time, velocity) {
      synth.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toFrequency(), dur, time, velocity);
    },
    releaseAll() {
      synth.releaseAll();
    },
    dispose() {
      synth.dispose();
      chain.forEach((n) => n.dispose());
    },
  };
}

interface SampledDef {
  bank: string;
  /** Volume en dB, pour aligner le niveau des banques entre elles. */
  volume: number;
  /** Relâchement en secondes à la fin de la note (étouffoir, main sur la corde). */
  release: number;
  fallback: () => InstrumentVoice;
  chain?: () => Tone.ToneAudioNode[];
}

function sampled(def: SampledDef): InstrumentVoice {
  const context = Tone.getContext();
  const out = new Tone.Gain({ context });
  const fallback = def.fallback();
  fallback.output.connect(out);
  let sampler: Tone.Sampler | null = null;
  let chain: Tone.ToneAudioNode[] = [];
  let disposed = false;

  const build = (bank: DecodedBank) => {
    if (disposed || sampler) return;
    // Le contexte est fixé à la création : la voix reste dans le bon contexte
    // même si les fichiers arrivent pendant un rendu hors-ligne.
    sampler = new Tone.Sampler({ context, urls: Object.fromEntries(bank), release: def.release, volume: def.volume });
    chain = def.chain?.() ?? [];
    let last: Tone.ToneAudioNode = sampler;
    for (const node of chain) {
      last.connect(node);
      last = node;
    }
    last.connect(out);
  };

  const cached = getLoadedBank(def.bank);
  if (cached) build(cached);
  const ready = cached
    ? Promise.resolve()
    : loadBank(def.bank).then((bank) => {
        if (bank) build(bank);
      });

  return {
    output: out,
    ready,
    trigger(pitch, dur, time, velocity) {
      if (sampler) sampler.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toFrequency(), dur, time, velocity);
      else fallback.trigger(pitch, dur, time, velocity);
    },
    releaseAll() {
      sampler?.releaseAll();
      fallback.releaseAll();
    },
    dispose() {
      disposed = true;
      sampler?.dispose();
      chain.forEach((n) => n.dispose());
      fallback.dispose();
      out.dispose();
    },
  };
}

const SAMPLED: Record<string, Omit<SampledDef, 'fallback'>> = {
  keys: { bank: 'piano', volume: 3, release: 0.45 },
  epiano: {
    bank: 'epiano',
    volume: 9,
    release: 0.35,
    chain: () => [new Tone.Chorus({ frequency: 0.8, delayTime: 3, depth: 0.25, wet: 0.25 }).start()],
  },
  round: { bank: 'bass-finger', volume: 13, release: 0.08 },
  upright: { bank: 'bass-upright', volume: 14, release: 0.1 },
};

/** Synthés joués pendant le chargement des échantillons (ou à leur place s'ils manquent). */
const synths: Record<string, () => InstrumentVoice> = {
  keys: () => {
    const s = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 1.4,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.003, decay: 1.8, sustain: 0.22, release: 1.1 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0.08, release: 0.8 },
    });
    s.volume.value = -2;
    const filter = new Tone.Filter(4200, 'lowpass');
    const chorus = new Tone.Chorus({ frequency: 0.6, delayTime: 3.5, depth: 0.35, wet: 0.35 }).start();
    return voice(s, [filter, chorus]);
  },
  epiano: () => synths.keys(),
  upright: () => synths.round(),
  pad: () => {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: { attack: 0.35, decay: 0.6, sustain: 0.75, release: 1.6 },
    });
    s.volume.value = -10;
    const filter = new Tone.Filter({ frequency: 1300, type: 'lowpass', Q: 0.4 });
    const chorus = new Tone.Chorus({ frequency: 0.3, delayTime: 4, depth: 0.6, wet: 0.5 }).start();
    return voice(s, [filter, chorus]);
  },
  organ: () => {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'custom', partials: [1, 0.55, 0.3, 0.12, 0.08, 0.04] },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.85, release: 0.25 },
    });
    s.volume.value = -17;
    const vibrato = new Tone.Vibrato({ frequency: 5.5, depth: 0.06 });
    const filter = new Tone.Filter(2600, 'lowpass');
    return voice(s, [vibrato, filter]);
  },
  pluck: () => {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'custom', partials: [1, 0.4, 0.25, 0.1, 0.05] },
      envelope: { attack: 0.002, decay: 0.45, sustain: 0.04, release: 0.5 },
    });
    s.volume.value = -5;
    const filter = new Tone.Filter(3800, 'lowpass');
    const delay = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.22, wet: 0.16 });
    return voice(s, [filter, delay]);
  },
  bell: () => {
    const s = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 5.07,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 1.6, sustain: 0, release: 1.6 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.6 },
    });
    s.volume.value = -1;
    return voice(s);
  },
  lead: () => {
    const s = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'square' },
      filter: { Q: 1, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.45, release: 0.4, baseFrequency: 500, octaves: 2.6 },
      envelope: { attack: 0.012, decay: 0.2, sustain: 0.65, release: 0.25 },
    });
    s.volume.value = -18;
    const delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.12 });
    return voice(s, [delay]);
  },
  sub: () => {
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'custom', partials: [1, 0.22, 0.06] },
      envelope: { attack: 0.006, decay: 0.25, sustain: 0.9, release: 0.18 },
    });
    s.volume.value = -11;
    return voice(s);
  },
  analog: () => {
    const s = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2.5, type: 'lowpass', rolloff: -24 },
      filterEnvelope: { attack: 0.003, decay: 0.22, sustain: 0.25, release: 0.3, baseFrequency: 110, octaves: 3.2 },
      envelope: { attack: 0.004, decay: 0.3, sustain: 0.8, release: 0.15 },
    });
    s.volume.value = -10;
    return voice(s);
  },
  round: () => {
    const s = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'triangle' },
      filter: { Q: 0.8, type: 'lowpass', rolloff: -12 },
      filterEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.3, release: 0.3, baseFrequency: 220, octaves: 2 },
      envelope: { attack: 0.004, decay: 0.6, sustain: 0.5, release: 0.2 },
    });
    s.volume.value = -5.5;
    return voice(s);
  },
};

/** Part de réverbération par piste : la batterie reste sèche et percutante. */
export const REVERB_SEND: Record<string, number> = { chords: 1, melody: 1, bass: 1, drums: 0.25 };

export function createInstrument(id: string): InstrumentVoice {
  if (isDrumKit(id)) return createDrumKit(id);
  const def = SAMPLED[id];
  if (def) return sampled({ ...def, fallback: synths[id] });
  return (synths[id] ?? (() => createInstrument('keys')))();
}

/** Charge à l'avance les échantillons d'un instrument (indispensable avant un rendu hors-ligne). */
export async function preloadInstrument(id: string): Promise<void> {
  if (isDrumKit(id)) await loadBank('ride');
  const def = SAMPLED[id];
  if (def) await loadBank(def.bank);
}
