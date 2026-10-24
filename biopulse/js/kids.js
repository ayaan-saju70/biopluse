/* ═══════════════════════════════════════════════════════════
   kids.js — BioPulse Kids Mode Engine
   Fixed 1600x900 Virtual Stage • CSS Transform Uniform Scaling
   2D Flat Illustrated Cutout Sprites • Direct Manipulation
   Independent Kids State • Web Audio Juice • Web Speech Narration
   Zero WebGL • 8 Stages (1-7 + Free Lab)
   ════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  /* ── 1. INDEPENDENT KIDS STATE (Never inherits Scientific values) ── */
  const _kidState = {
    currentStage: 0,
    unlockedStages: [true, false, false, false, false, false, false, false],
    completedStages: [false, false, false, false, false, false, false, false],
    isBroken: false,
    soundEnabled: true,

    // Stage 1: Wave & Boy position (in 1600px stage coordinates)
    boyX: 1050, // draggable between 480 and 1350
    waveSpeed: 'gentle', // 'gentle' | 'quick'

    // Stage 2: Vitals (healthy baseline)
    breathSpeed: 50, // 1 to 100
    heartSpeed: 50,  // 1 to 100

    // Stage 3: Bouncy ball wave
    bouncyBall: { x: 313, y: 324, progress: 0, direction: 1, squashed: false },

    // Stage 4: Blender & Bugs
    bugsInBlender: [], // active noisy bugs
    blenderSpinning: false,

    // Stage 5: Strainer position
    strainerX: 700, // draggable between 300 and 1100
    strainedClean: false,

    // Stage 6: Camera photo rate
    cameraRate: 45, // 2 to 50 photos
    lastSampleTick: 0,

    // PulseBot Mascot Expression
    pulsebotExpression: 'happy',

    // Dragging
    isDraggingBoy: false,
    isDraggingStrainer: false
  };

  /* ── 2. STAGE DEFINITIONS (At most 3-6 words, Spoken Aloud) ── */
  const STAGES = [
    {
      id: 0,
      title: 'Wave Machine',
      badge: '📡',
      voice: 'Drag the boy!',
      bg: 'assets/kids/bg_sunny_meadow.svg',
      stickerName: 'Magic Radar'
    },
    {
      id: 1,
      title: 'Breathing & Heart',
      badge: '🫁',
      voice: 'Fast or slow breathing!',
      bg: 'assets/kids/bg_bedroom_night.svg',
      stickerName: 'Happy Organs'
    },
    {
      id: 2,
      title: 'Bouncy Wave',
      badge: '⚽',
      voice: 'The wave bounces back!',
      bg: 'assets/kids/bg_bedroom_night.svg',
      stickerName: 'Bouncy Wave'
    },
    {
      id: 3,
      title: 'Magic Blender',
      badge: '🍹',
      voice: 'Tap bugs into blender!',
      bg: 'assets/kids/bg_friendly_lab.svg',
      stickerName: 'Smoothie Blender'
    },
    {
      id: 4,
      title: 'Magic Strainer',
      badge: '🥣',
      voice: 'Catch wiggles, drop bugs!',
      bg: 'assets/kids/bg_friendly_lab.svg',
      stickerName: 'Magic Sieve'
    },
    {
      id: 5,
      title: 'Toy Camera',
      badge: '📸',
      voice: 'Snap lots of photos!',
      bg: 'assets/kids/bg_friendly_lab.svg',
      stickerName: 'Super Camera'
    },
    {
      id: 6,
      title: 'Robot Screen',
      badge: '🤖',
      voice: 'PulseBot sees happy vitals!',
      bg: 'assets/kids/bg_friendly_lab.svg',
      stickerName: 'Robot Monitor'
    },
    {
      id: 7,
      title: 'Free Lab',
      badge: '🌟',
      voice: 'Play with all toys!',
      bg: 'assets/kids/bg_friendly_lab.svg',
      stickerName: 'Gold Star Champion'
    }
  ];

  /* ── 3. VIRTUAL 1600x900 STAGE UNIFORM SCALING ── */
  function updateStageScale() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / 1600, vh / 900);
    document.documentElement.style.setProperty('--stage-scale', scale);
  }
  window.addEventListener('resize', updateStageScale);
  window.addEventListener('orientationchange', updateStageScale);
  updateStageScale();

  function getStagePointerPos(e) {
    const stage = document.getElementById('kids-stage-viewport');
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    const scale = rect.width / 1600;
    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY) ?? 0;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale
    };
  }

  /* ── 4. SYNTHESIZED WEB AUDIO SOUND ENGINE ── */
  let _audioCtx = null;
  function getAudioCtx() {
    if (!_audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) _audioCtx = new AudioContext();
    }
    if (_audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume();
    }
    return _audioCtx;
  }

  const KidAudio = {
    play(type) {
      if (!_kidState.soundEnabled) return;
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;

        if (type === 'click') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.06);
        } else if (type === 'pop') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.08);
        } else if (type === 'boing') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.linearRampToValueAtTime(620, now + 0.12);
          osc.frequency.exponentialRampToValueAtTime(340, now + 0.24);
          gain.gain.setValueAtTime(0.2, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.24);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.24);
        } else if (type === 'shutter') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(900, now);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.04);
        } else if (type === 'sparkle') {
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.06);
            gain.gain.setValueAtTime(0.12, now + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.06);
            osc.stop(now + i * 0.06 + 0.2);
          });
        } else if (type === 'break') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.linearRampToValueAtTime(140, now + 0.25);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.25);
        }
      } catch (e) {
        // Sound error handled safely
      }
    }
  };

  /* ── 5. WEB SPEECH NARRATION ── */
  function speakInstruction(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1.25;
      utter.volume = 0.9;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      // Speech failed silently
    }
  }

  /* ── 6. PULSEBOT EXPRESSION SWITCHER ── */
  function setPulseBotExpression(expr) {
    _kidState.pulsebotExpression = expr;
    const img = document.getElementById('pulsebot-sprite');
    if (!img) return;

    const valid = ['happy', 'surprised', 'worried', 'celebrating', 'thinking'];
    const chosen = valid.includes(expr) ? expr : 'happy';
    img.src = `assets/kids/pulsebot_${chosen}.png?v=202610250100`;
  }

  /* ── 7. RENDER & STAGE CONTROLLER ── */
  function setKidStage(stageIndex) {
    if (stageIndex < 0 || stageIndex >= STAGES.length) return;

    // Check if stage is unlocked (All stages unlocked in Free Lab)
    const isUnlocked = _kidState.unlockedStages[stageIndex] || _kidState.currentStage === 7;
    if (!isUnlocked && stageIndex !== 0) {
      KidAudio.play('boing');
      setPulseBotExpression('worried');
      return;
    }

    _kidState.currentStage = stageIndex;
    _kidState.isBroken = false;

    const viewport = document.getElementById('kids-stage-viewport');
    if (viewport) viewport.classList.toggle('stage-freelab', stageIndex === 7);

    // If entering Free Lab, unlock all stages
    if (stageIndex === 7) {
      for (let i = 0; i < STAGES.length; i++) {
        _kidState.unlockedStages[i] = true;
      }
    }

    const stage = STAGES[stageIndex];

    // 1. Update Stepper Badges & Status
    document.querySelectorAll('.kid-step-btn').forEach((btn, idx) => {
      const isCurrent = idx === stageIndex;
      const isFinished = _kidState.completedStages[idx];
      const isAvailable = _kidState.unlockedStages[idx] || stageIndex === 7;

      btn.classList.toggle('active', isCurrent);
      btn.classList.toggle('completed', isFinished);
      btn.classList.toggle('locked', !isAvailable);

      const badge = btn.querySelector('.step-status-badge');
      if (badge) {
        if (isFinished) {
          badge.textContent = '★';
          badge.style.display = 'flex';
        } else if (!isAvailable) {
          badge.textContent = '🔒';
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    });

    // 2. Update Instruction Banner (3-6 words max)
    const badgeEl = document.getElementById('instruction-badge');
    const textEl = document.getElementById('spoken-instruction-text');
    if (badgeEl) badgeEl.textContent = stage.badge;
    if (textEl) textEl.textContent = stage.voice;

    speakInstruction(stage.voice);

    // 3. Update Dynamic Background
    const bgLayer = document.getElementById('kids-bg-layer');
    if (bgLayer) {
      bgLayer.style.backgroundImage = `url('${stage.bg}')`;
    }

    // 4. Update Sprites Layout & Visibility
    const radar = document.getElementById('sprite-radar');
    const boyStanding = document.getElementById('sprite-boy-standing');
    const boySleeping = document.getElementById('sprite-boy-sleeping');
    const xrayBubble = document.getElementById('xray-bubble');
    const blenderDeck = document.getElementById('sprite-blender-deck');
    const strainerDeck = document.getElementById('sprite-strainer-deck');
    const cameraDeck = document.getElementById('sprite-camera-deck');
    const screen = document.getElementById('sprite-screen');
    const freelabScope = document.getElementById('freelab-scope-deck');
    const botDock = document.getElementById('kids-pulsebot-dock');

    // Default pulsebot corner
    if (botDock) {
      if (stageIndex === 7) {
        // Free Lab mascot at top-right
        botDock.style.left = 'auto';
        botDock.style.right = '60px';
        botDock.style.top = '20px';
      } else {
        botDock.style.left = '32px';
        botDock.style.right = 'auto';
        botDock.style.top = '24px';
      }
    }

    if (radar) {
      radar.style.display = (stageIndex === 0 || stageIndex === 2 || stageIndex === 7) ? 'block' : 'none';
      if (stageIndex === 7) {
        radar.style.left = '70px';
        radar.style.top = '204px';
        radar.style.width = '238px';
        radar.style.height = '290px';
      } else {
        radar.style.left = '100px';
        radar.style.top = '234px';
        radar.style.width = '213px';
        radar.style.height = '260px';
      }
    }

    if (boyStanding) {
      boyStanding.style.display = (stageIndex === 0 || stageIndex === 7) ? 'block' : 'none';
      if (stageIndex === 7) {
        _kidState.boyX = 680;
        boyStanding.style.left = '680px';
        boyStanding.style.top = '124px';
      } else {
        _kidState.boyX = 1050;
        boyStanding.style.left = '1050px';
        boyStanding.style.top = '124px';
      }
    }

    if (boySleeping) {
      boySleeping.style.display = (stageIndex === 1 || stageIndex === 2) ? 'block' : 'none';
      if (stageIndex === 2) {
        // In Stage 3, boy bed is on the right to receive wave
        boySleeping.style.left = '950px';
        boySleeping.style.transform = 'none';
      } else {
        // Stage 2: Center
        boySleeping.style.left = '50%';
        boySleeping.style.transform = 'translateX(-50%)';
      }
    }

    if (xrayBubble) xrayBubble.style.display = (stageIndex === 1) ? 'flex' : 'none';
    if (blenderDeck) blenderDeck.style.display = (stageIndex === 3) ? 'block' : 'none';
    if (strainerDeck) strainerDeck.style.display = (stageIndex === 4) ? 'block' : 'none';
    if (cameraDeck) cameraDeck.style.display = (stageIndex === 5) ? 'block' : 'none';
    if (screen) {
      screen.style.display = (stageIndex === 6 || stageIndex === 7) ? 'block' : 'none';
      if (stageIndex === 7) {
        screen.style.left = '1080px';
        screen.style.transform = 'none';
      } else {
        screen.style.left = '50%';
        screen.style.transform = 'translateX(-50%)';
      }
    }
    if (freelabScope) freelabScope.style.display = (stageIndex === 7) ? 'flex' : 'none';

    // 5. Update Controls Dock
    const ctrlDial = document.getElementById('ctrl-dial-deck');
    const ctrlSliders = document.getElementById('ctrl-sliders-deck');
    const ctrlBugs = document.getElementById('ctrl-bugs-deck');
    const ctrlCamera = document.getElementById('ctrl-camera-deck');
    const freelabTray = document.getElementById('freelab-tray-deck');

    if (ctrlDial) ctrlDial.style.display = (stageIndex === 0) ? 'flex' : 'none';
    if (ctrlSliders) ctrlSliders.style.display = (stageIndex === 1) ? 'flex' : 'none';
    if (ctrlBugs) ctrlBugs.style.display = (stageIndex === 3) ? 'flex' : 'none';
    if (ctrlCamera) ctrlCamera.style.display = (stageIndex === 5) ? 'flex' : 'none';
    if (freelabTray) freelabTray.style.display = (stageIndex === 7) ? 'flex' : 'none';

    // 6. Reset Fix/Break Buttons
    const btnBreak = document.getElementById('btn-kid-break');
    const btnFix = document.getElementById('btn-kid-fix');
    if (btnBreak) btnBreak.style.display = '';
    if (btnFix) btnFix.style.display = 'none';

    setPulseBotExpression('happy');
    KidAudio.play('click');
  }

  /* ── 8. CANVAS 2D RENDER LOOP ── */
  let _canvas = null;
  let _ctx = null;
  let _animId = null;
  let _tick = 0;

  function initCanvas() {
    _canvas = document.getElementById('kids-canvas');
    if (!_canvas) return;
    _ctx = _canvas.getContext('2d');
    _canvas.width = 1600;
    _canvas.height = 636;
  }

  function renderKidsLoop() {
    _tick++;
    if (_ctx && _canvas) {
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      const stage = _kidState.currentStage;

      if (stage === 0) {
        drawStage1Waves(_ctx, _canvas.width, _canvas.height, _tick);
      } else if (stage === 2) {
        drawStage3BouncyBall(_ctx, _canvas.width, _canvas.height, _tick);
      } else if (stage === 3) {
        drawStage4BlenderSquiggle(_tick);
      } else if (stage === 4) {
        drawStage5StrainerWaves(_tick);
      } else if (stage === 5) {
        drawStage6CameraSnapshots(_tick);
      } else if (stage === 7) {
        drawFreeLabSquiggle(_tick);
      }
    }

    _animId = requestAnimationFrame(renderKidsLoop);
  }

  /* Stage 1: Waves radiating from radar horn to boy */
  function drawStage1Waves(ctx, w, h, t) {
    const hornX = 313;
    const hornY = 324;
    const boyChestX = _kidState.boyX + 73;
    const boyChestY = 254;
    const dist = Math.max(80, boyChestX - hornX);

    const speedMult = _kidState.waveSpeed === 'quick' ? 3.5 : 1.8;
    const waveCount = _kidState.waveSpeed === 'quick' ? 8 : 5;

    ctx.save();
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    for (let i = 0; i < waveCount; i++) {
      const prog = ((t * speedMult + i * (dist / waveCount)) % dist) / dist;
      const arcR = prog * dist;
      const alpha = Math.sin(prog * Math.PI);

      ctx.strokeStyle = _kidState.isBroken
        ? `hsla(${(t * 4 + i * 40) % 360}, 85%, 60%, ${alpha})`
        : `rgba(56, 189, 248, ${alpha * 0.85})`;

      ctx.beginPath();
      ctx.arc(hornX, hornY, arcR, -Math.PI * 0.24, Math.PI * 0.24);
      ctx.stroke();
    }

    // Glow at radar horn
    const hornGlow = ctx.createRadialGradient(hornX, hornY, 4, hornX, hornY, 28);
    hornGlow.addColorStop(0, '#34D399');
    hornGlow.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = hornGlow;
    ctx.beginPath();
    ctx.arc(hornX, hornY, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* Stage 3: Glowing bouncy ball traveling radar -> chest -> back with squash & wiggle */
  function drawStage3BouncyBall(ctx, w, h, t) {
    const startX = 313;
    const startY = 324;
    const targetX = 1055;
    const targetY = 265;
    const dist = targetX - startX;

    // Ball cycle
    const cycle = (t * 0.04) % (Math.PI * 2);
    const norm = (Math.sin(cycle) + 1) / 2; // 0 to 1
    const ballX = startX + norm * dist;
    // Parabolic bounce arc
    const arcHeight = Math.abs(Math.sin(norm * Math.PI)) * 90;
    const ballY = startY + norm * (targetY - startY) - arcHeight;

    const isAtChest = norm > 0.92;
    const bedEl = document.getElementById('sprite-boy-sleeping');
    if (bedEl) {
      if (isAtChest) {
        bedEl.style.transform = 'scale(0.96, 1.04)';
      } else {
        bedEl.style.transform = 'scale(1, 1)';
      }
    }

    ctx.save();

    // Motion trail
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo((startX + targetX) / 2, startY - 100, targetX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing Bouncy Ball
    const grad = ctx.createRadialGradient(ballX, ballY, 4, ballX, ballY, 32);
    grad.addColorStop(0, '#FFFDF7');
    grad.addColorStop(0.4, '#FDE68A');
    grad.addColorStop(1, 'rgba(251, 113, 133, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ballX, ballY, 32, 0, Math.PI * 2);
    ctx.fill();

    // Solid ball core with squash on chest
    ctx.save();
    ctx.translate(ballX, ballY);
    if (isAtChest) {
      ctx.scale(1.4, 0.7); // Squash!
    }
    ctx.fillStyle = '#FB7185';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ball highlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-5, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Oscilloscope Wiggle Box at Bottom Center
    const scopeW = 420;
    const scopeH = 68;
    const scopeX = 590;
    const scopeY = 510;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(scopeX, scopeY, scopeW, scopeH, 18);
    ctx.fill();
    ctx.stroke();

    // Wiggle wave line
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = 0; x < scopeW; x += 4) {
      const freq = isAtChest ? 0.12 : 0.05;
      const amp = isAtChest ? 22 : 12;
      const y = Math.sin((x + t * 4) * freq) * amp;
      if (x === 0) ctx.moveTo(scopeX + x, scopeY + scopeH / 2 + y);
      else ctx.lineTo(scopeX + x, scopeY + scopeH / 2 + y);
    }
    ctx.stroke();

    ctx.restore();
  }

  /* Stage 4: Blender Scope Display (Canvas above blender) */
  function drawStage4BlenderSquiggle(t) {
    const c = document.getElementById('blender-scope-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    ctx.save();
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';

    const hasBugs = _kidState.bugsInBlender.length > 0;
    ctx.strokeStyle = hasBugs ? '#FB7185' : '#38BDF8';

    ctx.beginPath();
    for (let x = 0; x < c.width; x += 4) {
      let y = Math.sin((x + t * 4) * 0.05) * 16;
      if (hasBugs) {
        y += Math.sin((x * 2.5 + t * 12)) * 14 * _kidState.bugsInBlender.length;
      }
      if (x === 0) ctx.moveTo(x, c.height / 2 + y);
      else ctx.lineTo(x, c.height / 2 + y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* Stage 5: Strainer Scope Display */
  function drawStage5StrainerWaves(t) {
    const c = document.getElementById('strainer-scope-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    ctx.save();
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    const strainerXInCanvas = (_kidState.strainerX - 250);

    ctx.beginPath();
    for (let x = 0; x < c.width; x += 4) {
      const isPastStrainer = x > strainerXInCanvas;
      let y = Math.sin((x + t * 3) * 0.04) * 22;
      if (!isPastStrainer && !_kidState.strainedClean) {
        y += Math.sin((x * 2 + t * 10)) * 16; // bug noise
      }
      if (x === 0) ctx.moveTo(x, c.height / 2 + y);
      else ctx.lineTo(x, c.height / 2 + y);
    }
    ctx.strokeStyle = _kidState.strainedClean ? '#34D399' : '#FB7185';
    ctx.stroke();

    // If noise bugs falling below
    if (!_kidState.strainedClean) {
      ctx.font = '28px sans-serif';
      ctx.fillText('🌀', 200, c.height / 2 + 35 + Math.sin(t * 0.08) * 8);
      ctx.fillText('👟', 380, c.height / 2 + 40 + Math.cos(t * 0.08) * 8);
      ctx.fillText('📱', 560, c.height / 2 + 32 + Math.sin(t * 0.07) * 8);
    }
    ctx.restore();
  }

  /* Stage 6: Camera Scope Display */
  function drawStage6CameraSnapshots(t) {
    const c = document.getElementById('camera-scope-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    const step = Math.max(12, (52 - _kidState.cameraRate) * 2.2);

    ctx.save();
    // Continuous base line (faded)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 20; x <= c.width - 20; x += 4) {
      const y = Math.sin((x + t * 3) * 0.035) * 35;
      if (x === 20) ctx.moveTo(x, c.height / 2 + y);
      else ctx.lineTo(x, c.height / 2 + y);
    }
    ctx.stroke();

    // Sampled photo dots
    const dots = [];
    for (let x = 20; x <= c.width - 20; x += step) {
      const y = Math.sin((x + t * 3) * 0.035) * 35;
      dots.push({ x, y: c.height / 2 + y });
    }

    // Connect dots
    ctx.strokeStyle = _kidState.cameraRate < 15 ? '#FB7185' : '#38BDF8';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    dots.forEach((d, i) => {
      if (i === 0) ctx.moveTo(d.x, d.y);
      else ctx.lineTo(d.x, d.y);
    });
    ctx.stroke();

    // Draw camera snapshots
    dots.forEach(d => {
      ctx.fillStyle = '#FDE68A';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.restore();
  }

  /* Free Lab Small Squiggle Display */
  function drawFreeLabSquiggle(t) {
    const c = document.getElementById('freelab-scope-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    ctx.save();
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = 0; x < c.width; x += 4) {
      const y = Math.sin((x + t * 3) * 0.06) * 20;
      if (x === 0) ctx.moveTo(x, c.height / 2 + y);
      else ctx.lineTo(x, c.height / 2 + y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ── 9. CONFETTI CELEBRATION ── */
  let _confettiParticles = [];
  function launchConfetti() {
    const c = document.getElementById('kids-confetti-canvas');
    if (!c) return;
    c.width = 1600;
    c.height = 636;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    _confettiParticles = [];
    const colors = ['#FDE68A', '#38BDF8', '#FB7185', '#34D399', '#C084FC'];
    for (let i = 0; i < 90; i++) {
      _confettiParticles.push({
        x: 800,
        y: 300,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.7) * 20,
        size: Math.random() * 14 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vr: (Math.random() - 0.5) * 12,
        alpha: 1
      });
    }

    function animConfetti() {
      ctx.clearRect(0, 0, c.width, c.height);
      let alive = false;
      _confettiParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.5;
        p.rotation += p.vr;
        p.alpha -= 0.012;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          ctx.restore();
        }
      });

      if (alive) requestAnimationFrame(animConfetti);
      else ctx.clearRect(0, 0, c.width, c.height);
    }
    animConfetti();
  }

  /* ── 10. ATTACH DIRECT MANIPULATION HANDLERS ── */
  function setupDirectManipulation() {
    // Stage 1 & FreeLab: Draggable Boy
    const boyStanding = document.getElementById('sprite-boy-standing');
    if (boyStanding) {
      let dragStartX = 0;
      let initialBoyX = 1050;

      const onPointerDown = e => {
        _kidState.isDraggingBoy = true;
        const pos = getStagePointerPos(e);
        dragStartX = pos.x;
        initialBoyX = _kidState.boyX;
        setPulseBotExpression('thinking');
        KidAudio.play('pop');
        boyStanding.setPointerCapture?.(e.pointerId);
      };

      const onPointerMove = e => {
        if (!_kidState.isDraggingBoy) return;
        const pos = getStagePointerPos(e);
        const deltaX = pos.x - dragStartX;
        const minX = _kidState.currentStage === 7 ? 450 : 550;
        const maxX = _kidState.currentStage === 7 ? 880 : 1350;
        _kidState.boyX = Math.max(minX, Math.min(maxX, initialBoyX + deltaX));
        boyStanding.style.left = `${_kidState.boyX}px`;
      };

      const onPointerUp = () => {
        if (_kidState.isDraggingBoy) {
          _kidState.isDraggingBoy = false;
          setPulseBotExpression('happy');
          KidAudio.play('sparkle');
        }
      };

      boyStanding.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }

    // Stage 1: Wave Speed Choice Buttons
    const btnSlow = document.getElementById('btn-wave-slow');
    const btnFast = document.getElementById('btn-wave-fast');
    if (btnSlow && btnFast) {
      btnSlow.addEventListener('click', () => {
        _kidState.waveSpeed = 'gentle';
        btnSlow.classList.add('active');
        btnFast.classList.remove('active');
        KidAudio.play('click');
        setPulseBotExpression('happy');
      });
      btnFast.addEventListener('click', () => {
        _kidState.waveSpeed = 'quick';
        btnFast.classList.add('active');
        btnSlow.classList.remove('active');
        KidAudio.play('sparkle');
        setPulseBotExpression('thinking');
      });
    }

    // Stage 2: Sliders for Lungs & Heart
    const sliderLungs = document.getElementById('kid-slider-lungs');
    const sliderHeart = document.getElementById('kid-slider-heart');
    const xrayLungs = document.getElementById('xray-lungs');
    const xrayHeart = document.getElementById('xray-heart');

    if (sliderLungs) {
      sliderLungs.addEventListener('input', e => {
        _kidState.breathSpeed = parseInt(e.target.value, 10);
        if (xrayLungs) {
          const dur = 4.0 - (_kidState.breathSpeed / 100) * 2.8;
          xrayLungs.style.animationDuration = `${dur}s`;
        }
        KidAudio.play('click');
      });
    }

    if (sliderHeart) {
      sliderHeart.addEventListener('input', e => {
        _kidState.heartSpeed = parseInt(e.target.value, 10);
        if (xrayHeart) {
          const dur = 1.8 - (_kidState.heartSpeed / 100) * 1.3;
          xrayHeart.style.animationDuration = `${dur}s`;
        }
        KidAudio.play('pop');
      });
    }

    // Turtle/Rabbit buttons
    document.getElementById('btn-lung-slow')?.addEventListener('click', () => {
      if (sliderLungs) { sliderLungs.value = 20; sliderLungs.dispatchEvent(new Event('input')); }
    });
    document.getElementById('btn-lung-fast')?.addEventListener('click', () => {
      if (sliderLungs) { sliderLungs.value = 85; sliderLungs.dispatchEvent(new Event('input')); }
    });
    document.getElementById('btn-heart-slow')?.addEventListener('click', () => {
      if (sliderHeart) { sliderHeart.value = 20; sliderHeart.dispatchEvent(new Event('input')); }
    });
    document.getElementById('btn-heart-fast')?.addEventListener('click', () => {
      if (sliderHeart) { sliderHeart.value = 85; sliderHeart.dispatchEvent(new Event('input')); }
    });

    // Stage 4: Bug Buttons into Blender
    const addBug = bugName => {
      _kidState.bugsInBlender.push(bugName);
      const blender = document.getElementById('sprite-blender');
      if (blender) {
        blender.classList.add('blending');
        setTimeout(() => blender.classList.remove('blending'), 900);
      }
      setPulseBotExpression('surprised');
      KidAudio.play('boing');
    };

    document.getElementById('btn-bug-fan')?.addEventListener('click', () => addBug('fan'));
    document.getElementById('btn-bug-walk')?.addEventListener('click', () => addBug('walk'));
    document.getElementById('btn-bug-phone')?.addEventListener('click', () => addBug('phone'));

    // Free Lab Tray Bugs
    document.getElementById('tray-bug-fan')?.addEventListener('click', () => addBug('fan'));
    document.getElementById('tray-bug-walk')?.addEventListener('click', () => addBug('walk'));
    document.getElementById('tray-bug-phone')?.addEventListener('click', () => addBug('phone'));

    // Stage 5: Draggable Strainer
    const strainer = document.getElementById('sprite-strainer');
    if (strainer) {
      let sStartX = 0;
      let initialStrainerX = 700;

      strainer.addEventListener('pointerdown', e => {
        _kidState.isDraggingStrainer = true;
        const pos = getStagePointerPos(e);
        sStartX = pos.x;
        initialStrainerX = _kidState.strainerX;
        setPulseBotExpression('thinking');
        KidAudio.play('pop');
        strainer.setPointerCapture?.(e.pointerId);
      });

      window.addEventListener('pointermove', e => {
        if (!_kidState.isDraggingStrainer) return;
        const pos = getStagePointerPos(e);
        const deltaX = pos.x - sStartX;
        _kidState.strainerX = Math.max(300, Math.min(1050, initialStrainerX + deltaX));
        strainer.style.left = `${_kidState.strainerX}px`;

        if (_kidState.strainerX > 750 && !_kidState.strainedClean) {
          _kidState.strainedClean = true;
          setPulseBotExpression('celebrating');
          KidAudio.play('sparkle');
        }
      });

      window.addEventListener('pointerup', () => {
        _kidState.isDraggingStrainer = false;
      });
    }

    // Stage 6: Camera photo rate slider & Flash
    const sliderCam = document.getElementById('kid-slider-cam');
    const flashEl = document.getElementById('camera-flash');
    if (sliderCam) {
      sliderCam.addEventListener('input', e => {
        _kidState.cameraRate = parseInt(e.target.value, 10);
        KidAudio.play('shutter');
        if (flashEl) {
          flashEl.classList.add('flash-active');
          setTimeout(() => flashEl.classList.remove('flash-active'), 350);
        }
        if (_kidState.cameraRate < 15) {
          setPulseBotExpression('surprised');
        } else {
          setPulseBotExpression('happy');
        }
      });
    }

    // Navigation Buttons (Chunky bottom bar)
    document.getElementById('btn-kid-prev')?.addEventListener('click', () => {
      if (_kidState.currentStage > 0) setKidStage(_kidState.currentStage - 1);
    });

    document.getElementById('btn-kid-next')?.addEventListener('click', () => {
      _kidState.completedStages[_kidState.currentStage] = true;
      if (_kidState.currentStage + 1 < STAGES.length) {
        _kidState.unlockedStages[_kidState.currentStage + 1] = true;
        launchConfetti();
        KidAudio.play('sparkle');
        setPulseBotExpression('celebrating');
        setTimeout(() => setKidStage(_kidState.currentStage + 1), 600);
      } else {
        launchConfetti();
        KidAudio.play('sparkle');
        setPulseBotExpression('celebrating');
        openStickerBook();
      }
    });

    // Top Bar Stepper buttons
    document.querySelectorAll('.kid-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const stageIdx = parseInt(btn.dataset.stage, 10);
        setKidStage(stageIdx);
      });
    });

    // Replay Voice Button
    document.getElementById('btn-replay-voice')?.addEventListener('click', () => {
      KidAudio.play('click');
      speakInstruction(STAGES[_kidState.currentStage].voice);
    });

    // Funny Break It & Fix It
    const btnBreak = document.getElementById('btn-kid-break');
    const btnFix = document.getElementById('btn-kid-fix');

    if (btnBreak && btnFix) {
      btnBreak.addEventListener('click', () => {
        _kidState.isBroken = true;
        btnBreak.style.display = 'none';
        btnFix.style.display = 'inline-flex';
        setPulseBotExpression('worried');
        KidAudio.play('break');

        if (_kidState.currentStage === 3) {
          _kidState.bugsInBlender = ['fan', 'walk', 'phone'];
        }
      });

      btnFix.addEventListener('click', () => {
        _kidState.isBroken = false;
        btnFix.style.display = 'none';
        btnBreak.style.display = 'inline-flex';
        _kidState.bugsInBlender = [];
        _kidState.strainedClean = true;
        setPulseBotExpression('celebrating');
        KidAudio.play('sparkle');
        launchConfetti();
      });

      document.getElementById('btn-freelab-break')?.addEventListener('click', () => {
        btnBreak.click();
      });

      document.getElementById('freelab-slider-lungs')?.addEventListener('input', e => {
        _kidState.breathSpeed = parseInt(e.target.value, 10);
        const bellyLungs = document.querySelector('.belly-lungs-img');
        if (bellyLungs) {
          bellyLungs.style.animationDuration = `${4.0 - (_kidState.breathSpeed / 100) * 2.8}s`;
        }
        KidAudio.play('click');
      });

      document.getElementById('freelab-slider-heart')?.addEventListener('input', e => {
        _kidState.heartSpeed = parseInt(e.target.value, 10);
        const bellyHearts = document.querySelectorAll('.heart-pulse-icon');
        bellyHearts.forEach(h => {
          h.style.animationDuration = `${1.8 - (_kidState.heartSpeed / 100) * 1.3}s`;
        });
        KidAudio.play('pop');
      });

      document.getElementById('freelab-slider-cam')?.addEventListener('input', e => {
        _kidState.cameraRate = parseInt(e.target.value, 10);
        KidAudio.play('shutter');
      });
    }

    // Parent Gate: 3-Second Hold
    const parentTrigger = document.getElementById('parent-gate-trigger');
    const parentModal = document.getElementById('parent-gate-modal');
    if (parentTrigger && parentModal) {
      let holdTimer = null;

      const startHold = () => {
        parentTrigger.classList.add('holding');
        holdTimer = setTimeout(() => {
          parentTrigger.classList.remove('holding');
          parentModal.removeAttribute('hidden');
          KidAudio.play('pop');
        }, 3000);
      };

      const cancelHold = () => {
        parentTrigger.classList.remove('holding');
        if (holdTimer) clearTimeout(holdTimer);
      };

      parentTrigger.addEventListener('mousedown', startHold);
      parentTrigger.addEventListener('touchstart', startHold);
      parentTrigger.addEventListener('mouseup', cancelHold);
      parentTrigger.addEventListener('mouseleave', cancelHold);
      parentTrigger.addEventListener('touchend', cancelHold);

      document.getElementById('btn-close-parent-gate')?.addEventListener('click', () => {
        parentModal.setAttribute('hidden', '');
      });
      document.getElementById('btn-gate-stay')?.addEventListener('click', () => {
        parentModal.setAttribute('hidden', '');
      });
      document.getElementById('btn-gate-sci')?.addEventListener('click', () => {
        parentModal.setAttribute('hidden', '');
        if (typeof setView === 'function') setView('sci');
      });
      document.getElementById('btn-gate-home')?.addEventListener('click', () => {
        parentModal.setAttribute('hidden', '');
        if (typeof setView === 'function') setView('landing');
      });
    }

    // Sticker Book Modal
    const stickerModal = document.getElementById('sticker-book-modal');
    document.getElementById('btn-open-stickers')?.addEventListener('click', openStickerBook);
    document.getElementById('btn-close-stickers')?.addEventListener('click', () => {
      if (stickerModal) stickerModal.setAttribute('hidden', '');
    });

    // Home button in top bar
    document.getElementById('btn-kid-home')?.addEventListener('click', () => {
      KidAudio.play('click');
      if (typeof setView === 'function') setView('landing');
    });

    // PulseBot tap reaction
    document.getElementById('kids-pulsebot-dock')?.addEventListener('click', () => {
      const expressions = ['happy', 'surprised', 'thinking', 'celebrating'];
      const next = expressions[Math.floor(Math.random() * expressions.length)];
      setPulseBotExpression(next);
      KidAudio.play('pop');
    });
  }

  function openStickerBook() {
    const stickerModal = document.getElementById('sticker-book-modal');
    const grid = document.getElementById('stickers-album-grid');
    if (!stickerModal || !grid) return;

    grid.innerHTML = '';
    STAGES.forEach((s, idx) => {
      const isDone = _kidState.completedStages[idx];
      const slot = document.createElement('div');
      slot.className = `sticker-slot ${isDone ? 'unlocked' : ''}`;
      slot.innerHTML = `
        <div style="font-size: 38px;">${isDone ? s.badge : '🔒'}</div>
        <span>${isDone ? s.stickerName : 'Locked'}</span>
      `;
      grid.appendChild(slot);
    });

    stickerModal.removeAttribute('hidden');
    KidAudio.play('sparkle');
  }

  /* ── 11. LIFECYCLE HOOKS (Router Integration) ── */
  window.onKidsActivate = function () {
    updateStageScale();
    initCanvas();
    setKidStage(_kidState.currentStage);
    if (!_animId) renderKidsLoop();
  };

  window.onKidsDeactivate = function () {
    if (_animId) {
      cancelAnimationFrame(_animId);
      _animId = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  };

  window.kidNextStage = function () {
    if (_kidState.currentStage < STAGES.length - 1) setKidStage(_kidState.currentStage + 1);
  };
  window.kidPrevStage = function () {
    if (_kidState.currentStage > 0) setKidStage(_kidState.currentStage - 1);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupDirectManipulation();
    });
  } else {
    setupDirectManipulation();
  }
})();
