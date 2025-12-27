let audioContext: AudioContext | null = null;

export function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

const audioBufferCache = new Map<string, AudioBuffer>();

export interface EffectsState {
  compressor: { enabled: boolean; threshold: number; ratio: number };
  reverb: { enabled: boolean; mix: number };
  delay: { enabled: boolean; time: number; feedback: number };
  lofi: { enabled: boolean; reduction: number };
  masterVolume: number;
}

let effectsState: EffectsState = {
  compressor: { enabled: true, threshold: -24, ratio: 4 },
  reverb: { enabled: false, mix: 0.3 },
  delay: { enabled: false, time: 0.3, feedback: 0.4 },
  lofi: { enabled: false, reduction: 8 },
  masterVolume: 0.8,
};

let compressorNode: DynamicsCompressorNode | null = null;
let convolverNode: ConvolverNode | null = null;
let delayNode: DelayNode | null = null;
let delayFeedback: GainNode | null = null;
let masterGain: GainNode | null = null;
let dryGain: GainNode | null = null;
let wetGain: GainNode | null = null;
let delayWetGain: GainNode | null = null;
let compressorBypass: GainNode | null = null;
let compressorWet: GainNode | null = null;
let drumGain: GainNode | null = null;

let effectsInitialized = false;

async function initEffects() {
  if (effectsInitialized) return;
  const ctx = getAudioContext();
  
  masterGain = ctx.createGain();
  masterGain.gain.value = effectsState.masterVolume;
  masterGain.connect(ctx.destination);
  
  compressorNode = ctx.createDynamicsCompressor();
  compressorNode.threshold.value = effectsState.compressor.threshold;
  compressorNode.ratio.value = effectsState.compressor.ratio;
  compressorNode.knee.value = 10;
  compressorNode.attack.value = 0.003;
  compressorNode.release.value = 0.25;
  
  compressorWet = ctx.createGain();
  compressorWet.gain.value = effectsState.compressor.enabled ? 1 : 0;
  compressorNode.connect(compressorWet);
  compressorWet.connect(masterGain);
  
  compressorBypass = ctx.createGain();
  compressorBypass.gain.value = effectsState.compressor.enabled ? 0 : 1;
  compressorBypass.connect(masterGain);
  
  dryGain = ctx.createGain();
  const reverbMix = effectsState.reverb.enabled ? effectsState.reverb.mix : 0;
  dryGain.gain.value = 1 - reverbMix;
  dryGain.connect(compressorNode);
  dryGain.connect(compressorBypass);
  
  wetGain = ctx.createGain();
  wetGain.gain.value = reverbMix;
  wetGain.connect(compressorNode);
  wetGain.connect(compressorBypass);
  
  convolverNode = ctx.createConvolver();
  const reverbBuffer = await createReverbImpulse(ctx, 2, 2);
  convolverNode.buffer = reverbBuffer;
  convolverNode.connect(wetGain);
  
  delayNode = ctx.createDelay(2);
  delayNode.delayTime.value = effectsState.delay.time;
  
  delayFeedback = ctx.createGain();
  delayFeedback.gain.value = effectsState.delay.feedback;
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  
  delayWetGain = ctx.createGain();
  delayWetGain.gain.value = effectsState.delay.enabled ? 0.5 : 0;
  delayNode.connect(delayWetGain);
  delayWetGain.connect(compressorNode);
  delayWetGain.connect(compressorBypass);
  
  drumGain = ctx.createGain();
  drumGain.gain.value = 0.8;
  drumGain.connect(masterGain);
  
  effectsInitialized = true;
}

async function createReverbImpulse(ctx: AudioContext, duration: number, decay: number): Promise<AudioBuffer> {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  
  return impulse;
}

export function updateEffects(newState: Partial<EffectsState>) {
  effectsState = { ...effectsState, ...newState };
  
  if (compressorNode && compressorWet && compressorBypass && newState.compressor) {
    compressorNode.threshold.value = effectsState.compressor.threshold;
    compressorNode.ratio.value = effectsState.compressor.ratio;
    compressorWet.gain.value = effectsState.compressor.enabled ? 1 : 0;
    compressorBypass.gain.value = effectsState.compressor.enabled ? 0 : 1;
  }
  
  if (dryGain && wetGain && newState.reverb !== undefined) {
    const mix = effectsState.reverb.enabled ? effectsState.reverb.mix : 0;
    dryGain.gain.value = 1 - mix;
    wetGain.gain.value = mix;
  }
  
  if (delayNode && delayFeedback && delayWetGain && newState.delay !== undefined) {
    delayNode.delayTime.value = effectsState.delay.time;
    delayFeedback.gain.value = effectsState.delay.feedback;
    delayWetGain.gain.value = effectsState.delay.enabled ? 0.5 : 0;
  }
  
  if (masterGain && newState.masterVolume !== undefined) {
    masterGain.gain.value = effectsState.masterVolume;
  }
}

