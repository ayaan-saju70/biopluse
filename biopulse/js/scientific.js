/* ═══════════════════════════════════════════════════════════
   scientific.js — Mission Control Scientific Instrument Mode
   Precision Oscilloscopes, Real Physics Plots & Interactive Controls
   Shared 3D Anatomy Scene • HiDPI Auto-Scaling • Tabular Monospace
   Depends on: sim.js (S, raw, yy, mag, ad, lam, Hf, mot, runSim)
               landing.js (window.BioPulse3D)
               router.js (setView)
════════════════════════════════════════════════════════════ */
'use strict';

/* ── Canvas setup ── */
let sciCanvas = document.getElementById('sci-scope-canvas');
let sg = null;
let scW = 1, scH = 1;

function _resizeSci() {
  if (!sciCanvas) {
    sciCanvas = document.getElementById('sci-scope-canvas');
  }
  if (!sciCanvas) return;
  sg = sciCanvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  scW = sciCanvas.clientWidth || 400;
  scH = sciCanvas.clientHeight || 200;
  sciCanvas.width  = Math.floor(scW * dpr);
  sciCanvas.height = Math.floor(scH * dpr);
  if (sg) {
    sg.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
window.addEventListener('resize', _resizeSci);

/* ── State ── */
let sciStage = 0;
const sciDone = Array(8).fill(false);
let _lastRenderedStage = -1;

/* ── Stage Definitions & Metadata ── */
const SCI_STAGES = [
  {
    num: 1,
    title: 'Transmitter & Free-Space Wave',
    desc: 'The radar emits a 10.525 GHz microwave beam. Echo power drops as 1/d² with distance.',
    eqBadge: 'λ = c / f',
    challenge: 'Drag the distance slider past 1.50 m so echo drops under 45%.',
    whyMatters: 'Microwave echo power follows the 1/d² inverse-square law (1/R⁴ for point radar targets). Beyond 1.5–2 meters, reflected cardiopulmonary displacement drops near the RF receiver thermal noise floor.',
    ok: () => S.d >= 1.5,
    breakAct() {
      S.d = 4.0;
      S.msg = 'Distance set to 4.0 m — echo amplitude drops to 6.2%, signal lost!';
    },
    render: _drawS1
  },
  {
    num: 2,
    title: 'Chest Motion & Superposition',
    desc: 'Two motions overlap: slow respiration (default 8 mm, range 4–12 mm) and subtle heartbeat (~0.35 mm).',
    eqBadge: 'x(t) = x_b(t) + x_h(t)',
    challenge: 'Toggle breathing OFF to isolate the subtle 0.35 mm cardiac pulse.',
    whyMatters: 'The central physiological challenge of contactless radar vitals is dynamic range: respiration is ~8 mm while cardiac apex displacement is ~0.35 mm (a 23:1 amplitude disparity). Signal processing must cleanly isolate both without phase distortion.',
    ok: () => S.run && !S.bo && S.ho,
    breakAct() {
      S.ab = 12.0; S.ah = 0.15;
      S.msg = 'Max 12 mm breath swamped the tiny 0.15 mm heartbeat!';
    },
    render: _drawS2
  },
  {
    num: 3,
    title: 'Reflection, Phase Shift & I-Q Null Point',
    desc: 'Echo phase Δφ = 4π·Δx/λ. Notice the Null-Point at 0°/180° where I-channel sensitivity vanishes, and how Quadrature (I/Q) restores detection!',
    eqBadge: 'Δφ = 4π·Δx / λ',
    challenge: 'Hit a null-point (~0° or ~180°) where I-channel vanishes, then observe how Q-channel saves detection.',
    whyMatters: 'Single-channel radar suffers from periodic blind spots (null points every λ/4 ≈ 7.1 mm) where dI/dφ = 0. Quadrature (I/Q) receivers maintain an orthogonal channel shifted by 90° so sin²(Δφ) + cos²(Δφ) = 1, ensuring zero blind spots.',
    ok: () => {
      const wrapped = (((720 * S.x0 / lam()) % 360 + 360) % 360);
      return Math.abs(wrapped - 180) < 8 || Math.abs(wrapped - 0) < 8 || Math.abs(wrapped - 360) < 8;
    },
    breakAct() {
      S.x0 = 0;
      S.msg = 'Null-point hit! At Δφ = 0° (or 180°), dI/dφ ≈ 0 — single-channel radar goes blind! Q-channel restores vitals!';
    },
    render: _drawS3
  },
  {
    num: 4,
    title: 'Mixer & Environmental Clutter',
    desc: 'The mixer down-converts RF echo to baseband V_mix(t). Environmental clutter corrupts the trace.',
    eqBadge: 'V_mix(t) = TX ⊗ RX',
    challenge: 'Activate at least two noise sources to observe trace corruption.',
    whyMatters: 'Direct-conversion mixers multiply the local oscillator carrier with incoming echo. Ambient vibrations (pedestrians at 0.9 Hz, cooling fans at 2.1 Hz) overlap directly with the cardiopulmonary band and must be filtered.',
    ok: () => (S.n.fan + S.n.walk + S.n.phone) >= 2,
    breakAct() {
      S.n.fan = 1; S.n.walk = 1; S.n.phone = 1;
      S.msg = 'All noise ON! Vital signs buried in environmental clutter!';
    },
    render: _drawS4
  },
  {
    num: 5,
    title: 'Active Bandpass Filter & Spectrum',
    desc: 'A 4th-order Butterworth bandpass filter removes mains hum (50 Hz) while preserving breath (0.25 Hz) and heart (1.2 Hz).',
    eqBadge: '0.1 Hz ≤ f ≤ 3.0 Hz',
    challenge: 'Adjust passband: H(50Hz) < 0.15 AND H(1.2Hz) > 0.60.',
    whyMatters: 'An active analog bandpass filter isolates physiological frequencies (0.1–3.0 Hz, 6–180 BPM) while rejecting 50 Hz power-line interference by >30 dB, preventing ADC saturation.',
    ok: () => Hf(50) < 0.15 && Hf(1.2) > 0.60,
    breakAct() {
      S.lo = 2.0; S.hi = 4.0;
      S.msg = 'Passband shifted to 2.0–4.0 Hz! Both respiration and heartbeat cut out!';
    },
    render: _drawS5
  },
  {
    num: 6,
    title: 'Arduino ADC & Nyquist Sampling',
    desc: 'ADC must sample above 2× fmax (Nyquist: 2.4 Hz). Below 2.4 Hz, aliasing makes 72 BPM look like false bradycardia.',
    eqBadge: 'fs ≥ 2·f_max (2.4 Hz)',
    challenge: 'Drop fs to ~2 Hz to trigger aliasing, then restore to 50 Hz.',
    whyMatters: 'The Nyquist-Shannon theorem dictates that sampling below twice the highest cardiac harmonic (2.4 Hz) folds high frequencies into false lower rates, misdiagnosing normal 72 BPM as critical bradycardia.',
    ok: () => S.fsA >= 20 && sciDone[5],
    breakAct() {
      S.fsA = 1.8; sciDone[5] = true;
      S.msg = 'Aliased! Sample rate dropped to 1.8 Hz (< 2.4 Hz) — true 72 BPM registers as false 36 BPM!';
    },
    render: _drawS6
  },
  {
    num: 7,
    title: 'OLED Display & BPM Detection',
    desc: 'Real peak detection on the filtered cardiac pulses yields the live OLED vital-signs readout.',
    eqBadge: 'BPM = 60 / Δt_peak',
    challenge: 'Set d > 2.0 m with fan ON — observe OLED signal degradation.',
    whyMatters: 'Clinical reliability depends on accurate R-wave systolic peak timing. Excessive distance or motion artifacts distort wave morphology, causing peak detectors to miss beats or calculate erratic pulse intervals.',
    ok: () => S.d >= 2.0 && S.n.fan,
    breakAct() {
      S.d = 2.4; S.n.fan = 1; S.n.walk = 1;
      S.msg = 'Distant + noisy: peak detector lost lock!';
    },
    render: _drawS7
  },
  {
    num: 8,
    title: 'Free Lab — Mission Control Dashboard',
    desc: 'Full mission instrumentation unlocked. Freely manipulate RF, biomechanical and DSP parameters with live telemetry export.',
    eqBadge: 'MISSION TELEMETRY',
    challenge: 'Explore telemetry export (CSV & PNG) and test edge cases.',
    whyMatters: 'Unified control demonstrates end-to-end radar signal propagation from electromagnetic wave generation to real-time biometric display.',
    ok: () => false,
    breakAct() {
      S.d = 1.0; S.f = 10.525; S.x0 = 0;
      S.bo = true; S.ho = true; S.ab = 8.0; S.ah = 0.35;
      S.n.fan = S.n.walk = S.n.phone = 0;
      S.lo = 0.10; S.hi = 3.0; S.fsA = 50;
      S.msg = 'Telemetry reset to baseline mission parameters (10.525 GHz, 1.0 m, 0.1–3.0 Hz, 50 Hz ADC).';
    },
    render: _drawFreeLab
  }
];

/* ══════════════════════════════════════════════════════════
   NAVIGATION & STEPPER
══════════════════════════════════════════════════════════ */
function _initSciStepper() {
  const bar = document.getElementById('sci-stepper');
  if (!bar) return;
  const buttons = bar.querySelectorAll('.stage-step-btn');
  buttons.forEach((btn, idx) => {
    btn.onclick = () => sciGotoStage(idx);
  });
}

function _renderSciStepper() {
  const bar = document.getElementById('sci-stepper');
  if (!bar) return;
  const buttons = bar.querySelectorAll('.stage-step-btn');
  buttons.forEach((b, i) => {
    b.classList.toggle('active', i === sciStage);
    b.classList.toggle('done', Boolean(sciDone[i]));
  });
}

function _updateSciHeader() {
  const st = SCI_STAGES[sciStage];
  if (!st) return;
  const tag = document.getElementById('sci-stage-tag');
  if (tag) tag.textContent = sciStage === 7 ? 'LAB' : `STAGE ${sciStage + 1}`;
  const title = document.getElementById('sci-title');
  if (title) title.textContent = st.title;
  const desc = document.getElementById('sci-desc');
  if (desc) desc.textContent = st.desc;

  const btnPrev = document.getElementById('sci-prev');
  if (btnPrev) btnPrev.disabled = sciStage === 0;
  const btnNext = document.getElementById('sci-next');
  if (btnNext) btnNext.disabled = sciStage === SCI_STAGES.length - 1;

  const eqBadge = document.getElementById('eq-badge');
  if (eqBadge) eqBadge.textContent = st.eqBadge || 'FORMULA';

  const hudMode = document.getElementById('hud-cam-mode');
  if (hudMode) {
    const modes = [
      'CAM: 10.525 GHz BEAM PROPAGATION',
      'CAM: CARDIOPULMONARY ANATOMY',
      'CAM: REFLECTED WAVE & PHASE OFFSET',
      'CAM: HARDWARE RAIL - MIXER STAGE',
      'CAM: HARDWARE RAIL - ACTIVE FILTER',
      'CAM: HARDWARE RAIL - ARDUINO ADC',
      'CAM: HARDWARE RAIL - OLED DISPLAY',
      'CAM: MISSION DASHBOARD LAB'
    ];
    hudMode.textContent = modes[sciStage] || 'CAM: 3D VIEWPORT';
  }
}

function sciGotoStage(idx) {
  if (idx < 0 || idx >= SCI_STAGES.length) return;
  sciStage = idx;
  S.msg = '';
  if (typeof sfxClick === 'function') sfxClick();
  _renderSciStepper();
  _updateSciHeader();
  if (window.BioPulse3D) {
    window.BioPulse3D.setStageView(sciStage);
  }
  _renderStagePanels(true);
}
function sciNextStage() { sciGotoStage(sciStage + 1); }
function sciPrevStage() { sciGotoStage(sciStage - 1); }
function sciTogglePause() { S.paused = !S.paused; }

/* ── Presenter Mode ── */
let _isSciPresenter = false;
function isSciPresenterActive() { return _isSciPresenter; }
function toggleSciPresenter(force) {
  _isSciPresenter = typeof force === 'boolean' ? force : !_isSciPresenter;
  const viewEl = document.getElementById('view-sci');
  const btn = document.getElementById('sci-presenter');
  if (viewEl) viewEl.classList.toggle('presenter-mode', _isSciPresenter);
  if (btn) {
    btn.classList.toggle('active', _isSciPresenter);
    btn.setAttribute('aria-pressed', _isSciPresenter ? 'true' : 'false');
  }
  _resizeSci();
  if (window.BioPulse3D) window.BioPulse3D.resize();
  if (typeof sfxClick === 'function') sfxClick();
}

/* ── Button wiring ── */
const btnSciPresenter = document.getElementById('sci-presenter');
if (btnSciPresenter) btnSciPresenter.addEventListener('click', () => toggleSciPresenter());
const btnSciPrev = document.getElementById('sci-prev');
if (btnSciPrev) btnSciPrev.addEventListener('click', sciPrevStage);
const btnSciNext = document.getElementById('sci-next');
if (btnSciNext) btnSciNext.addEventListener('click', sciNextStage);

// Touch swipe support between stages on mobile
(function() {
  let touchStartX = 0;
  let touchStartY = 0;
  const workspaceEl = document.getElementById('sci-workspace');
  if (workspaceEl) {
    workspaceEl.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    workspaceEl.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].screenX - touchStartX;
      const diffY = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(diffX) > 48 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) sciNextStage();
        else sciPrevStage();
      }
    }, { passive: true });
  }
})();

