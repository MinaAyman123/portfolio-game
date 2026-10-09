import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';


// ============================================
// CONFIG
// ============================================
const API_URL = "https://portfolio-game-production-f231.up.railway.app";
const COLORS = {
  purple: 0x8B5CF6,
  blue:   0x3B82F6,
  cyan:   0x06B6D4,
  pink:   0xEC4899,
  bg:     0x0A0A0F,
};

// ============================================
// ثوابت الحركة والكاميرا
// ============================================
const CAMERA_DISTANCE     = 8;
const CAMERA_PIVOT_HEIGHT = 1.7;
const CAMERA_MIN_PITCH    = -0.1;
const CAMERA_MAX_PITCH    = 1.2;

const WALK_SPEED   = 3.5;
const RUN_SPEED    = 7;
const ACCEL_GROUND = 10;
const DECEL_GROUND = 14;
const ACCEL_AIR    = 2.5;
const TURN_SPEED   = 14;

const COYOTE_TIME      = 0.12;
const JUMP_BUFFER_TIME = 0.12;

const RUN_UP_THRESHOLD   = 4.6;
const RUN_DOWN_THRESHOLD = 4.0;
const IDLE_THRESHOLD     = 0.4;

// ============================================
// HELPERS
// ============================================
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dampFactor = (lambda, dt) => 1 - Math.exp(-lambda * dt);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ============================================
// SCENE SETUP
// ============================================
const canvas = document.getElementById("world-canvas");
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.Fog(COLORS.bg, 30, 100);

// ============================================
// SKY SPHERE
// ============================================
const skyGeo = new THREE.SphereGeometry(200, 32, 32);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    topColor:    { value: new THREE.Color(0x6A4A9A) },
    bottomColor: { value: new THREE.Color(0x1A1530) },
    offset:      { value: 20 },
    exponent:    { value: 0.7 },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + offset).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
    }
  `,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);


const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ============================================
// POST-PROCESSING (Bloom)
// ============================================
const composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.8,
  0.4,
  0.85
);
composer.addPass(bloomPass);


// ============================================
// LIGHTS
// ============================================
scene.add(new THREE.AmbientLight(0xffffff, 0.9));

const hemi = new THREE.HemisphereLight(COLORS.purple, COLORS.bg, 0.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
scene.add(sun);

const purpleLight = new THREE.PointLight(COLORS.purple, 3, 40);
purpleLight.position.set(-15, 8, -15);
scene.add(purpleLight);

const cyanLight = new THREE.PointLight(COLORS.cyan, 3, 40);
cyanLight.position.set(15, 8, 15);
scene.add(cyanLight);

// ============================================
// FLOOR
// ============================================
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({ color: 0x12121A, roughness: 0.9, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(120, 60, COLORS.purple, 0x1A1A25);
grid.material.opacity = 0.3;
grid.material.transparent = true;
grid.position.y = 0.01;
scene.add(grid);

// ============================================
// DOORS
// ============================================
const doors = [];
const doorDefs = [
  { id: "about",    label: "ABOUT",    color: COLORS.purple, pos: [-15, 0, -15] },
  { id: "projects", label: "PROJECTS", color: COLORS.blue,   pos: [ 15, 0, -15] },
  { id: "skills",   label: "SKILLS",   color: COLORS.cyan,   pos: [-15, 0,  15] },
  { id: "contact",  label: "CONTACT",  color: COLORS.pink,   pos: [ 15, 0,  15] },
];

function createDoor({ id, label, color, pos }) {
  const group = new THREE.Group();
  group.position.set(...pos);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(5, 7, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1A1A25, roughness: 0.7, metalness: 0.4 })
  );
  frame.position.y = 3.5;
  frame.castShadow = true;
  group.add(frame);

  const doorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 6),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
  );
  doorMesh.position.set(0, 3.5, 0.3);
  group.add(doorMesh);

  const light = new THREE.PointLight(color, 2.5, 12);
  light.position.set(0, 5, 2);
  group.add(light);

  // Label
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext("2d");
  ctx.fillStyle = "#0A0A0F";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 256, 64);

  const texture = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 0.9),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
  labelMesh.position.set(0, 8, 0.3);
  group.add(labelMesh);

  scene.add(group);

  return {
    id,
    group,
    position: new THREE.Vector3(...pos),
    interactDistance: 6,
  };
}

doorDefs.forEach(d => doors.push(createDoor(d)));

doors.forEach(door => {
  door.group.visible = false;
});


// ============================================
// CENTRAL PATH (الممر المركزي)
// ============================================
const centralPath = {
  neonLines: [],
  floorSegments: [],
  pillars: [],
};

function createCentralPath() {
  const group = new THREE.Group();

  const pathLength = 24;
  const pathWidth = 7;

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0A0A0F,
    roughness: 0.4,
    metalness: 0.6,
    emissive: 0x1A1A2A,
    emissiveIntensity: 0.3,
  });

  const segments = 8;
  const segLength = pathLength / segments;
  for (let i = 0; i < segments; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(pathWidth, 0.3, segLength - 0.2),
      floorMat
    );
    seg.position.set(0, 0.15, 14 - i * segLength);
    seg.receiveShadow = true;
    group.add(seg);
    centralPath.floorSegments.push(seg);
  }

  const neonLeftMat = new THREE.MeshBasicMaterial({
    color: 0x8B5CF6,
    transparent: true,
    opacity: 0.9,
  });
  const neonRightMat = new THREE.MeshBasicMaterial({
    color: 0x06B6D4,
    transparent: true,
    opacity: 0.9,
  });

  const leftLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.1, pathLength),
    neonLeftMat
  );
  leftLine.position.set(-pathWidth / 2 + 0.4, 0.32, 14 - pathLength / 2);
  group.add(leftLine);
  centralPath.neonLines.push({ mesh: leftLine, baseColor: 0x8B5CF6 });

  const rightLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.1, pathLength),
    neonRightMat
  );
  rightLine.position.set(pathWidth / 2 - 0.4, 0.32, 14 - pathLength / 2);
  group.add(rightLine);
  centralPath.neonLines.push({ mesh: rightLine, baseColor: 0x06B6D4 });

  for (let i = 0; i < 6; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(pathWidth - 1, 0.05, 0.12),
      new THREE.MeshBasicMaterial({
        color: 0x06B6D4,
        transparent: true,
        opacity: 0.6,
      })
    );
    line.position.set(0, 0.33, 14 - (i + 1) * (pathLength / 7));
    line.userData = {
      baseZ: line.position.z,
      offset: i * 0.7,
    };
    group.add(line);
    centralPath.neonLines.push({ mesh: line, baseColor: 0x06B6D4, isHorizontal: true });
  }

  const pillarCount = 6;
  for (let i = 0; i < pillarCount; i++) {
    const z = 14 - (i + 0.5) * (pathLength / pillarCount);

    const leftPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 1.8, 12),
      new THREE.MeshStandardMaterial({
        color: 0x1A1A25,
        metalness: 0.7,
        roughness: 0.4,
        emissive: 0x8B5CF6,
        emissiveIntensity: 0.3,
      })
    );
    leftPillar.position.set(-pathWidth / 2 - 0.5, 0.9, z);
    leftPillar.castShadow = true;
    group.add(leftPillar);
    centralPath.pillars.push(leftPillar);

    const rightPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 1.8, 12),
      new THREE.MeshStandardMaterial({
        color: 0x1A1A25,
        metalness: 0.7,
        roughness: 0.4,
        emissive: 0x06B6D4,
        emissiveIntensity: 0.3,
      })
    );
    rightPillar.position.set(pathWidth / 2 + 0.5, 0.9, z);
    rightPillar.castShadow = true;
    group.add(rightPillar);
    centralPath.pillars.push(rightPillar);

    const orbColor = i % 2 === 0 ? 0x8B5CF6 : 0x06B6D4;
    const topOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      new THREE.MeshBasicMaterial({ color: orbColor })
    );
    topOrb.position.set(-pathWidth / 2 - 0.5, 2.05, z);
    group.add(topOrb);

    const topOrb2 = topOrb.clone();
    topOrb2.position.x = pathWidth / 2 + 0.5;
    topOrb2.position.y = 2.05;
    group.add(topOrb2);
  }

  for (let i = 0; i < 4; i++) {
    const z = 14 - (i + 0.5) * (pathLength / 4);

    const leftLight = new THREE.PointLight(0x8B5CF6, 2.5, 8);
    leftLight.position.set(-pathWidth / 2 - 0.5, 1.8, z);
    group.add(leftLight);

    const rightLight = new THREE.PointLight(0x06B6D4, 2.5, 8);
    rightLight.position.set(pathWidth / 2 + 0.5, 1.8, z);
    group.add(rightLight);
  }

  for (let i = 0; i < 3; i++) {
    const z = 12 - i * 6;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 8, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x06B6D4,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
      })
    );
    beam.position.set(0, 4, z);
    group.add(beam);
  }

  scene.add(group);
}

createCentralPath();

// ============================================
// WALKABLE MESHES
// ============================================
const walkableMeshes = [];

// ============================================
// Path Collider
// ============================================
{
  const pathCollider = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.3, 23.8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  pathCollider.position.set(0, 0.15, 3.5);
  scene.add(pathCollider);
  walkableMeshes.push(pathCollider);
}

// ============================================
// [1] LIVE SCREENS — شاشات بتعرض بيانات حقيقية
// ============================================
const liveScreens = [];
const screenData = { projects: null, skills: null, loaded: false };

const hex = (c) => "#" + c.toString(16).padStart(6, "0");
const SCREEN_FONT = "Orbitron, Arial, sans-serif";

function fitFont(ctx, text, maxW, startPx, minPx, weight = "bold") {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${SCREEN_FONT}`;
    if (ctx.measureText(text).width <= maxW) break;
    px -= 2;
  }
  ctx.font = `${weight} ${px}px ${SCREEN_FONT}`;
  return px;
}

