import { useEffect, useRef } from "react";
import { useApp } from "../store";

const BAR_COUNT = 48;

/**
 * Real-time audio visualizer.
 *
 * Taps the media element with `HTMLMediaElement.captureStream()` — a read-only
 * stream of what the element is playing. Unlike `createMediaElementSource`,
 * this does NOT redirect the element's audio: the app keeps playing through the
 * normal audio path no matter what happens to this AudioContext, so the
 * visualizer can never mute playback.
 */
export function AudioVisualizer() {
  const { videoRef } = useApp();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let raf = 0;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let data: Uint8Array | null = null;
    const bars = new Array<number>(BAR_COUNT).fill(0);
    const captureStream = (
      video as HTMLVideoElement & { captureStream?: () => MediaStream }
    ).captureStream;

    const setup = () => {
      if (analyser || typeof captureStream !== "function") return;
      try {
        const AC: typeof AudioContext =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new AC();
        const stream = captureStream.call(video);
        const source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        data = new Uint8Array(analyser.frequencyBinCount);
        void ctx.resume().catch(() => undefined);
      } catch {
        // Visualization is optional — audio keeps playing regardless.
        ctx = null;
        analyser = null;
        data = null;
      }
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const W = Math.max(1, Math.floor(rect.width * dpr));
      const H = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx2d.clearRect(0, 0, W, H);

      let peak = 0;
      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        // Bass energy (lowest frequency bins).
        for (let i = 1; i < 10; i++) peak = Math.max(peak, data[i]);
        const step = Math.max(1, Math.floor(data.length / 2 / BAR_COUNT));
        for (let i = 0; i < BAR_COUNT; i++) {
          const v = data[Math.min(data.length - 1, i * step)] / 255;
          bars[i] += (v - bars[i]) * 0.42;
        }
      } else {
        // Nothing playing (or graph not built yet) — let bars settle.
        for (let i = 0; i < BAR_COUNT; i++) bars[i] *= 0.9;
      }

      // Bass-reactive glow rising from the bottom (only when there's energy).
      const glow = peak / 255;
      if (glow > 0.02) {
        const glowGrad = ctx2d.createRadialGradient(W / 2, H, 0, W / 2, H, H * (0.45 + glow * 0.55));
        glowGrad.addColorStop(0, `rgba(254, 127, 45, ${0.2 + glow * 0.3})`);
        glowGrad.addColorStop(1, "rgba(254, 127, 45, 0)");
        ctx2d.fillStyle = glowGrad;
        ctx2d.fillRect(0, 0, W, H);
      }

      // Frequency bars, anchored at the bottom.
      const bw = W / BAR_COUNT;
      const gap = bw * 0.26;
      const maxH = H * 0.4;
      for (let i = 0; i < BAR_COUNT; i++) {
        const h = Math.max(2, bars[i] * maxH);
        const x = i * bw + gap / 2;
        const y = H - h;
        const barGrad = ctx2d.createLinearGradient(0, y, 0, H);
        barGrad.addColorStop(0, "#ffd9a8");
        barGrad.addColorStop(0.35, "#ffab5e");
        barGrad.addColorStop(1, "#fe7f2d");
        ctx2d.fillStyle = barGrad;
        ctx2d.beginPath();
        if (typeof ctx2d.roundRect === "function") {
          ctx2d.roundRect(x, y, bw - gap, h, 4);
        } else {
          ctx2d.rect(x, y, bw - gap, h);
        }
        ctx2d.fill();
      }
    };

    const onPlaying = () => setup();
    const onGesture = () => {
      setup();
      ctx?.resume().catch(() => undefined);
    };

    video.addEventListener("playing", onPlaying);
    window.addEventListener("pointerdown", onGesture);

    draw();

    return () => {
      cancelAnimationFrame(raf);
      video.removeEventListener("playing", onPlaying);
      window.removeEventListener("pointerdown", onGesture);
      // The stream/context can be torn down freely — it never touches the
      // element's own audio output.
      try {
        void ctx?.close();
      } catch {
        /* ignore */
      }
      ctx = null;
      analyser = null;
      data = null;
    };
  }, [videoRef]);

  return <canvas ref={canvasRef} className="visualizer" aria-hidden="true" />;
}
