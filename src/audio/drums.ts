import * as Tone from 'tone';
import { mapDrumPitch } from '../core/drums';
import type { InstrumentVoice } from './instruments';

/**
 * Kits de batterie 100 % synthétisés (comme les boîtes à rythmes 808 et 909,
 * qui sont elles-mêmes des synthés) : aucun échantillon, aucune licence.
 *
 * Toutes les sources tournent en continu et chaque coup ne fait que
 * déclencher une enveloppe : on peut donc rejouer un élément à n'importe quel
 * moment (roulements rapides, rendu hors-ligne) sans contrainte d'ordre.
 * La structure accepte plus tard des kits d'échantillons (Tone.Players) : il
 * suffit de fournir un autre `InstrumentVoice` pour le même identifiant.
 */

type Hit = (time: number, velocity: number) => void;

interface Built {
  hit: Hit;
  nodes: Tone.ToneAudioNode[];
}

/** Corps accordé (kick, toms, corps de snare) : sinus avec chute de hauteur. */
function tonal(out: Tone.InputNode, o: { from: number; to: number; sweep: number; decay: number; gain: number; type?: 'sine' | 'triangle' }): Built {
  const osc = new Tone.Oscillator({ frequency: o.to, type: o.type ?? 'sine' }).start();
  const env = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: o.decay, sustain: 0, release: 0.02 });
  const g = new Tone.Gain(o.gain);
  osc.chain(env, g);
  g.connect(out);
  return {
    nodes: [osc, env, g],
    hit(time, v) {
      osc.frequency.cancelScheduledValues(time);
      osc.frequency.setValueAtTime(o.from, time);
      osc.frequency.exponentialRampToValueAtTime(o.to, time + o.sweep);
      env.triggerAttack(time, v);
    },
  };
}

/** Bruit filtré (snare, hats, shaker, crash). */
function noisy(
  out: Tone.InputNode,
  src: Tone.ToneAudioNode,
  o: { type: BiquadFilterType; freq: number; q?: number; decay: number; gain: number; attack?: number },
): Built & { env: Tone.AmplitudeEnvelope } {
  const filter = new Tone.Filter({ frequency: o.freq, type: o.type, Q: o.q ?? 0.7 });
  const env = new Tone.AmplitudeEnvelope({ attack: o.attack ?? 0.0008, decay: o.decay, sustain: 0, release: 0.03 });
  const g = new Tone.Gain(o.gain);
  src.connect(filter);
  filter.chain(env, g);
  g.connect(out);
  return { env, nodes: [filter, env, g], hit: (time, v) => env.triggerAttack(time, v) };
}

/** Banque de 6 carrés désaccordés : le « métal » des cymbales de la 808. */
function metalBank(scale: number): { out: Tone.Gain; nodes: Tone.ToneAudioNode[] } {
  const out = new Tone.Gain(0.16);
  const nodes: Tone.ToneAudioNode[] = [out];
  for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
    const osc = new Tone.Oscillator({ frequency: f * scale, type: 'square' }).start();
    osc.connect(out);
    nodes.push(osc);
  }
  return { out, nodes };
}

interface KitSpec {
  kick: { from: number; to: number; sweep: number; decay: number; click: number };
  snare: { tone: number; toneDecay: number; noiseDecay: number; noiseFreq: number; noise: number };
  clap: { freq: number; tail: number; gain: number };
  hat: { decay: number; open: number; freq: number; metal: number; noise: number };
  tom: { lo: number; hi: number; decay: number };
  /** Coloration du kit : passe-bas (Hz) et saturation (0-1). */
  tone: { lowpass: number; drive: number; gain: number };
}

const KITS: Record<string, KitSpec> = {
  'kit-808': {
    kick: { from: 150, to: 47, sweep: 0.09, decay: 0.75, click: 0.15 },
    snare: { tone: 190, toneDecay: 0.09, noiseDecay: 0.16, noiseFreq: 1900, noise: 0.55 },
    clap: { freq: 1150, tail: 0.2, gain: 0.95 },
    hat: { decay: 0.045, open: 0.32, freq: 8200, metal: 0.9, noise: 0.25 },
    tom: { lo: 95, hi: 145, decay: 0.45 },
    tone: { lowpass: 16000, drive: 0, gain: 1 },
  },
  'kit-dusty': {
    kick: { from: 120, to: 54, sweep: 0.06, decay: 0.36, click: 0.35 },
    snare: { tone: 175, toneDecay: 0.07, noiseDecay: 0.2, noiseFreq: 1400, noise: 0.8 },
    clap: { freq: 1000, tail: 0.16, gain: 0.8 },
    hat: { decay: 0.05, open: 0.26, freq: 6500, metal: 0.35, noise: 0.75 },
    tom: { lo: 100, hi: 150, decay: 0.3 },
    tone: { lowpass: 6200, drive: 0.22, gain: 1.15 },
  },
  'kit-house': {
    kick: { from: 230, to: 52, sweep: 0.045, decay: 0.42, click: 0.6 },
    snare: { tone: 220, toneDecay: 0.06, noiseDecay: 0.14, noiseFreq: 2600, noise: 0.75 },
    clap: { freq: 1300, tail: 0.22, gain: 1.1 },
    hat: { decay: 0.04, open: 0.24, freq: 9500, metal: 0.55, noise: 0.6 },
    tom: { lo: 110, hi: 165, decay: 0.32 },
    tone: { lowpass: 15000, drive: 0.06, gain: 1 },
  },
};

