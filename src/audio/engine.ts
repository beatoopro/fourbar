import * as Tone from 'tone';
import type { Composition, TrackId } from '../core/types';
import { TRACK_IDS } from '../core/types';
import { LOOP_TICKS, PPQ, ticksToSeconds } from '../core/timing';
import { swingNote } from '../core/drums';
import { REVERB_SEND, createInstrument, type InstrumentVoice } from './instruments';

/**
 * Moteur audio : lit une composition en boucle (4 mesures) avec Tone.js.
 * Une seule composition est chargée à la fois ; `sourceId` indique à l'UI
 * qui la joue (l'éditeur ou une carte d'Explore).
 */

interface TrackNodes {
  instrumentId: string;
  voice: InstrumentVoice;
  volume: Tone.Volume;
}

interface PartEvent {
  time: string;
  track: TrackId;
  pitch: number;
  duration: number;
  velocity: number;
}

export interface EngineState {
  playing: boolean;
  sourceId: string | null;
}

type Listener = (s: EngineState) => void;

class AudioEngine {
  private ready: Promise<void> | null = null;
  private tracks = new Map<TrackId, TrackNodes>();
  private master!: Tone.Gain;
  private reverbSend!: Tone.Gain;
  private part: Tone.Part<PartEvent> | null = null;
  private comp: Composition | null = null;
  private state: EngineState = { playing: false, sourceId: null };
  private listeners = new Set<Listener>();

  /** Doit être appelé suite à un geste utilisateur (politique d'autoplay des navigateurs). */
  init(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await Tone.start();
        Tone.getContext().lookAhead = 0.05;
        const transport = Tone.getTransport();
        transport.PPQ = PPQ;
        transport.loop = true;
        transport.loopStart = 0;
        transport.loopEnd = `${LOOP_TICKS}i`;

        const limiter = new Tone.Limiter(-1).toDestination();
        const comp = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.01, release: 0.2 }).connect(limiter);
        this.master = new Tone.Gain(0.9).connect(comp);
        const reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: 1 });
        await reverb.ready;
        reverb.connect(this.master);
        this.reverbSend = new Tone.Gain(0.22).connect(reverb);

        this.part = new Tone.Part<PartEvent>((time, ev) => {
          const nodes = this.tracks.get(ev.track);
          const bpm = transport.bpm.value;
          nodes?.voice.trigger(ev.pitch, ticksToSeconds(ev.duration, bpm), time, ev.velocity);
        }, []);
        this.part.start(0);
      })();
    }
    return this.ready;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  getState() {
    return this.state;
  }

  private setState(s: Partial<EngineState>) {
    this.state = { ...this.state, ...s };
    this.listeners.forEach((l) => l(this.state));
  }

  private ensureTrack(id: TrackId, instrumentId: string): TrackNodes {
    let nodes = this.tracks.get(id);
    if (nodes && nodes.instrumentId === instrumentId) return nodes;
    if (nodes) {
      nodes.voice.releaseAll();
      const old = nodes;
      setTimeout(() => old.voice.dispose(), 2000);
    }
    const voice = createInstrument(instrumentId);
    const volume = nodes?.volume ?? new Tone.Volume(0);
    if (!nodes) {
      volume.connect(this.master);
      volume.connect(new Tone.Gain(REVERB_SEND[id] ?? 1).connect(this.reverbSend));
    }
    voice.output.connect(volume);
    nodes = { instrumentId, voice, volume };
    this.tracks.set(id, nodes);
    return nodes;
  }

  /** Synchronise le moteur avec la composition (notes, tempo, mix). Appel peu coûteux. */
  update(comp: Composition) {
    this.comp = comp;
    if (!this.part) return;
    Tone.getTransport().bpm.value = comp.bpm;
    const anySolo = TRACK_IDS.some((id) => comp.tracks[id].solo);
    for (const id of TRACK_IDS) {
      const t = comp.tracks[id];
      const nodes = this.ensureTrack(id, t.instrument);
      const audible = !t.muted && (!anySolo || t.solo);
      nodes.volume.mute = !audible;
      nodes.volume.volume.value = t.volume <= 0.001 ? -Infinity : Tone.gainToDb(t.volume);
    }
    this.part.clear();
    for (const id of TRACK_IDS) {
      for (const n of comp.tracks[id].notes) {
        if (n.start >= LOOP_TICKS) continue;
        // Le swing est appliqué à la lecture : les notes restent sur la grille dans les données.
        const { start, duration } = swingNote(n.start, n.duration, comp.swing);
        this.part.add({
          time: `${Math.min(LOOP_TICKS - 1, Math.round(start))}i`,
          track: id,
          pitch: n.pitch,
          duration: Math.min(duration, LOOP_TICKS * 2),
          velocity: n.velocity,
        });
      }
    }
  }

  async play(comp: Composition, sourceId: string) {
    await this.init();
    const transport = Tone.getTransport();
    if (this.state.playing) {
      transport.stop();
      this.tracks.forEach((t) => t.voice.releaseAll());
    }
    this.update(comp);
    transport.position = 0;
    transport.start('+0.03');
    this.setState({ playing: true, sourceId });
  }

  stop() {
    if (!this.ready) return;
    Tone.getTransport().stop();
    this.tracks.forEach((t) => t.voice.releaseAll());
    this.setState({ playing: false });
  }

  async toggle(comp: Composition, sourceId: string) {
    if (this.state.playing && this.state.sourceId === sourceId) this.stop();
    else await this.play(comp, sourceId);
  }

  /** Position de lecture audible (en ticks dans la boucle) ou null. */
  getTick(): number | null {
    if (!this.state.playing || !this.part) return null;
    const transport = Tone.getTransport();
    const t = transport.getTicksAtTime(Tone.getContext().currentTime);
    return ((t % LOOP_TICKS) + LOOP_TICKS) % LOOP_TICKS;
  }

  /** Déplace la tête de lecture (pendant la lecture). */
  seek(tick: number) {
    if (!this.ready) return;
    Tone.getTransport().ticks = Math.max(0, Math.min(LOOP_TICKS - 1, Math.round(tick)));
  }

  /** Joue une note isolée immédiatement (clic sur le clavier, ajout de note…). */
  async preview(comp: Composition, track: TrackId, pitch: number, velocity = 0.8, durTicks = PPQ / 2) {
    await this.init();
    if (this.comp !== comp) this.update(comp);
    const nodes = this.ensureTrack(track, comp.tracks[track].instrument);
    nodes.voice.trigger(pitch, Math.min(0.6, ticksToSeconds(durTicks, comp.bpm)), Tone.now(), velocity);
  }

  getCurrentComposition() {
    return this.comp;
  }
}

export const engine = new AudioEngine();