function drawFrame(ctx, w, h, color, title) {
  ctx.fillStyle = "#070712";
  ctx.fillRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, hex(color) + "22");
  g.addColorStop(1, "#00000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = hex(color);
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  ctx.fillStyle = hex(color);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  fitFont(ctx, title, w - 80, 46, 22);
  ctx.fillText(title, 40, 38);
  ctx.fillRect(40, 100, w - 80, 3);
}

function drawHint(ctx, w, h, color, text = "PRESS  E") {
  ctx.font = `bold 24px ${SCREEN_FONT}`;
  ctx.fillStyle = hex(color);
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, w - 40, h - 28);
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  let lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return y + lines.length * lineH;
}

// ---------- الرسّامين ----------
const makeProjectRenderer = (i, color) => (ctx, w, h) => {
  const p = screenData.projects && screenData.projects[i];
  drawFrame(ctx, w, h, color, p ? String(p.name).toUpperCase() : `PROJECT ${i + 1}`);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "30px Arial, sans-serif";

  if (!screenData.loaded) { ctx.fillText("Loading...", 40, 130); return; }
  if (!p) {
    ctx.fillText("Press E to see all projects", 40, 130);
    drawHint(ctx, w, h, color);
    return;
  }

  wrapText(ctx, p.description || "", 40, 128, w - 80, 40, 5);

  let tx = 40;
  const ty = h - 120;
  ctx.font = "bold 24px Arial, sans-serif";
  ctx.textBaseline = "middle";
  for (const t of (p.tech || []).slice(0, 4)) {
    const tw = ctx.measureText(t).width + 32;
    if (tx + tw > w - 40) break;
    ctx.fillStyle = hex(color) + "33";
    ctx.fillRect(tx, ty, tw, 40);
    ctx.strokeStyle = hex(color);
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty, tw, 40);
    ctx.fillStyle = hex(color);
    ctx.textAlign = "left";
    ctx.fillText(t, tx + 16, ty + 21);
    tx += tw + 12;
  }
  drawHint(ctx, w, h, color);
};

function renderSkillsBoard(ctx, w, h) {
  const color = 0x8B5CF6;
  drawFrame(ctx, w, h, color, "SKILLS");

  const list = (screenData.skills || [])
    .slice()
    .sort((a, b) => b.level - a.level)
    .slice(0, 5);

  if (!list.length) {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "30px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(screenData.loaded ? "Press E to view skills" : "Loading...", 40, 130);
    return;
  }

  const top = 122;
  const rowH = (h - top - 30) / list.length;
  list.forEach((s, i) => {
    const y = top + i * rowH;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillStyle = "#F5F5F7";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(s.name, 40, y);

    ctx.textAlign = "right";
    ctx.fillStyle = hex(color);
    ctx.fillText(`${s.level}%`, w - 40, y);

    ctx.fillStyle = "#1A1A25";
    ctx.fillRect(40, y + 34, w - 80, 12);
    const g = ctx.createLinearGradient(40, 0, w - 40, 0);
    g.addColorStop(0, "#8B5CF6");
    g.addColorStop(1, "#06B6D4");
    ctx.fillStyle = g;
    ctx.fillRect(40, y + 34, (w - 80) * clamp(s.level, 0, 100) / 100, 12);
  });
}

const makeLinkRenderer = (title, big, small, color) => (ctx, w, h) => {
  drawFrame(ctx, w, h, color, title);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#F5F5F7";
  fitFont(ctx, big, w - 80, 56, 24);
  ctx.fillText(big, 40, h * 0.34);

  ctx.fillStyle = "#cbd5e1";
  fitFont(ctx, small, w - 80, 30, 16, "normal");
  ctx.fillText(small, 40, h * 0.34 + 80);
  drawHint(ctx, w, h, color);
};

function renderAboutScreen(ctx, w, h) {
  const color = 0x06B6D4;
  drawFrame(ctx, w, h, color, "MINA AYMAN SEIF");
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  ctx.fillStyle = "#F5F5F7";
  ctx.font = "bold 40px Arial, sans-serif";
  ctx.fillText("AI Engineer", 40, 130);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = "32px Arial, sans-serif";
  ["Deep Learning & Neural Networks", "Computer Vision", "Backend APIs with FastAPI"].forEach((t, i) => {
    ctx.fillStyle = hex(color);
    ctx.fillText("▸", 40, 210 + i * 56);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(t, 84, 210 + i * 56);
  });
  drawHint(ctx, w, h, color);
}

// ---------- منشئ الشاشة ----------
function createInfoScreen({ parent, x, y, z, width, height, color, id, label, opens, render }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round(1024 * (height / width));
  const ctx = canvas.getContext("2d");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);

  const screen = {
    id, label, opens, color, mesh, canvas, ctx, texture, render,
    position: new THREE.Vector3(),
    interactDistance: 5,
    redraw() {
      render(ctx, canvas.width, canvas.height);
      texture.needsUpdate = true;
    },
  };
  screen.redraw();
  liveScreens.push(screen);
  return screen;
}

function buildScreenTargets() {
  scene.updateMatrixWorld(true);
  liveScreens.forEach((s) => s.mesh.getWorldPosition(s.position));
}

async function loadScreenData() {
  const get = (path) =>
    fetch(`${API_URL}${path}`).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });

  const [pr, sk] = await Promise.allSettled([get("/api/projects"), get("/api/skills")]);
  if (pr.status === "fulfilled" && Array.isArray(pr.value)) screenData.projects = pr.value;
  if (sk.status === "fulfilled" && Array.isArray(sk.value)) screenData.skills = sk.value;
  screenData.loaded = true;
  liveScreens.forEach((s) => s.redraw());
}

// إعادة الرسم بعد تحميل الخط
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => liveScreens.forEach((s) => s.redraw()));
}


// ============================================
// PLATFORMS
// ============================================
const platforms = {
  list: [],
  stairs: [],
  bridges: [],
};

