/* ═══════════════════════════════════════════════════════════
   router.js — View switching, browser history, keyboard nav
   Depends on: nothing (loads first after sim.js)
════════════════════════════════════════════════════════════ */
'use strict';

/** Currently active view id ('landing' | 'sci' | 'kids') */
let _currentView = 'landing';

/**
 * Activate a view by name. Updates DOM, history, and ARIA.
 * @param {string} name - 'landing' | 'sci' | 'kids'
 * @param {boolean} [push=true] - push to history stack
 */
function setView(name, push = true) {
  const targetViewEl = document.getElementById('view-' + name);
  if (name === _currentView && targetViewEl && targetViewEl.classList.contains('active')) return;
  const prevView = _currentView;
  _currentView = name;
  document.body.dataset.view = name;

  // Show/hide views strictly
  document.querySelectorAll('.view').forEach(el => {
    const isTarget = el.id === 'view-' + name;
    if (isTarget) {
      el.removeAttribute('hidden');
      el.classList.add('active');
      el.setAttribute('aria-hidden', 'false');
    } else {
      el.classList.remove('active');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('hidden', '');
    }
  });

  // Update mode pill active state
  const navSci = document.getElementById('nav-sci');
  const navKids = document.getElementById('nav-kids');
  if (navSci) {
    navSci.setAttribute('aria-pressed', name === 'sci' ? 'true' : 'false');
    navSci.classList.toggle('active', name === 'sci');
  }
  if (navKids) {
    navKids.setAttribute('aria-pressed', name === 'kids' ? 'true' : 'false');
    navKids.classList.toggle('active', name === 'kids');
  }

  // Manage Shared 3D WebGL Host & Render Loop
  const sharedHost = document.getElementById('shared-3d-host');
  if (name === 'kids') {
    if (sharedHost) sharedHost.style.display = 'none';
    if (window.BioPulse3D) window.BioPulse3D.deactivate();
  } else {
    if (sharedHost) sharedHost.style.display = '';
    if (window.BioPulse3D) {
      window.BioPulse3D.activate();
      requestAnimationFrame(() => window.BioPulse3D.resize());
    }
  }

  // Mode deactivation hooks
  if (prevView === 'kids' && name !== 'kids' && typeof onKidsDeactivate === 'function') onKidsDeactivate();
  if (prevView === 'sci' && name !== 'sci' && typeof onSciDeactivate === 'function') onSciDeactivate();

  // Mode activation hooks
  if (name === 'sci' && typeof onSciActivate === 'function') onSciActivate();
  if (name === 'kids' && typeof onKidsActivate === 'function') onKidsActivate();
  if (name === 'landing' && typeof onLandingActivate === 'function') onLandingActivate();

  // Audio click feedback
  if (typeof sfxClick === 'function') sfxClick();

  // History
  if (push) history.pushState({ view: name }, '', '#' + name);
}

/** Read the hash on load to restore deep links */
function initRouterFromHash() {
  const hash = location.hash.replace('#', '');
  const valid = ['landing', 'sci', 'kids'];
  setView(valid.includes(hash) ? hash : 'landing', false);
}

/* ── Browser back/forward ── */
window.addEventListener('popstate', e => {
  const hash = location.hash.replace('#', '');
  const v = (e.state && e.state.view) || hash || 'landing';
  const valid = ['landing', 'sci', 'kids'];
  setView(valid.includes(v) ? v : 'landing', false);
});

/* ── Keyboard shortcuts ── */
window.addEventListener('keydown', e => {
  // Escape key handler:
  // In Kids Mode it must NOT leave the mode (use Home or parent gate).
  // In Scientific Mode keep it, but exit presenter mode first if active.
  if (e.key === 'Escape') {
    if (_currentView === 'kids') {
      return; // Do NOT leave Kids Mode on Escape!
    }
    if (_currentView === 'sci') {
      if (typeof isSciPresenterActive === 'function' && isSciPresenterActive()) {
        toggleSciPresenter(false);
        return;
      }
      setView('landing');
      return;
    }
    return;
  }

  // Arrow & space shortcuts
  if (_currentView === 'sci') {
    if ((e.key === 'p' || e.key === 'P') && typeof toggleSciPresenter === 'function') {
      toggleSciPresenter();
    }
    if (e.key === 'ArrowRight' && typeof sciNextStage === 'function') sciNextStage();
    if (e.key === 'ArrowLeft'  && typeof sciPrevStage === 'function') sciPrevStage();
    if ((e.key === ' ' || e.code === 'Space') && typeof sciTogglePause === 'function') {
      e.preventDefault(); sciTogglePause();
    }
  }
  if (_currentView === 'kids') {
    if (e.key === 'ArrowRight' && typeof kidNextStage === 'function') kidNextStage();
    if (e.key === 'ArrowLeft'  && typeof kidPrevStage === 'function') kidPrevStage();
  }
});

/* ── Navbar wiring ── */
document.getElementById('btn-home').addEventListener('click', () => setView('landing'));
document.getElementById('nav-sci').addEventListener('click', () => setView('sci'));
document.getElementById('nav-kids').addEventListener('click', () => setView('kids'));

/* ── Landing card wiring ── */
document.getElementById('card-sci').addEventListener('click',  () => setView('sci'));
document.getElementById('card-kids').addEventListener('click', () => setView('kids'));
// Keyboard-accessible card activation
['card-sci', 'card-kids'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click();
  });
});

/* ── Sound toggle ── */
let _soundMuted = false;
document.getElementById('btn-sound').addEventListener('click', () => {
  _soundMuted = !_soundMuted;
  document.getElementById('sound-ico').textContent = _soundMuted ? '🔇' : '🔊';
  if (typeof setSimMuted === 'function') setSimMuted(_soundMuted);
});

/* ── Low power eco toggle ── */
let _lowPower = false;
function isLowPowerMode() { return _lowPower; }
document.getElementById('btn-power')?.addEventListener('click', () => {
  _lowPower = !_lowPower;
  document.body.classList.toggle('low-power', _lowPower);
  document.getElementById('power-ico').textContent = _lowPower ? '🌱' : '🔋';
  document.getElementById('btn-power').title = _lowPower ? 'Eco Mode Active (30 FPS)' : 'Toggle Low-Power Eco Mode';
  if (typeof sfxClick === 'function') sfxClick();
});

/* ── Boot ── */
// Set initial history state then resolve view from hash
history.replaceState({ view: 'landing' }, '', '#landing');
initRouterFromHash();
