import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
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

const CAMERA_DISTANCE = 8;
const CAMERA_HEIGHT   = 3.5;
const CAMERA_FOLLOW   = 6;    // أعلى = الكاميرا تلحق أسرع (مبنية على الوقت)
const ROTATE_SPEED    = 2.5;  // راديان في الثانية

// حدود تبديل الأنيميشن (مع hysteresis عشان ما يحصلش تنطيط)
const RUN_UP_THRESHOLD   = 6.2;
const RUN_DOWN_THRESHOLD = 5.5;
const IDLE_THRESHOLD     = 0.5;

// ============================================
// HELPERS
// ============================================
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// تنعيم مستقل عن عدد الفريمات
const dampFactor = (lambda, dt) => 1 - Math.exp(-lambda * dt);

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
topColor:    { value: new THREE.Color(0x6A4A9A) },  // بنفسجي أوضح
bottomColor: { value: new THREE.Color(0x1A1530) },  // أسود بنفسجي
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
// LIGHTS
// ============================================
scene.add(new THREE.AmbientLight(0xffffff, 0.9));


const hemi = new THREE.HemisphereLight(COLORS.purple, COLORS.bg, 0.8);  // ← كان 0.6
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 1.8);  // ← كان 1.2
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

// ============================================
// ROOM DECORATIONS (تفاصيل كل غرفة)
// ============================================
function createAboutRoom() {
  const group = new THREE.Group();
  group.position.set(-15, 0, -15); // نفس مكان باب ABOUT

  // مكتب
  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.2, 2),
    new THREE.MeshStandardMaterial({ color: 0x2A2A3A, roughness: 0.7 })
  );
  desk.position.set(-6, 1, 0);
  desk.castShadow = true;
  desk.receiveShadow = true;
  group.add(desk);

  // أرجل المكتب (4 أرجل)
  const legGeo = new THREE.BoxGeometry(0.15, 1, 0.15);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1A1A25 });
  [[-1.8, 0.9], [1.8, 0.9], [-1.8, -0.9], [1.8, -0.9]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(-6 + x, 0.5, z);
    group.add(leg);
  });

  // كوب على المكتب
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x8B5CF6, emissive: 0x8B5CF6, emissiveIntensity: 0.3 })
  );
  cup.position.set(-6, 1.3, 0.3);
  cup.castShadow = true;
  group.add(cup);

  // كتب متكدسة
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

  // كرسي
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
  group.position.set(15, 0, -15); // نفس مكان باب PROJECTS

  // 3 شاشات جدارية
  for (let i = 0; i < 3; i++) {
    const screenFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.6, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
    );
    screenFrame.position.set(-3 + i * 3, 3.5, 0);
    screenFrame.castShadow = true;
    group.add(screenFrame);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 1.4),
      new THREE.MeshStandardMaterial({
        color: 0x06B6D4,
        emissive: 0x06B6D4,
        emissiveIntensity: 0.7,
      })
    );
    screen.position.set(-3 + i * 3, 3.5, 0.1);
    group.add(screen);

    // إضاءة خلف الشاشة
    const backLight = new THREE.PointLight(0x06B6D4, 1.5, 6);
    backLight.position.set(-3 + i * 3, 3.5, 1);
    group.add(backLight);
  }

  // طاولة طويلة
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.2, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x2A2A3A })
  );
  table.position.set(0, 1, 3);
  table.castShadow = true;
  table.receiveShadow = true;
  group.add(table);

  // أرجل الطاولة
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
  // نحطها على الجنب — مش على الباب مباشرة
  // الأبواب على (-15, 0, 15)
  // نخلي التفاصيل على (-10, 0, 12) — قدام الباب بشوي وجنبه
  group.position.set(-10, 0, 12);

  // ============================================
  // اللوحة الخلفية (خلف الأعمدة)
  // ============================================
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(5, 2.5, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1A1A25 })
  );
  board.position.set(0, 2.2, -0.6);
  board.castShadow = true;
  group.add(board);

  // شاشة اللوحة
  const boardScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(4.7, 2.2),
    new THREE.MeshStandardMaterial({
      color: 0x8B5CF6,
      emissive: 0x8B5CF6,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.75,
    })
  );
  boardScreen.position.set(0, 2.2, -0.48);
  group.add(boardScreen);

  // ============================================
  // الأعمدة (أقصر — بحد أقصى 3 وحدات)
  // ============================================
  const barColors = [0x8B5CF6, 0x3B82F6, 0x06B6D4, 0x8B5CF6, 0x3B82F6];
  const barHeights = [1.2, 1.8, 2.6, 1.5, 2.2];  // ← أقصر بكتير
  const barSpacing = 0.8;

  barHeights.forEach((h, i) => {
    const barX = (i - 2) * barSpacing;

    // العمود
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

    // القمة المضيئة
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

  // ============================================
  // القاعدة
  // ============================================
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
  group.position.set(15, 0, 15); // نفس مكان باب CONTACT

  // صندوق بريد
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

  // أريكة صغيرة
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

// ===== إنشاء الغرف الأربعة =====
createAboutRoom();
createProjectsRoom();
createSkillsRoom();
createContactRoom();

// إضاءة نقطية في كل غرفة
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
// CHARACTER + ANIMATIONS
// ============================================
const loader = new FBXLoader();

const player = {
  object: null,
  mixer: null,
  actions: {},
  currentAction: null,
  position: new THREE.Vector3(0, 0, 0),
  rotation: 0,
  currentSpeed: 0,
  maxWalkSpeed: 4,
  maxRunSpeed: 8,
};

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
              // إزالة Root Motion (حركة الـ Hips) عشان الأنيميشن ما يحركش الشخصية بنفسه
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
  next.play(); // من غير reset() عشان ما يحصلش "قفزة" في الأنيميشن

  if (prev) prev.crossFadeTo(next, fade, false);

  player.currentAction = name;
}

// ============================================
// INPUT
// ============================================
const keys = {};
let cameraAngle = 0;
let cameraPitch = 0.15;

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "KeyE") tryInteract();
  if (e.code === "Space") e.preventDefault();
});