// ============================================
// createStairs
// ============================================
function createStairs({ endX, endZ, dirX, dirZ, steps, topY, depth = 0.8, width = 3 }) {
  const group = new THREE.Group();
  const stepH = topY / steps;
  const alongX = Math.abs(dirX) > 0.5;

  const stairMat = new THREE.MeshStandardMaterial({
    color: 0x1A1A25,
    roughness: 0.5,
    metalness: 0.6,
    emissive: 0x8B5CF6,
    emissiveIntensity: 0.1,
  });

  for (let i = 0; i < steps; i++) {
    const top = (i + 1) * stepH;
    const back = (steps - i - 0.5) * depth;
    const cx = endX - dirX * back;
    const cz = endZ - dirZ * back;

    const step = new THREE.Mesh(
      new THREE.BoxGeometry(alongX ? depth : width, top, alongX ? width : depth),
      stairMat
    );
    step.position.set(cx, top / 2, cz);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
    walkableMeshes.push(step);

    if (i % 2 === 0) {
      const neon = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? 0.1 : width, 0.03, alongX ? width : 0.1),
        new THREE.MeshBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.8 })
      );
      neon.position.set(
        cx - dirX * (depth / 2 - 0.05),
        top + 0.02,
        cz - dirZ * (depth / 2 - 0.05)
      );
      group.add(neon);
    }
  }

  scene.add(group);
  platforms.stairs.push(group);
  return group;
}

// ============================================
// createPlatform
// ============================================
function createPlatform(x, y, z, width, depth, color, hasRailing = true) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x15152A,
    roughness: 0.4,
    metalness: 0.7,
    emissive: color,
    emissiveIntensity: 0.08,
  });

  const plat = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.4, depth),
    platformMat
  );
  plat.receiveShadow = true;
  plat.castShadow = true;
  group.add(plat);

  walkableMeshes.push(plat);

  const neonMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.9,
  });

  const frontLine = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.06, 0.15),
    neonMat
  );
  frontLine.position.set(0, 0.23, depth / 2 - 0.1);
  group.add(frontLine);

  const backLine = frontLine.clone();
  backLine.position.z = -depth / 2 + 0.1;
  group.add(backLine);

  const rightLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.06, depth),
    neonMat
  );
  rightLine.position.set(width / 2 - 0.1, 0.23, 0);
  group.add(rightLine);

  const leftLine = rightLine.clone();
  leftLine.position.x = -width / 2 + 0.1;
  group.add(leftLine);

  if (hasRailing) {
    const railingMat = new THREE.MeshStandardMaterial({
      color: 0x1A1A25,
      metalness: 0.8,
      roughness: 0.3,
    });

    const railHeight = 1.2;

    for (let i = -width / 2 + 0.5; i < width / 2; i += 1.5) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, railHeight, 8),
        railingMat
      );
      post.position.set(i, 0.2 + railHeight / 2, -depth / 2 + 0.2);
      group.add(post);
    }

    for (let i = -depth / 2 + 0.5; i < depth / 2; i += 1.5) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, railHeight, 8),
        railingMat
      );
      post.position.set(width / 2 - 0.2, 0.2 + railHeight / 2, i);
      group.add(post);
    }

    for (let i = -depth / 2 + 0.5; i < depth / 2; i += 1.5) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, railHeight, 8),
        railingMat
      );
      post.position.set(-width / 2 + 0.2, 0.2 + railHeight / 2, i);
      group.add(post);
    }
  }

  const light = new THREE.PointLight(color, 2, 15);
  light.position.set(0, 2, 0);
  group.add(light);

  group.userData.topY = y + 0.2;

  scene.add(group);
  platforms.list.push(group);
  return group;
}

// ============================================
// createLevelDesign
// ============================================
function createLevelDesign() {
  // منصة 1 — وسط (y=6)
  const p1 = createPlatform(18, 6, 0, 8, 8, 0x8B5CF6);

  // [2] شاشتين المنصة 1
  for (let i = 0; i < 2; i++) {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1.3, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
    );
    frame.position.set(-2 + i * 4, 2, -2);
    p1.add(frame);

    createInfoScreen({
      parent: p1, x: -2 + i * 4, y: 2, z: -1.9,
      width: 1.85, height: 1.15,
      color: i === 0 ? 0x8B5CF6 : 0x3B82F6,
      id: `p1-screen-${i}`,
      label: i === 0 ? "GitHub" : "LinkedIn",
      opens: "contact",
      render: i === 0
        ? makeLinkRenderer("GITHUB", "MinaAyman123", "github.com/MinaAyman123", 0x8B5CF6)
        : makeLinkRenderer("LINKEDIN", "Mina Ayman", "linkedin.com/in/mina-aiman-0629a42b1", 0x3B82F6),
    });
  }

  // منصة 2 — عالية (y=6) على الشمال
  const p2 = createPlatform(-18, 6, 0, 8, 8, 0x06B6D4);

  const smallCrystal = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.6, 1),
    new THREE.MeshStandardMaterial({
      color: 0x06B6D4,
      emissive: 0x06B6D4,
      emissiveIntensity: 1.5,
      flatShading: true,
    })
  );
  smallCrystal.position.set(0, 2.5, 0);
  p2.add(smallCrystal);

  const smallRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.03, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x06B6D4 })
  );
  smallRing.rotation.x = Math.PI / 2;
  smallRing.position.set(0, 2.5, 0);
  p2.add(smallRing);

  const bigScreen = new THREE.Mesh(
    new THREE.BoxGeometry(3, 2, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
  );
  bigScreen.position.set(0, 2, -3);
  p2.add(bigScreen);

  // [3] شاشة المنصة 2 — About
  createInfoScreen({
    parent: p2, x: 0, y: 2, z: -2.9,
    width: 2.8, height: 1.8,
    color: 0x06B6D4,
    id: "p2-about",
    label: "About",
    opens: "about",
    render: renderAboutScreen,
  });

  // سلم المنصة 1: من الجنب الخارجي +x
  createStairs({ endX: 22, endZ: 0, dirX: -1, dirZ: 0, steps: 16, topY: p1.userData.topY, depth: 0.75, width: 3 });

  // سلم المنصة 2
  createStairs({ endX: -16, endZ: 4, dirX: 0, dirZ: -1, steps: 16, topY: p2.userData.topY, depth: 0.75, width: 3 });

  // ============================================
  // الجسر على شكل U
  // ============================================
  const BRIDGE_Z = -6.5;
  const BRIDGE_W = 2.5;
  const BRIDGE_T = 0.3;
  const BRIDGE_Y = p2.userData.topY - BRIDGE_T / 2;

  const bridgeMat = new THREE.MeshStandardMaterial({
    color: 0x1A1A25,
    roughness: 0.4,
    metalness: 0.7,
    emissive: 0x8B5CF6,
    emissiveIntensity: 0.15,
  });

  function addBridgePiece(minX, maxX, minZ, maxZ) {
    const w = maxX - minX;
    const d = maxZ - minZ;

    const piece = new THREE.Mesh(new THREE.BoxGeometry(w, BRIDGE_T, d), bridgeMat);
    piece.position.set((minX + maxX) / 2, BRIDGE_Y, (minZ + maxZ) / 2);
    piece.castShadow = true;
    piece.receiveShadow = true;
    scene.add(piece);
    walkableMeshes.push(piece);

    const lineY = BRIDGE_Y + BRIDGE_T / 2 + 0.03;
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x8B5CF6 });
    if (w >= d) {
      [minZ + 0.06, maxZ - 0.06].forEach((z) => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.1), lineMat);
        l.position.set((minX + maxX) / 2, lineY, z);
        scene.add(l);
      });
    } else {
      [minX + 0.06, maxX - 0.06].forEach((x) => {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, d), lineMat);
        l.position.set(x, lineY, (minZ + maxZ) / 2);
        scene.add(l);
      });
    }
  }

  const half = BRIDGE_W / 2;
  const zMin = BRIDGE_Z - half;
  const zMax = BRIDGE_Z + half;

  addBridgePiece(-16 - half, 18 + half, zMin, zMax);
  addBridgePiece(-16 - half, -16 + half, zMin, -4);
  addBridgePiece(18 - half, 18 + half, zMin, -4);

  // منصة صغيرة ثالثة (y=3)
  const p3 = createPlatform(-22, 3, 8, 5, 5, 0xEC4899);

  for (let i = 0; i < 3; i++) {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xEC4899 })
    );
    orb.position.set(-1 + i, 1, 0);
    p3.add(orb);
  }

  createStairs({ endX: -22, endZ: 10.5, dirX: 0, dirZ: -1, steps: 8, topY: p3.userData.topY, depth: 0.8, width: 2.5 });
}