/* ── Interactive Passband Dragging on FFT Spectrum (Stage 5) ── */
(function() {
  let dragMode = null; // 'lo', 'hi', 'band'
  let startX = 0;
  let startLo = 0, startHi = 0;

  function getPlotMetrics() {
    if (!sciCanvas) return null;
    const rect = sciCanvas.getBoundingClientRect();
    const w = scW;
    const h = scH;
    const topH = Math.floor(h * 0.52);
    const plotLeft = 30;
    const plotRight = w - 8;
    const plotW = Math.max(plotRight - plotLeft, 10);
    return { rect, w, h, topH, plotLeft, plotRight, plotW };
  }

  function canvasXToFreq(clientX, m) {
    const xInCanvas = clientX - m.rect.left;
    const norm = (xInCanvas - m.plotLeft) / m.plotW;
    return Math.max(0, Math.min(60, norm * 60));
  }

  function syncFilterInputs() {
    const slLo = document.getElementById('sl-lo');
    const slHi = document.getElementById('sl-hi');
    const valLo = document.getElementById('sl-lo-val');
    const valHi = document.getElementById('sl-hi-val');
    if (slLo) slLo.value = S.lo;
    if (slHi) slHi.value = S.hi;
    if (valLo) valLo.textContent = `${S.lo.toFixed(2)} Hz`;
    if (valHi) valHi.textContent = `${S.hi.toFixed(1)} Hz`;
  }

  function onPointerDown(e) {
    if (sciStage !== 4 || !sciCanvas) return;
    const m = getPlotMetrics();
    if (!m) return;
    const yInCanvas = e.clientY - m.rect.top;
    if (yInCanvas < 8 || yInCanvas > m.topH) return;

    const f = canvasXToFreq(e.clientX, m);
    const tol = 2.2; // Hz tolerance
    if (Math.abs(f - S.lo) < tol) {
      dragMode = 'lo';
    } else if (Math.abs(f - S.hi) < tol) {
      dragMode = 'hi';
    } else if (f > S.lo && f < S.hi) {
      dragMode = 'band';
      startX = f;
      startLo = S.lo;
      startHi = S.hi;
    } else {
      return;
    }
    try { sciCanvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (sciStage !== 4 || !sciCanvas) return;
    const m = getPlotMetrics();
    if (!m) return;
    const yInCanvas = e.clientY - m.rect.top;

    if (!dragMode) {
      if (yInCanvas >= 8 && yInCanvas <= m.topH) {
        const f = canvasXToFreq(e.clientX, m);
        const tol = 2.2;
        if (Math.abs(f - S.lo) < tol || Math.abs(f - S.hi) < tol) {
          sciCanvas.style.cursor = 'ew-resize';
        } else if (f > S.lo && f < S.hi) {
          sciCanvas.style.cursor = 'grab';
        } else {
          sciCanvas.style.cursor = 'default';
        }
      } else {
        sciCanvas.style.cursor = 'default';
      }
      return;
    }

    sciCanvas.style.cursor = dragMode === 'band' ? 'grabbing' : 'ew-resize';
    const f = canvasXToFreq(e.clientX, m);
    if (dragMode === 'lo') {
      S.lo = Math.max(0.05, Math.min(S.hi - 0.2, Math.round(f * 20) / 20));
    } else if (dragMode === 'hi') {
      S.hi = Math.max(S.lo + 0.2, Math.min(25.0, Math.round(f * 10) / 10));
    } else if (dragMode === 'band') {
      const delta = f - startX;
      const span = startHi - startLo;
      let newLo = Math.max(0.05, startLo + delta);
      let newHi = newLo + span;
      if (newHi > 25.0) {
        newHi = 25.0;
        newLo = newHi - span;
      }
      S.lo = Math.round(newLo * 20) / 20;
      S.hi = Math.round(newHi * 10) / 10;
    }
    syncFilterInputs();
  }

  function onPointerUp(e) {
    if (dragMode && sciCanvas) {
      try { sciCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
      dragMode = null;
      sciCanvas.style.cursor = 'default';
    }
  }

  function bindCanvasDrag() {
    const c = document.getElementById('sci-scope-canvas');
    if (c) {
      c.addEventListener('pointerdown', onPointerDown);
      c.addEventListener('pointermove', onPointerMove);
      c.addEventListener('pointerup', onPointerUp);
      c.addEventListener('pointercancel', onPointerUp);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCanvasDrag);
  } else {
    bindCanvasDrag();
  }
})();

/* ══════════════════════════════════════════════════════════
   PRECISION PLOT ENGINE (HiDPI, Grid, Ticks, Clipping, Auto-scale)
══════════════════════════════════════════════════════════ */
function drawPrecisionGrid(ctx, x, y, w, h, opts = {}) {
  const {
    xTitle = '',
    yTitle = '',
    xUnit = '',
    yUnit = '',
    xMin = 0,
    xMax = 1,
    yMin = -1,
    yMax = 1,
    xDivs = 4,
    yDivs = 4,
    gridCol = 'rgba(0, 243, 255, 0.08)',
    axisCol = 'rgba(0, 243, 255, 0.25)',
    textCol = '#64748b'
  } = opts;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Vertical grid lines + X ticks
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = textCol;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const plotLeft = x + 30;
  const plotRight = x + w - 8;
  const plotTop = y + 8;
  const plotBottom = y + h - 18;
  const plotW = Math.max(plotRight - plotLeft, 1);
  const plotH = Math.max(plotBottom - plotTop, 1);

  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);

  for (let i = 0; i <= xDivs; i++) {
    const gx = plotLeft + (i / xDivs) * plotW;
    ctx.beginPath();
    ctx.moveTo(gx, plotTop);
    ctx.lineTo(gx, plotBottom);
    ctx.stroke();

    const val = xMin + (i / xDivs) * (xMax - xMin);
    const valStr = (Math.abs(val) < 10 ? val.toFixed(1) : Math.round(val)) + (i === xDivs && xUnit ? ' ' + xUnit : '');
    ctx.fillText(valStr, gx, plotBottom + 4);
  }

  // Horizontal grid lines + Y ticks
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let j = 0; j <= yDivs; j++) {
    const gy = plotTop + (j / yDivs) * plotH;
    ctx.beginPath();
    ctx.moveTo(plotLeft, gy);
    ctx.lineTo(plotRight, gy);
    ctx.stroke();

    const val = yMax - (j / yDivs) * (yMax - yMin);
    const valStr = Math.abs(val) < 10 ? val.toFixed(1) : Math.round(val);
    ctx.fillText(valStr, plotLeft - 4, gy);
  }

  ctx.setLineDash([]);

  // Axis lines
  ctx.strokeStyle = axisCol;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();

  // Axis Titles
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.fillStyle = '#00f3ff';
  if (yTitle) {
    ctx.textAlign = 'left';
    ctx.fillText(`${yTitle}${yUnit ? ' [' + yUnit + ']' : ''}`, x + 6, y + 6);
  }
  if (xTitle) {
    ctx.textAlign = 'right';
    ctx.fillText(`${xTitle}${xUnit ? ' [' + xUnit + ']' : ''}`, x + w - 6, y + h - 6);
  }

  ctx.restore();
}

