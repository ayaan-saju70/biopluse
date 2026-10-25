/* ═══════════════════════════════════════════════════════════
   sim.js — Shared physics engine + Web Audio sound effects
   Loaded first. Exports globals: S, raw, yy, mag, ad,
   mot(), lam(), Hf(), runSim(), sfxClick(), sfxSuccess(), …
════════════════════════════════════════════════════════════ */
'use strict';

/* ─── Constants ─── */
const N   = 2048;   // Signal buffer length
const FS  = 256;    // Internal "virtual" sample rate (Hz)
const TAU = Math.PI * 2;
const cl  = (v, a, b) => Math.max(a, Math.min(b, v));

/* ─── Simulation State ─── */
const S = {
  d: 1.0,       // Person distance (m)
  f: 10.525,    // Radar frequency (GHz)
  x0: 0,        // Manual chest offset (mm)
  run: true,    // Sim running
  bo: true,     // Breathing on
  ho: true,     // Heart on
  ab: 8.0,      // Breath amplitude (mm, spec: default 8 mm, range 4-12 mm)
  ah: 0.35,     // Heart amplitude (mm)
  fb: 0.25,     // Breath freq (Hz, ≈15 RPM)
  fh: 1.2,      // Heart freq (Hz, ≈72 BPM)
  n:  { fan: 0, walk: 0, phone: 0 }, // Noise flags
  lo: 0.10,     // Filter low cut (0.1 Hz) — spec: 0.1-3 Hz analog bandpass
  hi: 3.0,      // Filter high cut (3.0 Hz) — spec: 0.1-3 Hz analog bandpass
  fsA: 50,      // ADC sample rate (50 Hz) — spec: good sampling rate 50 Hz
  paused: false,
  // Derived / output
  bpm: 72,
  respRPM: 15,
  msg: '',
};

/* ─── Signal buffers ─── */
const raw = new Float64Array(N);  // Mixer output (raw)
const yy  = new Float64Array(N);  // Filtered output
const mag = new Float64Array(N / 2); // FFT magnitude
let   ad  = [];                   // ADC-sampled vitals
let   simNow = 0;                 // Running time (s)

/* ─── Helper functions ─── */
/** Radar wavelength in mm (28.48 mm ≈ 2.85 cm at 10.525 GHz) */
const lam = () => 299.79 / S.f;

/** 4th-order Butterworth-style transfer function (analog bandpass 0.1-3 Hz) */
const Hf = f => 1 / Math.sqrt(
  (1 + Math.pow(S.lo / Math.max(f, 1e-6), 4)) *
  (1 + Math.pow(f / S.hi, 4))
);

/** Chest displacement x(t) in mm */
const mot = t => S.run
  ? (S.bo ? S.ab * Math.sin(TAU * S.fb * t) : 0)
  + (S.ho ? S.ah * Math.sin(TAU * S.fh * t) : 0)
  : 0;