createLevelDesign();


// ============================================
// AI CORE
// ============================================
const aiCore = {
  group: null,
  crystal: null,
  ring1: null,
  ring2: null,
  beam: null,
  satellites: [],
  light: null,
};

function createAICore() {
  const group = new THREE.Group();
  group.position.set(0, 4, 0);

  const crystalGeo = new THREE.IcosahedronGeometry(1.5, 2);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x8B5CF6,
    emissive: 0x8B5CF6,
    emissiveIntensity: 2,
    roughness: 0.2,
    metalness: 0.8,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
  });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.castShadow = true;
  group.add(crystal);

  const haloGeo = new THREE.SphereGeometry(2.2, 32, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x06B6D4,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  group.add(halo);

  const ring1Geo = new THREE.TorusGeometry(2.8, 0.05, 16, 100);
  const ring1Mat = new THREE.MeshBasicMaterial({
    color: 0x06B6D4,
    transparent: true,
    opacity: 0.9,
  });
  const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
  ring1.rotation.x = Math.PI / 2;
  group.add(ring1);

  const ring2Geo = new THREE.TorusGeometry(3.5, 0.04, 16, 100);
  const ring2Mat = new THREE.MeshBasicMaterial({
    color: 0x8B5CF6,
    transparent: true,
    opacity: 0.7,
  });
  const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2.rotation.x = Math.PI / 3;
  ring2.rotation.y = Math.PI / 4;
  group.add(ring2);

  const ring3Geo = new THREE.TorusGeometry(4.2, 0.02, 8, 80);
  const ring3Mat = new THREE.MeshBasicMaterial({
    color: 0xEC4899,
    transparent: true,
    opacity: 0.5,
  });
  const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
  ring3.rotation.x = Math.PI / 2.5;
  ring3.rotation.z = Math.PI / 6;
  group.add(ring3);

  const satellites = [];
  for (let i = 0; i < 8; i++) {
    const satGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const satMat = new THREE.MeshBasicMaterial({
      color: [0x06B6D4, 0x8B5CF6, 0x3B82F6][i % 3],
    });
    const sat = new THREE.Mesh(satGeo, satMat);

    const angle = (i / 8) * Math.PI * 2;
    const radius = 3.5 + Math.random() * 0.5;
    const height = (Math.random() - 0.5) * 2;

    sat.userData = {
      angle,
      radius,
      height,
      speed: 0.5 + Math.random() * 0.5,
      baseY: height,
    };

    group.add(sat);
    satellites.push(sat);
  }

  const coreLight = new THREE.PointLight(0x06B6D4, 5, 30);
  coreLight.castShadow = true;
  group.add(coreLight);

  const coreLight2 = new THREE.PointLight(0x8B5CF6, 3, 25);
  coreLight2.position.set(0, 1, 0);
  group.add(coreLight2);

  const baseGroup = new THREE.Group();
  baseGroup.position.y = -4;

  const baseDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 4, 0.4, 8),
    new THREE.MeshStandardMaterial({
      color: 0x1A1A25,
      roughness: 0.5,
      metalness: 0.7,
      emissive: 0x8B5CF6,
      emissiveIntensity: 0.1,
    })
  );
  baseDisc.castShadow = true;
  baseDisc.receiveShadow = true;
  baseGroup.add(baseDisc);

  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.08, 12, 40),
    new THREE.MeshBasicMaterial({
      color: 0x06B6D4,
      transparent: true,
      opacity: 0.9,
    })
  );
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.21;
  baseGroup.add(baseRing);

  scene.add(baseGroup);

  const beams = [];
  for (let i = 0; i < 6; i++) {
    const beamGeo = new THREE.CylinderGeometry(0.03, 0.08, 4, 6);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x06B6D4,
      transparent: true,
      opacity: 0.4,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);

    const angle = (i / 6) * Math.PI * 2;
    beam.position.set(Math.cos(angle) * 1.5, -2, Math.sin(angle) * 1.5);
    beam.rotation.z = Math.cos(angle) * 0.3;
    beam.rotation.x = Math.sin(angle) * 0.3;

    group.add(beam);
    beams.push(beam);
  }

  scene.add(group);

  aiCore.group = group;
  aiCore.crystal = crystal;
  aiCore.ring1 = ring1;
  aiCore.ring2 = ring2;
  aiCore.ring3 = ring3;
  aiCore.satellites = satellites;
  aiCore.light = coreLight;
}

createAICore();


// ============================================
// STARS + NEBULA
// ============================================
const starsGroup = new THREE.Group();

function createStars() {
  const starCount = 300;
  const starGeo = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  const palette = [
    new THREE.Color(0xFFFFFF),
    new THREE.Color(0x8B5CF6),
    new THREE.Color(0x06B6D4),
    new THREE.Color(0x3B82F6),
    new THREE.Color(0xEC4899),
  ];

  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const radius = 150 + Math.random() * 30;

    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) - 20;
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const color = palette[Math.floor(Math.random() * palette.length)];
    starColors[i * 3] = color.r;
    starColors[i * 3 + 1] = color.g;
    starColors[i * 3 + 2] = color.b;
  }

  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 0.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
  });

  const stars = new THREE.Points(starGeo, starMat);
  starsGroup.add(stars);

  const nebulaColors = [
    { color: 0x8B5CF6, position: [-60, 40, -80], scale: 60 },
    { color: 0x06B6D4, position: [80, 50, -60], scale: 50 },
    { color: 0xEC4899, position: [0, 60, -100], scale: 40 },
  ];

  nebulaColors.forEach(({ color, position, scale }) => {
    const nebulaGeo = new THREE.SphereGeometry(scale, 32, 32);
    const nebulaMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const nebula = new THREE.Mesh(nebulaGeo, nebulaMat);
    nebula.position.set(...position);
    starsGroup.add(nebula);
  });

  const planets = [
    { color: 0x8B5CF6, position: [-100, 60, -120], radius: 4 },
    { color: 0x06B6D4, position: [120, 70, -100], radius: 3 },
    { color: 0xEC4899, position: [80, 40, -140], radius: 2.5 },
  ];

  planets.forEach(({ color, position, radius }) => {
    const planetGeo = new THREE.SphereGeometry(radius, 24, 24);
    const planetMat = new THREE.MeshBasicMaterial({
      color: color,
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.set(...position);
    starsGroup.add(planet);

    const ringGeo = new THREE.TorusGeometry(radius * 1.8, 0.1, 8, 60);
    const ringMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    ring.rotation.z = Math.PI / 6;
    ring.position.copy(planet.position);
    starsGroup.add(ring);
  });

  scene.add(starsGroup);
}

createStars();


// ============================================
// INTERACTIVE STATIONS
// ============================================
const stations = [];
window.stations = stations;

function createStation({ id, name, color, position }) {
  const group = new THREE.Group();
  group.position.set(...position);

  const baseDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.2, 0.3, 32),
    new THREE.MeshStandardMaterial({
      color: 0x1A1A25,
      roughness: 0.3,
      metalness: 0.9,
      emissive: color,
      emissiveIntensity: 0.2,
    })
  );
  baseDisc.receiveShadow = true;
  baseDisc.castShadow = true;
  group.add(baseDisc);

  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.08, 12, 60),
    new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.95,
    })
  );
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.2;
  group.add(baseRing);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.7, 2.5, 16),
    new THREE.MeshStandardMaterial({
      color: 0x1A1A25,
      roughness: 0.4,
      metalness: 0.8,
      emissive: color,
      emissiveIntensity: 0.3,
    })
  );
  pillar.position.y = 1.5;
  pillar.castShadow = true;
  group.add(pillar);

  const holoCrystal = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.7, 1),
    new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 2,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
    })
  );
  holoCrystal.position.y = 3.5;
  group.add(holoCrystal);

  const holoRing1 = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.03, 12, 60),
    new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
    })
  );
  holoRing1.rotation.x = Math.PI / 2;
  holoRing1.position.y = 3.5;
  group.add(holoRing1);

  const holoRing2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.02, 12, 60),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
    })
  );
  holoRing2.rotation.x = Math.PI / 3;
  holoRing2.rotation.y = Math.PI / 4;
  holoRing2.position.y = 3.5;
  group.add(holoRing2);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext("2d");
  ctx.fillStyle = "#0A0A0F";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.font = "bold 56px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name.toUpperCase(), 256, 64);

  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 0.75),
    new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  labelMesh.position.y = 5.5;
  group.add(labelMesh);

  const light = new THREE.PointLight(color, 3, 12);
  light.position.y = 3.5;
  group.add(light);

  scene.add(group);

  group.userData = {
    holoCrystal,
    holoRing1,
    holoRing2,
    light,
    baseRing,
  };

  const station = {
    id,
    name,
    color,
    position: new THREE.Vector3(...position),
    group,
    interactDistance: 3.5,
  };
  stations.push(station);

  return station;
}