function drawScopeTrace(ctx, x, y, w, h, data, opts = {}) {
  if (!data || data.length === 0) return;
  const {
    color = '#00f3ff',
    lineWidth = 1.8,
    yMin = null,
    yMax = null,
    scanLine = true,
    glow = true,
    fill = false
  } = opts;

  const left = x + 30;
  const right = x + w - 8;
  const top = y + 8;
  const bottom = y + h - 18;
  const plotW = Math.max(right - left, 1);
  const plotH = Math.max(bottom - top, 1);

  let min = yMin !== null ? yMin : Infinity;
  let max = yMax !== null ? yMax : -Infinity;
  if (yMin === null || yMax === null) {
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (Math.abs(max - min) < 1e-4) {
      min -= 1;
      max += 1;
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, plotW, plotH);
  ctx.clip();

  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  const len = data.length;
  for (let i = 0; i < len; i++) {
    const px = left + (i / (len - 1)) * plotW;
    const norm = (data[i] - min) / (max - min);
    const py = bottom - norm * plotH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  if (fill) {
    ctx.shadowBlur = 0;
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, color.replace(')', ', 0.25)').replace('rgb', 'rgba'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();
  }

  if (scanLine) {
    ctx.shadowBlur = 0;
    const sweep = (performance.now() % 2400) / 2400;
    const sx = left + sweep * plotW;
    const sGrad = ctx.createLinearGradient(sx - 30, 0, sx, 0);
    sGrad.addColorStop(0, 'rgba(0, 243, 255, 0)');
    sGrad.addColorStop(1, 'rgba(0, 243, 255, 0.35)');
    ctx.fillStyle = sGrad;
    ctx.fillRect(sx - 30, top, 30, plotH);

    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, top);
    ctx.lineTo(sx, bottom);
    ctx.stroke();
  }

  ctx.restore();
}

/* ══════════════════════════════════════════════════════════
   PANEL CONTENT GENERATION & BINDINGS
══════════════════════════════════════════════════════════ */
function updateEquationCard(formulaHtml, metricsList = []) {
  const eqDisp = document.getElementById('sci-eq-display');
  if (!eqDisp) return;
  const metricsHtml = metricsList.map(m => `
    <div class="eq-metric-item">
      <span class="eq-metric">${m.label}:</span>
      <strong class="${m.status === 'warn' ? 'eq-val-warn' : m.status === 'coral' ? 'eq-val-coral' : 'eq-val-live'}">${m.val}</strong>
      ${m.unit ? `<span class="eq-unit">${m.unit}</span>` : ''}
    </div>
  `).join('');

  eqDisp.innerHTML = `
    <div class="eq-formula">${formulaHtml}</div>
    <div class="eq-values">${metricsHtml}</div>
  `;
}

function renderControlCard(opts = {}) {
  const cardBody = document.getElementById('sci-ctrl-body');
  if (!cardBody) return;

  const {
    sliders = [],
    toggles = [],
    breakAction = null,
    breakLabel = 'Break it',
    challengeText = '',
    isChallengeSolved = false,
    whyMattersText = ''
  } = opts;

  let html = '';

  // Sliders
  if (sliders.length > 0) {
    html += '<div class="ctrl-sliders-section">';
    sliders.forEach(s => {
      html += `
        <div class="ctrl-row">
          <div class="ctrl-row-header">
            <span>${s.label}</span>
            <span class="ctrl-unit-val" id="${s.id}-val">${s.val} ${s.unit || ''}</span>
          </div>
          <input type="range" class="sci-slider" id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step}" value="${s.val}">
        </div>
      `;
    });
    html += '</div>';
  }

  // Toggles
  if (toggles.length > 0) {
    html += '<div class="ctrl-toggles-row">';
    toggles.forEach(t => {
      html += `
        <label class="sci-toggle-label">
          <span class="sci-switch">
            <input type="checkbox" id="${t.id}" ${t.checked ? 'checked' : ''}>
            <span class="sci-slider-toggle"></span>
          </span>
          <span>${t.label}</span>
        </label>
      `;
    });
    html += '</div>';
  }

  // Action Strip: Break it
  html += '<div class="ctrl-action-strip">';
  if (breakAction) {
    html += `
      <button class="btn-break-card" id="btn-card-break">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span>${breakLabel}</span>
      </button>
    `;
  }
  html += '</div>';

  // Challenge Card Box
  if (challengeText) {
    html += `
      <div class="challenge-card-box">
        <div class="challenge-title-row">
          <span class="challenge-tag">CHALLENGE OBJECTIVE</span>
          <span class="challenge-status ${isChallengeSolved ? 'done' : ''}">${isChallengeSolved ? '[SOLVED]' : '[IN PROGRESS]'}</span>
        </div>
        <p class="challenge-text">${challengeText}</p>
      </div>
    `;
  }

  // Why this matters Collapsible
  if (whyMattersText) {
    html += `
      <div class="why-matters-wrap">
        <button class="why-matters-toggle" id="btn-why-matters">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          <span>Why this matters</span>
        </button>
        <div class="why-matters-content" id="why-matters-content" hidden>${whyMattersText}</div>
      </div>
    `;
  }

  cardBody.innerHTML = html;

  // Bind listeners
  sliders.forEach(s => {
    const el = document.getElementById(s.id);
    if (el) {
      el.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        const valEl = document.getElementById(`${s.id}-val`);
        if (valEl) valEl.textContent = `${v.toFixed(s.decimals || 1)} ${s.unit || ''}`;
        s.onInput(v);
      });
    }
  });

  toggles.forEach(t => {
    const el = document.getElementById(t.id);
    if (el) {
      el.addEventListener('change', (e) => {
        t.onChange(e.target.checked);
      });
    }
  });

  if (breakAction) {
    const bBtn = document.getElementById('btn-card-break');
    if (bBtn) {
      bBtn.addEventListener('click', () => {
        if (typeof sfxGlitch === 'function') sfxGlitch();
        breakAction();
        _updateSciHeader();
        _renderStagePanels(true);
      });
    }
  }

  const whyBtn = document.getElementById('btn-why-matters');
  const whyContent = document.getElementById('why-matters-content');
  if (whyBtn && whyContent) {
    whyBtn.addEventListener('click', () => {
      const isHidden = whyContent.hidden;
      whyContent.hidden = !isHidden;
      whyBtn.querySelector('svg').style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  }
}

/* ══════════════════════════════════════════════════════════
   STAGE CONTROLS & LIVE EQUATION DISPATCHER
══════════════════════════════════════════════════════════ */
function _renderStagePanels(forceRebuild = false) {
  const st = SCI_STAGES[sciStage];
  if (!st) return;

  const scopeTitleEl = document.getElementById('scope-title');

  if (forceRebuild || _lastRenderedStage !== sciStage) {
    _lastRenderedStage = sciStage;

    switch (sciStage) {
      case 0: // 1 Transmitter
        if (scopeTitleEl) scopeTitleEl.textContent = 'ECHO ATTENUATION VS DISTANCE A(d) = 1/d²';
        renderControlCard({
          sliders: [
            {
              id: 'sl-freq',
              label: 'Radar Frequency f',
              min: 5.0, max: 25.0, step: 0.1, val: S.f, unit: 'GHz', decimals: 2,
              onInput: (v) => { S.f = v; }
            },
            {
              id: 'sl-dist',
              label: 'Subject Distance d',
              min: 0.5, max: 4.0, step: 0.05, val: S.d, unit: 'm', decimals: 2,
              onInput: (v) => { S.d = v; }
            }
          ],
          breakAction: () => { st.breakAct(); },
          breakLabel: 'Break: Push to 4.0 m (Echo Vanishes)',
          challengeText: st.challenge,
          isChallengeSolved: Boolean(sciDone[0]),
          whyMattersText: st.whyMatters
        });
        break;

      case 1: // 2 Chest
        if (scopeTitleEl) scopeTitleEl.textContent = 'CARDIOPULMONARY DISPLACEMENT SCOPES [mm]';
        renderControlCard({
          toggles: [
            { id: 'tg-bo', label: 'Breathing Motion', checked: S.bo, onChange: (c) => { S.bo = c; } },
            { id: 'tg-ho', label: 'Heartbeat Pulse', checked: S.ho, onChange: (c) => { S.ho = c; } }
          ],
          sliders: [
            {
              id: 'sl-ab',
              label: 'Respiration Excursion A_b',
              min: 4.0, max: 12.0, step: 0.2, val: S.ab, unit: 'mm', decimals: 1,
              onInput: (v) => { S.ab = v; }
            },
            {
              id: 'sl-ah',
              label: 'Cardiac Apex Pulse A_h',
              min: 0.1, max: 0.6, step: 0.02, val: S.ah, unit: 'mm', decimals: 2,
              onInput: (v) => { S.ah = v; }
            }
          ],
          breakAction: () => { st.breakAct(); },
          breakLabel: 'Break: Swamp Heart with 12 mm Breath',
          challengeText: st.challenge,
          isChallengeSolved: Boolean(sciDone[1]),
          whyMattersText: st.whyMatters
        });
        break;

      case 2: // 3 Reflection
        if (scopeTitleEl) scopeTitleEl.textContent = 'TX / RX PHASE OVERLAY & I/Q CONSTELLATION';
        renderControlCard({
          sliders: [
            {
              id: 'sl-x0',
              label: 'Chest Position Offset Δx',
              min: -14.0, max: 14.0, step: 0.2, val: S.x0, unit: 'mm', decimals: 1,
              onInput: (v) => { S.x0 = v; }
            }
          ],
          breakAction: () => { st.breakAct(); },
          breakLabel: 'Break: Trigger 0° Null Point',
          challengeText: st.challenge,
          isChallengeSolved: Boolean(sciDone[2]),
          whyMattersText: st.whyMatters
        });
        break;

      case 3: // 4 Mixer
        if (scopeTitleEl) scopeTitleEl.textContent = 'MIXER BASEBAND V_mix(t) & CLUTTER SPECTRUM';
        renderControlCard({
          toggles: [
            { id: 'tg-fan', label: 'Cooling Fan (2.1 Hz)', checked: Boolean(S.n.fan), onChange: (c) => { S.n.fan = c ? 1 : 0; } },
            { id: 'tg-walk', label: 'Walking Footsteps (0.9 Hz)', checked: Boolean(S.n.walk), onChange: (c) => { S.n.walk = c ? 1 : 0; } },
            { id: 'tg-phone', label: 'Cellular EMI (17.0 Hz)', checked: Boolean(S.n.phone), onChange: (c) => { S.n.phone = c ? 1 : 0; } }
          ],
          breakAction: () => { st.breakAct(); },
          breakLabel: 'Break: Activate All Noise Sources',
          challengeText: st.challenge,
          isChallengeSolved: Boolean(sciDone[3]),
          whyMattersText: st.whyMatters
        });
        break;

      case 4: // 5 Filter
        if (scopeTitleEl) scopeTitleEl.textContent = 'BUTTERWORTH SPECTRUM H(f) & FILTERED y(t)';
        renderControlCard({
          sliders: [
            {
              id: 'sl-lo',
              label: 'Low Cutoff f_lo',
              min: 0.05, max: 2.5, step: 0.05, val: S.lo, unit: 'Hz', decimals: 2,
              onInput: (v) => { S.lo = v; }
            },
            {
              id: 'sl-hi',
              label: 'High Cutoff f_hi',
              min: 1.0, max: 15.0, step: 0.5, val: S.hi, unit: 'Hz', decimals: 1,
              onInput: (v) => { S.hi = v; }
            }
          ],
          breakAction: () => { st.breakAct(); },
          breakLabel: 'Break: Shift Passband to 2-4 Hz',
          challengeText: st.challenge,
          isChallengeSolved: Boolean(sciDone[4]),
          whyMattersText: st.whyMatters
        });
        break;

      case 5: // 6 Arduino
        if (scopeTitleEl) scopeTitleEl.textContent = 'ADC SAMPLING & NYQUIST RECONSTRUCTION';
        renderControlCard({
          sliders: [
            {
              id: 'sl-fsa',
              label: 'ADC Sample Rate fs',
              min: 1.0, max: 100.0, step: 1.0, val: S.fsA, unit: 'Hz', decimals: 0,
              onInput: (v) => { S.fsA = v; }
            }
          ],
          breakAction: () => { st.breakAct(); },
          breakLabel: 'Break: Drop fs to 1.8 Hz (Aliasing)',
          challengeText: st.challenge,
          isChallengeSolved: Boolean(sciDone[5]),
          whyMattersText: st.whyMatters
        });
        break;

      case 6: // 7 OLED
        if (scopeTitleEl) scopeTitleEl.textContent = '128x64 OLED GRAPHIC VITAL SIGNS DISPLAY';
        renderControlCard({
          sliders: [
            {
              id: 'sl-oled-dist',
              label: 'Radar Distance d',
              min: 0.5, max: 3.0, step: 0.1, val: S.d, unit: 'm', decimals: 1,
              onInput: (v) => { S.d = v; }
            }
          ],
          toggles: [
            { id: 'tg-oled-fan', label: 'Environmental Fan Noise', checked: Boolean(S.n.fan), onChange: (c) => { S.n.fan = c ? 1 : 0; } }
          ],
          breakAction: () => { st.breakAct(); },
          breakLabel: 'Break: Move Distance > 2.4 m',
          challengeText: st.challenge,
          isChallengeSolved: Boolean(sciDone[6]),
          whyMattersText: st.whyMatters
        });
        break;

      case 7: // Lab
        if (scopeTitleEl) scopeTitleEl.textContent = 'FREE LAB TELEMETRY & SYSTEM BENCHMARK';
        renderControlCard({
          sliders: [
            {
              id: 'sl-lab-d',
              label: 'Radar Distance d',
              min: 0.5, max: 3.5, step: 0.1, val: S.d, unit: 'm', decimals: 1,
              onInput: (v) => { S.d = v; }
            },
            {
              id: 'sl-lab-f',
              label: 'RF Frequency f',
              min: 5.0, max: 24.0, step: 0.1, val: S.f, unit: 'GHz', decimals: 2,
              onInput: (v) => { S.f = v; }
            },
            {
              id: 'sl-lab-fs',
              label: 'ADC Rate fs',
              min: 2.0, max: 100.0, step: 1.0, val: S.fsA, unit: 'Hz', decimals: 0,
              onInput: (v) => { S.fsA = v; }
            },
            {
              id: 'sl-lab-lo',
              label: 'Filter Low Cutoff',
              min: 0.05, max: 2.0, step: 0.05, val: S.lo, unit: 'Hz', decimals: 2,
              onInput: (v) => { S.lo = v; }
            },
            {
              id: 'sl-lab-hi',
              label: 'Filter High Cutoff',
              min: 1.0, max: 15.0, step: 0.5, val: S.hi, unit: 'Hz', decimals: 1,
              onInput: (v) => { S.hi = v; }
            }
          ],
          toggles: [
            { id: 'tg-lab-bo', label: 'Breathing Motion', checked: Boolean(S.bo), onChange: (c) => { S.bo = c; } },
            { id: 'tg-lab-ho', label: 'Cardiac Pulse', checked: Boolean(S.ho), onChange: (c) => { S.ho = c; } },
            { id: 'tg-lab-fan', label: 'Fan Clutter', checked: Boolean(S.n.fan), onChange: (c) => { S.n.fan = c ? 1 : 0; } },
            { id: 'tg-lab-walk', label: 'Walking Clutter', checked: Boolean(S.n.walk), onChange: (c) => { S.n.walk = c ? 1 : 0; } },
            { id: 'tg-lab-phone', label: 'Cellular EMI', checked: Boolean(S.n.phone), onChange: (c) => { S.n.phone = c ? 1 : 0; } }
          ],
          breakAction: () => { st.breakAct(); },
          breakLabel: 'Reset Mission Defaults',
          challengeText: st.challenge,
          isChallengeSolved: true,
          whyMattersText: st.whyMatters
        });
        _buildExportActions();
        break;
    }
  }

  // Dynamic Equation Metrics Updates
  switch (sciStage) {
    case 0: {
      const echoPct = Math.round(Math.min(1, 1 / (S.d * S.d)) * 100);
      const pathLossDb = (20 * Math.log10(S.d)).toFixed(1);
      updateEquationCard(
        `λ = c / f = 299.79 / ${S.f.toFixed(2)} GHz = <strong>${lam().toFixed(2)} mm (2.85 cm)</strong>`,
        [
          { label: 'Distance d', val: S.d.toFixed(2), unit: 'm', status: S.d > 2.5 ? 'warn' : 'live' },
          { label: 'Echo Amplitude', val: echoPct, unit: '%', status: echoPct < 20 ? 'coral' : 'live' },
          { label: 'Free-space Loss', val: pathLossDb, unit: 'dB', status: 'live' }
        ]
      );
      break;
    }
    case 1: {
      const currentX = mot(simNow);
      updateEquationCard(
        `x(t) = A_b·sin(2π·f_b·t) + A_h·sin(2π·f_h·t) = <strong>${currentX.toFixed(2)} mm</strong>`,
        [
          { label: 'Respiration Excursion', val: S.bo ? S.ab.toFixed(1) : '0.0', unit: 'mm', status: S.bo ? 'live' : 'warn' },
          { label: 'Cardiac Apex Pulse', val: S.ho ? S.ah.toFixed(2) : '0.00', unit: 'mm', status: S.ho ? 'coral' : 'warn' },
          { label: 'Dynamic Ratio', val: S.ho ? `${(S.ab / Math.max(S.ah, 0.01)).toFixed(0)}:1` : 'OFF', unit: '', status: 'live' }
        ]
      );
      break;
    }
    case 2: {
      const deg = (720 * S.x0 / lam());
      const wrapped = ((deg % 360 + 360) % 360);
      const phR = deg * Math.PI / 180;
      const isNull = Math.abs(Math.sin(phR)) < 0.22;
      updateEquationCard(
        `Δφ = 4π·Δx / λ = <strong>${wrapped.toFixed(1)}°</strong> (Δx = ${S.x0.toFixed(2)} mm)`,
        [
          { label: 'I-Channel Sensitivity', val: `${Math.round(Math.abs(Math.sin(phR)) * 100)}`, unit: '%', status: isNull ? 'coral' : 'live' },
          { label: 'Q-Channel Sensitivity', val: `${Math.round(Math.abs(Math.cos(phR)) * 100)}`, unit: '%', status: 'live' },
          { label: 'Demod Status', val: isNull ? 'NULL POINT (Q SAVES)' : 'BALANCED', unit: '', status: isNull ? 'warn' : 'live' }
        ]
      );
      break;
    }
    case 3: {
      const activeClutter = Object.entries(S.n).filter(([, v]) => v).map(([k]) => k.toUpperCase());
      updateEquationCard(
        `V_mix(t) = A·cos(Δφ(t)) + V_noise(t) = <strong>${(raw[N - 1] || 0).toFixed(3)} V</strong>`,
        [
          { label: 'Clutter Sources', val: activeClutter.length ? activeClutter.join(' + ') : 'CLEAN', unit: '', status: activeClutter.length ? 'coral' : 'live' },
          { label: 'Noise Status', val: activeClutter.length >= 2 ? 'HEAVILY CORRUPTED' : activeClutter.length ? 'MODERATE' : 'CLEAN BASEBAND', unit: '', status: activeClutter.length ? 'warn' : 'live' }
        ]
      );
      break;
    }
    case 4: {
      const hHum = Hf(50);
      const hHeart = Hf(1.2);
      updateEquationCard(
        `Bandpass Passband: <strong>${S.lo.toFixed(2)} Hz – ${S.hi.toFixed(1)} Hz</strong> (0.1–3.0 Hz nominal)`,
        [
          { label: '50 Hz Hum Attenuation', val: (20 * Math.log10(Math.max(hHum, 1e-4))).toFixed(1), unit: 'dB', status: hHum < 0.15 ? 'live' : 'coral' },
          { label: '1.2 Hz Cardiac Gain', val: hHeart.toFixed(2), unit: '', status: hHeart > 0.6 ? 'live' : 'warn' },
          { label: '0.25 Hz Breath Gain', val: Hf(0.25).toFixed(2), unit: '', status: 'live' }
        ]
      );
      break;
    }
    case 5: {
      const nyq = 2.4;
      const isAliased = S.fsA < nyq;
      updateEquationCard(
        `fs = <strong>${S.fsA.toFixed(1)} Hz</strong> (Nyquist Minimum: 2·f_max = 2.4 Hz)`,
        [
          { label: 'True Heart Rate', val: '72', unit: 'BPM (1.2 Hz)', status: 'live' },
          { label: 'Measured BPM', val: isAliased ? '36 (ALIASED)' : '72', unit: 'BPM', status: isAliased ? 'coral' : 'live' },
          { label: 'Sampling Status', val: isAliased ? 'FAIL: ALIASING ARTIFACT' : 'PASS: NYQUIST SATISFIED', unit: '', status: isAliased ? 'coral' : 'live' }
        ]
      );
      break;
    }
    case 6: {
      const bpmReliable = Math.abs(S.bpm - 72) <= 8 && S.d <= 2.0;
      updateEquationCard(
        `OLED Vitals Detection: Heart Rate = <strong>${S.bpm} BPM</strong> | Resp = <strong>${S.respRPM} RPM</strong>`,
        [
          { label: 'Signal Confidence', val: bpmReliable ? '98.4' : '42.1', unit: '%', status: bpmReliable ? 'live' : 'coral' },
          { label: 'Detector Lock', val: bpmReliable ? 'LOCKED' : 'NOISY DROPOUT', unit: '', status: bpmReliable ? 'live' : 'warn' }
        ]
      );
      break;
    }
    case 7: {
      updateEquationCard(
        `Mission Control: f = ${S.f.toFixed(2)} GHz | d = ${S.d.toFixed(2)} m | fs = ${S.fsA.toFixed(0)} Hz`,
        [
          { label: 'Live Heart Rate', val: S.bpm, unit: 'BPM', status: 'live' },
          { label: 'Live Respiration', val: S.respRPM, unit: 'RPM', status: 'live' },
          { label: 'Telemetry Stream', val: 'ACTIVE (50 Hz)', unit: '', status: 'live' }
        ]
      );
      break;
    }
  }
}

function _buildExportActions() {
  const ctrlCard = document.getElementById('sci-ctrl-body');
  if (!ctrlCard || document.getElementById('btn-export-csv')) return;

  const exportDiv = document.createElement('div');
  exportDiv.style.display = 'flex';
  exportDiv.style.gap = '8px';
  exportDiv.style.marginTop = '10px';
  exportDiv.innerHTML = `
    <button class="btn-break-card" id="btn-export-png" style="flex:1;background:rgba(0,243,255,0.12);border-color:rgba(0,243,255,0.35);color:#00f3ff;">
      <span>Capture Scope PNG</span>
    </button>
    <button class="btn-break-card" id="btn-export-csv" style="flex:1;background:rgba(182,255,60,0.12);border-color:rgba(182,255,60,0.35);color:#b6ff3c;">
      <span>Export Telemetry CSV</span>
    </button>
  `;
  ctrlCard.appendChild(exportDiv);

  document.getElementById('btn-export-png')?.addEventListener('click', () => {
    if (!sciCanvas) return;
    const link = document.createElement('a');
    link.download = `BioPulse_Scope_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = sciCanvas.toDataURL('image/png');
    link.click();
    if (typeof sfxSuccess === 'function') sfxSuccess();
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    let csv = 'Time_s,Raw_Mixer_V,Filtered_V,ADC_V\n';
    const len = Math.min(yy.length, raw.length, 256);
    for (let i = 0; i < len; i++) {
      const t = (i / FS).toFixed(4);
      const rVal = (raw[i] || 0).toFixed(5);
      const fVal = (yy[i] || 0).toFixed(5);
      const adVal = (ad[Math.floor(i / 5)] || 0).toFixed(5);
      csv += `${t},${rVal},${fVal},${adVal}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `BioPulse_Telemetry_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof sfxSuccess === 'function') sfxSuccess();
  });
}

/* ══════════════════════════════════════════════════════════
   PRECISION PLOT RENDERERS PER STAGE
══════════════════════════════════════════════════════════ */

/* ── Stage 1: Transmitter (Echo Amplitude vs Distance A(d) = 1/d²) ── */
function _drawS1() {
  if (!sg) return;
  const w = scW, h = scH;

  drawPrecisionGrid(sg, 0, 0, w, h, {
    xTitle: 'Distance d',
    xUnit: 'm',
    yTitle: 'Echo Amplitude A(d)',
    yUnit: '%',
    xMin: 0.5,
    xMax: 4.0,
    yMin: 0,
    yMax: 100,
    xDivs: 7,
    yDivs: 4
  });

  // Calculate 1/d² curve
  const curvePts = [];
  const numSteps = 120;
  for (let i = 0; i <= numSteps; i++) {
    const d = 0.5 + (i / numSteps) * (4.0 - 0.5);
    const amp = Math.min(1.0, 1.0 / (d * d)) * 100;
    curvePts.push(amp);
  }

  drawScopeTrace(sg, 0, 0, w, h, curvePts, {
    color: '#00f3ff',
    lineWidth: 2.2,
    yMin: 0,
    yMax: 100,
    fill: true,
    scanLine: true
  });

  // Moving marker for current distance S.d
  const plotLeft = 30;
  const plotRight = w - 8;
  const plotTop = 8;
  const plotBottom = h - 18;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const curDNorm = (S.d - 0.5) / (4.0 - 0.5);
  const curX = plotLeft + curDNorm * plotW;
  const curAmp = Math.min(1.0, 1.0 / (S.d * S.d)) * 100;
  const curY = plotBottom - (curAmp / 100) * plotH;

  sg.save();
  // Vertical marker guide line
  sg.strokeStyle = 'rgba(182, 255, 60, 0.4)';
  sg.lineWidth = 1;
  sg.setLineDash([2, 3]);
  sg.beginPath();
  sg.moveTo(curX, plotTop);
  sg.lineTo(curX, plotBottom);
  sg.stroke();

  // Horizontal marker guide line
  sg.beginPath();
  sg.moveTo(plotLeft, curY);
  sg.lineTo(plotRight, curY);
  sg.stroke();
  sg.setLineDash([]);

  // Marker Reticle
  sg.strokeStyle = '#b6ff3c';
  sg.lineWidth = 2;
  sg.beginPath();
  sg.arc(curX, curY, 6, 0, Math.PI * 2);
  sg.stroke();

  sg.fillStyle = '#b6ff3c';
  sg.beginPath();
  sg.arc(curX, curY, 2.5, 0, Math.PI * 2);
  sg.fill();

  // Label
  sg.font = '700 9.5px "JetBrains Mono", monospace';
  sg.fillStyle = '#b6ff3c';
  sg.textAlign = curDNorm > 0.6 ? 'right' : 'left';
  const labelX = curDNorm > 0.6 ? curX - 10 : curX + 10;
  sg.fillText(`d=${S.d.toFixed(2)}m (${Math.round(curAmp)}%)`, labelX, curY - 8);
  sg.restore();
}

/* ── Stage 2: Chest (Three Stacked Scopes: Breath, Heart, Sum in mm) ── */
function _drawS2() {
  if (!sg) return;
  const w = scW, h = scH;
  const rowH = Math.floor(h / 3);

  // 1. Top Scope: Respiration Excursion xb(t) [±12 mm]
  drawPrecisionGrid(sg, 0, 0, w, rowH, {
    yTitle: 'Respiration xb',
    yUnit: 'mm',
    yMin: -12,
    yMax: 12,
    xDivs: 4,
    yDivs: 2
  });

  const numPts = 128;
  const respData = [];
  for (let i = 0; i < numPts; i++) {
    const t = simNow - 4.0 + (i / numPts) * 4.0;
    respData.push(S.bo ? S.ab * Math.sin(Math.PI * 2 * S.fb * t) : 0);
  }
  drawScopeTrace(sg, 0, 0, w, rowH, respData, {
    color: '#b6ff3c',
    lineWidth: 1.8,
    yMin: -12,
    yMax: 12,
    scanLine: false
  });

  // 2. Middle Scope: Cardiac Apex Impulse xh(t) [±0.50 mm sensitive scale]
  drawPrecisionGrid(sg, 0, rowH, w, rowH, {
    yTitle: 'Cardiac Apex xh',
    yUnit: 'mm',
    yMin: -0.5,
    yMax: 0.5,
    xDivs: 4,
    yDivs: 2
  });

  const heartData = [];
  for (let i = 0; i < numPts; i++) {
    const t = simNow - 4.0 + (i / numPts) * 4.0;
    // Physiological dual lub-dub apex motion
    const phi = (t * S.fh) % 1.0;
    const lub = Math.sin(phi * Math.PI * 2);
    const dub = Math.sin((phi * Math.PI * 2 - 0.8) * 2.0);
    const pulse = (lub * 0.7 + dub * 0.3) * (S.ho ? S.ah : 0);
    heartData.push(pulse);
  }
  drawScopeTrace(sg, 0, rowH, w, rowH, heartData, {
    color: '#ff5e43',
    lineWidth: 1.8,
    yMin: -0.5,
    yMax: 0.5,
    scanLine: false
  });

  // 3. Bottom Scope: Superposition Net Displacement x(t) [±15 mm]
  drawPrecisionGrid(sg, 0, rowH * 2, w, rowH, {
    xTitle: 'Time',
    xUnit: 's',
    yTitle: 'Net x(t) = xb+xh',
    yUnit: 'mm',
    xMin: 0,
    xMax: 4,
    yMin: -15,
    yMax: 15,
    xDivs: 4,
    yDivs: 2
  });

  const sumData = [];
  for (let i = 0; i < numPts; i++) {
    sumData.push(respData[i] + heartData[i]);
  }
  drawScopeTrace(sg, 0, rowH * 2, w, rowH, sumData, {
    color: '#00f3ff',
    lineWidth: 2.0,
    yMin: -15,
    yMax: 15,
    scanLine: true
  });
}

/* ── Stage 3: Reflection (Overlay TX/RX Same Axes + I/Q Constellation) ── */
function _drawS3() {
  if (!sg) return;
  const w = scW, h = scH;

  const deg = (720 * S.x0 / lam());
  const wrapped = ((deg % 360 + 360) % 360);
  const phR = deg * Math.PI / 180;
  const isNull = Math.abs(Math.sin(phR)) < 0.22;

  // Split view: Left 60% Waveforms Overlay, Right 40% I/Q Constellation
  const splitW = Math.floor(w * 0.58);
  const rightW = w - splitW;

  // Left: TX and RX Overlaid on SAME AXES
  drawPrecisionGrid(sg, 0, 0, splitW, h, {
    xTitle: 'RF Phase',
    xUnit: 'rad',
    yTitle: 'TX & RX Overlay',
    yUnit: 'V',
    xMin: 0,
    xMax: 4 * Math.PI,
    yMin: -1.2,
    yMax: 1.2,
    xDivs: 4,
    yDivs: 4
  });

  const numPts = 100;
  const txPts = [];
  const rxPts = [];
  for (let i = 0; i < numPts; i++) {
    const angle = (i / (numPts - 1)) * (4 * Math.PI);
    txPts.push(Math.sin(angle));
    rxPts.push(Math.sin(angle + phR));
  }

  // Draw TX trace (Cyan)
  drawScopeTrace(sg, 0, 0, splitW, h, txPts, {
    color: '#00f3ff',
    lineWidth: 2.0,
    yMin: -1.2,
    yMax: 1.2,
    scanLine: false
  });

  // Draw RX trace (Coral)
  drawScopeTrace(sg, 0, 0, splitW, h, rxPts, {
    color: '#ff5e43',
    lineWidth: 2.0,
    yMin: -1.2,
    yMax: 1.2,
    scanLine: true
  });

  // Delta-phi Arc marker on left waveform between peaks
  const plotLeftW = splitW - 38;
  const tPeakX = 30 + (0.25) * plotW;
  const rPeakX = 30 + ((0.25 - (phR / (4 * Math.PI)) % 1 + 1) % 1) * plotW;

  sg.save();
  sg.strokeStyle = '#b6ff3c';
  sg.lineWidth = 1.5;
  sg.beginPath();
  sg.moveTo(tPeakX, 16);
  sg.quadraticCurveTo((tPeakX + rPeakX) / 2, 4, rPeakX, 16);
  sg.stroke();

  sg.font = '700 9px "JetBrains Mono", monospace';
  sg.fillStyle = '#b6ff3c';
  sg.textAlign = 'center';
  sg.fillText(`Δφ = ${wrapped.toFixed(0)}°`, (tPeakX + rPeakX) / 2, 12);
  sg.restore();

  // Right: Bigger I/Q Constellation Circle
  sg.save();
  sg.beginPath();
  sg.rect(splitW, 0, rightW, h);
  sg.clip();

  const cx = splitW + rightW / 2;
  const cy = h / 2 - 8;
  const radius = Math.min(rightW * 0.38, h * 0.35);

  // Crosshairs
  sg.strokeStyle = 'rgba(0, 243, 255, 0.2)';
  sg.lineWidth = 1;
  sg.beginPath();
  sg.moveTo(cx - radius - 18, cy);
  sg.lineTo(cx + radius + 18, cy);
  sg.moveTo(cx, cy - radius - 18);
  sg.lineTo(cx, cy + radius + 18);
  sg.stroke();

  // Constellation Ring
  sg.strokeStyle = 'rgba(0, 243, 255, 0.35)';
  sg.lineWidth = 1.5;
  sg.setLineDash([3, 3]);
  sg.beginPath();
  sg.arc(cx, cy, radius, 0, Math.PI * 2);
  sg.stroke();
  sg.setLineDash([]);

  // Labels
  sg.font = '9px "JetBrains Mono", monospace';
  sg.fillStyle = '#64748b';
  sg.textAlign = 'center';
  sg.fillText('+I (0°)', cx + radius + 20, cy + 3);
  sg.fillText('+Q (90°)', cx, cy - radius - 6);

  // Rotating Phasor Vector
  const px = cx + Math.cos(phR) * radius;
  const py = cy - Math.sin(phR) * radius; // inverted y

  sg.strokeStyle = isNull ? '#ff5e43' : '#b6ff3c';
  sg.lineWidth = 2.5;
  sg.beginPath();
  sg.moveTo(cx, cy);
  sg.lineTo(px, py);
  sg.stroke();

  sg.fillStyle = isNull ? '#ff5e43' : '#b6ff3c';
  sg.beginPath();
  sg.arc(px, py, 6.5, 0, Math.PI * 2);
  sg.fill();

  // Status indicator below circle
  sg.font = '700 9.5px "JetBrains Mono", monospace';
  sg.textAlign = 'center';
  if (isNull) {
    sg.fillStyle = '#ff5e43';
    sg.fillText('⚠ NULL POINT (I ≈ 0)', cx, cy + radius + 22);
  } else {
    sg.fillStyle = '#b6ff3c';
    sg.fillText('✓ BALANCED SENSITIVITY', cx, cy + radius + 22);
  }

  sg.restore();
}

/* ── Stage 4: Mixer (V_mix Baseband & Noise Spectrum) ── */
function _drawS4() {
  if (!sg) return;
  const w = scW, h = scH;
  const topH = Math.floor(h * 0.55);
  const botH = h - topH;

  const isNoiseOn = Boolean(S.n.fan || S.n.walk || S.n.phone);

  // Top: Time-Domain V_mix(t)
  drawPrecisionGrid(sg, 0, 0, w, topH, {
    xTitle: 'Time',
    xUnit: 's',
    yTitle: 'Mixer Output V_mix(t)',
    yUnit: 'V',
    xMin: 0,
    xMax: 2.0,
    yMin: -1.5,
    yMax: 1.5,
    xDivs: 4,
    yDivs: 4
  });

  const slice = [];
  for (let i = 0; i < 128; i++) {
    const idx = N - 128 + i;
    if (!isNoiseOn) {
      // Genuinely clean baseband trace when environmental noise is off
      const t = simNow - (128 - i) / FS;
      const phase = 4 * Math.PI * (S.d * 1000 + S.x0 + mot(t)) / lam();
      slice.push((1 / (S.d * S.d)) * Math.cos(phase));
    } else {
      slice.push(raw[idx]);
    }
  }

  drawScopeTrace(sg, 0, 0, w, topH, slice, {
    color: isNoiseOn ? '#ff5e43' : '#00f3ff',
    lineWidth: 1.8,
    yMin: -1.5,
    yMax: 1.5,
    scanLine: true
  });

  // Bottom: Noise Frequency Identification Bars
  drawPrecisionGrid(sg, 0, topH, w, botH, {
    xTitle: 'Frequency',
    xUnit: 'Hz',
    yTitle: 'Clutter Harmonics',
    yUnit: 'dB',
    xMin: 0,
    xMax: 25,
    yMin: -40,
    yMax: 0,
    xDivs: 5,
    yDivs: 2
  });

  sg.save();
  const plotLeft = 30;
  const plotRight = w - 8;
  const plotW = plotRight - plotLeft;
  const plotTop = topH + 8;
  const plotBottom = topH + botH - 18;
  const plotH = plotBottom - plotTop;

  // Noise markers
  const sources = [
    { name: 'Walking (0.9 Hz)', freq: 0.9, active: Boolean(S.n.walk), color: '#ffb703' },
    { name: 'Cooling Fan (2.1 Hz)', freq: 2.1, active: Boolean(S.n.fan), color: '#ff5e43' },
    { name: 'Cell EMI (17 Hz)', freq: 17.0, active: Boolean(S.n.phone), color: '#ef4444' }
  ];

  sources.forEach(src => {
    if (src.active) {
      const fx = plotLeft + (src.freq / 25.0) * plotW;
      sg.strokeStyle = src.color;
      sg.lineWidth = 3;
      sg.beginPath();
      sg.moveTo(fx, plotBottom);
      sg.lineTo(fx, plotTop + 10);
      sg.stroke();

      sg.font = '700 8.5px "JetBrains Mono", monospace';
      sg.fillStyle = src.color;
      sg.textAlign = 'center';
      sg.fillText(src.name, fx, plotTop + 6);
    }
  });

  sg.restore();
}

/* ── Stage 5: Filter (Real FFT with 0-60 Hz Continuous Axis & Draggable Passband) ── */
function _drawS5() {
  if (!sg) return;
  const w = scW, h = scH;
  const topH = Math.floor(h * 0.52);
  const botH = h - topH;

  // Top: Real FFT Spectrum (0 to 60 Hz continuous linear axis, no kink!)
  drawPrecisionGrid(sg, 0, 0, w, topH, {
    xTitle: 'Frequency',
    xUnit: 'Hz',
    yTitle: 'FFT Magnitude |Y(f)|',
    yUnit: 'dB',
    xMin: 0,
    xMax: 60,
    yMin: -50,
    yMax: 0,
    xDivs: 6,
    yDivs: 3
  });

  sg.save();
  const plotLeft = 30;
  const plotRight = w - 8;
  const plotW = Math.max(plotRight - plotLeft, 10);
  const plotTop = 8;
  const plotBottom = topH - 18;
  const plotH = Math.max(plotBottom - plotTop, 10);

  // Shaded passband overlay [S.lo to S.hi]
  const pbLeft = plotLeft + (Math.max(0, S.lo) / 60.0) * plotW;
  const pbRight = plotLeft + (Math.min(60, S.hi) / 60.0) * plotW;
  const pbW = Math.max(pbRight - pbLeft, 4);

  // Passband glow & fill
  sg.fillStyle = 'rgba(0, 243, 255, 0.12)';
  sg.fillRect(pbLeft, plotTop, pbW, plotH);
  sg.strokeStyle = 'rgba(0, 243, 255, 0.6)';
  sg.lineWidth = 1.5;
  sg.strokeRect(pbLeft, plotTop, pbW, plotH);

  // Draggable Left Edge (f_lo) Handle
  sg.strokeStyle = '#00f3ff';
  sg.lineWidth = 2.5;
  sg.beginPath();
  sg.moveTo(pbLeft, plotTop);
  sg.lineTo(pbLeft, plotBottom);
  sg.stroke();

  // Grab handle tab top/bottom
  sg.fillStyle = '#00f3ff';
  sg.beginPath();
  sg.arc(pbLeft, plotTop + 4, 3.5, 0, Math.PI * 2);
  sg.arc(pbLeft, plotBottom - 4, 3.5, 0, Math.PI * 2);
  sg.fill();

  // Draggable Right Edge (f_hi) Handle
  sg.beginPath();
  sg.moveTo(pbRight, plotTop);
  sg.lineTo(pbRight, plotBottom);
  sg.stroke();

  sg.beginPath();
  sg.arc(pbRight, plotTop + 4, 3.5, 0, Math.PI * 2);
  sg.arc(pbRight, plotBottom - 4, 3.5, 0, Math.PI * 2);
  sg.fill();

  // Passband center label
  sg.font = '700 8.5px "JetBrains Mono", monospace';
  sg.fillStyle = '#00f3ff';
  sg.textAlign = 'center';
  if (pbW > 45) {
    sg.fillText(`⇋ PASSBAND [${S.lo.toFixed(2)}–${S.hi.toFixed(1)}Hz]`, (pbLeft + pbRight) / 2, plotTop + 14);
  } else {
    sg.fillText(`[${S.lo.toFixed(1)}–${S.hi.toFixed(1)}]`, (pbLeft + pbRight) / 2, plotTop + 14);
  }

  // Peak markers: Respiration (0.25 Hz), Heart (1.2 Hz), 50 Hz Hum
  const hHumDb = (20 * Math.log10(Math.max(Hf(50), 1e-4))).toFixed(1);
  const peaks = [
    { freq: 0.25, mag: -6, label: '0.25Hz', full: `0.25 Hz Resp (-6 dB)`, col: '#b6ff3c' },
    { freq: 1.2, mag: -14, label: '1.2Hz', full: `1.20 Hz Cardiac (-14 dB)`, col: '#ff5e43' },
    { freq: 50.0, mag: -8 + 20 * Math.log10(Math.max(Hf(50), 1e-4)), label: '50Hz Hum', full: `50 Hz Hum (${hHumDb} dB)`, col: '#ffb703' }
  ];

  peaks.forEach(p => {
    const px = plotLeft + (p.freq / 60.0) * plotW;
    const clampedMag = Math.max(-48, Math.min(0, p.mag));
    const py = plotBottom - ((clampedMag + 50) / 50.0) * plotH;

    sg.strokeStyle = p.col;
    sg.lineWidth = 1.8;
    sg.beginPath();
    sg.moveTo(px, plotBottom);
    sg.lineTo(px, py);
    sg.stroke();

    sg.fillStyle = p.col;
    sg.beginPath();
    sg.arc(px, py, 3.5, 0, Math.PI * 2);
    sg.fill();

    // Subtle reticle
    sg.strokeStyle = p.col;
    sg.lineWidth = 1;
    sg.beginPath();
    sg.arc(px, py, 6, 0, Math.PI * 2);
    sg.stroke();
  });

  // Top-Right Spectrum HUD Readout Box (Prevents any Y-axis overlap)
  const hudBoxW = Math.min(185, plotW * 0.42);
  const hudBoxX = plotRight - hudBoxW;
  const hudBoxY = plotTop + 4;
  sg.fillStyle = 'rgba(6, 10, 20, 0.75)';
  sg.strokeStyle = 'rgba(0, 243, 255, 0.25)';
  sg.lineWidth = 1;
  sg.beginPath();
  sg.roundRect(hudBoxX, hudBoxY, hudBoxW, 46, [4]);
  sg.fill();
  sg.stroke();

  sg.font = '700 8px "JetBrains Mono", monospace';
  sg.textAlign = 'left';
  sg.fillStyle = '#b6ff3c';
  sg.fillText(`● 0.25 Hz Resp  [-6 dB]`, hudBoxX + 8, hudBoxY + 13);
  sg.fillStyle = '#ff5e43';
  sg.fillText(`● 1.20 Hz Heart [-14 dB]`, hudBoxX + 8, hudBoxY + 26);
  sg.fillStyle = '#ffb703';
  sg.fillText(`● 50 Hz Hum    [${hHumDb} dB]`, hudBoxX + 8, hudBoxY + 39);

  sg.restore();

  // Bottom: Before & After Waveforms
  drawPrecisionGrid(sg, 0, topH, w, botH, {
    xTitle: 'Time',
    xUnit: 's',
    yTitle: 'Waveform',
    yUnit: 'V',
    xMin: 0,
    xMax: 2.0,
    yMin: -1.5,
    yMax: 1.5,
    xDivs: 4,
    yDivs: 2
  });

  // 1. Before: Raw Mixer V_mix(t) (coral with hum/clutter)
  const rawSlice = Array.from(raw.slice(raw.length - 128));
  drawScopeTrace(sg, 0, topH, w, botH, rawSlice, {
    color: 'rgba(255, 94, 67, 0.55)',
    lineWidth: 1.3,
    yMin: -1.5,
    yMax: 1.5,
    scanLine: false
  });

  // 2. After: Filtered y(t) (lime clean physiological signal)
  const filtSlice = Array.from(yy.slice(yy.length - 128));
  drawScopeTrace(sg, 0, topH, w, botH, filtSlice, {
    color: '#b6ff3c',
    lineWidth: 2.0,
    yMin: -1.5,
    yMax: 1.5,
    scanLine: true
  });

  // Dual Trace Legend at top right of bottom plot
  sg.save();
  sg.font = '700 8.5px "JetBrains Mono", monospace';
  sg.textAlign = 'right';
  sg.fillStyle = '#ff5e43';
  sg.fillText('━ BEFORE: RAW MIXER (HUM + CLUTTER)', w - 14, topH + 16);
  sg.fillStyle = '#b6ff3c';
  sg.fillText('━ AFTER: 4TH-ORDER BUTTERWORTH', w - 14, topH + 28);
  sg.restore();
}

/* ── Stage 6: Arduino (Sample Dots, Nyquist Line & Aliasing) ── */
function _drawS6() {
  if (!sg) return;
  const w = scW, h = scH;

  drawPrecisionGrid(sg, 0, 0, w, h, {
    xTitle: 'Sampling Time',
    xUnit: 's',
    yTitle: 'ADC Voltage',
    yUnit: 'V',
    xMin: 0,
    xMax: 2.0,
    yMin: -1.2,
    yMax: 1.2,
    xDivs: 4,
    yDivs: 4
  });

  const plotLeft = 30;
  const plotRight = w - 8;
  const plotW = Math.max(plotRight - plotLeft, 10);
  const plotTop = 8;
  const plotBottom = h - 18;
  const plotH = Math.max(plotBottom - plotTop, 10);

  const isAliased = S.fsA < 2.4;

  // 1. Continuous True Physiological Signal (Translucent Cyan)
  const truePts = [];
  const numTrue = 128;
  for (let i = 0; i < numTrue; i++) {
    const t = simNow - 2.0 + (i / numTrue) * 2.0;
    truePts.push(Math.sin(Math.PI * 2 * S.fh * t) * 0.85);
  }
  drawScopeTrace(sg, 0, 0, w, h, truePts, {
    color: 'rgba(0, 243, 255, 0.35)',
    lineWidth: 1.4,
    yMin: -1.2,
    yMax: 1.2,
    scanLine: false
  });

  // 2. Discrete Sample Dots & Aliased vs Nyquist Reconstruction
  const numSamples = Math.max(4, Math.floor(S.fsA * 2.0));
  const samplePts = [];
  sg.save();

  for (let k = 0; k < numSamples; k++) {
    const t = simNow - 2.0 + (k / (numSamples - 1)) * 2.0;
    const val = Math.sin(Math.PI * 2 * S.fh * t) * 0.85;
    const sx = plotLeft + (k / (numSamples - 1)) * plotW;
    const sy = plotBottom - ((val + 1.2) / 2.4) * plotH;
    samplePts.push({ x: sx, y: sy });

    // Discrete Sample Dot
    sg.fillStyle = isAliased ? '#ff5e43' : '#b6ff3c';
    sg.beginPath();
    sg.arc(sx, sy, 3.8, 0, Math.PI * 2);
    sg.fill();

    // Stem line to axis
    sg.strokeStyle = isAliased ? 'rgba(255, 94, 67, 0.25)' : 'rgba(182, 255, 60, 0.25)';
    sg.lineWidth = 1;
    sg.beginPath();
    sg.moveTo(sx, sy);
    sg.lineTo(sx, plotBottom);
    sg.stroke();
  }

  // Draw reconstruction curve through sample points
  sg.strokeStyle = isAliased ? '#ffb703' : '#b6ff3c';
  sg.lineWidth = 2.2;
  sg.beginPath();
  samplePts.forEach((pt, idx) => {
    if (idx === 0) sg.moveTo(pt.x, pt.y);
    else sg.lineTo(pt.x, pt.y);
  });
  sg.stroke();

  // Top Nyquist Status Banner & Annotation
  sg.font = '700 9.5px "JetBrains Mono", monospace';
  if (isAliased) {
    const apparentHz = Math.abs(S.fh - S.fsA);
    const apparentBpm = Math.round(apparentHz * 60);
    sg.fillStyle = '#ff5e43';
    sg.fillText(`⚠ ALIASING ARTIFACT: fs = ${S.fsA.toFixed(1)} Hz < 2.4 Hz Nyquist`, plotLeft + 10, plotTop + 14);
    sg.fillStyle = '#ffb703';
    sg.fillText(`True Rate: 72 BPM (1.2 Hz) ➔ Reconstructed Apparent: ~${apparentBpm} BPM (False Bradycardia)`, plotLeft + 10, plotTop + 27);
  } else {
    sg.fillStyle = '#b6ff3c';
    sg.fillText(`✓ NYQUIST CRITERION SATISFIED: fs = ${S.fsA.toFixed(0)} Hz ≥ 2.4 Hz`, plotLeft + 10, plotTop + 14);
    sg.fillStyle = 'rgba(0, 243, 255, 0.8)';
    sg.fillText(`Exact 72 BPM (1.2 Hz) cardiac harmonics fully preserved without phase folding`, plotLeft + 10, plotTop + 27);
  }

  // Nyquist Threshold Marker Line
  sg.strokeStyle = 'rgba(255, 183, 3, 0.6)';
  sg.lineWidth = 1;
  sg.setLineDash([3, 3]);
  const nyqX = plotLeft + (2.4 / 100.0) * plotW;
  sg.beginPath();
  sg.moveTo(nyqX, plotTop);
  sg.lineTo(nyqX, plotBottom);
  sg.stroke();
  sg.setLineDash([]);

  sg.restore();
}

/* ── Stage 7: OLED (Simulated 128x64 OLED Display & Signal Chain Strip) ── */
function _drawS7() {
  if (!sg) return;
  const w = scW, h = scH;

  // Render simulated OLED chassis
  const oledW = Math.min(270, w - 36);
  const oledH = Math.min(125, Math.floor((h - 38) * 0.75));
  const ox = (w - oledW) / 2;
  const oy = Math.max(6, Math.floor((h - oledH - 26) / 2));

  sg.save();
  // Outer metallic bezel frame
  sg.fillStyle = '#0a0f1d';
  sg.strokeStyle = '#00f3ff';
  sg.lineWidth = 1.5;
  sg.beginPath();
  sg.roundRect(ox - 10, oy - 10, oledW + 20, oledH + 20, [8]);
  sg.fill();
  sg.stroke();

  // Bezel mounting screws
  sg.fillStyle = '#334155';
  [[ox - 5, oy - 5], [ox + oledW + 5, oy - 5], [ox - 5, oy + oledH + 5], [ox + oledW + 5, oy + oledH + 5]].forEach(([sx, sy]) => {
    sg.beginPath();
    sg.arc(sx, sy, 2.5, 0, Math.PI * 2);
    sg.fill();
  });

  // Deep OLED Glass Screen
  sg.fillStyle = '#020409';
  sg.fillRect(ox, oy, oledW, oledH);

  // Subtle Scanline Grid
  sg.strokeStyle = 'rgba(0, 243, 255, 0.04)';
  sg.lineWidth = 1;
  for (let y = oy; y < oy + oledH; y += 3) {
    sg.beginPath();
    sg.moveTo(ox, y);
    sg.lineTo(ox + oledW, y);
    sg.stroke();
  }

  // 1. Yellow Header Band (SSD1306 Yellow-Cyan Style)
  const isReliable = Math.abs(S.bpm - 72) <= 8 && S.d <= 2.0 && !S.n.fan;
  sg.fillStyle = '#1e1c05';
  sg.fillRect(ox, oy, oledW, 20);

  sg.font = '700 9px "JetBrains Mono", monospace';
  sg.fillStyle = '#ffea00';
  sg.textAlign = 'left';
  sg.fillText('BIOPULSE RADAR', ox + 8, oy + 14);

  sg.textAlign = 'right';
  sg.fillStyle = isReliable ? '#b6ff3c' : '#ff5e43';
  sg.fillText(isReliable ? '● LOCKED (24dB)' : '▲ SEARCHING...', ox + oledW - 8, oy + 14);

  // 2. Cyan Body Section
  sg.textAlign = 'left';
  sg.font = '700 28px "JetBrains Mono", monospace';
  sg.fillStyle = isReliable ? '#00f3ff' : '#ff5e43';
  sg.fillText(isReliable ? `${S.bpm}` : '--', ox + 10, oy + 54);

  sg.font = '700 10px "JetBrains Mono", monospace';
  sg.fillStyle = '#64748b';
  sg.fillText('BPM', ox + 76, oy + 42);

  // Pulsing Heart Icon
  const heartBeat = (Math.sin(simNow * S.fh * Math.PI * 2) + 1) * 0.5;
  sg.fillStyle = isReliable ? '#ff5e43' : '#64748b';
  sg.font = `${Math.floor(12 + heartBeat * 4)}px "JetBrains Mono", monospace`;
  sg.fillText('♥', ox + 106, oy + 42);

  // Secondary Vital: Respiration
  sg.font = '700 9px "JetBrains Mono", monospace';
  sg.fillStyle = '#b6ff3c';
  sg.fillText(`RESP: ${isReliable ? S.respRPM : '--'} RPM`, ox + 76, oy + 54);

  // OLED Real-time Scrolling Waveform Trace
  sg.strokeStyle = isReliable ? '#00f3ff' : '#ff5e43';
  sg.lineWidth = 1.6;
  sg.beginPath();
  const traceLen = oledW - 16;
  for (let i = 0; i < traceLen; i++) {
    const t = simNow - 1.2 + (i / traceLen) * 1.2;
    const pulse = isReliable ? Math.sin(t * S.fh * Math.PI * 2) * 14 : (Math.random() - 0.5) * 12;
    const py = oy + oledH - 14 - pulse;
    if (i === 0) sg.moveTo(ox + 8 + i, py);
    else sg.lineTo(ox + 8 + i, py);
  }
  sg.stroke();

  // 3. Bottom Signal Chain Pipeline Strip (Lighting up in sequence)
  const stripY = Math.min(h - 22, oy + oledH + 8);
  const chain = ['TX HORN', 'AIR PATH', 'CHEST', 'MIXER', 'FILTER', 'ADC', 'OLED'];
  const nodeW = Math.floor((w - 36) / chain.length);
  const pulseStep = (simNow * 2.8) % 7;

  chain.forEach((node, idx) => {
    const nx = 18 + idx * nodeW;
    const distToPulse = Math.abs(idx - pulseStep);
    const isPulseHit = distToPulse < 0.85;

    let bg = 'rgba(0, 243, 255, 0.08)';
    let border = 'rgba(0, 243, 255, 0.25)';
    let text = '#64748b';

    if (isPulseHit) {
      bg = 'rgba(0, 243, 255, 0.35)';
      border = '#00f3ff';
      text = '#00f3ff';
    } else if (idx < Math.floor(pulseStep)) {
      bg = 'rgba(0, 243, 255, 0.15)';
      border = 'rgba(0, 243, 255, 0.45)';
      text = '#00f3ff';
    }

    // Degraded signal turns downstream nodes amber/coral
    if (!isReliable && idx >= 4) {
      if (isPulseHit) {
        bg = 'rgba(255, 94, 67, 0.4)';
        border = '#ff5e43';
        text = '#ff5e43';
      } else {
        bg = 'rgba(255, 94, 67, 0.12)';
        border = 'rgba(255, 94, 67, 0.35)';
        text = '#ffb703';
      }
    }

    sg.fillStyle = bg;
    sg.strokeStyle = border;
    sg.lineWidth = 1;
    sg.beginPath();
    sg.roundRect(nx + 2, stripY, nodeW - 4, 18, [3]);
    sg.fill();
    sg.stroke();

    sg.font = '700 7.5px "JetBrains Mono", monospace';
    sg.fillStyle = text;
    sg.textAlign = 'center';
    sg.fillText(node, nx + nodeW / 2, stripY + 12);
  });

  sg.restore();
}

/* ── Stage 8: Free Lab (Complete Triple Pipeline Display) ── */
function _drawFreeLab() {
  if (!sg) return;
  const w = scW, h = scH;
  const rowH = Math.floor(h / 3);

  // 1. Raw Mixer
  drawPrecisionGrid(sg, 0, 0, w, rowH, {
    yTitle: 'Raw Mixer V(t)',
    yUnit: 'V',
    yMin: -1.5,
    yMax: 1.5,
    xDivs: 4,
    yDivs: 2
  });
  const rawSlice = Array.from(raw.slice(raw.length - 128));
  drawScopeTrace(sg, 0, 0, w, rowH, rawSlice, {
    color: '#ff5e43',
    lineWidth: 1.5,
    yMin: -1.5,
    yMax: 1.5,
    scanLine: false
  });

  // 2. Filtered
  drawPrecisionGrid(sg, 0, rowH, w, rowH, {
    yTitle: 'Filtered y(t)',
    yUnit: 'V',
    yMin: -1.2,
    yMax: 1.2,
    xDivs: 4,
    yDivs: 2
  });
  const filtSlice = Array.from(yy.slice(yy.length - 128));
  drawScopeTrace(sg, 0, rowH, w, rowH, filtSlice, {
    color: '#b6ff3c',
    lineWidth: 1.8,
    yMin: -1.2,
    yMax: 1.2,
    scanLine: false
  });

  // 3. Sampled ADC Vitals
  drawPrecisionGrid(sg, 0, rowH * 2, w, rowH, {
    xTitle: 'Time',
    xUnit: 's',
    yTitle: 'ADC Output',
    yUnit: 'V',
    xMin: 0,
    xMax: 2.0,
    yMin: -1.2,
    yMax: 1.2,
    xDivs: 4,
    yDivs: 2
  });
  drawScopeTrace(sg, 0, rowH * 2, w, rowH, ad.length ? ad : filtSlice, {
    color: '#00f3ff',
    lineWidth: 2.0,
    yMin: -1.2,
    yMax: 1.2,
    scanLine: true
  });
}

/* ══════════════════════════════════════════════════════════
   ANIMATION LOOP
══════════════════════════════════════════════════════════ */
let _sciAnimId = null;
function _sciFrame(t) {
  _sciAnimId = requestAnimationFrame(_sciFrame);
  runSim(t / 1000);

  if (sciCanvas && (sciCanvas.clientWidth !== scW || sciCanvas.clientHeight !== scH || !sg)) {
    _resizeSci();
  }

  if (sg && scW > 10 && scH > 10) {
    sg.fillStyle = '#060913';
    sg.fillRect(0, 0, scW, scH);

    const st = SCI_STAGES[sciStage];
    if (st && typeof st.render === 'function') {
      st.render();
    }
  }

  // Update live metrics & challenges
  _renderStagePanels(false);

  const st = SCI_STAGES[sciStage];
  if (!sciDone[sciStage] && sciStage < 7 && st && st.ok && st.ok()) {
    sciDone[sciStage] = true;
    if (typeof sfxSuccess === 'function') sfxSuccess();
    _renderSciStepper();
    _updateSciHeader();
  }
}

function onSciActivate() {
  _resizeSci();
  _initSciStepper();
  _renderSciStepper();
  _updateSciHeader();
  if (window.BioPulse3D) {
    window.BioPulse3D.activate();
    window.BioPulse3D.setStageView(sciStage);
    requestAnimationFrame(window.BioPulse3D.resize);
  }
  _renderStagePanels(true);
  if (!_sciAnimId) _sciAnimId = requestAnimationFrame(_sciFrame);
}
window.sciOnActivate = onSciActivate;
window.onSciActivate = onSciActivate;

function _initOnReady() {
  _initSciStepper();
  _updateSciHeader();
  if ((typeof _currentView !== 'undefined' && _currentView === 'sci') || location.hash.includes('sci')) {
    onSciActivate();
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  _initOnReady();
} else {
  document.addEventListener('DOMContentLoaded', _initOnReady);
}
