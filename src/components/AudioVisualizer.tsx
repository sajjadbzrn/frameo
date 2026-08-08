import { useEffect, useRef } from "react";
import { usePlayback } from "../store";

const BAR_COUNT = 44;
const RING_BARS = 96;
const MAX_PARTICLES = 70;

/**
 * Real-time audio visualizer.
 *
 * Taps the media element with `HTMLMediaElement.captureStream()` — a read-only
 * stream of what the element is playing. Unlike `createMediaElementSource`,
 * this does NOT redirect the element's audio: the app keeps playing through the
 * normal audio path no matter what happens to this AudioContext, so the
 * visualizer can never mute playback.
 *
 * Renders three layers around the spinning disc:
 *   - a bass-reactive glow rising from the center,
 *   - a slowly rotating circular equalizer ring hugging the disc edge,
 *   - floating ember particles that rise with the music, plus the bottom bars.
 */
export function AudioVisualizer() {
  const { videoRef } = usePlayback();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    let raf = 0;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let data: Uint8Array | null = null;
    let t0 = performance.now();
    let ringRotation = 0;
    let lastEnergy = 0;
    const bars = new Array<number>(BAR_COUNT).fill(0);
    const ringBars = new Array<number>(RING_BARS).fill(0);
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
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
        // Route the analyser through a silent gain to the destination. This
        // keeps the graph rendering (so the analyser receives data) WITHOUT
        // playing the captured stream back — the element already outputs its
        // own audio, so a direct connection would double/echo it.
        const silent = ctx.createGain();
        silent.gain.value = 0;
        analyser.connect(silent);
        silent.connect(ctx.destination);
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

      const now = performance.now();
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const playing = !video.paused && !video.ended;

      let peak = 0;
      if (analyser && data) {
        analyser.getByteFrequencyData(data);
        // Bass energy (lowest frequency bins) drives the glow + particles.
        for (let i = 1; i < 10; i++) peak = Math.max(peak, data[i]);
        const step = Math.max(1, Math.floor(data.length / 2 / BAR_COUNT));
        for (let i = 0; i < BAR_COUNT; i++) {
          const v = data[Math.min(data.length - 1, i * step)] / 255;
          bars[i] += (v - bars[i]) * (playing ? 0.42 : 0.06);
        }
        const ringStep = Math.max(1, Math.floor(data.length / 2 / RING_BARS));
        for (let i = 0; i < RING_BARS; i++) {
          const v = data[Math.min(data.length - 1, i * ringStep)] / 255;
          ringBars[i] += (v - ringBars[i]) * (playing ? 0.5 : 0.06);
        }
      } else {
        // Nothing playing (or graph not built yet) — let everything settle.
        for (let i = 0; i < BAR_COUNT; i++) bars[i] *= 0.9;
        for (let i = 0; i < RING_BARS; i++) ringBars[i] *= 0.92;
        peak = lastEnergy * 0.9;
      }
      lastEnergy = peak;

      const energy = peak / 255;
      const cx = W / 2;
      const cy = H / 2;

      /* ---- bass-reactive glow rising from the center ---- */
      if (energy > 0.02) {
        const glowR = H * (0.5 + energy * 0.45);
        const glowGrad = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, glowR);
        glowGrad.addColorStop(0, `rgba(254, 127, 45, ${0.14 + energy * 0.26})`);
        glowGrad.addColorStop(1, "rgba(254, 127, 45, 0)");
        ctx2d.fillStyle = glowGrad;
        ctx2d.fillRect(0, 0, W, H);
      }

      /* ---- rotating circular equalizer ring around the disc ---- */
      // The disc is a fixed 236 CSS px element, so the ring must hug its
      // actual device-pixel radius (118 * dpr) to stay outside it on HiDPI.
      const discR = 118 * dpr;
      const R = Math.min(Math.max(discR + 26 * dpr, Math.min(W, H) * 0.3), 208 * dpr);
      if (playing) ringRotation += dt * 0.4;
      else ringRotation *= 0.98;
      const ringMax = (26 + energy * 22) * dpr;
      for (let i = 0; i < RING_BARS; i++) {
        const v = ringBars[i];
        if (v < 0.04) continue;
        const angle = (i / RING_BARS) * Math.PI * 2 + ringRotation;
        // Softer toward the top so the ring breathes like an organic orbit.
        const pulse = 0.45 + 0.55 * Math.abs(Math.sin((i / RING_BARS) * Math.PI * 2));
        const len = 4 * dpr + v * ringMax * pulse;
        const x0 = cx + Math.cos(angle) * R;
        const y0 = cy + Math.sin(angle) * R;
        const x1 = cx + Math.cos(angle) * (R + len);
        const y1 = cy + Math.sin(angle) * (R + len);
        // Warm gradient: pale cream → orange around the ring.
        const mix = i / RING_BARS;
        const g = Math.round(217 - (217 - 127) * mix);
        const b = Math.round(168 - (168 - 45) * mix);
        const color = `rgba(255, ${g}, ${b}, ${0.5 + v * 0.5})`;
        ctx2d.strokeStyle = color;
        ctx2d.lineWidth = 3.2 * dpr;
        ctx2d.lineCap = "round";
        ctx2d.beginPath();
        ctx2d.moveTo(x0, y0);
        ctx2d.lineTo(x1, y1);
        ctx2d.stroke();
        // Glowing bead at the tip.
        ctx2d.fillStyle = `rgba(255, ${g}, ${b}, ${0.55 + v * 0.45})`;
        ctx2d.beginPath();
        ctx2d.arc(x1, y1, 2.2 * dpr, 0, Math.PI * 2);
        ctx2d.fill();
      }

      /* ---- bottom frequency bars (single shared gradient) ---- */
      const bw = W / BAR_COUNT;
      const gap = bw * 0.26;
      const maxH = H * 0.34;
      const barGrad = ctx2d.createLinearGradient(0, H - maxH, 0, H);
      barGrad.addColorStop(0, "#ffd9a8");
      barGrad.addColorStop(0.35, "#ffab5e");
      barGrad.addColorStop(1, "#fe7f2d");
      ctx2d.fillStyle = barGrad;
      ctx2d.globalAlpha = 0.9;
      for (let i = 0; i < BAR_COUNT; i++) {
        const h = Math.max(2, bars[i] * maxH);
        const x = i * bw + gap / 2;
        const y = H - h;
        ctx2d.beginPath();
        if (typeof ctx2d.roundRect === "function") {
          ctx2d.roundRect(x, y, bw - gap, h, 4);
        } else {
          ctx2d.rect(x, y, bw - gap, h);
        }
        ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;

      /* ---- rising ember particles (additive glow) ---- */
      if (playing && energy > 0.08 && particles.length < MAX_PARTICLES) {
        const spawn = Math.random() < energy * 1.8 ? 1 + Math.floor(Math.random() * 2) : 0;
        for (let k = 0; k < spawn; k++) {
          particles.push({
            x: cx + (Math.random() - 0.5) * W * 0.5,
            y: H + 8 * dpr,
            vx: (Math.random() - 0.5) * 46,
            vy: -(50 + Math.random() * 120) * (0.5 + energy),
            r: (1 + Math.random() * 2.2) * dpr,
            a: 0.3 + Math.random() * 0.45,
          });
        }
      }
      if (particles.length > 0) {
        ctx2d.globalCompositeOperation = "lighter";
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.a *= 0.982;
          if (p.a < 0.02 || p.y < -12) {
            particles.splice(i, 1);
            continue;
          }
          ctx2d.globalAlpha = p.a;
          ctx2d.fillStyle = "#ffab5e";
          ctx2d.beginPath();
          ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx2d.fill();
        }
        ctx2d.globalAlpha = 1;
        ctx2d.globalCompositeOperation = "source-over";
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