function createAllStations() {
  createStation({
    id: "about",
    name: "About",
    color: 0x8B5CF6,
    position: [-25, 0, -20],
  });

  createStation({
    id: "projects",
    name: "Projects",
    color: 0x3B82F6,
    position: [25, 0, -20],
  });

  createStation({
    id: "skills",
    name: "Skills",
    color: 0x06B6D4,
    position: [-25, 0, 20],
  });

  createStation({
    id: "contact",
    name: "Contact",
    color: 0xEC4899,
    position: [25, 0, 20],
  });
}

createAllStations();


// ============================================
// ROOM DECORATIONS
// ============================================
function createAboutRoom() {
  const group = new THREE.Group();
  group.position.set(-15, 0, -15);

  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.2, 2),
    new THREE.MeshStandardMaterial({ color: 0x2A2A3A, roughness: 0.7 })
  );
  desk.position.set(-6, 1, 0);
  desk.castShadow = true;
  desk.receiveShadow = true;
  group.add(desk);

  const legGeo = new THREE.BoxGeometry(0.15, 1, 0.15);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1A1A25 });
  [[-1.8, 0.9], [1.8, 0.9], [-1.8, -0.9], [1.8, -0.9]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(-6 + x, 0.5, z);
    group.add(leg);
  });

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x8B5CF6, emissive: 0x8B5CF6, emissiveIntensity: 0.3 })
  );
  cup.position.set(-6, 1.3, 0.3);
  cup.castShadow = true;
  group.add(cup);

  const bookColors = [0x3B82F6, 0x06B6D4, 0xEC4899];
  for (let i = 0; i < 3; i++) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.12, 0.6),
      new THREE.MeshStandardMaterial({
        color: bookColors[i],
        emissive: bookColors[i],
        emissiveIntensity: 0.15,
      })
    );
    book.position.set(-5, 1.15 + i * 0.12, -0.6);
    book.castShadow = true;
    group.add(book);
  }

  const chairSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.15, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
  );
  chairSeat.position.set(-6, 0.9, 1.8);
  chairSeat.castShadow = true;
  group.add(chairSeat);

  const chairBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
  );
  chairBack.position.set(-6, 1.4, 2.1);
  chairBack.castShadow = true;
  group.add(chairBack);

  scene.add(group);
}

function createProjectsRoom() {
  const group = new THREE.Group();
  group.position.set(15, 0, -15);

  // [4] 3 شاشات المشاريع
  const projColors = [0x06B6D4, 0x3B82F6, 0x8B5CF6];
  for (let i = 0; i < 3; i++) {
    const screenFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.6, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
    );
    screenFrame.position.set(-3 + i * 3, 3.5, 0);
    screenFrame.castShadow = true;
    group.add(screenFrame);

    createInfoScreen({
      parent: group, x: -3 + i * 3, y: 3.5, z: 0.1,
      width: 2.3, height: 1.4,
      color: projColors[i],
      id: `projects-screen-${i}`,
      label: "Projects",
      opens: "projects",
      render: makeProjectRenderer(i, projColors[i]),
    });

    const backLight = new THREE.PointLight(0x06B6D4, 1.5, 6);
    backLight.position.set(-3 + i * 3, 3.5, 1);
    group.add(backLight);
  }

  const table = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.2, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x2A2A3A })
  );
  table.position.set(0, 1, 3);
  table.castShadow = true;
  table.receiveShadow = true;
  group.add(table);

  [[-3.8, 3], [3.8, 3]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
    );
    leg.position.set(x, 0.5, z);
    group.add(leg);
  });

  scene.add(group);
}

function createSkillsRoom() {
  const group = new THREE.Group();
  group.position.set(-10, 0, 12);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(5, 2.5, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
  );
  board.position.set(0, 2.2, -0.6);
  board.castShadow = true;
  group.add(board);

  // [5] شاشة المهارات
  createInfoScreen({
    parent: group, x: 0, y: 2.2, z: -0.48,
    width: 4.7, height: 2.2,
    color: 0x8B5CF6,
    id: "skills-board",
    label: "Skills",
    opens: "skills",
    render: renderSkillsBoard,
  });

  const barColors = [0x8B5CF6, 0x3B82F6, 0x06B6D4, 0x8B5CF6, 0x3B82F6];
  const barHeights = [1.2, 1.8, 2.6, 1.5, 2.2];
  const barSpacing = 0.8;

  barHeights.forEach((h, i) => {
    const barX = (i - 2) * barSpacing;

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, h, 0.6),
      new THREE.MeshStandardMaterial({
        color: barColors[i],
        emissive: barColors[i],
        emissiveIntensity: 0.5,
      })
    );
    bar.position.set(barX, h / 2, 0);
    bar.castShadow = true;
    group.add(bar);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.08, 0.7),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: barColors[i],
        emissiveIntensity: 1.5,
      })
    );
    cap.position.set(barX, h + 0.04, 0);
    group.add(cap);
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5, 0.15, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2A2A3A })
  );
  base.position.set(0, 0.05, 0);
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  scene.add(group);
}

function createContactRoom() {
  const group = new THREE.Group();
  group.position.set(15, 0, 15);

  const mailboxPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
  );
  mailboxPost.position.set(-3, 0.75, 0);
  mailboxPost.castShadow = true;
  group.add(mailboxPost);

  const mailbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.6, 1.2),
    new THREE.MeshStandardMaterial({
      color: 0xEC4899,
      emissive: 0xEC4899,
      emissiveIntensity: 0.3,
    })
  );
  mailbox.position.set(-3, 1.9, 0);
  mailbox.castShadow = true;
  group.add(mailbox);

  const sofaSeat = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x2A2A3A })
  );
  sofaSeat.position.set(2, 0.5, 0);
  sofaSeat.castShadow = true;
  group.add(sofaSeat);

  const sofaBack = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.8, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2A2A3A })
  );
  sofaBack.position.set(2, 0.9, -0.45);
  sofaBack.castShadow = true;
  group.add(sofaBack);

  scene.add(group);
}

createAboutRoom();
createProjectsRoom();
createSkillsRoom();
createContactRoom();