export function getEffectsState(): EffectsState {
  return { ...effectsState };
}

async function loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
  if (audioBufferCache.has(url)) {
    return audioBufferCache.get(url)!;
  }

  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
    audioBufferCache.set(url, audioBuffer);
    return audioBuffer;
  } catch (err) {
    console.error(`Failed to load audio: ${url}`, err);
    return null;
  }
}

async function playSample(url: string) {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  await initEffects();

  const buffer = await loadAudioBuffer(url);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  
  source.connect(dryGain!);
  if (effectsState.reverb.enabled) {
    source.connect(convolverNode!);
  }
  if (effectsState.delay.enabled) {
    source.connect(delayNode!);
  }

  source.start(0);
}

export const drumKits = {
  kicks: Array.from({ length: 10 }, (_, i) => ({
    id: `kick_${i + 1}`,
    name: `Kick ${i + 1}`,
    url: `/drums/kicks/kick_${i + 1}.wav`,
  })),
  snares: Array.from({ length: 10 }, (_, i) => ({
    id: `snare_${i + 1}`,
    name: `Snare ${i + 1}`,
    url: `/drums/snares/snare_${i + 1}.wav`,
  })),
  hats: Array.from({ length: 10 }, (_, i) => ({
    id: `hat_${i + 1}`,
    name: `Hat ${i + 1}`,
    url: `/drums/hats/hat_${i + 1}.wav`,
  })),
  openHats: Array.from({ length: 10 }, (_, i) => ({
    id: `oh_${i + 1}`,
    name: `Open Hat ${i + 1}`,
    url: `/drums/open_hats/oh_${i + 1}.wav`,
  })),
  percs: Array.from({ length: 10 }, (_, i) => ({
    id: `perc_${i + 1}`,
    name: `Perc ${i + 1}`,
    url: `/drums/percs/perc_${i + 1}.wav`,
  })),
};

export type DrumType = 'kicks' | 'snares' | 'hats' | 'openHats' | 'percs';

export const playDrum = async (type: DrumType, index: number = 0) => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  await initEffects();
  
  const kit = drumKits[type];
  if (!kit || !kit[index]) return;
  
  const buffer = await loadAudioBuffer(kit[index].url);
  if (!buffer) return;
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(drumGain!);
  source.start(0);
};

export const preloadDrums = async () => {
  const allUrls = [
    ...drumKits.kicks.map(d => d.url),
    ...drumKits.snares.map(d => d.url),
    ...drumKits.hats.map(d => d.url),
    ...drumKits.openHats.map(d => d.url),
    ...drumKits.percs.map(d => d.url),
  ];

  await Promise.all(allUrls.map(url => loadAudioBuffer(url)));
};

export const drumSounds = {
  kick: () => playDrum('kicks', 0),
  snare: () => playDrum('snares', 0),
  hihat: () => playDrum('hats', 0),
  openHat: () => playDrum('openHats', 0),
  perc: () => playDrum('percs', 0),
  vox: () => playDrum('percs', 3),
  fx: () => playDrum('percs', 5),
};

export interface DrumPattern {
  kicks: boolean[];
  snares: boolean[];
  hats: boolean[];
  openHats: boolean[];
  percs: boolean[];
}

export function createEmptyPattern(steps: number = 16): DrumPattern {
  return {
    kicks: Array(steps).fill(false),
    snares: Array(steps).fill(false),
    hats: Array(steps).fill(false),
    openHats: Array(steps).fill(false),
    percs: Array(steps).fill(false),
  };
}

export async function playDrumAtTime(type: DrumType, index: number, time: number) {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  await initEffects();

  const kit = drumKits[type];
  if (!kit || !kit[index]) return;

  const buffer = await loadAudioBuffer(kit[index].url);
  if (!buffer) return;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(drumGain!);
  source.start(time);
}

export function getAudioContextTime(): number {
  return getAudioContext().currentTime;
}

export async function resumeAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}