export function createDrumKit(id: string): InstrumentVoice {
  const k = KITS[id] ?? KITS['kit-dusty'];
  const nodes: Tone.ToneAudioNode[] = [];
  const add = <T extends Tone.ToneAudioNode>(n: T) => (nodes.push(n), n);

  // Sortie du kit : saturation légère et passe-bas pour la couleur.
  const bus = add(new Tone.Gain(k.tone.gain * 0.8));
  const lowpass = add(new Tone.Filter({ frequency: k.tone.lowpass, type: 'lowpass', rolloff: -12 }));
  let last: Tone.ToneAudioNode = lowpass;
  bus.connect(lowpass);
  if (k.tone.drive > 0) {
    const drive = add(new Tone.Distortion({ distortion: k.tone.drive, wet: 0.5 }));
    lowpass.connect(drive);
    last = drive;
  }
  const output = add(new Tone.Gain(1));
  last.connect(output);

  const white = add(new Tone.Noise('white').start());
  const pink = add(new Tone.Noise('pink').start());
  const metal = metalBank(1);
  const metalHi = metalBank(1.45);
  nodes.push(...metal.nodes, ...metalHi.nodes);
  const own = <B extends Built>(b: B) => (nodes.push(...b.nodes), b);

  // Kick : corps + petit clic d'attaque.
  const kickBody = own(tonal(bus, { from: k.kick.from, to: k.kick.to, sweep: k.kick.sweep, decay: k.kick.decay, gain: 1.15 }));
  const kickClick = own(noisy(bus, white, { type: 'highpass', freq: 3000, decay: 0.006, gain: k.kick.click }));

  // Snare : corps accordé + bruit.
  const snBody = own(tonal(bus, { from: k.snare.tone * 1.25, to: k.snare.tone, sweep: 0.03, decay: k.snare.toneDecay, gain: 0.5, type: 'triangle' }));
  const snNoise = own(noisy(bus, white, { type: 'highpass', freq: k.snare.noiseFreq, decay: k.snare.noiseDecay, gain: k.snare.noise }));

  // Clap : trois éclats rapprochés puis une queue.
  const clapBurst = own(noisy(bus, white, { type: 'bandpass', freq: k.clap.freq, q: 1.2, decay: 0.009, gain: k.clap.gain * 1.4 }));
  const clapTail = own(noisy(bus, white, { type: 'bandpass', freq: k.clap.freq, q: 1, decay: k.clap.tail, gain: k.clap.gain }));

  // Hi-hats : métal + bruit aigu. Le fermé coupe l'ouvert (« choke »).
  const hatMetal = own(noisy(bus, metal.out, { type: 'highpass', freq: k.hat.freq, decay: k.hat.decay, gain: k.hat.metal * 2.2 }));
  const hatNoise = own(noisy(bus, white, { type: 'highpass', freq: k.hat.freq, decay: k.hat.decay, gain: k.hat.noise }));
  const openMetal = own(noisy(bus, metal.out, { type: 'highpass', freq: k.hat.freq * 0.9, decay: k.hat.open, gain: k.hat.metal * 1.8 }));
  const openNoise = own(noisy(bus, white, { type: 'highpass', freq: k.hat.freq * 0.9, decay: k.hat.open, gain: k.hat.noise * 0.8 }));

  // Ride, crash, shaker.
  const ride = own(noisy(bus, metalHi.out, { type: 'bandpass', freq: 5200, q: 0.8, decay: 1.1, gain: 1.6 }));
  const rideTick = own(noisy(bus, white, { type: 'highpass', freq: 9000, decay: 0.03, gain: 0.25 }));
  const crashMetal = own(noisy(bus, metal.out, { type: 'highpass', freq: 4500, decay: 1.6, gain: 1.3, attack: 0.002 }));
  const crashNoise = own(noisy(bus, white, { type: 'highpass', freq: 5000, decay: 1.4, gain: 0.45, attack: 0.002 }));
  const shaker = own(noisy(bus, white, { type: 'bandpass', freq: 6500, q: 1.4, decay: 0.05, gain: 0.7, attack: 0.008 }));

  // Toms.
  const tomLo = own(tonal(bus, { from: k.tom.lo * 1.6, to: k.tom.lo, sweep: 0.12, decay: k.tom.decay, gain: 0.9 }));
  const tomHi = own(tonal(bus, { from: k.tom.hi * 1.6, to: k.tom.hi, sweep: 0.1, decay: k.tom.decay * 0.85, gain: 0.8 }));
  const tomNoise = own(noisy(bus, pink, { type: 'lowpass', freq: 2500, decay: 0.05, gain: 0.25 }));

  const both = (...hits: Hit[]): Hit => (t, v) => hits.forEach((h) => h(t, v));
  const lanes: Record<number, Hit> = {
    36: both(kickBody.hit, kickClick.hit),
    38: both(snBody.hit, snNoise.hit),
    39: (t, v) => {
      clapBurst.hit(t, v);
      clapBurst.hit(t + 0.011, v * 0.85);
      clapBurst.hit(t + 0.022, v * 0.75);
      clapTail.hit(t + 0.03, v);
    },
    42: (t, v) => {
      openMetal.env.triggerRelease(t);
      openNoise.env.triggerRelease(t);
      hatMetal.hit(t, v);
      hatNoise.hit(t, v);
    },
    46: both(openMetal.hit, openNoise.hit),
    51: both(ride.hit, rideTick.hit),
    49: both(crashMetal.hit, crashNoise.hit),
    70: shaker.hit,
    45: both(tomLo.hit, tomNoise.hit),
    50: both(tomHi.hit, tomNoise.hit),
  };

  return {
    output,
    trigger(pitch, _dur, time, velocity) {
      const p = mapDrumPitch(pitch);
      if (p !== null) lanes[p]?.(time, velocity);
    },
    releaseAll() {
      /* Coups « one-shot » : rien à relâcher. */
    },
    dispose() {
      nodes.forEach((n) => n.dispose());
    },
  };
}