[
  { pos: [-15, 4, -15], color: COLORS.purple },
  { pos: [ 15, 4, -15], color: COLORS.blue   },
  { pos: [-15, 4,  15], color: COLORS.cyan   },
  { pos: [ 15, 4,  15], color: COLORS.pink   },
].forEach(({ pos, color }) => {
  const light = new THREE.PointLight(color, 3, 15);
  light.position.set(...pos);
  scene.add(light);
});


// ============================================
// DECORATIONS
// ============================================
const pillarPositions = [
  [-25, 6, -25], [25, 6, -25], [-25, 6, 25], [25, 6, 25],
];
const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 14, 12);
const pillarMat = new THREE.MeshStandardMaterial({
  color: 0x1A1A25,
  roughness: 0.6,
  metalness: 0.5,
  emissive: COLORS.purple,
  emissiveIntensity: 0.08,
});
pillarPositions.forEach(([x, y, z]) => {
  const pillar = new THREE.Mesh(pillarGeo, pillarMat);
  pillar.position.set(x, y, z);
  pillar.castShadow = true;
  scene.add(pillar);
});

const orbs = [];
const orbGeo = new THREE.SphereGeometry(0.15, 8, 8);
for (let i = 0; i < 50; i++) {
  const orb = new THREE.Mesh(
    orbGeo,
    new THREE.MeshBasicMaterial({
      color: [COLORS.purple, COLORS.blue, COLORS.cyan][Math.floor(Math.random() * 3)],
    })
  );
  orb.position.set(
    (Math.random() - 0.5) * 70,
    Math.random() * 10 + 1,
    (Math.random() - 0.5) * 70
  );
  orb.userData.floatSpeed = 0.5 + Math.random();
  orb.userData.floatOffset = Math.random() * Math.PI * 2;
  orbs.push(orb);
  scene.add(orb);
}

// ============================================
// PLAYER
// ============================================
const loader = new FBXLoader();
const player = {
  object: null,
  mixer: null,
  actions: {},
  currentAction: null,

  position: new THREE.Vector3(0, 0.3, 12),
  velocity: new THREE.Vector3(),
  rotation: Math.PI,
  smoothY: 0.3,
  hSpeed: 0,

  isGrounded: true,
  coyoteTimer: 0,
  jumpBuffer: 0,

  gravity: -22,
  fallMultiplier: 1.4,
  jumpForce: 7,

  radius: 0.25,
  height: 1.7,
  stepHeight: 0.6,
};
window.player = player;


async function loadCharacter() {
  return new Promise((resolve, reject) => {
    loader.load(
      "assets/characters/maria.fbx",
      (object) => {
        object.scale.set(0.02, 0.02, 0.02);
        object.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        player.object = object;
        scene.add(object);
        player.mixer = new THREE.AnimationMixer(object);
        resolve();
      },
      undefined,
      reject
    );
  });
}

async function loadAnimations() {
  const anims = [
    { name: "idle", path: "assets/animations/idle.fbx" },
    { name: "walk", path: "assets/animations/walk.fbx" },
    { name: "run",  path: "assets/animations/run.fbx"  },
  ];

  await Promise.all(
    anims.map(({ name, path }) =>
      new Promise((resolve) => {
        loader.load(
          path,
          (anim) => {
            const clip = anim.animations[0];
            if (clip) {
              clip.tracks = clip.tracks.filter(
                (t) => !(t.name.toLowerCase().includes("hips") && t.name.endsWith(".position"))
              );

              const action = player.mixer.clipAction(clip);
              action.loop = THREE.LoopRepeat;
              player.actions[name] = action;
            }
            resolve();
          },
          undefined,
          () => resolve()
        );
      })
    )
  );
}

function playAction(name, fade = 0.25) {
  const next = player.actions[name];
  if (!next || player.currentAction === name) return;

  const prev = player.actions[player.currentAction];

  next.enabled = true;
  next.setEffectiveTimeScale(1);
  next.setEffectiveWeight(1);
  next.play();

  if (prev) prev.crossFadeTo(next, fade, false);

  player.currentAction = name;
}

// ============================================
// INPUT
// ============================================
const keys = {};
window.gameKeys = keys;

let cameraYaw   = Math.PI;
let cameraPitch = 0.3;

const GAME_KEYS = [
  "KeyW", "KeyA", "KeyS", "KeyD",
  "KeyE", "KeyQ",
  "Space",
  "ShiftLeft", "ShiftRight",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
];

window.addEventListener("keydown", (e) => {
  if (GAME_KEYS.includes(e.code)) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  keys[e.code] = true;
  
  if (e.code === "Space" && !e.repeat) player.jumpBuffer = JUMP_BUFFER_TIME;
  
  if (e.code === "KeyE") tryInteract();
});

window.addEventListener("keyup", (e) => {
  if (GAME_KEYS.includes(e.code)) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  keys[e.code] = false;
});

window.addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
});

// ============================================
// POINTER LOCK
// ============================================
const clickToStart = document.getElementById("clickToStart");
const roomPanelEl = document.getElementById("roomPanel");

let pointerLocked = false;

document.body.addEventListener("click", (e) => {
  if (e.target.closest("#exitBtn")) return;
  if (e.target.closest("#roomPanel")) return;
  if (pointerLocked) return;
  if (!roomPanelEl.classList.contains("hidden")) return;

  document.body.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === document.body;

  if (pointerLocked) {
    document.body.classList.add("playing");
    clickToStart.classList.add("hidden");
  } else {
    document.body.classList.remove("playing");
    if (roomPanelEl.classList.contains("hidden")) {
      clickToStart.classList.remove("hidden");
    }
  }
});

document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  cameraYaw   -= e.movementX * 0.0025;
  cameraPitch += e.movementY * 0.002;
  cameraPitch  = clamp(cameraPitch, CAMERA_MIN_PITCH, CAMERA_MAX_PITCH);
});

// ============================================
// INTERACTION
// ============================================
const interactHint = document.getElementById("interactHint");
let currentTarget = null;

// [6] checkNearbyTarget بالنسخة الجديدة
function checkNearbyTarget() {
  const pp = player.position;
  let best = null;
  let bestDist = Infinity;

  const consider = (type, key, panelId, name, dist) => {
    if (dist < bestDist) {
      bestDist = dist;
      best = { type, key, id: panelId, name };
    }
  };

  doors.forEach((d) => {
    const dist = pp.distanceTo(d.position);
    if (dist < d.interactDistance) consider("door", d.id, d.id, d.id.toUpperCase(), dist);
  });

  stations.forEach((s) => {
    const dist = pp.distanceTo(s.position);
    if (dist < s.interactDistance) consider("station", s.id, s.id, s.name, dist);
  });

  liveScreens.forEach((s) => {
    const dist = Math.hypot(pp.x - s.position.x, pp.z - s.position.z);
    const sameLevel = Math.abs(pp.y + 1 - s.position.y) < 4;
    if (dist < s.interactDistance && sameLevel) consider("screen", s.id, s.opens, s.label, dist);
  });

  const currentKey = best ? `${best.type}-${best.key}` : null;
  const prevKey = currentTarget ? `${currentTarget.type}-${currentTarget.key}` : null;
  if (currentKey === prevKey) return;

  const statusText = document.getElementById("statusText");
  if (best) {
    currentTarget = best;
    const prefix = best.type === "door" ? "Enter" : best.type === "screen" ? "View" : "Use";
    interactHint.classList.remove("hidden");
    interactHint.innerHTML = `Press <kbd>E</kbd> to ${prefix} <strong style="color:#06B6D4">${best.name}</strong>`;
    if (statusText) statusText.textContent = `Near: ${best.name}`;
  } else {
    currentTarget = null;
    interactHint.classList.add("hidden");
    if (statusText) statusText.textContent = "Exploring";
  }
}

function tryInteract() {
  if (!currentTarget) return;
  openRoomPanel(currentTarget.id);
}

// ============================================
// ROOM PANEL
// ============================================
const roomPanel = document.getElementById("roomPanel");
const roomTitle = document.getElementById("roomTitle");
const roomBody = document.getElementById("roomBody");

