import * as THREE from "./vendor/three/three.module.min.js";

const form = document.querySelector("#loadicatorForm");
const canvas = document.querySelector("#loadicatorCanvas");
const metrics = document.querySelector("#loadicatorMetrics");
const riskPill = document.querySelector("#loadicatorRisk");
const holdLabel = document.querySelector("#loadicatorHoldLabel");
const liveTrim = document.querySelector("#loadicatorLiveTrim");
const resetButton = document.querySelector("#resetLoadicator");

const readouts = {
  vesselType: document.querySelector("#vesselTypeReadout"),
  cargoType: document.querySelector("#cargoTypeReadout"),
  cargoWeight: document.querySelector("#cargoWeightReadout"),
  longitudinal: document.querySelector("#longReadout"),
  transverse: document.querySelector("#transReadout"),
  cargoKg: document.querySelector("#cargoKgReadout"),
  cargoSf: document.querySelector("#cargoSfReadout")
};

const holdNames = {
  "-72": "Hold 1 / forward",
  "-36": "Hold 2",
  "0": "Hold 3 / midship",
  "36": "Hold 4",
  "72": "Hold 5 / aft",
  custom: "Custom cargo position"
};

const holdCenters = [-72, -36, 0, 36, 72];
const holdMeshes = [];
let scene;
let camera;
let renderer;
let shipGroup;
let cargoBlock;
let waterLine;
let lowerHullMesh;
let hullMesh;
let deckMesh;
let bowMesh;
let funnelMesh;
let vesselDetailGroup;
let targetRoll = 0;
let targetPitch = 0;
let cameraAngle = 1.52;
let dragStartX = 0;
let dragging = false;
let lastModel = null;
const shipBaseY = 0.28;
let firstRender = true;
let activeVesselVisual = "";
let activeCargoVisual = "";

function number(name) {
  return Number(new FormData(form).get(name)) || 0;
}

function fmt(value, decimals = 2) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function classify(model) {
  if (model.correctedGm < 0.55 || Math.abs(model.heelDeg) > 5 || Math.abs(model.trimMeters) > 2) {
    return { level: "ALERT", note: "Review loading plan before approval", className: "danger" };
  }
  if (model.correctedGm < 0.85 || Math.abs(model.heelDeg) > 2.5 || Math.abs(model.trimMeters) > 1.2) {
    return { level: "WATCH", note: "Workable but needs loadicator check", className: "watch" };
  }
  return { level: "OK", note: "Planning values inside quick limits", className: "ok" };
}

function calculateModel() {
  if (window.focuseaLoadicatorBasic?.calculate) {
    return window.focuseaLoadicatorBasic.calculate();
  }

  const cargoWeight = number("cargoWeight");
  const x = number("longitudinal");
  const z = number("transverse");
  const cargoKg = number("cargoKg");
  const baseDisplacement = Math.max(number("baseDisplacement"), 1);
  const baseKg = number("baseKg");
  const km = number("km");
  const fsc = number("fsc");
  const mctc = Math.max(number("mctc"), 1);
  const lbp = Math.max(number("lbp"), 1);
  const displacement = baseDisplacement + cargoWeight;
  const kg = ((baseDisplacement * baseKg) + (cargoWeight * cargoKg)) / displacement;
  const correctedGm = km - kg - fsc;
  const trimCm = (cargoWeight * x) / mctc;
  const trimMeters = trimCm / 100;
  const heelMoment = cargoWeight * z;
  const heelRad = Math.atan(heelMoment / (displacement * Math.max(correctedGm, 0.05)));
  const heelDeg = heelRad * 180 / Math.PI;
  const pitchRad = Math.atan(trimMeters / lbp);
  const meanDraft = 11.6 + ((cargoWeight - 4200) / 62 / 100);
  const fwdDraft = meanDraft - trimMeters / 2;
  const aftDraft = meanDraft + trimMeters / 2;
  const risk = classify({ correctedGm, heelDeg, trimMeters });
  return {
    cargoWeight,
    x,
    z,
    cargoKg,
    displacement,
    kg,
    correctedGm,
    trimCm,
    trimMeters,
    heelMoment,
    heelRad,
    heelDeg,
    pitchRad,
    fwdDraft,
    aftDraft,
    risk
  };
}

