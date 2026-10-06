import * as Tone from 'tone';
import type { Composition } from '../core/types';
import { TRACK_IDS } from '../core/types';
import { LOOP_TICKS, PPQ, ticksToSeconds } from '../core/timing';
import { createInstrument } from './instruments';

/**
 * Rendu hors-ligne en WAV. On joue la boucle deux fois et on garde le second
 * passage : les queues de notes et de réverbération de la fin rebouclent sur le
 * début, le fichier se répète donc sans coupure dans un sampler ou un DAW.
 */
export async function renderWav(comp: Composition): Promise<Blob> {
  const loopSec = ticksToSeconds(LOOP_TICKS, comp.bpm);
  const anySolo = TRACK_IDS.some((id) => comp.tracks[id].solo);
  const buffer = await Tone.Offline(async ({ transport }) => {
    transport.PPQ = PPQ;
    transport.bpm.value = comp.bpm;
    const limiter = new Tone.Limiter(-1).toDestination();
    const compressor = new Tone.Compressor({ threshold: -14, ratio: 3, attack: 0.01, release: 0.2 }).connect(limiter);
    const master = new Tone.Gain(0.9).connect(compressor);
    const reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.02, wet: 1 });
    await reverb.ready;
    reverb.connect(master);
    const send = new Tone.Gain(0.22).connect(reverb);

    for (const id of TRACK_IDS) {
      const t = comp.tracks[id];
      if (t.muted || (anySolo && !t.solo) || t.notes.length === 0) continue;
      const voice = createInstrument(t.instrument);
      const vol = new Tone.Volume(Tone.gainToDb(Math.max(0.001, t.volume)));
      voice.output.connect(vol);
      vol.connect(master);
      vol.connect(send);
      for (let pass = 0; pass < 2; pass++) {
        for (const n of t.notes) {
          const time = ticksToSeconds(n.start + pass * LOOP_TICKS, comp.bpm);
          transport.schedule((when) => {
            voice.trigger(n.pitch, ticksToSeconds(n.duration, comp.bpm), when, n.velocity);
          }, time);
        }
      }
    }
    transport.start(0);
  }, loopSec * 2, 2, 44100);

  const audio = buffer.get();
  if (!audio) throw new Error('Rendu audio vide');
  const start = Math.round(loopSec * audio.sampleRate);
  const length = audio.length - start;
  const channels = [0, 1].map((ch) => audio.getChannelData(Math.min(ch, audio.numberOfChannels - 1)).slice(start, start + length));
  // Sécurité anti-saturation : normalisation si un pic dépasse -0,3 dBFS.
  let peak = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  if (peak > 0.966) for (const c of channels) for (let i = 0; i < c.length; i++) c[i] *= 0.966 / peak;
  return encodeWav(channels, audio.sampleRate);
}

function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const numCh = channels.length;
  const len = channels[0].length;
  const dataSize = len * numCh * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numCh * 2, true);
  v.setUint16(32, numCh * 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}