function openRoomPanel(roomId) {
  roomPanel.classList.remove("hidden");
  switch (roomId) {
    case "about":    showAbout();    break;
    case "projects": showProjects(); break;
    case "skills":   showSkills();   break;
    case "contact":  showContact();  break;
  }
}

function showAbout() {
  roomTitle.textContent = "ABOUT ME";
  roomBody.innerHTML = `
    <p>I'm <strong style="color:#8B5CF6">Mina Ayman Seif</strong>, an AI Engineer passionate about building intelligent systems.</p>
    <p style="margin-top:16px">Specialized in:</p>
    <ul style="margin:12px 0 0 20px">
      <li>Deep Learning & Neural Networks</li>
      <li>Computer Vision</li>
      <li>Backend APIs with FastAPI</li>
    </ul>
    <p style="margin-top:20px">
      <a href="https://github.com/MinaAyman123" target="_blank" style="color:#06B6D4">GitHub</a> ·
      <a href="https://www.linkedin.com/in/mina-aiman-0629a42b1/" target="_blank" style="color:#06B6D4">LinkedIn</a>
    </p>
  `;
}

async function showSkills() {
  roomTitle.textContent = "SKILLS";
  roomBody.innerHTML = `<p>Loading...</p>`;
  try {
    const res = await fetch(`${API_URL}/api/skills`);
    const skills = await res.json();
    roomBody.innerHTML = skills.map(s => `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="color:#F5F5F7">${s.name}</span>
          <span style="color:#8B5CF6;font-family:Orbitron">${s.level}%</span>
        </div>
        <div style="height:4px;background:#0A0A0F;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${s.level}%;background:linear-gradient(90deg,#8B5CF6,#06B6D4);box-shadow:0 0 10px #8B5CF6"></div>
        </div>
      </div>
    `).join("");
  } catch {
    roomBody.innerHTML = `<p style="color:#EF4444">Failed to load.</p>`;
  }
}

async function showProjects() {
  roomTitle.textContent = "PROJECTS";
  roomBody.innerHTML = `<p>Loading...</p>`;
  try {
    const res = await fetch(`${API_URL}/api/projects`);
    const projects = await res.json();
    roomBody.innerHTML = projects.map(p => `
      <div style="margin-bottom:20px;padding:16px;background:#0A0A0F;border-radius:10px;border:1px solid #8B5CF640">
        <h3 style="color:#F5F5F7;font-family:Orbitron;font-size:1rem;letter-spacing:1px;margin-bottom:8px">${p.name}</h3>
        <p style="margin-bottom:12px">${p.description || ""}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          ${(p.tech || []).map(t => `<span style="font-size:0.7rem;padding:4px 10px;background:#8B5CF620;color:#8B5CF6;border:1px solid #8B5CF640;border-radius:20px">${t}</span>`).join("")}
        </div>
        ${p.github ? `<a href="${p.github}" target="_blank" style="color:#06B6D4;font-size:0.8rem">View on GitHub →</a>` : ""}
      </div>
    `).join("");
  } catch {
    roomBody.innerHTML = `<p style="color:#EF4444">Failed to load.</p>`;
  }
}

function showContact() {
  roomTitle.textContent = "CONTACT";
  roomBody.innerHTML = `
    <p>Let's connect:</p>
    <p style="margin-top:16px">
      <strong style="color:#06B6D4">GitHub:</strong> <a href="https://github.com/MinaAyman123" target="_blank" style="color:#8B5CF6">MinaAyman123</a><br>
      <strong style="color:#06B6D4">LinkedIn:</strong> <a href="https://www.linkedin.com/in/mina-aiman-0629a42b1/" target="_blank" style="color:#8B5CF6">Mina Ayman</a>
    </p>
  `;
}

document.getElementById("closePanel").addEventListener("click", () => {
  roomPanel.classList.add("hidden");
});
document.getElementById("exitBtn").addEventListener("click", () => {
  window.location.href = "../about.html";
});

// ============================================
// UPDATE LOOP
// ============================================
const clock = new THREE.Clock();
const _camTarget = new THREE.Vector3();

function chooseAnimation(absSpeed) {
  if (absSpeed < IDLE_THRESHOLD) return "idle";

  if (player.currentAction === "run") {
    return absSpeed < RUN_DOWN_THRESHOLD ? "walk" : "run";
  }
  return absSpeed > RUN_UP_THRESHOLD ? "run" : "walk";
}

// ============================================
// Colliders + updatePlayer
// ============================================
const colliders = [];

function buildColliders() {
  scene.updateMatrixWorld(true);
  colliders.length = 0;
  const box = new THREE.Box3();
  walkableMeshes.forEach((mesh) => {
    box.setFromObject(mesh);
    colliders.push({
      minX: box.min.x, maxX: box.max.x,
      minZ: box.min.z, maxZ: box.max.z,
      bottom: box.min.y, top: box.max.y,
    });
  });
}

function overlapsXZ(c, x, z, r) {
  return x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r;
}

function getGroundHeight(x, z, feetY) {
  const maxY = feetY + player.stepHeight + 0.01;
  let best = 0;
  for (const c of colliders) {
    if (c.top <= maxY && c.top > best && overlapsXZ(c, x, z, player.radius)) {
      best = c.top;
    }
  }
  return best;
}

function isBlocked(x, z, feetY) {
  const stepTop = feetY + player.stepHeight + 0.01;
  const headY = feetY + player.height;
  for (const c of colliders) {
    if (c.top > stepTop && c.bottom < headY && overlapsXZ(c, x, z, player.radius)) {
      return true;
    }
  }
  return false;
}

function moveHorizontal(dx, dz) {
  const p = player.position;
  const v = player.velocity;

  const nx = clamp(p.x + dx, -50, 50);
  if (!isBlocked(nx, p.z, p.y)) p.x = nx; else v.x = 0;

  const nz = clamp(p.z + dz, -50, 50);
  if (!isBlocked(p.x, nz, p.y)) p.z = nz; else v.z = 0;
}

const cameraPivot = new THREE.Vector3(0, 0.3 + CAMERA_PIVOT_HEIGHT, 12);
const _pivotTarget = new THREE.Vector3();