function setReadouts(model) {
  if (readouts.vesselType && model.vessel) readouts.vesselType.textContent = model.vessel.label;
  if (readouts.cargoType && model.cargo) readouts.cargoType.textContent = model.cargo.label;
  readouts.cargoWeight.textContent = `${fmt(model.cargoWeight, 0)} mt`;
  readouts.longitudinal.textContent = `${fmt(model.x, 0)} m ${model.x < 0 ? "fwd" : model.x > 0 ? "aft" : "mid"}`;
  readouts.transverse.textContent = `${fmt(Math.abs(model.z), 1)} m ${model.z < 0 ? "port" : model.z > 0 ? "stbd" : "center"}`;
  readouts.cargoKg.textContent = `${fmt(model.cargoKg, 1)} m`;
  if (readouts.cargoSf && model.cargoSf) readouts.cargoSf.textContent = `${fmt(model.cargoSf, 2)} m3/mt`;
  holdLabel.textContent = holdNames[form.elements.hold.value] || "Custom cargo position";
  liveTrim.textContent = `Trim ${fmt(model.trimMeters, 2)} m ${model.trimMeters < 0 ? "by head" : "by stern"}`;
}

function renderMetrics(model) {
  metrics.innerHTML = [
    ["Corrected GM", `${fmt(model.correctedGm, 2)} m`, `KG ${fmt(model.kg, 2)} m / FSC applied`],
    ["Trim change", `${fmt(model.trimCm, 1)} cm`, `${model.trimMeters < 0 ? "Bow down" : "Stern down"} visualized`],
    ["Heel angle", `${fmt(model.heelDeg, 2)} deg`, `${model.z < 0 ? "Port" : model.z > 0 ? "Starboard" : "No transverse offset"}`],
    ["Draft F / A", `${fmt(model.fwdDraft, 2)} / ${fmt(model.aftDraft, 2)} m`, `Disp. ${fmt(model.displacement, 0)} mt`],
    ["Cargo volume", `${fmt(model.cargoVolume || 0, 0)} m3`, `SF ${fmt(model.cargoSf || 0, 2)} / cap ${fmt(model.capacityUse || 0, 1)}%`],
    ["Vessel match", model.compatibility?.level || "Quick check", model.compatibility?.note || "Compatibility profile pending"]
  ].map(([label, value, note]) => `
    <article>
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `).join("");

  riskPill.className = `scene-status ${model.risk.className}`;
  riskPill.textContent = `${model.risk.level} - ${model.risk.note}`;
}

