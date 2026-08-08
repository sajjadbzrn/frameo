/**
 * 10-band equalizer using Web Audio API.
 *
 * When the EQ is active, audio is routed through an AudioContext filter chain.
 * This redirects the video element's audio (createMediaElementSource), so the
 * element itself becomes silent. Disable the EQ to restore direct output.
 */

export type EQPreset = "flat" | "rock" | "pop" | "jazz" | "classical" | "bass-boost" | "custom";

interface EQBand {
  filter: BiquadFilterNode;
  gain: number;
}

const BAND_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

const PRESETS: Record<Exclude<EQPreset, "custom">, number[]> = {
  flat:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock:       [4, 3, -2, -1, 2, 4, 3, 2, 1, 0],
  pop:        [-1, 2, 3, 1, -1, -2, -1, 1, 2, 3],
  jazz:       [3, 2, 1, 0, -1, -1, 1, 2, 3, 3],
  classical:  [3, 2, 1, 0, -1, -2, -1, 1, 3, 4],
  "bass-boost":[6, 5, 3, 1, 0, -1, -2, -2, -2, -2],
};

export interface EQState {
  ctx: AudioContext | null;
  bands: EQBand[];
  source: MediaElementAudioSourceNode | null;
  preset: EQPreset;
  enabled: boolean;
  /** Call this when disposing to clean up the audio graph. */
  destroy: () => void;
  setBand: (index: number, gain: number) => void;
  setPreset: (preset: EQPreset) => void;
  setEnabled: (enabled: boolean) => void;
  /** Returns the analyser node for visualizers to tap into. */
  analyser: AnalyserNode | null;
}

/**
 * Initialize an equalizer for a video/audio element.
 * Returns an EQState object that manages the audio routing.
 */
export function createEqualizer(video: HTMLMediaElement): EQState {
  let ctx: AudioContext | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let bands: EQBand[] = [];
  let analyser: AnalyserNode | null = null;
  let preset: EQPreset = "flat";
  let enabled = false;

  const AC: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  function ensureContext() {
    if (ctx) return;
    ctx = new AC();
    source = ctx.createMediaElementSource(video);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    // Build filter chain: source → filter1 → filter2 → ... → analyser → destination
    let prev: AudioNode = source;
    for (const freq of BAND_FREQS) {
      const filter = ctx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1.4;
      filter.gain.value = 0;
      prev.connect(filter);
      prev = filter;
      bands.push({ filter, gain: 0 });
    }
    prev.connect(analyser);
    analyser.connect(ctx.destination);
  }

  function applyGains() {
    for (const b of bands) b.filter.gain.value = b.gain;
  }

  function applyPreset(name: EQPreset) {
    preset = name;
    const gains = name === "custom"
      ? bands.map((b) => b.gain)
      : PRESETS[name];
    bands.forEach((b, i) => { b.gain = gains[i] ?? 0; });
    applyGains();
  }

  function destroy() {
    try { void ctx?.close(); } catch { /* ignore */ }
    ctx = null;
    source = null;
    bands = [];
    analyser = null;
  }

  return {
    get ctx() { return ctx; },
    get bands() { return bands; },
    get source() { return source; },
    get preset() { return preset; },
    get enabled() { return enabled; },
    get analyser() { return analyser; },
    destroy,

    setBand(index: number, gain: number) {
      if (index < 0 || index >= bands.length) return;
      bands[index].gain = gain;
      bands[index].filter.gain.value = gain;
      applyPreset("custom");
    },

    setPreset(name: EQPreset) {
      if (!ctx) ensureContext();
      preset = name;
      const gains = name === "custom"
        ? bands.map((b) => b.gain)
        : PRESETS[name];
      bands.forEach((b, i) => {
        b.gain = gains[i] ?? 0;
        b.filter.gain.value = gains[i] ?? 0;
      });
    },

    setEnabled(on: boolean) {
      enabled = on;
      if (on) {
        ensureContext();
        void ctx?.resume().catch(() => undefined);
      } else {
        // When disabled, disconnect the source so audio goes back to the element.
        if (source) {
          source.disconnect();
          source = null;
        }
        destroy();
      }
    },
  };
}