function updatePlayer(delta) {
  if (!player.object) return;
  const p = player.position;
  const v = player.velocity;

  if (keys["ArrowLeft"])  cameraYaw += 1.8 * delta;
  if (keys["ArrowRight"]) cameraYaw -= 1.8 * delta;

  let ix = (keys["KeyD"] ? 1 : 0) - (keys["KeyA"] ? 1 : 0);
  let iz = (keys["KeyW"] ? 1 : 0) - (keys["KeyS"] ? 1 : 0);
  const inputLen = Math.hypot(ix, iz);
  if (inputLen > 1) { ix /= inputLen; iz /= inputLen; }
  const hasInput = inputLen > 0.01;

  const fx = Math.sin(cameraYaw), fz = Math.cos(cameraYaw);
  const dirX = fx * iz - fz * ix;
  const dirZ = fz * iz + fx * ix;

  const running = keys["ShiftLeft"] || keys["ShiftRight"];
  const topSpeed = running ? RUN_SPEED : WALK_SPEED;

  if (player.isGrounded || hasInput) {
    const rate = !player.isGrounded ? ACCEL_AIR : hasInput ? ACCEL_GROUND : DECEL_GROUND;
    const k = dampFactor(rate, delta);
    v.x += (dirX * topSpeed - v.x) * k;
    v.z += (dirZ * topSpeed - v.z) * k;
  }

  const hSpeed = Math.hypot(v.x, v.z);
  if (hSpeed < 0.05 && !hasInput) { v.x = 0; v.z = 0; }
  player.hSpeed = hSpeed;

  if (hasInput) {
    const targetRot = Math.atan2(dirX, dirZ);
    player.rotation += wrapAngle(targetRot - player.rotation) * dampFactor(TURN_SPEED, delta);
  }

  moveHorizontal(v.x * delta, v.z * delta);

  player.jumpBuffer = Math.max(0, player.jumpBuffer - delta);
  player.coyoteTimer = player.isGrounded ? COYOTE_TIME : Math.max(0, player.coyoteTimer - delta);

  if (player.jumpBuffer > 0 && player.coyoteTimer > 0) {
    v.y = player.jumpForce;
    player.isGrounded = false;
    player.coyoteTimer = 0;
    player.jumpBuffer = 0;
  }

  const ground = getGroundHeight(p.x, p.z, p.y);

  if (player.isGrounded) {
    if (p.y - ground <= player.stepHeight + 0.01) {
      p.y = ground;
      v.y = 0;
    } else {
      player.isGrounded = false;
      v.y = 0;
    }
  } else {
    v.y += player.gravity * (v.y < 0 ? player.fallMultiplier : 1) * delta;
    p.y += v.y * delta;
    if (p.y <= ground) {
      p.y = ground;
      v.y = 0;
      player.isGrounded = true;
    }
  }

  player.smoothY += (p.y - player.smoothY) * dampFactor(player.isGrounded ? 18 : 40, delta);

  player.object.position.set(p.x, player.smoothY, p.z);
  player.object.rotation.y = player.rotation;

  if (player.isGrounded) playAction(chooseAnimation(hSpeed));

  if (player.currentAction === "walk" && player.actions.walk) {
    player.actions.walk.timeScale = clamp(hSpeed / WALK_SPEED, 0.5, 1.5);
  } else if (player.currentAction === "run" && player.actions.run) {
    player.actions.run.timeScale = clamp(hSpeed / RUN_SPEED, 0.7, 1.3);
  }

  _pivotTarget.set(p.x, player.smoothY + CAMERA_PIVOT_HEIGHT, p.z);
  cameraPivot.x += (_pivotTarget.x - cameraPivot.x) * dampFactor(14, delta);
  cameraPivot.z += (_pivotTarget.z - cameraPivot.z) * dampFactor(14, delta);
  cameraPivot.y += (_pivotTarget.y - cameraPivot.y) * dampFactor(6, delta);

  const cp = Math.cos(cameraPitch);
  camera.position.set(
    cameraPivot.x - Math.sin(cameraYaw) * cp * CAMERA_DISTANCE,
    Math.max(cameraPivot.y + Math.sin(cameraPitch) * CAMERA_DISTANCE, 0.4),
    cameraPivot.z - Math.cos(cameraYaw) * cp * CAMERA_DISTANCE
  );
  camera.lookAt(cameraPivot);

  const targetFov = 60 + clamp((hSpeed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1) * 7;
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov += (targetFov - camera.fov) * dampFactor(4, delta);
    camera.updateProjectionMatrix();
  }

  checkNearbyTarget();
}

function animateOrbs(time) {
  orbs.forEach(orb => {
    orb.position.y += Math.sin(time * orb.userData.floatSpeed + orb.userData.floatOffset) * 0.005;
    orb.rotation.y += 0.01;
  });
}

function updateStations(time, delta) {
  stations.forEach((station, idx) => {
    const { holoCrystal, holoRing1, holoRing2, light, baseRing } = station.group.userData;

    holoCrystal.rotation.y += delta * 0.5;
    holoCrystal.rotation.x += delta * 0.3;

    const pulse = 1.8 + Math.sin(time * 2 + idx) * 0.5;
    holoCrystal.material.emissiveIntensity = pulse;
    light.intensity = 3 + Math.sin(time * 2 + idx) * 1;

    holoRing1.rotation.z += delta * 0.8;
    holoRing2.rotation.y += delta * 0.4;
    holoRing2.rotation.z += delta * 0.6;

    baseRing.material.opacity = 0.7 + Math.sin(time * 3 + idx) * 0.3;
  });
}

function updatePlatforms(time) {
  platforms.list.forEach((platform, i) => {
    const light = platform.children.find(c => c.isPointLight);
    if (light) {
      light.intensity = 2 + Math.sin(time * 1.5 + i) * 0.5;
    }
  });
}

function updateCentralPath(time) {
  centralPath.neonLines.forEach((item, idx) => {
    if (item.isHorizontal) {
      item.mesh.position.z = item.baseZ + Math.sin(time * 1.5 + item.offset) * 1.5;
      item.mesh.material.opacity = 0.4 + Math.sin(time * 3 + item.offset) * 0.3;
    } else {
      item.mesh.material.opacity = 0.7 + Math.sin(time * 2 + idx) * 0.25;
    }
  });

  centralPath.pillars.forEach((pillar, i) => {
    pillar.material.emissiveIntensity = 0.3 + Math.sin(time * 1.5 + i * 0.5) * 0.2;
  });
}

function updateAICore(time, delta) {
  if (!aiCore.group) return;

  aiCore.crystal.rotation.y += delta * 0.3;
  aiCore.crystal.rotation.x += delta * 0.1;

  const pulse = 1.8 + Math.sin(time * 1.5) * 0.4;
  aiCore.crystal.material.emissiveIntensity = pulse;
  aiCore.light.intensity = 4 + Math.sin(time * 1.5) * 1.5;

  aiCore.ring1.rotation.z += delta * 0.5;
  aiCore.ring2.rotation.y += delta * 0.3;
  aiCore.ring2.rotation.x += delta * 0.2;
  if (aiCore.ring3) {
    aiCore.ring3.rotation.z -= delta * 0.4;
    aiCore.ring3.rotation.y += delta * 0.15;
  }

  aiCore.satellites.forEach(sat => {
    sat.userData.angle += delta * sat.userData.speed;
    sat.position.x = Math.cos(sat.userData.angle) * sat.userData.radius;
    sat.position.z = Math.sin(sat.userData.angle) * sat.userData.radius;
    sat.position.y = sat.userData.baseY + Math.sin(time * 2 + sat.userData.angle) * 0.3;
  });

  aiCore.group.position.y = 4 + Math.sin(time * 0.8) * 0.15;
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  updatePlayer(delta);
  animateOrbs(time);
  updateAICore(time, delta);
  updateCentralPath(time);
  updatePlatforms(time);
  updateStations(time, delta);
  if (player.mixer) player.mixer.update(delta);

  doors.forEach((door, i) => {
    const mesh = door.group.children[1];
    if (mesh && mesh.material) {
      mesh.material.emissiveIntensity = 0.4 + Math.sin(time * 2 + i) * 0.25;
    }
  });

  composer.render();
}

// ============================================
// RESIZE
// ============================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================
// START
// ============================================
const hud = document.getElementById("hud");
const loading = document.getElementById("loading");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

function setProgress(value) {
  progressFill.style.width = value + "%";
  progressText.textContent = Math.floor(value) + "%";
}

async function init() {
  try {
    setProgress(0);

    setProgress(10);
    await loadCharacter();
    setProgress(50);

    setProgress(60);
    await loadAnimations();

    buildColliders();

    // [7] buildScreenTargets + loadScreenData
    buildScreenTargets();
    loadScreenData();  // من غير await — الشاشات بتتحدّث لما البيانات توصل

    player.position.set(0, 0.3, 12);
    player.smoothY = 0.3;
    player.rotation = Math.PI;
    player.object.position.copy(player.position);
    player.object.rotation.y = player.rotation;
    cameraPivot.set(0, 0.3 + CAMERA_PIVOT_HEIGHT, 12);

    setProgress(90);

    playAction("idle");
    setProgress(100);

    await new Promise(r => setTimeout(r, 400));

    loading.classList.add("fade-out");
    setTimeout(() => loading.remove(), 600);

    hud.classList.remove("hidden");
    clickToStart.classList.remove("hidden");
    
    const bottomHud = document.getElementById("bottomHud");
    if (bottomHud) bottomHud.classList.remove("hidden");

    animate();

    console.log("🌍 World ready — click to start");
  } catch (err) {
    console.error("Failed to load character:", err);
    loading.querySelector(".loading-text").textContent = "⚠️ Failed to load character";
  }
}

init();