function createBox(size, color, position, opacity = 1) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.18,
    transparent: opacity < 1,
    opacity
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCylinder(radius, depth, color, position, rotation = [0, 0, 0], opacity = 1) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.2,
    transparent: opacity < 1,
    opacity
  });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 32), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createSphere(radius, color, position, scale = [1, 1, 1], opacity = 1) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.14,
    transparent: opacity < 1,
    opacity
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 18), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createHullMesh(color) {
  const sections = [
    { x: -5.75, half: 0.42, deck: 0.34, shoulder: 0.08, chine: -0.28, keel: -0.58 },
    { x: -5.05, half: 0.92, deck: 0.48, shoulder: 0.12, chine: -0.34, keel: -0.72 },
    { x: -3.55, half: 1.22, deck: 0.53, shoulder: 0.14, chine: -0.38, keel: -0.78 },
    { x: -1.35, half: 1.34, deck: 0.56, shoulder: 0.15, chine: -0.4, keel: -0.82 },
    { x: 1.7, half: 1.32, deck: 0.56, shoulder: 0.15, chine: -0.4, keel: -0.82 },
    { x: 3.65, half: 1.12, deck: 0.54, shoulder: 0.12, chine: -0.36, keel: -0.76 },
    { x: 4.65, half: 0.72, deck: 0.52, shoulder: 0.08, chine: -0.28, keel: -0.66 },
    { x: 5.34, half: 0.34, deck: 0.49, shoulder: 0.02, chine: -0.2, keel: -0.54 },
    { x: 5.88, half: 0.045, deck: 0.42, shoulder: -0.03, chine: -0.14, keel: -0.42, rake: 0.42 }
  ];
  const vertices = [];
  const indices = [];
  const profile = (section) => {
    const rake = section.rake || 0;
    const deckX = section.x - rake * 0.56;
    const shoulderX = section.x - rake * 0.24;
    const chineX = section.x + rake * 0.1;
    const keelX = section.x - rake * 0.28;
    return [
      [deckX, section.deck, -section.half * 0.96],
      [deckX, section.deck, section.half * 0.96],
      [shoulderX, section.shoulder, section.half],
      [chineX, section.chine, section.half * 0.72],
      [keelX, section.keel, section.half * 0.16],
      [keelX, section.keel, -section.half * 0.16],
      [chineX, section.chine, -section.half * 0.72],
      [shoulderX, section.shoulder, -section.half]
    ];
  };

  sections.forEach((section) => {
    profile(section).forEach(([x, y, z]) => vertices.push(x, y, z));
  });

  const pointsPerSection = 8;
  for (let i = 0; i < sections.length - 1; i += 1) {
    for (let j = 0; j < pointsPerSection; j += 1) {
      const a = i * pointsPerSection + j;
      const b = i * pointsPerSection + (j + 1) % pointsPerSection;
      const c = (i + 1) * pointsPerSection + (j + 1) % pointsPerSection;
      const d = (i + 1) * pointsPerSection + j;
      indices.push(a, b, d, b, c, d);
    }
  }

  const capSection = (sectionIndex, reverse = false) => {
    const base = sectionIndex * pointsPerSection;
    const centerIndex = vertices.length / 3;
    const section = sections[sectionIndex];
    vertices.push(section.x - (section.rake || 0) * 0.18, (section.deck + section.keel) / 2, 0);
    for (let j = 0; j < pointsPerSection; j += 1) {
      const a = base + j;
      const b = base + (j + 1) % pointsPerSection;
      indices.push(reverse ? centerIndex : a, reverse ? b : b, reverse ? a : centerIndex);
    }
  };
  capSection(0, true);
  capSection(sections.length - 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.44,
    metalness: 0.22
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createDeckPlate(color) {
  const stations = [
    { x: -5.2, half: 0.58 },
    { x: -4.55, half: 1.0 },
    { x: -2.8, half: 1.2 },
    { x: -0.4, half: 1.24 },
    { x: 2.45, half: 1.14 },
    { x: 4.25, half: 0.82 },
    { x: 5.12, half: 0.38 },
    { x: 5.68, half: 0.07 }
  ];
  const vertices = [];
  const indices = [];

  stations.forEach(({ x, half }) => {
    vertices.push(
      x, 0.62, -half,
      x, 0.62, half,
      x, 0.55, -half * 0.92,
      x, 0.55, half * 0.92
    );
  });

  for (let i = 0; i < stations.length - 1; i += 1) {
    const a = i * 4;
    const b = (i + 1) * 4;
    indices.push(
      a, a + 1, b,
      a + 1, b + 1, b,
      a + 2, a, b + 2,
      a, b, b + 2,
      a + 1, a + 3, b + 1,
      a + 3, b + 3, b + 1,
      a + 2, b + 2, a + 3,
      a + 3, b + 2, b + 3
    );
  }

  const cap = (index, reverse = false) => {
    const a = index * 4;
    if (reverse) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  };
  cap(0, true);
  cap(stations.length - 1);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.16
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createTexturedContainer(color, position, scale = [1, 1, 1]) {
  const container = createBox([0.72, 0.32, 0.44], color, position, 1);
  container.scale.set(...scale);
  return container;
}

function clearVesselDetails() {
  if (!vesselDetailGroup) return;
  while (vesselDetailGroup.children.length) {
    const child = vesselDetailGroup.children[0];
    vesselDetailGroup.remove(child);
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  }
}

function addBulkerDetails() {
  [-4.1, -2.05, 0, 2.05, 4.1].forEach((x) => {
    vesselDetailGroup.add(createBox([1.34, 0.08, 1.5], 0x10275e, [x, 0.78, 0], 0.88));
    vesselDetailGroup.add(createBox([1.48, 0.04, 1.64], 0x2df1ca, [x, 0.84, 0], 0.28));
  });

  [-3.05, -1.0, 1.0, 3.05].forEach((x, index) => {
    const mast = createCylinder(0.035, 0.98, 0xe8edff, [x, 1.24, -1.05], [0, 0, 0], 1);
    const boom = createBox([1.35, 0.045, 0.05], index % 2 ? 0xf5d36b : 0x2df1ca, [x + 0.42, 1.68, -0.66], 1);
    boom.rotation.z = index % 2 ? -0.22 : 0.2;
    boom.rotation.y = 0.18;
    vesselDetailGroup.add(mast, boom);
  });
}

function addTankerDetails() {
  vesselDetailGroup.add(createCylinder(0.055, 8.4, 0xff80ae, [0.2, 0.9, 0], [0, 0, Math.PI / 2], 0.92));
  vesselDetailGroup.add(createCylinder(0.035, 7.6, 0xe8edff, [0.15, 1.02, 0.36], [0, 0, Math.PI / 2], 0.86));
  vesselDetailGroup.add(createCylinder(0.035, 7.6, 0xe8edff, [0.15, 1.02, -0.36], [0, 0, Math.PI / 2], 0.86));
  [-3.4, -1.7, 0, 1.7, 3.4].forEach((x) => {
    vesselDetailGroup.add(createCylinder(0.36, 0.18, 0xff80ae, [x, 0.92, 0], [Math.PI / 2, 0, 0], 0.86));
    vesselDetailGroup.add(createBox([0.78, 0.08, 1.38], 0x411a4d, [x, 0.78, 0], 0.42));
  });
  vesselDetailGroup.add(createBox([0.95, 0.42, 1.16], 0xe8edff, [-4.35, 1.38, 0], 1));
}

function addContainerDetails() {
  const colors = [0xf5d36b, 0xff6b9c, 0x2df1ca, 0x7774ff, 0xe8edff];
  [-3.6, -2.55, -1.5, -0.45, 0.6, 1.65, 2.7, 3.75].forEach((x, bay) => {
    [-0.54, 0, 0.54].forEach((z, row) => {
      for (let tier = 0; tier < (bay % 3 === 1 ? 3 : 2); tier += 1) {
        vesselDetailGroup.add(createTexturedContainer(colors[(bay + row + tier) % colors.length], [x, 0.86 + tier * 0.31, z], [1, 1, 1]));
      }
    });
  });
}

function addLngDetails() {
  [-3.1, -1.05, 1.05, 3.1].forEach((x) => {
    vesselDetailGroup.add(createSphere(0.72, 0xe8fbff, [x, 1.04, 0], [1.05, 0.58, 0.9], 0.96));
    vesselDetailGroup.add(createCylinder(0.74, 0.05, 0x7eefff, [x, 0.72, 0], [Math.PI / 2, 0, 0], 0.45));
  });
  vesselDetailGroup.add(createCylinder(0.035, 7.8, 0x7eefff, [0, 1.42, -0.82], [0, 0, Math.PI / 2], 0.9));
}

function addMpvDetails() {
  [-2.7, 1.9].forEach((x, index) => {
    const mast = createCylinder(0.045, 1.15, 0xf5d36b, [x, 1.22, -1.0], [0, 0, 0], 1);
    const boom = createBox([1.75, 0.055, 0.06], 0xf5d36b, [x + 0.56, 1.78, -0.55], 1);
    boom.rotation.z = index ? -0.16 : 0.24;
    boom.rotation.y = 0.22;
    vesselDetailGroup.add(mast, boom);
  });
  vesselDetailGroup.add(createBox([2.2, 0.42, 0.9], 0x9f7cff, [0.2, 1.04, 0.12], 0.92));
  vesselDetailGroup.add(createBox([2.45, 0.08, 1.08], 0xf5d36b, [0.2, 0.77, 0.12], 0.5));
}

function rebuildVesselDetails(model) {
  const visual = model.vessel?.visual || "bulker";
  if (visual === activeVesselVisual) return;
  activeVesselVisual = visual;
  clearVesselDetails();

  if (visual === "tanker") addTankerDetails();
  else if (visual === "container") addContainerDetails();
  else if (visual === "lng") addLngDetails();
  else if (visual === "mpv") addMpvDetails();
  else addBulkerDetails();
}

function updateCargoGeometry(model) {
  const visual = model.cargo?.visual || "bulk";
  if (visual === activeCargoVisual) return;
  activeCargoVisual = visual;
  cargoBlock.geometry.dispose();
  cargoBlock.rotation.set(0, 0, 0);

  if (visual === "gas") {
    cargoBlock.geometry = new THREE.SphereGeometry(0.58, 36, 18);
  } else if (visual === "liquid" || visual === "chemical") {
    cargoBlock.geometry = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 32);
    cargoBlock.rotation.z = Math.PI / 2;
  } else if (visual === "ore") {
    cargoBlock.geometry = new THREE.DodecahedronGeometry(0.62, 0);
  } else if (visual === "project") {
    cargoBlock.geometry = new THREE.BoxGeometry(1.8, 0.52, 0.78);
  } else {
    cargoBlock.geometry = new THREE.BoxGeometry(1.2, 0.62, 1.05);
  }
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = null;
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;

  const ambient = new THREE.AmbientLight(0xbfc5ff, 0.65);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 8, 7);
  key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6df7ff, 1.1);
  fill.position.set(-6, 4, -4);
  scene.add(fill);
  const rim = new THREE.PointLight(0x2df1ca, 2.5, 18);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const grid = new THREE.GridHelper(18, 18, 0x2df1ca, 0x25276f);
  grid.position.y = -0.58;
  scene.add(grid);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 12),
    new THREE.MeshStandardMaterial({ color: 0x071c36, roughness: 0.85, metalness: 0.1, transparent: true, opacity: 0.72 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.62;
  scene.add(water);

  shipGroup = new THREE.Group();
  shipGroup.position.y = shipBaseY;
  scene.add(shipGroup);

  hullMesh = createHullMesh(0x2f4fb5);
  shipGroup.add(hullMesh);
  lowerHullMesh = createBox([9.25, 0.045, 1.42], 0x8d2d68, [-0.42, -0.45, 0], 0.94);
  lowerHullMesh.scale.z = 0.9;
  shipGroup.add(lowerHullMesh);
  deckMesh = createDeckPlate(0x7d8cf1);
  shipGroup.add(deckMesh);
  bowMesh = createSphere(0.34, 0x3d65d8, [5.76, -0.5, 0], [1.45, 0.34, 0.46], 0.92);
  bowMesh.castShadow = true;
  shipGroup.add(bowMesh);
  const bowStem = createBox([0.075, 0.78, 0.08], 0xdce7ff, [5.54, 0.08, 0], 0.82);
  bowStem.rotation.z = -0.28;
  shipGroup.add(bowStem);
  const bowRail = createCylinder(0.018, 1.1, 0xe8edff, [5.1, 0.82, 0], [Math.PI / 2, 0, 0], 0.9);
  shipGroup.add(bowRail);
  const anchorPort = createCylinder(0.055, 0.035, 0x0b1236, [5.18, 0.04, -0.76], [Math.PI / 2, 0, 0], 1);
  const anchorStbd = createCylinder(0.055, 0.035, 0x0b1236, [5.18, 0.04, 0.76], [Math.PI / 2, 0, 0], 1);
  shipGroup.add(anchorPort, anchorStbd);

  const bridgeBase = createBox([1.22, 0.72, 1.58], 0xe7edff, [-4.38, 1.1, 0], 1);
  shipGroup.add(bridgeBase);
  const bridgeTop = createBox([0.96, 0.38, 1.28], 0xffffff, [-4.38, 1.64, 0], 1);
  shipGroup.add(bridgeTop);
  const bridgeWindows = createBox([0.98, 0.12, 1.34], 0x12215a, [-4.38, 1.7, 0], 0.82);
  shipGroup.add(bridgeWindows);
  funnelMesh = createBox([0.42, 0.78, 0.48], 0x2df1ca, [-5.05, 1.22, 0.76], 1);
  shipGroup.add(funnelMesh);

  vesselDetailGroup = new THREE.Group();
  shipGroup.add(vesselDetailGroup);

  cargoBlock = createBox([1.2, 0.62, 1.05], 0xf5d36b, [0, 1.2, 0], 0.96);
  shipGroup.add(cargoBlock);

  waterLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5.4, -0.22, -1.18),
      new THREE.Vector3(5.5, -0.22, -1.18),
      new THREE.Vector3(5.5, -0.22, 1.18),
      new THREE.Vector3(-5.4, -0.22, 1.18),
      new THREE.Vector3(-5.4, -0.22, -1.18)
    ]),
    new THREE.LineBasicMaterial({ color: 0x2df1ca, transparent: true, opacity: 0.7 })
  );
  shipGroup.add(waterLine);

  updateCamera();
  resize();
  window.addEventListener("resize", resize);
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(canvas.parentElement);
  }
  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    dragStartX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    cameraAngle += (event.clientX - dragStartX) * 0.006;
    dragStartX = event.clientX;
    updateCamera();
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });
}