window.addEventListener("keyup", (e) => {
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
  cameraAngle -= e.movementX * 0.0025;
  cameraPitch += e.movementY * 0.002;
  cameraPitch = clamp(cameraPitch, -0.4, 1.0);
});


// ============================================
// INTERACTION
// ============================================
const interactHint = document.getElementById("interactHint");
let currentNearbyDoor = null;

function checkNearbyDoor() {
  let nearest = null;
  let minDist = Infinity;

  doors.forEach(door => {
    const dist = player.position.distanceTo(door.position);
    if (dist < door.interactDistance && dist < minDist) {
      minDist = dist;
      nearest = door;
    }
  });

  if (nearest !== currentNearbyDoor) {
    currentNearbyDoor = nearest;
    if (nearest) {
      interactHint.classList.remove("hidden");
      interactHint.innerHTML = `Press <kbd>E</kbd> to enter ${nearest.id.toUpperCase()}`;
    } else {
      interactHint.classList.add("hidden");
    }
  }
}

function tryInteract() {
  if (!currentNearbyDoor) return;
  openRoomPanel(currentNearbyDoor.id);
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

  // Hysteresis: حد للطلوع على الجري وحد مختلف للنزول منه
  if (player.currentAction === "run") {
    return absSpeed < RUN_DOWN_THRESHOLD ? "walk" : "run";
  }
  return absSpeed > RUN_UP_THRESHOLD ? "run" : "walk";
}

