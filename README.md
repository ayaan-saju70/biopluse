# BioPulse Data — Contactless Vital-Sign Radar

An interactive, multi-mode vital sign radar visualization and simulation application built with WebGL (Three.js), modern CSS, and vanilla JavaScript.

## Project Structure

```
biopluse/
├── biopulse/                        # Main BioPulse Application Folder
│   ├── index.html                   # Core single-page application (3D Landing, Scientific, Kids)
│   ├── css/
│   │   ├── base.css                 # Global tokens, reset, typography, and dark theme
│   │   ├── landing.css              # 3D interactive landing page styling
│   │   ├── scientific.css           # Mission-control scientific mode styling
│   │   └── kids.css                 # Fixed 1600x900 scaled virtual stage Kids Mode
│   ├── js/
│   │   ├── landing.js               # Three.js 3D anatomy hologram & procedural scene
│   │   ├── scientific.js            # Signal processing, scopes, FFT, and instrument HUD
│   │   ├── kids.js                  # 2D sprite direct manipulation engine & web audio
│   │   ├── router.js                # View switching & URL hash routing (#landing, #sci, #kids)
│   │   ├── sim.js                   # Doppler physics simulation engine
│   │   └── vendor/
│   │       ├── three.min.js         # Three.js (r128)
│   │       └── GLTFLoader.js        # GLTF/GLB loader
│   ├── models/
│   │   ├── biopulse_anatomy.glb     # 3D anatomical model (BodyParts3D CC BY 4.0)
│   │   ├── biopulse_anatomy_embedded.js # Base64 embedded model fallback
│   │   └── ATTRIBUTION.md           # Model licensing & attribution
│   ├── assets/
│   │   └── kids/                    # Illustrated sprite cutouts (radar, organs, mascot, backgrounds)
│   ├── fonts/                       # Local web fonts
│   └── tools/
│       └── cutout.py                # Asset cutout tool for transparency trimming
├── index.html                       # Root launcher / redirect
├── .gitignore
└── README.md
```

## Features

### 1. 3D Anatomical Landing View
- Real-time 3D fresnel hologram human anatomy model (ribs, lungs, heart, vascular tree).
- Animated cardiac contractions and thoracic respiratory expansion.
- Continuous 10.525 GHz microwave radar beam with Doppler phase shift callouts.
- Responsive orbit navigation and live vitals HUD stats.

### 2. Scientific Mission-Control Mode
- Full instrument workbench linking the 3D anatomical scene with live physics oscilloscopes.
- 7 progressive RF signal processing stages:
  1. Transmitter & Free-Space Wave
  2. Anatomical Reflection & Chest Wall Micro-Displacements
  3. Demodulation / Direct Conversion Quadrature Mixer (I/Q)
  4. Analog Signal Conditioning & Active Bandpass Filtering
  5. Analog-to-Digital Sampling & Nyquist Discretization
  6. Phase Demodulation & DC-Offset Cancellation
  7. Discrete Fourier Transform (FFT) & Harmonic Vital-Sign Separation
- Presenter Mode (`P`), low-power eco mode, and live interactive sliders.

### 3. Kids Mode (Ages 4-8)
- Built on a fixed $1600 \times 900$ virtual stage with CSS transform uniform scaling (never scrolls, perfectly letterboxed across desktop, iPad landscape, and mobile portrait).
- Cutout illustrated 2D sprite characters (radar machine, PulseBot mascot, friendly smoothie blender, magic strainer sieve, toy camera, robot screen monitor).
- Touch and mouse direct manipulation (drag the boy along the floor line, drag strainer, tap bugs into blender, turtle-rabbit animal sliders).
- Synthesized Web Audio effects (boing, pop, sparkle, shutter) and Web Speech API spoken narration.
- Free Lab playground with a docked toy tray and sticker book album.

## Running Locally

To run the application locally using any standard static file server:

```bash
# Using Python
python -m http.server 8088

# Open in browser:
# http://127.0.0.1:8088/biopulse/index.html
```