function updateCamera() {
  const radius = 13.2;
  camera.position.set(Math.cos(cameraAngle) * radius, 4.2, Math.sin(cameraAngle) * radius);
  camera.lookAt(0, 0.66, 0);
}

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(360, Math.floor(rect.height));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateSceneFromModel(model) {
  rebuildVesselDetails(model);
  updateCargoGeometry(model);

  const x = model.x / 90 * 4.2;
  const z = model.z / 16 * 0.82;
  const maxCargo = model.vessel?.maxCargo || 12000;
  const cargoHeight = clamp(0.3 + model.cargoWeight / maxCargo * 1.15, 0.26, 1.45);
  cargoBlock.scale.set(1 + model.cargoWeight / maxCargo * 0.45, cargoHeight / 0.62, 1 + model.cargoWeight / maxCargo * 0.22);
  cargoBlock.position.x = x;
  cargoBlock.position.z = z;
  cargoBlock.position.y = 0.98 + cargoHeight / 2;
  cargoBlock.material.color.set(model.risk.level === "ALERT" ? 0xff6b9c : model.risk.level === "WATCH" ? 0xf5d36b : model.cargo?.colorHex || 0x2df1ca);

  if (model.vessel) {
    lowerHullMesh.material.color.set(model.vessel.lower || "#8d2d68");
    hullMesh.material.color.set(model.vessel.hull || "#2f4fb5");
    deckMesh.material.color.set(model.vessel.deck || "#7d8cf1");
    bowMesh.material.color.set(model.vessel.hull || "#3d65d8");
    funnelMesh.material.color.set(model.vessel.visual === "tanker" ? 0xff80ae : model.vessel.visual === "lng" ? 0x7eefff : 0x2df1ca);
    shipGroup.scale.x = clamp(maxCargo / 12000, 0.82, 1.14);
    shipGroup.scale.z = model.vessel.visual === "lng" ? 1.06 : model.vessel.visual === "container" ? 0.96 : 1;
  }

  holdMeshes.forEach((hold, index) => {
    const nearest = Math.abs(model.x - holdCenters[index]) < 19;
    hold.material.color.set(nearest ? 0x3141a0 : 0x171b4f);
    hold.material.emissive.set(nearest ? 0x10265a : 0x090a28);
  });

  targetPitch = clamp(-model.pitchRad * 6, -0.16, 0.16);
  targetRoll = clamp(-model.heelRad * 0.62, -0.22, 0.22);
}