/* ─── In-place FFT (Cooley-Tukey, DIF) ─── */
function fft(re, im, inv) {
  const n = re.length;
  // Bit-reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inv ? 2 : -2) * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const u = i + k, v = u + len / 2;
        const tr = re[v] * cr - im[v] * ci;
        const ti = re[v] * ci + im[v] * cr;
        re[v] = re[u] - tr; im[v] = im[u] - ti;
        re[u] += tr;        im[u] += ti;
        const nt = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nt;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/* ─── Main simulation step ─── */
function runSim(wallTime) {
  if (S.paused) return;
  simNow = wallTime;

  const l = lam();
  const A = 1 / (S.d * S.d);  // Echo voltage ~ 1/d^2

  // Fill raw buffer: dphi = 4*pi*dx/lambda
  for (let i = 0; i < N; i++) {
    const t = simNow - (N - i) / FS;
    const phase = 4 * Math.PI * (S.d * 1000 + S.x0 + mot(t)) / l;
    let v = A * Math.cos(phase);

    // 50 Hz mains hum always present (small)
    v += 0.12 * Math.sin(TAU * 50 * t);

    // Environmental noise
    if (S.n.fan)   v += 0.34 * Math.sin(TAU * 2.1 * t);
    if (S.n.walk)  v += 0.68 * Math.sin(TAU * 0.9 * t + 1.3 * Math.sin(TAU * 0.2 * t));
    if (S.n.phone && (t % 1.3) < 0.18) v += 0.88 * Math.sin(TAU * 17 * t);

    raw[i] = v;
  }

  // FFT → apply analog bandpass filter (0.1 - 3 Hz) BEFORE ADC → IFFT
  const re = Float64Array.from(raw);
  const im = new Float64Array(N);
  fft(re, im, 0);

  for (let k = 0; k <= N / 2; k++) {
    if (k < N / 2) mag[k] = Math.hypot(re[k], im[k]) * 2 / N;
    const h = k ? Hf(k * FS / N) : 0;
    re[k] *= h; im[k] *= h;
    if (k && k < N / 2) { re[N - k] *= h; im[N - k] *= h; }
  }
  fft(re, im, 1);
  yy.set(re);

  // ADC sub-sampling
  const K = Math.max(2, Math.floor(8 * S.fsA));
  ad = [];
  for (let k = 0; k < K; k++) {
    const idx = Math.min(N - 1, Math.round(N - 1 - (K - 1 - k) / S.fsA * FS));
    ad.push(yy[idx]);
  }

  // Real peak detection for OLED BPM and respiration RPM
  if (S.fsA < 2.4) {
    // Under-sampled / aliased below Nyquist (2 * 1.2 Hz = 2.4 Hz)
    const aliasHz = Math.abs(S.fh - Math.round(S.fh / S.fsA) * S.fsA);
    S.bpm = Math.round(aliasHz * 60);
    S.respRPM = Math.round(S.fb * 60);
  } else {
    // 1. Moving average baseline to separate respiratory and cardiac signals
    const win = Math.max(1, Math.round(0.4 * S.fsA));
    const hp = [];
    const lp = [];
    for (let i = 0; i < K; i++) {
      let s = 0, c = 0;
      const start = Math.max(0, i - win), end = Math.min(K - 1, i + win);
      for (let j = start; j <= end; j++) { s += ad[j]; c++; }
      const base = s / c;
      lp.push(base);
      hp.push(ad[i] - base);
    }

    // 2. Cardiac peak detection on high-pass residual hp
    // Refractory period: minimum 0.35s between consecutive heart peaks (max ~171 BPM)
    const refr = Math.max(1, Math.round(0.35 * S.fsA));
    const peaks = [];
    let hpMax = 0;
    for (let i = 0; i < K; i++) { if (Math.abs(hp[i]) > hpMax) hpMax = Math.abs(hp[i]); }
    const pkThresh = Math.max(0.002, hpMax * 0.22);

    for (let i = 1; i < K - 1; i++) {
      if (hp[i] > hp[i - 1] && hp[i] > hp[i + 1] && hp[i] >= pkThresh) {
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= refr) {
          peaks.push(i);
        } else if (hp[i] > hp[peaks[peaks.length - 1]]) {
          peaks[peaks.length - 1] = i; // Keep taller peak in refractory window
        }
      }
    }

    // 3. Compute heart rate from detected peak intervals
    if (peaks.length >= 2) {
      const intervals = [];
      for (let i = 1; i < peaks.length; i++) {
        const dt = (peaks[i] - peaks[i - 1]) / S.fsA;
        if (dt >= 0.35 && dt <= 1.8) intervals.push(dt);
      }
      if (intervals.length > 0) {
        const avgDt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const detBpm = Math.round(60 / avgDt);
        if (detBpm >= 40 && detBpm <= 160) {
          S.bpm = Math.round(S.bpm * 0.8 + detBpm * 0.2);
        }
      }
    }

    // 4. Respiration peak detection on low-pass baseline lp
    const refrResp = Math.max(1, Math.round(1.8 * S.fsA));
    const rPeaks = [];
    for (let i = 1; i < K - 1; i++) {
      if (lp[i] > lp[i - 1] && lp[i] > lp[i + 1]) {
        if (rPeaks.length === 0 || (i - rPeaks[rPeaks.length - 1]) >= refrResp) {
          rPeaks.push(i);
        }
      }
    }
    if (rPeaks.length >= 2) {
      const rIntervals = [];
      for (let i = 1; i < rPeaks.length; i++) {
        rIntervals.push((rPeaks[i] - rPeaks[i - 1]) / S.fsA);
      }
      const avgR = rIntervals.reduce((a, b) => a + b, 0) / rIntervals.length;
      if (avgR > 1.5 && avgR < 8) S.respRPM = Math.round(60 / avgR);
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   WEB AUDIO — Sound Effects
════════════════════════════════════════════════════════════ */
let _audioCtx = null;
let _muted = false;

function _getCtx() {
  if (!_audioCtx) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (A) _audioCtx = new A();
  }
  if (_audioCtx && _audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function _tone(freq, type, gain, dur, delay = 0) {
  if (_muted) return;
  const ctx = _getCtx(); if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur + 0.01);
}

/** Soft click — nav actions */
function sfxClick() { _tone(600, 'sine', 0.08, 0.05); }

/** Success chime — stage completed */
function sfxSuccess() {
  [523.25, 659.25, 784, 1046.5].forEach((f, i) => _tone(f, 'triangle', 0.12, 0.25, i * 0.09));
}

/** Glitch buzz — Break It */
function sfxGlitch() { _tone(220, 'sawtooth', 0.15, 0.24); }

/** Heartbeat thump */
function sfxHeartbeat() {
  _tone(72, 'sine', 0.18, 0.09);
  _tone(58, 'sine', 0.13, 0.09, 0.13);
}

/** Expose mute control to router */
function setSimMuted(v) { _muted = v; }
