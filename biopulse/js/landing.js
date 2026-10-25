/* ═══════════════════════════════════════════════════════════
   landing.js — Real 3D Micro-Doppler Radar Hero Scene
   Three.js r128 (Local Bundle) • Procedural Shaders & Holograms
   Full Implementation: Hologram Human, Radar, Waves, Rail, OLED,
   Callouts, Tooltips, Guided Tour & Quality Engine
════════════════════════════════════════════════════════════ */
'use strict';

(function() {
  if (typeof THREE === 'undefined') {
    console.error('Three.js failed to load. Check js/vendor/three.min.js');
    return;
  }

  /* ── Core Three.js Globals ── */
  let scene, camera, renderer, clock;
  let canvasEl, calloutsLayerEl, tooltipEl;
  let animId = null;
  let isSceneActive = false;
  let raycaster, mouseVec;

  // Scene root & groups
  let mainSceneGroup;
  let humanGroup, radarGroup, waveGroup, chainGroup, bedGroup;
  let lungsMesh, heartMesh, chestRulerMesh;
  let oledTexture, oledCanvas, oledCtx;

  // Pose state
  let isSupine = false;
  let currentPoseProgress = 0; // 0 = standing, 1 = bed supine

  // Tinting & Quality
  const colorCyan = new THREE.Color(0x00f3ff);
  const colorCoral = new THREE.Color(0xff5e43);
  const colorAmber = new THREE.Color(0xf59e0b);
  let targetSceneTint = new THREE.Color(0x00f3ff);
  let currentSceneTint = new THREE.Color(0x00f3ff);
  let keyLight, rimLight, waveTintUniform;

  let fpsHistory = [];
  let lastFpsCheck = performance.now();
  let frameCount = 0;
  let isLowQuality = false;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Custom Orbit Controller (Closer Framing, Chest Centered) ── */
  const orbit = {
    target: new THREE.Vector3(0.08, 1.25, 0.04),
    radius: 2.25,
    targetRadius: 2.25,
    minRadius: 1.4,
    maxRadius: 4.8,
    theta: 0.25,
    targetTheta: 0.25,
    minTheta: -0.9,
    maxTheta: 0.9,
    phi: 0.10,
    targetPhi: 0.10,
    minPhi: -0.05,
    maxPhi: 0.75,
    isDragging: false,
    prevX: 0,
    prevY: 0,
    damping: 0.08,
    idleDrift: 0,
    isTouring: false
  };

  /* ── Guided Tour Stops ── */
  const tourStops = [
    {
      title: "10.525 GHz Radar Transceiver",
      caption: "Direct-conversion microwave horn emits a continuous 10.525 GHz RF carrier beam toward the subject.",
      target: new THREE.Vector3(-0.25, 1.30, 0.08),
      theta: 0.42,
      phi: 0.14,
      radius: 1.7,
      duration: 4.5
    },
    {
      title: "Chest & Holographic Thorax",
      caption: "Sub-millimeter thoracic wall movement and arterial pulsation induce micro-Doppler phase modulation.",
      target: new THREE.Vector3(0.72, 1.30, 0.05),
      theta: 0.22,
      phi: 0.10,
      radius: 1.6,
      duration: 4.5
    },
    {
      title: "Reflected Phase-Shifted Echo",
      caption: "The returned microwave echo experiences a phase shift: ΔΦ = 4π·Δx / λ, carrying cardiopulmonary dynamics.",
      target: new THREE.Vector3(0.20, 1.30, 0.06),
      theta: 0.02,
      phi: 0.20,
      radius: 2.4,
      duration: 4.5
    },
    {
      title: "Hardware Signal Chain Rail",
      caption: "Mixer downconverts RF to baseband; 0.1-3 Hz active bandpass filter removes environmental clutter.",
      target: new THREE.Vector3(0.20, 0.08, 0.25),
      theta: 0.15,
      phi: 0.30,
      radius: 2.0,
      duration: 4.5
    },
    {
      title: "In-Scene OLED Spectrum & BPM",
      caption: "ADC samples filtered signals at 50 Hz; real-time peak and FFT algorithms isolate true 72 BPM vitals.",
      target: new THREE.Vector3(0.68, 0.22, 0.35),
      theta: 0.32,
      phi: 0.20,
      radius: 1.6,
      duration: 4.5
    }
  ];
  let currentTourIdx = -1;
  let tourTimer = null;

  /* ── 3D Callout Points (Stacked Column on Right Side of Body) ── */
  let currentRealDispMm = 0;
  const calloutDefs = [
    {
      id: 'transceiver',
      name: 'Transceiver',
      getPos: () => {
        if (humanGroup) {
          const wp = new THREE.Vector3();
          humanGroup.getWorldPosition(wp);
          wp.x += 0.08;
          wp.y = 1.35;
          wp.z = 0.14;
          return wp;
        }
        return new THREE.Vector3(0.80, 1.35, 0.14);
      },
      value: () => '10.525 GHz'
    },
    {
      id: 'chest',
      name: 'Thoracic Wall',
      getPos: () => {
        if (anatomyNodes.ribcage) {
          const wp = new THREE.Vector3();
          anatomyNodes.ribcage.getWorldPosition(wp);
          wp.x += 0.08;
          wp.y += 0.02;
          wp.z += 0.10;
          return wp;
        }
        return new THREE.Vector3(0.80, 1.30, 0.10);
      },
      value: () => `Displ: ${currentRealDispMm.toFixed(1)} mm (10×)`
    },
    {
      id: 'lungs',
      name: 'Respiration',
      getPos: () => {
        if (anatomyNodes.lung_left_pivot) {
          const wp = new THREE.Vector3();
          anatomyNodes.lung_left_pivot.getWorldPosition(wp);
          wp.x += 0.09;
          wp.y -= 0.05;
          wp.z += 0.05;
          return wp;
        }
        return new THREE.Vector3(0.81, 1.25, 0.05);
      },
      value: () => `${typeof S !== 'undefined' ? S.respRPM || 15 : 15} /min`
    },
    {
      id: 'heart',
      name: 'Cardiac Apex',
      coral: true,
      getPos: () => {
        if (anatomyNodes.heart_pivot) {
          const wp = new THREE.Vector3();
          anatomyNodes.heart_pivot.getWorldPosition(wp);
          wp.x += 0.06;
          wp.y += 0.01;
          wp.z += 0.07;
          return wp;
        }
        return new THREE.Vector3(0.78, 1.20, 0.07);
      },
      value: () => `${typeof S !== 'undefined' ? S.bpm || 72 : 72} BPM`
    }
  ];

  /* ── Hologram Fresnel Shader ── */
  const HologramShader = {
    uniforms: {
      uColor: { value: new THREE.Color(0x00f3ff) },
      uTime: { value: 0 },
      uOpacity: { value: 0.55 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);
        float scanline = sin(vWorldPosition.y * 95.0 - uTime * 2.0) * 0.06 + 0.94;
        vec3 col = uColor * (fresnel * 2.2 + 0.04) * scanline;
        float alpha = clamp((fresnel * 0.55 + 0.02) * uOpacity, 0.0, 0.85);
        gl_FragColor = vec4(col, alpha);
      }
    `
  };

  /* ═══════════════════════════════════════════════════════════
     1. INITIALIZATION & SETUP
  ════════════════════════════════════════════════════════════ */
  function init() {
    canvasEl = document.getElementById('landing-3d-canvas');
    calloutsLayerEl = document.getElementById('landing-callouts');
    tooltipEl = document.getElementById('organ-tooltip');
    if (!canvasEl) return;

    clock = new THREE.Clock();
    raycaster = new THREE.Raycaster();
    mouseVec = new THREE.Vector2();

    // Scene & Fog
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02050e);
    scene.fog = new THREE.FogExp2(0x02050e, 0.1);

    // Camera
    const aspect = canvasEl.clientWidth / Math.max(canvasEl.clientHeight, 1);
    camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 50);
    updateCamera();

    // Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight, false);
    renderer.outputEncoding = THREE.sRGBEncoding;

    // Lighting
    const ambient = new THREE.AmbientLight(0x07152d, 1.2);
    scene.add(ambient);

    keyLight = new THREE.DirectionalLight(0x00f3ff, 1.4);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    rimLight = new THREE.DirectionalLight(0xff5e43, 0.85);
    rimLight.position.set(-3, -2, -3);
    scene.add(rimLight);

    // Engineering Ground Grid
    const grid = new THREE.GridHelper(12, 32, 0x00f3ff, 0x091b36);
    grid.position.y = 0;
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    // Main Group
    mainSceneGroup = new THREE.Group();
    scene.add(mainSceneGroup);

    // Build Sub-Scenes
    buildRadarUnit();
    buildWaveField();
    buildSignalChainAndOLED();
    buildBedUnit();
    buildHumanAnatomy();

    // Controls & Listeners
    setupOrbitEvents();
    setupUIControls();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Start
    isSceneActive = true;
    lastFpsCheck = performance.now();
    renderLoop();
  }

  /* ═══════════════════════════════════════════════════════════
     2. BIOPULSE ANATOMY MODEL LOADER & RIGGING
     Step 1: Load and position skin only
  ════════════════════════════════════════════════════════════ */
  let anatomyNodes = {};
  let isAnatomyLoaded = false;

  function updateLoadBar(percent) {
    const bar = document.getElementById('landing-load-bar');
    const fill = document.getElementById('landing-load-progress');
    if (!bar || !fill) return;
    bar.hidden = false;
    fill.style.width = Math.min(100, Math.max(0, percent)) + '%';
    if (percent >= 100) {
      setTimeout(() => {
        bar.classList.add('done');
        setTimeout(() => { bar.hidden = true; }, 400);
      }, 300);
    }
  }

  function decodeBase64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function buildHumanAnatomy() {
    humanGroup = new THREE.Group();
    // Position human on ground (y=0) at x=0.72 in three-quarter view
    humanGroup.position.set(0.72, 0, 0);
    humanGroup.rotation.y = -Math.PI * 0.35;
    mainSceneGroup.add(humanGroup);

    updateLoadBar(15);

    if (typeof THREE.GLTFLoader === 'undefined') {
      console.warn('GLTFLoader not loaded, keeping procedural human');
      buildProceduralFallback();
      return;
    }

    const loader = new THREE.GLTFLoader();

    function onGltfParsed(gltf) {
      updateLoadBar(100);
      setupAnatomyModel(gltf.scene);
    }

    function onGltfError(err) {
      console.warn('GLTF load failed, trying embedded base64...', err);
      tryEmbeddedBase64();
    }

    function tryEmbeddedBase64() {
      if (typeof window.BIOPULSE_ANATOMY_B64 === 'string' && window.BIOPULSE_ANATOMY_B64.length > 100) {
        try {
          updateLoadBar(50);
          const buffer = decodeBase64ToArrayBuffer(window.BIOPULSE_ANATOMY_B64);
          loader.parse(buffer, '', (gltf) => {
            onGltfParsed(gltf);
          }, (parseErr) => {
            console.error('Embedded base64 parse failed:', parseErr);
            buildProceduralFallback();
          });
        } catch (e) {
          console.error('Base64 decode error:', e);
          buildProceduralFallback();
        }
      } else {
        console.error('No embedded anatomy base64 found.');
        buildProceduralFallback();
      }
    }

    // HTTP vs File Protocol Handling
    if (location.protocol.startsWith('http')) {
      loader.load('models/biopulse_anatomy.glb', (gltf) => {
        onGltfParsed(gltf);
      }, (xhr) => {
        if (xhr.total > 0) {
          updateLoadBar(Math.round((xhr.loaded / xhr.total) * 90));
        }
      }, onGltfError);
    } else {
      tryEmbeddedBase64();
    }
  }

  function setupAnatomyModel(modelScene) {
    isAnatomyLoaded = true;

    // Cache all nodes specified in README.md
    const nodeNames = [
      'body_skin', 'ribcage', 'spine', 'diaphragm', 'trachea',
      'heart_pivot', 'heart_muscle', 'heart_vessels',
      'lung_left_pivot', 'lung_left_surface', 'bronchi_left',
      'lung_right_pivot', 'lung_right_surface', 'bronchi_right'
    ];

    nodeNames.forEach(name => {
      const obj = modelScene.getObjectByName(name);
      if (obj) {
        anatomyNodes[name] = obj;
        obj.frustumCulled = true;
      }
    });

    // 1. Hologram Fresnel Shader for body_skin (Translucent, additive edge glow, never opaque)
    const holoMat = new THREE.ShaderMaterial({
      vertexShader: HologramShader.vertexShader,
      fragmentShader: HologramShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(HologramShader.uniforms),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    holoMat.uniforms.uColor.value.set(colorCyan);
    holoMat.uniforms.uOpacity.value = 0.35; // Translucent so internal organs are crystal clear

    if (anatomyNodes.body_skin) {
      anatomyNodes.body_skin.material = holoMat;
      anatomyNodes.body_skin.renderOrder = 10;
      anatomyNodes.body_skin.visible = true;
    }

    // 2. Ribcage & Spine: thin cyan-white, low opacity (spine hidden by default for >50 FPS)
    const ribMat = new THREE.MeshStandardMaterial({
      color: 0xd8f8ff,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.25,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.FrontSide
    });
    if (anatomyNodes.ribcage) {
      anatomyNodes.ribcage.material = ribMat;
      anatomyNodes.ribcage.renderOrder = 2;
      anatomyNodes.ribcage.visible = true;
    }

    const spineMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.15,
      roughness: 0.5,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });
    if (anatomyNodes.spine) {
      anatomyNodes.spine.material = spineMat;
      anatomyNodes.spine.renderOrder = 1;
      // Hidden by default for integrated GPU performance (unhidden in Ribcage X-ray mode)
      anatomyNodes.spine.visible = false;
    }

    // 3. Lungs (lung_*_surface): soft blue, translucent, with a gentle rim light
    const lungMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.1,
      transparent: true,
      opacity: 0.50,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    if (anatomyNodes.lung_left_surface) {
      anatomyNodes.lung_left_surface.material = lungMat;
      anatomyNodes.lung_left_surface.renderOrder = 3;
      anatomyNodes.lung_left_surface.visible = true;
    }
    if (anatomyNodes.lung_right_surface) {
      anatomyNodes.lung_right_surface.material = lungMat;
      anatomyNodes.lung_right_surface.renderOrder = 3;
      anatomyNodes.lung_right_surface.visible = true;
    }
    if (anatomyNodes.lung_left_pivot) anatomyNodes.lung_left_pivot.visible = true;
    if (anatomyNodes.lung_right_pivot) anatomyNodes.lung_right_pivot.visible = true;

    // 4. Airways: Bronchi & Trachea: brighter cyan so the airway tree reads clearly inside lungs
    const airwayMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    if (anatomyNodes.bronchi_left) {
      anatomyNodes.bronchi_left.material = airwayMat;
      anatomyNodes.bronchi_left.renderOrder = 4;
      anatomyNodes.bronchi_left.visible = true;
    }
    if (anatomyNodes.bronchi_right) {
      anatomyNodes.bronchi_right.material = airwayMat;
      anatomyNodes.bronchi_right.renderOrder = 4;
      anatomyNodes.bronchi_right.visible = true;
    }
    if (anatomyNodes.trachea) {
      anatomyNodes.trachea.material = airwayMat;
      anatomyNodes.trachea.renderOrder = 4;
      anatomyNodes.trachea.visible = true;
    }

    // 5. Heart: Muscle (deep red with warm emissive glow) and Vessels (coral)
    const heartMuscleMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xe11d48,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    if (anatomyNodes.heart_muscle) {
      anatomyNodes.heart_muscle.material = heartMuscleMat;
      anatomyNodes.heart_muscle.renderOrder = 5;
      anatomyNodes.heart_muscle.visible = true;
    }

    const heartVesselsMat = new THREE.MeshStandardMaterial({
      color: 0xff5e43,
      emissive: 0xff5e43,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 0.90,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    if (anatomyNodes.heart_vessels) {
      anatomyNodes.heart_vessels.material = heartVesselsMat;
      anatomyNodes.heart_vessels.renderOrder = 6;
      anatomyNodes.heart_vessels.visible = true;
    }
    if (anatomyNodes.heart_pivot) anatomyNodes.heart_pivot.visible = true;

    // 6. Diaphragm: soft translucent dome
    const diaphragmMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.15,
      roughness: 0.5,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    if (anatomyNodes.diaphragm) {
      anatomyNodes.diaphragm.material = diaphragmMat;
      anatomyNodes.diaphragm.renderOrder = 2;
      anatomyNodes.diaphragm.visible = true;
    }

    // Add model to human group
    humanGroup.add(modelScene);

    // Honest Chest Displacement Scale Ruler (Real: 0..8 mm breathing + 0.35 mm heart, drawn 10x)
    chestRulerMesh = new THREE.Group();
    chestRulerMesh.position.set(-0.16, 1.30, 0.12);

    const tickMat = new THREE.LineBasicMaterial({ color: 0xb6ff3c, transparent: true, opacity: 0.9 });
    // Bracket graduations (each tick represents 2 mm real, drawn at 20 mm intervals)
    const tickPts = [
      new THREE.Vector3(0, -0.05, 0), new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(-0.015, -0.05, 0), new THREE.Vector3(0.015, -0.05, 0),
      new THREE.Vector3(-0.010, -0.025, 0), new THREE.Vector3(0.010, -0.025, 0),
      new THREE.Vector3(-0.015, 0, 0), new THREE.Vector3(0.015, 0, 0),
      new THREE.Vector3(-0.010, 0.025, 0), new THREE.Vector3(0.010, 0.025, 0),
      new THREE.Vector3(-0.015, 0.05, 0), new THREE.Vector3(0.015, 0.05, 0)
    ];
    chestRulerMesh.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts), tickMat));

    // Dynamic pointer arrow indicating exact current displacement
    const ptrMat = new THREE.MeshBasicMaterial({ color: 0xb6ff3c });
    const ptrGeo = new THREE.ConeGeometry(0.009, 0.022, 4);
    ptrGeo.rotateZ(Math.PI / 2);
    const ptrMesh = new THREE.Mesh(ptrGeo, ptrMat);
    ptrMesh.name = 'rulerPointer';
    chestRulerMesh.add(ptrMesh);

    humanGroup.add(chestRulerMesh);

    // Apply default organ focus
    applyOrganFocus(currentOrganFocus);
  }

  /* ── Organ Isolation Engine (All / Heart / Lungs / Ribcage X-ray) ── */
  let currentOrganFocus = 'all';

  function applyOrganFocus(focus) {
    currentOrganFocus = focus;
    document.querySelectorAll('.isolate-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-isolate') === focus);
    });

    if (!isAnatomyLoaded) return;

    if (focus === 'all') {
      if (anatomyNodes.body_skin && anatomyNodes.body_skin.material) {
        anatomyNodes.body_skin.material.uniforms.uOpacity.value = 0.35;
        anatomyNodes.body_skin.visible = true;
      }
      if (anatomyNodes.ribcage && anatomyNodes.ribcage.material) {
        anatomyNodes.ribcage.material.opacity = 0.32;
        anatomyNodes.ribcage.visible = true;
      }
      if (anatomyNodes.spine && anatomyNodes.spine.material) {
        anatomyNodes.spine.material.opacity = 0.22;
        anatomyNodes.spine.visible = true;
      }
      if (anatomyNodes.lung_left_surface && anatomyNodes.lung_left_surface.material) {
        anatomyNodes.lung_left_surface.material.opacity = 0.50;
        anatomyNodes.lung_left_surface.visible = true;
      }
      if (anatomyNodes.lung_right_surface && anatomyNodes.lung_right_surface.material) {
        anatomyNodes.lung_right_surface.material.opacity = 0.50;
        anatomyNodes.lung_right_surface.visible = true;
      }
      if (anatomyNodes.bronchi_left && anatomyNodes.bronchi_left.material) {
        anatomyNodes.bronchi_left.material.opacity = 0.88;
        anatomyNodes.bronchi_left.visible = true;
      }
      if (anatomyNodes.bronchi_right && anatomyNodes.bronchi_right.material) {
        anatomyNodes.bronchi_right.material.opacity = 0.88;
        anatomyNodes.bronchi_right.visible = true;
      }
      if (anatomyNodes.trachea && anatomyNodes.trachea.material) {
        anatomyNodes.trachea.material.opacity = 0.88;
        anatomyNodes.trachea.visible = true;
      }
      if (anatomyNodes.heart_muscle && anatomyNodes.heart_muscle.material) {
        anatomyNodes.heart_muscle.material.opacity = 0.94;
        anatomyNodes.heart_muscle.visible = true;
      }
      if (anatomyNodes.heart_vessels && anatomyNodes.heart_vessels.material) {
        anatomyNodes.heart_vessels.material.opacity = 0.90;
        anatomyNodes.heart_vessels.visible = true;
      }
      if (anatomyNodes.diaphragm && anatomyNodes.diaphragm.material) {
        anatomyNodes.diaphragm.material.opacity = 0.25;
        anatomyNodes.diaphragm.visible = true;
      }
    } else if (focus === 'heart') {
      // Fade lungs to ~10% so heart is clearly visible
      if (anatomyNodes.body_skin && anatomyNodes.body_skin.material) {
        anatomyNodes.body_skin.material.uniforms.uOpacity.value = 0.12;
      }
      if (anatomyNodes.ribcage && anatomyNodes.ribcage.material) {
        anatomyNodes.ribcage.material.opacity = 0.10;
      }
      if (anatomyNodes.spine && anatomyNodes.spine.material) {
        anatomyNodes.spine.material.opacity = 0.06;
      }
      if (anatomyNodes.lung_left_surface && anatomyNodes.lung_left_surface.material) {
        anatomyNodes.lung_left_surface.material.opacity = 0.10;
      }
      if (anatomyNodes.lung_right_surface && anatomyNodes.lung_right_surface.material) {
        anatomyNodes.lung_right_surface.material.opacity = 0.10;
      }
      if (anatomyNodes.bronchi_left && anatomyNodes.bronchi_left.material) {
        anatomyNodes.bronchi_left.material.opacity = 0.16;
      }
      if (anatomyNodes.bronchi_right && anatomyNodes.bronchi_right.material) {
        anatomyNodes.bronchi_right.material.opacity = 0.16;
      }
      if (anatomyNodes.trachea && anatomyNodes.trachea.material) {
        anatomyNodes.trachea.material.opacity = 0.16;
      }
      if (anatomyNodes.heart_muscle && anatomyNodes.heart_muscle.material) {
        anatomyNodes.heart_muscle.material.opacity = 1.0;
        anatomyNodes.heart_muscle.visible = true;
      }
      if (anatomyNodes.heart_vessels && anatomyNodes.heart_vessels.material) {
        anatomyNodes.heart_vessels.material.opacity = 1.0;
        anatomyNodes.heart_vessels.visible = true;
      }
      if (anatomyNodes.diaphragm && anatomyNodes.diaphragm.material) {
        anatomyNodes.diaphragm.material.opacity = 0.08;
      }
    } else if (focus === 'lungs') {
      if (anatomyNodes.body_skin && anatomyNodes.body_skin.material) {
        anatomyNodes.body_skin.material.uniforms.uOpacity.value = 0.12;
      }
      if (anatomyNodes.ribcage && anatomyNodes.ribcage.material) {
        anatomyNodes.ribcage.material.opacity = 0.12;
      }
      if (anatomyNodes.spine && anatomyNodes.spine.material) {
        anatomyNodes.spine.material.opacity = 0.06;
      }
      if (anatomyNodes.lung_left_surface && anatomyNodes.lung_left_surface.material) {
        anatomyNodes.lung_left_surface.material.opacity = 0.72;
      }
      if (anatomyNodes.lung_right_surface && anatomyNodes.lung_right_surface.material) {
        anatomyNodes.lung_right_surface.material.opacity = 0.72;
      }
      if (anatomyNodes.bronchi_left && anatomyNodes.bronchi_left.material) {
        anatomyNodes.bronchi_left.material.opacity = 1.0;
      }
      if (anatomyNodes.bronchi_right && anatomyNodes.bronchi_right.material) {
        anatomyNodes.bronchi_right.material.opacity = 1.0;
      }
      if (anatomyNodes.trachea && anatomyNodes.trachea.material) {
        anatomyNodes.trachea.material.opacity = 1.0;
      }
      if (anatomyNodes.heart_muscle && anatomyNodes.heart_muscle.material) {
        anatomyNodes.heart_muscle.material.opacity = 0.10;
      }
      if (anatomyNodes.heart_vessels && anatomyNodes.heart_vessels.material) {
        anatomyNodes.heart_vessels.material.opacity = 0.10;
      }
      if (anatomyNodes.diaphragm && anatomyNodes.diaphragm.material) {
        anatomyNodes.diaphragm.material.opacity = 0.22;
      }
    } else if (focus === 'ribcage') {
      if (anatomyNodes.body_skin && anatomyNodes.body_skin.material) {
        anatomyNodes.body_skin.material.uniforms.uOpacity.value = 0.08;
      }
      if (anatomyNodes.ribcage && anatomyNodes.ribcage.material) {
        anatomyNodes.ribcage.material.opacity = 0.85;
      }
      if (anatomyNodes.spine && anatomyNodes.spine.material) {
        anatomyNodes.spine.material.opacity = 0.65;
      }
      if (anatomyNodes.lung_left_surface && anatomyNodes.lung_left_surface.material) {
        anatomyNodes.lung_left_surface.material.opacity = 0.06;
      }
      if (anatomyNodes.lung_right_surface && anatomyNodes.lung_right_surface.material) {
        anatomyNodes.lung_right_surface.material.opacity = 0.06;
      }
      if (anatomyNodes.bronchi_left && anatomyNodes.bronchi_left.material) {
        anatomyNodes.bronchi_left.material.opacity = 0.08;
      }
      if (anatomyNodes.bronchi_right && anatomyNodes.bronchi_right.material) {
        anatomyNodes.bronchi_right.material.opacity = 0.08;
      }
      if (anatomyNodes.trachea && anatomyNodes.trachea.material) {
        anatomyNodes.trachea.material.opacity = 0.08;
      }
      if (anatomyNodes.heart_muscle && anatomyNodes.heart_muscle.material) {
        anatomyNodes.heart_muscle.material.opacity = 0.08;
      }
      if (anatomyNodes.heart_vessels && anatomyNodes.heart_vessels.material) {
        anatomyNodes.heart_vessels.material.opacity = 0.08;
      }
      if (anatomyNodes.diaphragm && anatomyNodes.diaphragm.material) {
        anatomyNodes.diaphragm.material.opacity = 0.10;
      }
    }
  }

  function buildProceduralFallback() {
    console.log('Using procedural human fallback');
    // Keep previously built fallback if needed
  }

  /* ═══════════════════════════════════════════════════════════
     3. CLEAN RADAR PROJECTOR ON TRIPOD (10.525 GHz)
  ════════════════════════════════════════════════════════════ */
  function buildRadarUnit() {
    radarGroup = new THREE.Group();
    // Offset so radar is cleanly visible to the right of text cards
    radarGroup.position.set(-0.28, 1.30, 0.08);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x141f33,
      metalness: 0.75,
      roughness: 0.28
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x00f3ff,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.3,
      metalness: 0.9,
      roughness: 0.2
    });

    // 1. Radar Body Chassis
    const bodyGeo = new THREE.BoxGeometry(0.32, 0.26, 0.22);
    const body = new THREE.Mesh(bodyGeo, metalMat);
    radarGroup.add(body);

    // 2. Pyramidal Horn Antenna (flared aperture facing chest)
    const hornGeo = new THREE.ConeGeometry(0.14, 0.26, 4, 1, true);
    hornGeo.rotateX(-Math.PI / 2);
    hornGeo.rotateY(Math.PI / 4);
    const horn = new THREE.Mesh(hornGeo, accentMat);
    horn.position.set(0.24, 0, 0);
    radarGroup.add(horn);

    // Inner horn cavity
    const innerGeo = new THREE.ConeGeometry(0.12, 0.24, 4, 1, true);
    innerGeo.rotateX(-Math.PI / 2);
    innerGeo.rotateY(Math.PI / 4);
    const innerHorn = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({ color: 0x030712 }));
    innerHorn.position.set(0.23, 0, 0);
    radarGroup.add(innerHorn);

    // 3. Status LED (Blinking green/cyan)
    const ledGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xb6ff3c });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0.04, 0.09, 0.115);
    radarGroup.add(led);
    radarGroup.userData.led = led;

    // 4. Tripod Mounting (extending down to ground y = 0)
    const mountGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12);
    const mount = new THREE.Mesh(mountGeo, metalMat);
    mount.position.set(0, -0.18, 0);
    radarGroup.add(mount);

    const legGeo = new THREE.CylinderGeometry(0.014, 0.008, 1.30, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });

    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(legGeo, legMat);
      const angle = (i * Math.PI * 2) / 3;
      leg.position.set(Math.cos(angle) * 0.14, -0.65, Math.sin(angle) * 0.14);
      leg.rotation.z = Math.cos(angle) * 0.16;
      leg.rotation.x = -Math.sin(angle) * 0.16;
      radarGroup.add(leg);
    }

    mainSceneGroup.add(radarGroup);
  }

  /* ═══════════════════════════════════════════════════════════
     4. DIRECTED MICROWAVE BEAM & REFLECTED WAVE FIELD
  ════════════════════════════════════════════════════════════ */
  let waveShells = [];
  let beamConeMesh;

  function buildWaveField() {
    waveGroup = new THREE.Group();

    // 1. Directed Conical Microwave Envelope (Horn mouth to chest)
    const beamLen = 0.58;
    const coneGeo = new THREE.CylinderGeometry(0.12, 0.04, beamLen, 24, 1, true);
    coneGeo.rotateZ(-Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    beamConeMesh = new THREE.Mesh(coneGeo, coneMat);
    beamConeMesh.position.set(0.25, 1.30, 0.08);
    waveGroup.add(beamConeMesh);

    // 2. Wavefront Rings: 5 directed Cyan TX rings + 5 Coral RX rings
    const numRings = 5;
    for (let i = 0; i < numRings; i++) {
      // Transmitted wavefront ring (Cyan)
      const txGeo = new THREE.TorusGeometry(0.06, 0.0035, 12, 32);
      txGeo.rotateY(Math.PI / 2);
      const txMat = new THREE.MeshBasicMaterial({
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const txRing = new THREE.Mesh(txGeo, txMat);
      waveGroup.add(txRing);

      // Reflected phase-shifted wavefront ring (Coral)
      const rxGeo = new THREE.TorusGeometry(0.06, 0.0035, 12, 32);
      rxGeo.rotateY(Math.PI / 2);
      const rxMat = new THREE.MeshBasicMaterial({
        color: 0xff5e43,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const rxRing = new THREE.Mesh(rxGeo, rxMat);
      waveGroup.add(rxRing);

      waveShells.push({ tx: txRing, rx: rxRing, index: i });
    }

    mainSceneGroup.add(waveGroup);
  }

  /* ═══════════════════════════════════════════════════════════
     5. SIGNAL CHAIN RAIL & IN-SCENE OLED DISPLAY
  ════════════════════════════════════════════════════════════ */
  let railPulseMesh;
  function buildSignalChainAndOLED() {
    chainGroup = new THREE.Group();
    chainGroup.position.set(0.15, 0.02, 0.25);

    // 1. Thin rail
    const railGeo = new THREE.BoxGeometry(1.4, 0.02, 0.04);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 });
    const rail = new THREE.Mesh(railGeo, railMat);
    chainGroup.add(rail);

    // 2. Five Processing Nodes (Mixer, Filter, Arduino, ADC, OLED)
    const nodeNames = ['Mixer', 'Filter', 'Arduino', 'ADC', 'OLED'];
    const nodeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.08);
    const nodeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.2 });

    for (let i = 0; i < 5; i++) {
      const x = -0.55 + i * 0.26;
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(x, 0.03, 0);
      chainGroup.add(node);

      // Node LED status
      const dotGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(x, 0.065, 0.025);
      chainGroup.add(dot);
    }

    // 3. Traveling Signal Pulse along the rail
    const pulseGeo = new THREE.SphereGeometry(0.02, 12, 12);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xb6ff3c });
    railPulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    railPulseMesh.position.set(-0.55, 0.04, 0);
    chainGroup.add(railPulseMesh);

    // 4. In-Scene OLED Display (Elevated and tilted for optimal view)
    oledCanvas = document.createElement('canvas');
    oledCanvas.width = 512;
    oledCanvas.height = 256;
    oledCtx = oledCanvas.getContext('2d');

    oledTexture = new THREE.CanvasTexture(oledCanvas);
    oledTexture.minFilter = THREE.LinearFilter;
    oledTexture.magFilter = THREE.LinearFilter;

    const oledGeo = new THREE.PlaneGeometry(0.56, 0.28);
    const oledMat = new THREE.MeshBasicMaterial({
      map: oledTexture,
      transparent: false
    });
    const oledScreen = new THREE.Mesh(oledGeo, oledMat);
    oledScreen.position.set(0.62, 0.20, 0.08);
    oledScreen.rotation.y = -0.25;
    oledScreen.rotation.x = -0.22;
    chainGroup.add(oledScreen);

    // OLED Bezel Frame
    const frameGeo = new THREE.BoxGeometry(0.60, 0.32, 0.03);
    const frame = new THREE.Mesh(frameGeo, railMat);
    frame.position.copy(oledScreen.position);
    frame.rotation.copy(oledScreen.rotation);
    frame.position.z -= 0.02;
    chainGroup.add(frame);

    mainSceneGroup.add(chainGroup);
  }

  /* ═══════════════════════════════════════════════════════════
     6. BED / SUPINE UNIT (FOR POSTURE TOGGLE)
  ════════════════════════════════════════════════════════════ */
  function buildBedUnit() {
    bedGroup = new THREE.Group();
    bedGroup.position.set(0.9, -0.4, 0);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

    // Bed Frame
    const bedGeo = new THREE.BoxGeometry(0.8, 0.12, 1.8);
    const bedFrame = new THREE.Mesh(bedGeo, frameMat);
    bedGroup.add(bedFrame);

    // Mattress
    const matGeo = new THREE.BoxGeometry(0.72, 0.14, 1.7);
    const mattress = new THREE.Mesh(matGeo, mattressMat);
    mattress.position.y = 0.12;
    bedGroup.add(mattress);

    // Bed Legs
    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8);
    [[-0.35, -0.75], [0.35, -0.75], [-0.35, 0.75], [0.35, 0.75]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(x, -0.2, z);
      bedGroup.add(leg);
    });

    bedGroup.visible = false;
    mainSceneGroup.add(bedGroup);
  }

  /* ═══════════════════════════════════════════════════════════
     7. LIVE OLED TEXTURE RENDERING (FROM SIM.JS)
  ════════════════════════════════════════════════════════════ */
  function updateOledTexture(time) {
    if (!oledCtx) return;
    const w = 512, h = 256;

    // OLED Background
    oledCtx.fillStyle = '#030712';
    oledCtx.fillRect(0, 0, w, h);

    // Engineering Header
    oledCtx.fillStyle = '#00f3ff';
    oledCtx.font = 'bold 15px "JetBrains Mono", monospace';
    oledCtx.fillText('BIOPULSE MICRO-DOPPLER', 18, 28);

    oledCtx.fillStyle = 'rgba(255,255,255,0.45)';
    oledCtx.font = '12px "JetBrains Mono", monospace';
    oledCtx.fillText('BANDPASS: 0.1 - 3.0 Hz', 330, 28);

    // Grid lines
    oledCtx.strokeStyle = 'rgba(0, 243, 255, 0.08)';
    oledCtx.lineWidth = 1;
    for (let x = 20; x < w - 20; x += 40) {
      oledCtx.beginPath(); oledCtx.moveTo(x, 40); oledCtx.lineTo(x, 180); oledCtx.stroke();
    }
    for (let y = 40; y <= 180; y += 35) {
      oledCtx.beginPath(); oledCtx.moveTo(20, y); oledCtx.lineTo(w - 20, y); oledCtx.stroke();
    }

    // Live Filtered Waveform Plot (directly from sim.js yy buffer if available)
    oledCtx.strokeStyle = '#00f3ff';
    oledCtx.lineWidth = 2.4;
    oledCtx.shadowColor = '#00f3ff';
    oledCtx.shadowBlur = 8;
    oledCtx.beginPath();

    const scopeW = w - 40;
    const centerY = 110;
    const hasSim = typeof yy !== 'undefined' && yy.length > 0;

    for (let i = 0; i < scopeW; i += 2) {
      let val = 0;
      if (hasSim) {
        const idx = Math.min(yy.length - 1, Math.floor(i * (yy.length / scopeW)));
        val = yy[idx] * 28;
      } else {
        // Fallback smooth cardiopulmonary waveform
        const st = time * 2.5 - (scopeW - i) * 0.02;
        val = Math.sin(st * 1.57) * 22 + Math.sin(st * 7.54) * 8;
      }
      const y = Math.max(45, Math.min(175, centerY + val));
      if (i === 0) oledCtx.moveTo(20 + i, y);
      else oledCtx.lineTo(20 + i, y);
    }
    oledCtx.stroke();
    oledCtx.shadowBlur = 0;

    // Bottom Numerical Readouts (BPM & RPM)
    const bpm = (typeof S !== 'undefined' && S.bpm) ? S.bpm : 72;
    const rpm = (typeof S !== 'undefined' && S.respRPM) ? S.respRPM : 15;

    oledCtx.fillStyle = '#b6ff3c';
    oledCtx.font = 'bold 36px "JetBrains Mono", monospace';
    oledCtx.fillText(`${bpm}`, 24, 232);

    oledCtx.font = '12px "JetBrains Mono", monospace';
    oledCtx.fillStyle = 'rgba(255,255,255,0.7)';
    oledCtx.fillText('HEART BPM', 84, 232);

    oledCtx.fillStyle = '#00f3ff';
    oledCtx.font = 'bold 36px "JetBrains Mono", monospace';
    oledCtx.fillText(`${rpm}`, 230, 232);

    oledCtx.font = '12px "JetBrains Mono", monospace';
    oledCtx.fillStyle = 'rgba(255,255,255,0.7)';
    oledCtx.fillText('BREATH RPM', 290, 232);

    oledTexture.needsUpdate = true;
  }

  /* ═══════════════════════════════════════════════════════════
     8. 3D CALLOUTS & PROJECTION TRACKING (STACKED LEADER LINES)
  ════════════════════════════════════════════════════════════ */
  let calloutSvgEl = null;

  function updateCallouts() {
    if (!calloutsLayerEl || !canvasEl) return;

    if (!calloutSvgEl) {
      calloutSvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      calloutSvgEl.setAttribute('class', 'callout-svg-lines');
      calloutsLayerEl.appendChild(calloutSvgEl);
    }

    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;
    calloutSvgEl.setAttribute('width', w);
    calloutSvgEl.setAttribute('height', h);

    // Compute center anchor for chest
    let chestCenterY = h * 0.44;
    const chestDef = calloutDefs.find(d => d.id === 'chest');
    if (chestDef) {
      const cProj = chestDef.getPos().clone().project(camera);
      chestCenterY = (-cProj.y * 0.5 + 0.5) * h;
    }
    chestCenterY = Math.max(130, Math.min(h - 170, chestCenterY));

    // Rightmost body edge screen X
    const bodyPos = new THREE.Vector3(humanGroup ? humanGroup.position.x + 0.22 : 0.94, 1.25, 0);
    const bProj = bodyPos.project(camera);
    const bodyScreenX = (bProj.x * 0.5 + 0.5) * w;

    // Stacked column X coordinate: clamped safely inside viewport
    let colX;
    if (w < 680) {
      colX = Math.max(16, w - 195);
    } else {
      colX = Math.min(w - 195, Math.max(bodyScreenX + 35, w * 0.72));
      colX = Math.max(w * 0.58, colX);
    }

    const rowSpacing = 44;
    const totalH = rowSpacing * (calloutDefs.length - 1);
    const startY = Math.max(85, Math.min(h - totalH - 65, chestCenterY - totalH * 0.5));

    let svgHtml = '';

    calloutDefs.forEach((def, index) => {
      let dotEl = document.getElementById(`callout-dot-${def.id}`);
      let tagEl = document.getElementById(`callout-tag-${def.id}`);

      if (!dotEl) {
        dotEl = document.createElement('div');
        dotEl.id = `callout-dot-${def.id}`;
        dotEl.className = `callout-dot ${def.coral ? 'coral' : ''}`;
        calloutsLayerEl.appendChild(dotEl);
      }
      if (!tagEl) {
        tagEl = document.createElement('div');
        tagEl.id = `callout-tag-${def.id}`;
        tagEl.className = 'callout-anchor';
        tagEl.innerHTML = `
          <div class="callout-tag">
            <span>${def.name}</span>
            <strong id="callout-val-${def.id}" style="color:${def.coral ? '#ff5e43' : '#b6ff3c'};font-weight:700"></strong>
          </div>
        `;
        tagEl.addEventListener('click', () => showOrganTooltip(def));
        calloutsLayerEl.appendChild(tagEl);
      }

      // Project 3D coordinate to screen space
      const pos3D = def.getPos();
      const proj = pos3D.clone().project(camera);

      // Check if behind camera
      if (proj.z > 1.0) {
        dotEl.style.display = 'none';
        tagEl.style.display = 'none';
        return;
      }

      const dotX = (proj.x * 0.5 + 0.5) * w;
      const dotY = (-proj.y * 0.5 + 0.5) * h;

      // Occlusion check: hide if target is behind the body
      // If camera is viewing from behind (+Z is front, camera.position.z < -0.15) or dot is right of column, hide
      const isBehindBody = (camera.position.z < -0.15) || (dotX > colX - 10);
      if (isBehindBody) {
        dotEl.style.display = 'none';
        tagEl.style.display = 'none';
        return;
      }

      dotEl.style.display = 'block';
      tagEl.style.display = 'flex';

      dotEl.style.left = `${dotX.toFixed(1)}px`;
      dotEl.style.top = `${dotY.toFixed(1)}px`;
      dotEl.style.position = 'absolute';
      dotEl.style.transform = 'translate(-50%, -50%)';

      const tagY = Math.max(75, Math.min(h - 55, startY + index * rowSpacing));
      tagEl.style.left = `${colX.toFixed(1)}px`;
      tagEl.style.top = `${tagY.toFixed(1)}px`;

      const valEl = document.getElementById(`callout-val-${def.id}`);
      if (valEl) valEl.textContent = def.value();

      // Short leader line: from organ dot to stacked column with elbow
      if (w > 680 && dotX < colX - 12) {
        const leadX = Math.min(colX - 8, dotX + 22);
        const color = def.coral ? 'rgba(255, 94, 67, 0.55)' : 'rgba(0, 243, 255, 0.45)';
        svgHtml += `<path d="M ${dotX.toFixed(1)} ${dotY.toFixed(1)} L ${leadX.toFixed(1)} ${dotY.toFixed(1)} L ${leadX.toFixed(1)} ${tagY.toFixed(1)} L ${(colX - 4).toFixed(1)} ${tagY.toFixed(1)}" stroke="${color}" stroke-width="1.2" fill="none" stroke-dasharray="3,2"/>`;
      }
    });

    calloutSvgEl.innerHTML = svgHtml;
  }

  function showOrganTooltip(def) {
    if (!tooltipEl) return;
    document.getElementById('tooltip-title').textContent = def.name;
    document.getElementById('tooltip-val').textContent = def.value();
    document.getElementById('tooltip-val').style.color = def.coral ? '#ff5e43' : '#b6ff3c';

    const pos3D = def.getPos();
    const proj = pos3D.clone().project(camera);
    const w = canvasEl.clientWidth;
    const h = canvasEl.clientHeight;
    const sx = (proj.x * 0.5 + 0.5) * w;
    const sy = (-proj.y * 0.5 + 0.5) * h;

    tooltipEl.style.left = `${sx}px`;
    tooltipEl.style.top = `${sy}px`;
    tooltipEl.hidden = false;

    clearTimeout(tooltipEl._timer);
    tooltipEl._timer = setTimeout(() => {
      tooltipEl.hidden = true;
    }, 3800);
  }

  /* ═══════════════════════════════════════════════════════════
     9. GUIDED TOUR CAMERA CONTROLLER
  ════════════════════════════════════════════════════════════ */
  function startGuidedTour() {
    orbit.isTouring = true;
    currentTourIdx = 0;
    const captionBox = document.getElementById('tour-caption-box');
    if (captionBox) captionBox.hidden = false;
    advanceTourStop();
  }

  function stopGuidedTour() {
    orbit.isTouring = false;
    currentTourIdx = -1;
    clearTimeout(tourTimer);
    const captionBox = document.getElementById('tour-caption-box');
    if (captionBox) captionBox.hidden = true;

    // Reset camera target to closer chest framing
    orbit.target.set(0.08, 1.25, 0.04);
    orbit.targetTheta = 0.25;
    orbit.targetPhi = 0.10;
    orbit.targetRadius = 2.25;
  }

  function advanceTourStop() {
    if (!orbit.isTouring || currentTourIdx >= tourStops.length) {
      stopGuidedTour();
      return;
    }

    const stop = tourStops[currentTourIdx];
    document.getElementById('tour-step-badge').textContent = `STEP ${currentTourIdx + 1} / ${tourStops.length}`;
    document.getElementById('tour-caption-text').textContent = stop.caption;

    orbit.target.copy(stop.target);
    orbit.targetTheta = stop.theta;
    orbit.targetPhi = stop.phi;
    orbit.targetRadius = stop.radius;

    tourTimer = setTimeout(() => {
      currentTourIdx++;
      advanceTourStop();
    }, stop.duration * 1000);
  }

  /* ═══════════════════════════════════════════════════════════
     10. ORBIT & EVENT CONTROLS
  ════════════════════════════════════════════════════════════ */
  function updateCamera() {
    const x = orbit.target.x + orbit.radius * Math.cos(orbit.phi) * Math.sin(orbit.theta);
    const y = orbit.target.y + orbit.radius * Math.sin(orbit.phi);
    const z = orbit.target.z + orbit.radius * Math.cos(orbit.phi) * Math.cos(orbit.theta);
    camera.position.set(x, y, z);
    camera.lookAt(orbit.target);
  }

  function setupOrbitEvents() {
    canvasEl.addEventListener('mousedown', (e) => {
      if (orbit.isTouring) stopGuidedTour();
      orbit.isDragging = true;
      orbit.prevX = e.clientX;
      orbit.prevY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!orbit.isDragging) return;
      const dx = e.clientX - orbit.prevX;
      const dy = e.clientY - orbit.prevY;
      orbit.prevX = e.clientX;
      orbit.prevY = e.clientY;

      orbit.targetTheta -= dx * 0.005;
      orbit.targetPhi += dy * 0.005;
      orbit.targetTheta = Math.max(orbit.minTheta, Math.min(orbit.maxTheta, orbit.targetTheta));
      orbit.targetPhi = Math.max(orbit.minPhi, Math.min(orbit.maxPhi, orbit.targetPhi));
    });

    window.addEventListener('mouseup', () => {
      orbit.isDragging = false;
    });

    canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (orbit.isTouring) stopGuidedTour();
      orbit.targetRadius = Math.max(orbit.minRadius, Math.min(orbit.maxRadius, orbit.targetRadius + e.deltaY * 0.002));
    }, { passive: false });

    // Touch support
    let touchDist = 0;
    canvasEl.addEventListener('touchstart', (e) => {
      if (orbit.isTouring) stopGuidedTour();
      if (e.touches.length === 1) {
        orbit.isDragging = true;
        orbit.prevX = e.touches[0].clientX;
        orbit.prevY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });

    canvasEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && orbit.isDragging) {
        const dx = e.touches[0].clientX - orbit.prevX;
        const dy = e.touches[0].clientY - orbit.prevY;
        orbit.prevX = e.touches[0].clientX;
        orbit.prevY = e.touches[0].clientY;
        orbit.targetTheta -= dx * 0.005;
        orbit.targetPhi += dy * 0.005;
        orbit.targetTheta = Math.max(orbit.minTheta, Math.min(orbit.maxTheta, orbit.targetTheta));
        orbit.targetPhi = Math.max(orbit.minPhi, Math.min(orbit.maxPhi, orbit.targetPhi));
      } else if (e.touches.length === 2) {
        const curDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        orbit.targetRadius = Math.max(orbit.minRadius, Math.min(orbit.maxRadius, orbit.targetRadius + (touchDist - curDist) * 0.006));
        touchDist = curDist;
      }
    }, { passive: true });

    canvasEl.addEventListener('touchend', () => { orbit.isDragging = false; });
  }

  function setupUIControls() {
    // Mode Buttons Hover Tint (400ms transition)
    const btnSci = document.getElementById('card-sci');
    const btnKids = document.getElementById('card-kids');

    if (btnSci) {
      btnSci.addEventListener('mouseenter', () => targetSceneTint.copy(colorCyan));
      btnSci.addEventListener('mouseleave', () => targetSceneTint.copy(colorCyan));
    }
    if (btnKids) {
      btnKids.addEventListener('mouseenter', () => targetSceneTint.copy(colorAmber));
      btnKids.addEventListener('mouseleave', () => targetSceneTint.copy(colorCyan));
    }

    // Parameters Drawer Toggle
    const ctrlToggle = document.getElementById('ctrl-toggle-btn');
    const ctrlDrawer = document.getElementById('ctrl-drawer');
    if (ctrlToggle && ctrlDrawer) {
      ctrlToggle.addEventListener('click', () => {
        const isExp = ctrlToggle.getAttribute('aria-expanded') === 'true';
        ctrlToggle.setAttribute('aria-expanded', !isExp);
        ctrlDrawer.hidden = isExp;
      });
    }

    // Organ Focus Pill Buttons
    document.querySelectorAll('.isolate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-isolate');
        applyOrganFocus(mode);
      });
    });

    // Sliders
    const sDist = document.getElementById('slider-dist');
    const sResp = document.getElementById('slider-resp');
    const sHeart = document.getElementById('slider-heart');

    if (sDist) {
      sDist.addEventListener('input', (e) => {
        const d = parseFloat(e.target.value);
        document.getElementById('val-dist').textContent = d.toFixed(1) + ' m';
        if (typeof S !== 'undefined') S.d = d;
        if (radarGroup && humanGroup) {
          radarGroup.position.x = humanGroup.position.x - 0.18 - d;
        }
      });
    }
    if (sResp) {
      sResp.addEventListener('input', (e) => {
        const r = parseInt(e.target.value, 10);
        document.getElementById('val-resp').textContent = r + ' /min';
        if (typeof S !== 'undefined') {
          S.respRPM = r;
          S.fb = r / 60;
        }
      });
    }
    if (sHeart) {
      sHeart.addEventListener('input', (e) => {
        const h = parseInt(e.target.value, 10);
        document.getElementById('val-heart').textContent = h + ' BPM';
        if (typeof S !== 'undefined') {
          S.bpm = h;
          S.fh = h / 60;
        }
      });
    }

    // Posture Toggle (Standing vs Bed Supine)
    const btnPose = document.getElementById('btn-pose-toggle');
    if (btnPose) {
      btnPose.addEventListener('click', () => {
        isSupine = !isSupine;
        document.getElementById('pose-label').textContent = isSupine ? 'Pose: Supine (Bed)' : 'Pose: Standing';
        if (bedGroup) bedGroup.visible = isSupine;
      });
    }

    // Guided Tour Buttons
    const btnTour = document.getElementById('btn-start-tour');
    const btnCloseTour = document.getElementById('tour-close-btn');
    if (btnTour) btnTour.addEventListener('click', startGuidedTour);
    if (btnCloseTour) btnCloseTour.addEventListener('click', stopGuidedTour);
  }

  function onResize() {
    if (!canvasEl || !camera || !renderer) return;
    const w = canvasEl.clientWidth || window.innerWidth;
    const h = canvasEl.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(h, 1);

    if (w < 680) {
      orbit.target.set(0.18, 1.15, 0);
      orbit.targetRadius = 2.75;
    } else {
      orbit.target.set(0.08, 1.25, 0.04);
      orbit.targetRadius = 2.25;
    }

    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stopRenderLoop();
    } else if (typeof _currentView !== 'undefined' && _currentView === 'landing') {
      startRenderLoop();
    }
  }

  /* ═══════════════════════════════════════════════════════════
     11. ANIMATION & RENDER LOOP
  ════════════════════════════════════════════════════════════ */
  function renderLoop() {
    if (!isSceneActive) return;

    if (typeof _currentView !== 'undefined' && _currentView === 'kids') {
      stopRenderLoop();
      return;
    }

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    // 1. Camera interpolation
    if (!prefersReducedMotion && !orbit.isDragging && !orbit.isTouring) {
      orbit.idleDrift = Math.sin(time * 0.35) * 0.03;
    } else {
      orbit.idleDrift = 0;
    }

    const damp = orbit.isTouring ? 0.04 : orbit.damping;
    orbit.theta += (orbit.targetTheta + orbit.idleDrift - orbit.theta) * damp;
    orbit.phi += (orbit.targetPhi - orbit.phi) * damp;
    orbit.radius += (orbit.targetRadius - orbit.radius) * damp;
    updateCamera();

    // 2. Scene Tint Lerping (400ms transition)
    currentSceneTint.lerp(targetSceneTint, 0.08);
    keyLight.color.copy(currentSceneTint);

    // 3. Posture Transition Lerp (Standing vs Supine)
    const targetProg = isSupine ? 1 : 0;
    currentPoseProgress += (targetProg - currentPoseProgress) * 0.06;
    if (humanGroup) {
      humanGroup.rotation.x = -currentPoseProgress * (Math.PI / 2);
      humanGroup.position.y = currentPoseProgress * 0.25;
      humanGroup.position.z = currentPoseProgress * 0.15;
    }

    // 4. Cardiopulmonary Dynamics (Breathing & Heartbeat from sim.js)
    const respRate = (typeof S !== 'undefined' && S.respRPM) ? S.respRPM : 15;
    const heartRate = (typeof S !== 'undefined' && S.bpm) ? S.bpm : 72;

    // Respiration curve: ease-in-out with slightly longer exhale (~40% inhale, 60% exhale)
    const respCycle = (time * (respRate / 60)) % 1.0;
    let bFactor = 0;
    if (respCycle < 0.4) {
      const u = respCycle / 0.4;
      bFactor = 0.5 - 0.5 * Math.cos(u * Math.PI); // 0 -> 1 smooth inhale
    } else {
      const u = (respCycle - 0.4) / 0.6;
      bFactor = 0.5 + 0.5 * Math.cos(u * Math.PI); // 1 -> 0 smooth longer exhale
    }

    // Scale lungs non-uniformly on pivot nodes (NOT meshes, no translation!)
    if (anatomyNodes.lung_left_pivot) {
      anatomyNodes.lung_left_pivot.scale.set(
        1.0 + 0.06 * bFactor,
        1.0 + 0.08 * bFactor,
        1.0 + 0.10 * bFactor
      );
    }
    if (anatomyNodes.lung_right_pivot) {
      anatomyNodes.lung_right_pivot.scale.set(
        1.0 + 0.06 * bFactor,
        1.0 + 0.08 * bFactor,
        1.0 + 0.10 * bFactor
      );
    }

    // Push ribcage and body_skin outward slightly in sync (exaggerated x10)
    if (anatomyNodes.ribcage) {
      anatomyNodes.ribcage.scale.set(
        1.0 + 0.035 * bFactor,
        1.0,
        1.0 + 0.055 * bFactor
      );
    }
    if (anatomyNodes.body_skin) {
      anatomyNodes.body_skin.scale.set(
        1.0 + 0.03 * bFactor,
        1.0,
        1.0 + 0.045 * bFactor
      );
      if (anatomyNodes.body_skin.material && anatomyNodes.body_skin.material.uniforms && anatomyNodes.body_skin.material.uniforms.uTime) {
        anatomyNodes.body_skin.material.uniforms.uTime.value = time;
      }
    }

    // Diaphragm moves downward slightly on inhale
    if (anatomyNodes.diaphragm) {
      anatomyNodes.diaphragm.position.y = -0.015 * bFactor;
    }

    // Heartbeat: lub-dub on heart_pivot (two quick scale bumps: 6% then 4%)
    const heartCycle = (time * (heartRate / 60)) % 1.0;
    let lub = 0, dub = 0;
    if (heartCycle >= 0.0 && heartCycle < 0.14) {
      lub = Math.sin((heartCycle / 0.14) * Math.PI);
    } else if (heartCycle >= 0.18 && heartCycle < 0.30) {
      dub = Math.sin(((heartCycle - 0.18) / 0.12) * Math.PI);
    }
    const heartPulse = lub * 0.06 + dub * 0.04;
    if (anatomyNodes.heart_pivot) {
      anatomyNodes.heart_pivot.scale.set(
        1.0 + heartPulse,
        1.0 + heartPulse,
        1.0 + heartPulse
      );
    }
    // Emissive flash on heart_muscle
    if (anatomyNodes.heart_muscle && anatomyNodes.heart_muscle.material) {
      anatomyNodes.heart_muscle.material.emissiveIntensity = 0.4 + lub * 1.4 + dub * 0.8;
    }

    // Instantaneous chest displacement: real physiological value in mm
    const realRespDispMm = bFactor * 8.0; // 0 to 8 mm breathing
    const realHeartDispMm = lub * 0.35 + dub * 0.20; // 0 to 0.35 mm heartbeat
    currentRealDispMm = realRespDispMm + realHeartDispMm;
    const drawnDispMeters = (currentRealDispMm * 10.0) / 1000.0; // exact 10x visual scale

    // Chest ruler pointer animation
    if (chestRulerMesh) {
      const ptr = chestRulerMesh.getObjectByName('rulerPointer');
      if (ptr) {
        ptr.position.y = -0.05 + Math.min(1.0, currentRealDispMm / 8.0) * 0.10;
      }
    }

    // Radar LED blink
    if (radarGroup && radarGroup.userData.led) {
      radarGroup.userData.led.material.color.setHex((Math.floor(time * 2) % 2 === 0) ? 0xb6ff3c : 0x00f3ff);
    }

    // 5. Directed Microwave Beam Animation (One directed beam from horn to chest)
    const radarX = radarGroup ? radarGroup.position.x + 0.24 : -0.04;
    const chestX = humanGroup ? humanGroup.position.x - 0.18 : 0.54;
    const waveDist = Math.max(0.1, chestX - radarX);

    // Update directed conical beam envelope
    if (beamConeMesh) {
      beamConeMesh.position.set((radarX + chestX) * 0.5, 1.30 + (isSupine ? 0.2 : 0), 0.08);
      beamConeMesh.scale.set(1, 1, waveDist / 0.58);
    }

    // Update directed wavefront rings
    waveShells.forEach(shell => {
      // Transmitted wavefront ring (Cyan) traveling horn -> chest
      const txProg = (time * 0.7 + shell.index / waveShells.length) % 1;
      const txX = radarX + txProg * waveDist;
      shell.tx.position.set(txX, 1.30 + (isSupine ? 0.2 : 0), 0.08);
      const txScale = 0.045 + txProg * 0.10;
      shell.tx.scale.set(txScale, txScale, txScale);
      shell.tx.material.opacity = (1 - txProg) * 0.75;

      // Reflected phase-shifted wavefront ring (Coral) traveling chest -> horn
      const rxProg = ((1 - (time * 0.65 + shell.index / waveShells.length) % 1) + 1) % 1;
      const rxX = chestX - rxProg * waveDist + (drawnDispMeters * 0.8);
      shell.rx.position.set(rxX, 1.30 + (isSupine ? 0.2 : 0), 0.08);
      const rxScale = 0.14 - rxProg * 0.08;
      shell.rx.scale.set(rxScale, rxScale, rxScale);
      shell.rx.material.opacity = rxProg * 0.65;
    });

    // 6. Rail Signal Pulse
    if (railPulseMesh) {
      const railProg = (time * 0.7) % 1;
      railPulseMesh.position.x = -0.55 + railProg * 1.1;
    }

    // 7. Update Live OLED Texture
    updateOledTexture(time);

    // 8. Update Callouts & Adaptive Quality
    updateCallouts();
    trackQuality(delta);

    // Render Three.js Scene
    renderer.render(scene, camera);

    animId = requestAnimationFrame(renderLoop);
  }

  /* ── 10-Second Continuous FPS Benchmark & Quality Tracking ── */
  let benchmarkStart = null;
  let benchmarkFrames = 0;
  let benchmarkDone = false;

  function trackQuality(delta) {
    frameCount++;
    benchmarkFrames++;
    const now = performance.now();
    if (!benchmarkStart) benchmarkStart = now;

    // 10-Second Benchmark
    const totalBenchElapsed = (now - benchmarkStart) / 1000;
    if (totalBenchElapsed >= 10 && !benchmarkDone) {
      benchmarkDone = true;
      const avg10s = Math.round(benchmarkFrames / totalBenchElapsed);
      window.BIO_BENCHMARK_10S_FPS = avg10s;
      console.log('BioPulse 10-Second Measured Benchmark FPS:', avg10s);
      const fpsEl = document.getElementById('hud-fps-val');
      if (fpsEl) fpsEl.textContent = avg10s;
      if (avg10s < 50) {
        console.warn('FPS below 50 on integrated GPU, reducing ribcage/spine complexity');
        if (anatomyNodes.spine) anatomyNodes.spine.visible = false;
        if (anatomyNodes.ribcage && anatomyNodes.ribcage.material) {
          anatomyNodes.ribcage.material.opacity = 0.20;
        }
      }
    }

    // Instantaneous 1-second rolling FPS
    if (now - lastFpsCheck >= 1000) {
      const currentFPS = Math.round((frameCount * 1000) / (now - lastFpsCheck));
      fpsHistory.push(currentFPS);
      if (fpsHistory.length > 5) fpsHistory.shift();

      const avgFPS = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
      if (avgFPS < 45 && !isLowQuality) {
        isLowQuality = true;
        renderer.setPixelRatio(1);
        const qEl = document.getElementById('hud-quality-val');
        if (qEl) qEl.textContent = 'Eco (Low)';
      }

      const fpsEl = document.getElementById('hud-fps-val');
      if (fpsEl) fpsEl.textContent = currentFPS;

      frameCount = 0;
      lastFpsCheck = now;
    }
  }

  function startRenderLoop() {
    if (!isSceneActive) {
      isSceneActive = true;
      lastFpsCheck = performance.now();
      animId = requestAnimationFrame(renderLoop);
    }
  }

  function stopRenderLoop() {
    isSceneActive = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function setStage3D(stageIdx) {
    if (!orbit) return;
    orbit.isTouring = true;

    // Visibility defaults
    if (radarGroup) radarGroup.visible = true;
    if (waveGroup) waveGroup.visible = true;
    if (humanGroup) humanGroup.visible = true;
    if (chainGroup) chainGroup.visible = true;

    // Stage camera setups
    switch (stageIdx) {
      case 0: // 1 Transmitter: 3D beam from horn to chest
        orbit.target.set(0.18, 1.30, 0.05);
        orbit.targetRadius = 1.95;
        orbit.targetTheta = 0.40;
        orbit.targetPhi = 0.12;
        targetSceneTint.set(0x00f3ff);
        break;
      case 1: // 2 Chest: 3D anatomy with lungs expanding and heart pulsing
        orbit.target.set(0.72, 1.28, 0.04);
        orbit.targetRadius = 1.45;
        orbit.targetTheta = 0.18;
        orbit.targetPhi = 0.08;
        targetSceneTint.set(0xff5e43);
        break;
      case 2: // 3 Reflection: overlay TX and RX, phase offset, wave reflection
        orbit.target.set(0.25, 1.30, 0.05);
        orbit.targetRadius = 2.05;
        orbit.targetTheta = 0.06;
        orbit.targetPhi = 0.16;
        targetSceneTint.set(0x00f3ff);
        break;
      case 3: // 4 Mixer: schematic / mixer on hardware rail
        orbit.target.set(0.10, 0.12, 0.28);
        orbit.targetRadius = 1.50;
        orbit.targetTheta = 0.15;
        orbit.targetPhi = 0.32;
        targetSceneTint.set(0x00f3ff);
        break;
      case 4: // 5 Filter: analog bandpass filter on hardware rail
        orbit.target.set(0.32, 0.12, 0.28);
        orbit.targetRadius = 1.50;
        orbit.targetTheta = 0.20;
        orbit.targetPhi = 0.32;
        targetSceneTint.set(0xb6ff3c);
        break;
      case 5: // 6 Arduino: ADC sampling on hardware rail
        orbit.target.set(0.50, 0.14, 0.30);
        orbit.targetRadius = 1.50;
        orbit.targetTheta = 0.25;
        orbit.targetPhi = 0.32;
        targetSceneTint.set(0x00f3ff);
        break;
      case 6: // 7 OLED: OLED module on hardware rail with live vitals
        orbit.target.set(0.68, 0.22, 0.35);
        orbit.targetRadius = 1.35;
        orbit.targetTheta = 0.30;
        orbit.targetPhi = 0.20;
        targetSceneTint.set(0xb6ff3c);
        break;
      case 7: // Lab: Full dashboard overview
        orbit.target.set(0.15, 0.95, 0.08);
        orbit.targetRadius = 2.80;
        orbit.targetTheta = 0.25;
        orbit.targetPhi = 0.16;
        targetSceneTint.set(0x00f3ff);
        break;
    }

    setTimeout(() => { orbit.isTouring = false; }, 1200);
  }

  // Global interface for Scientific Mode and router
  window.BioPulse3D = {
    setStageView: setStage3D,
    resize: onResize,
    activate: startRenderLoop,
    deactivate: stopRenderLoop,
    applyOrganFocus: typeof applyOrganFocus === 'function' ? applyOrganFocus : null,
    getFPS: () => fpsHistory.length ? fpsHistory[fpsHistory.length - 1] : 60
  };

  // Hook into router activation
  window.onLandingActivate = function() {
    startRenderLoop();
    onResize();
  };

  const _prevOnSci = window.onSciActivate;
  window.onSciActivate = function() {
    startRenderLoop();
    requestAnimationFrame(onResize);
    if (typeof _prevOnSci === 'function') _prevOnSci();
    if (typeof window.sciOnActivate === 'function') window.sciOnActivate();
  };

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