function syncFromForm() {
  const model = calculateModel();
  lastModel = model;
  setReadouts(model);
  renderMetrics(model);
  updateSceneFromModel(model);
  window.focuseaLoadicator3d = { model, update: syncFromForm };
}

function animate() {
  requestAnimationFrame(animate);
  if (shipGroup) {
    shipGroup.rotation.z += (targetPitch - shipGroup.rotation.z) * 0.08;
    shipGroup.rotation.x += (targetRoll - shipGroup.rotation.x) * 0.08;
    shipGroup.position.y = shipBaseY + Math.sin(Date.now() * 0.0012) * 0.025;
  }
  renderer.render(scene, camera);
  if (firstRender) {
    firstRender = false;
    canvas.parentElement.classList.add("webgl-ready");
  }
}

function bindControls() {
  form.addEventListener("input", (event) => {
    if (event.target.name === "longitudinal") form.elements.hold.value = "custom";
    syncFromForm();
  });

  form.elements.hold.addEventListener("change", () => {
    const value = form.elements.hold.value;
    if (value !== "custom") form.elements.longitudinal.value = value;
    syncFromForm();
  });

  form.elements.vesselType.addEventListener("change", syncFromForm);
  form.elements.cargoType.addEventListener("change", syncFromForm);

  resetButton.addEventListener("click", () => {
    form.reset();
    syncFromForm();
  });
}

try {
  initScene();
  bindControls();
  syncFromForm();
  animate();
} catch (error) {
  canvas.parentElement.classList.add("webgl-failed");
  console.error(error);
}