function updatePlayer(delta) {
  if (!player.object) return;

  // 1) الدوران — مباشر ومبني على الوقت (من غير lerp متأخر)
  if (keys["KeyA"]) player.rotation += ROTATE_SPEED * delta;
  if (keys["KeyD"]) player.rotation -= ROTATE_SPEED * delta;

  // 2) الحركة — تسارع تدريجي
  const isRunning = keys["ShiftLeft"] || keys["ShiftRight"];
  const maxSpeed = isRunning ? player.maxRunSpeed : player.maxWalkSpeed;

  let targetSpeed = 0;
  if (keys["KeyW"]) targetSpeed = maxSpeed;
  if (keys["KeyS"]) targetSpeed = -player.maxWalkSpeed * 0.6;

  const accelRate = targetSpeed !== 0 ? 8 : 12;
  player.currentSpeed += (targetSpeed - player.currentSpeed) * dampFactor(accelRate, delta);

  // 3) تحديث الموقع
  if (Math.abs(player.currentSpeed) > 0.05) {
    const dx = Math.sin(player.rotation) * player.currentSpeed * delta;
    const dz = Math.cos(player.rotation) * player.currentSpeed * delta;
    player.position.x = clamp(player.position.x + dx, -50, 50);
    player.position.z = clamp(player.position.z + dz, -50, 50);
  } else {
    player.currentSpeed = 0;
  }

  // 4) تحديث الـCharacter
  player.object.position.copy(player.position);
  player.object.rotation.y = player.rotation;

  // 5) Animation State
  const absSpeed = Math.abs(player.currentSpeed);
  playAction(chooseAnimation(absSpeed));

  // مزامنة سرعة الأنيميشن مع سرعة الحركة (يقلل انزلاق القدم)
  if (player.currentAction === "walk" && player.actions.walk) {
    player.actions.walk.timeScale = clamp(absSpeed / player.maxWalkSpeed, 0.5, 1.5);
  } else if (player.currentAction === "run" && player.actions.run) {
    player.actions.run.timeScale = clamp(absSpeed / player.maxRunSpeed, 0.7, 1.2);
  }

  // 6) Third Person Camera
  const camTargetAngle = player.rotation + cameraAngle;

  _camTarget.set(
    player.position.x - Math.sin(camTargetAngle) * CAMERA_DISTANCE,
    player.position.y + CAMERA_HEIGHT,
    player.position.z - Math.cos(camTargetAngle) * CAMERA_DISTANCE
  );

  camera.position.lerp(_camTarget, dampFactor(CAMERA_FOLLOW, delta));
  camera.lookAt(
    player.position.x,
    player.position.y + 1.8,
    player.position.z
  );

  checkNearbyDoor();
}

function animateOrbs(time) {
  orbs.forEach(orb => {
    orb.position.y += Math.sin(time * orb.userData.floatSpeed + orb.userData.floatOffset) * 0.005;
    orb.rotation.y += 0.01;
  });
}

function animate() {
  requestAnimationFrame(animate);

  // نحدد أقصى delta عشان القفزات بعد تبديل التاب ما تبوظش الحركة
  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  updatePlayer(delta);
  animateOrbs(time);

  if (player.mixer) player.mixer.update(delta);

  doors.forEach((door, i) => {
    const mesh = door.group.children[1];
    if (mesh && mesh.material) {
      mesh.material.emissiveIntensity = 0.4 + Math.sin(time * 2 + i) * 0.25;
    }
  });

  renderer.render(scene, camera);
}

// ============================================
// RESIZE
// ============================================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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
    setProgress(90);

    playAction("idle");
    setProgress(100);

    await new Promise(r => setTimeout(r, 400));

    loading.classList.add("fade-out");
    setTimeout(() => loading.remove(), 600);

    hud.classList.remove("hidden");
    clickToStart.classList.remove("hidden");

    animate();

    console.log("🌍 World ready — click to start");
  } catch (err) {
    console.error("Failed to load character:", err);
    loading.querySelector(".loading-text").textContent = "⚠️ Failed to load character";
  }
}

init();