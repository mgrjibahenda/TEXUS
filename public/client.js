const $ = (id) => document.getElementById(id);

let socket = null;

function showLoginError(message) {
  const el = $("loginError");
  if (el) el.textContent = message;
  console.error(message);
}

if (location.protocol === "file:") {
  showLoginError("Do not open index.html directly. Run npm start, then open http://localhost:3000.");
} else if (typeof io === "undefined") {
  showLoginError("Socket.io did not load. The Node server is probably not running.");
} else {
  socket = io({
    reconnectionAttempts: 5,
    timeout: 8000
  });

  socket.on("connect", () => {
    showLoginError("");
    console.log("Connected to server:", socket.id);
  });

  socket.on("connect_error", (err) => {
    showLoginError("Could not connect to server. Wait for Render to wake up, then refresh.");
    console.error("Socket connect error:", err);
  });

  socket.on("disconnect", () => {
    showLoginError("Disconnected from server. Refresh or wait for Render.");
  });
}


let myId = null;
let state = null;
let renderer, scene, camera;
let world = {
  players: new Map(),
  bullets: new Map(),
  walls: [],
  ground: null
};
let keys = { w: false, a: false, s: false, d: false };
let yaw = 0;
let pitch = 0;
let lastSent = 0;
let audioCtx = null;
let touchMove = { active: false, dx: 0, dy: 0 };

$("createBtn").onclick = () => {
  if (!socket || !socket.connected) {
    showLoginError("Server not connected yet. If on Render, wait 30-60 seconds and refresh.");
    return;
  }
  showLoginError("Creating room...");
  socket.emit("createRoom", { name: $("name").value }, handleJoin);
};

$("joinBtn").onclick = () => {
  if (!socket || !socket.connected) {
    showLoginError("Server not connected yet. If on Render, wait 30-60 seconds and refresh.");
    return;
  }
  showLoginError("Joining room...");
  socket.emit("joinRoom", { name: $("name").value, code: $("roomCode").value }, handleJoin);
};

function handleJoin(res) {
  if (!res?.ok) {
    $("loginError").textContent = res?.error || "Could not join.";
    return;
  }
  if (!window.THREE) {
    showLoginError("Three.js did not load. Check internet/CDN, then refresh.");
    return;
  }
  myId = res.id;
  showLoginError("");
  $("login").classList.add("hidden");
  $("game").classList.remove("hidden");
  init3D();
  initControls();
}

if (socket) {
  socket.on("state", (s) => {
    state = s;
    $("code").textContent = s.code;
    updateHUD();
    updateWorld();
  });
}

function init3D() {
  if (!window.THREE) {
    alert("Three.js failed to load. Check internet/CDN.");
    return;
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071018);
  scene.fog = new THREE.Fog(0x071018, 30, 95);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 160);
  camera.position.set(0, 1.6, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: $("scene"),
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  const hemi = new THREE.HemisphereLight(0x9dcaff, 0x132015, 1.2);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(20, 38, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);

  const floorGeo = new THREE.PlaneGeometry(70, 70, 40, 40);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x203a2f,
    roughness: 0.85,
    metalness: 0.05
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  world.ground = floor;

  const grid = new THREE.GridHelper(70, 35, 0x4d7a68, 0x27483d);
  scene.add(grid);

  animate();
}

function makeWall(w) {
  const geo = new THREE.BoxGeometry(w.w, 4, w.d);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2b3943,
    roughness: 0.55,
    metalness: 0.1
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(w.x, 2, w.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x6aa2ff })
  );
  edge.position.copy(mesh.position);
  scene.add(edge);

  return { mesh, edge };
}

function makePlayerMesh(p) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.1, 6, 12),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(p.color),
      roughness: 0.42,
      metalness: 0.1
    })
  );
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 18, 12),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.35 })
  );
  head.position.y = 1.65;
  head.castShadow = true;
  group.add(head);

  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.16, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.65, roughness: 0.28 })
  );
  gun.position.set(0.33, 1.25, 0.45);
  gun.castShadow = true;
  group.add(gun);

  const nameCanvas = document.createElement("canvas");
  nameCanvas.width = 256;
  nameCanvas.height = 64;
  const ctx = nameCanvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.fillText(p.name, 128, 40);
  const texture = new THREE.CanvasTexture(nameCanvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  label.scale.set(2.7, 0.68, 1);
  label.position.y = 2.45;
  group.add(label);

  scene.add(group);
  return group;
}

function makeBullet(b) {
  const geo = new THREE.CylinderGeometry(0.045, 0.045, 7, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xf5d66c });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(b.x, b.y, b.z);
  mesh.lookAt(b.x + b.dx, b.y + b.dy, b.z + b.dz);
  mesh.rotateX(Math.PI / 2);
  scene.add(mesh);

  const light = new THREE.PointLight(0xf5d66c, 1.6, 8);
  light.position.copy(mesh.position);
  scene.add(light);

  return { mesh, light, born: performance.now() };
}

function updateWorld() {
  if (!scene || !state) return;

  if (world.walls.length === 0 && state.walls) {
    world.walls = state.walls.map(makeWall);
  }

  const seen = new Set();
  for (const p of state.players) {
    if (p.id === myId) {
      yaw = p.yaw ?? yaw;
      pitch = p.pitch ?? pitch;
      camera.position.set(p.x, p.y, p.z);
      camera.rotation.order = "YXZ";
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
      continue;
    }

    seen.add(p.id);
    let mesh = world.players.get(p.id);
    if (!mesh) {
      mesh = makePlayerMesh(p);
      world.players.set(p.id, mesh);
    }

    mesh.visible = p.alive;
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.yaw;
    const gun = mesh.children[2];
    if (p.shootingUntil > state.now) {
      gun.material.emissive = new THREE.Color(0xffcc33);
      gun.material.emissiveIntensity = 1.8;
    } else {
      gun.material.emissiveIntensity = 0;
    }
  }

  for (const [id, mesh] of world.players.entries()) {
    if (!seen.has(id)) {
      scene.remove(mesh);
      world.players.delete(id);
    }
  }

  for (const b of state.bullets || []) {
    if (!world.bullets.has(b.id)) {
      world.bullets.set(b.id, makeBullet(b));
      playShotSound(false);
    }
  }

  for (const [id, item] of world.bullets.entries()) {
    if (!state.bullets.find(b => b.id === id)) {
      scene.remove(item.mesh);
      scene.remove(item.light);
      world.bullets.delete(id);
    }
  }
}

function updateHUD() {
  if (!state) return;
  const me = state.players.find(p => p.id === myId);
  if (me) {
    $("healthText").textContent = me.health;
    $("healthFill").style.width = `${me.health}%`;
    $("status").textContent = me.alive ? "Alive" : `Respawning ${Math.max(0, Math.ceil((me.respawnAt - state.now)/1000))}s`;
  }

  const rows = [...state.players]
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .map(p => `
      <div class="scoreRow">
        <span style="color:${p.color}">${escapeHtml(p.name)}</span>
        <span>${p.kills}/${p.deaths}</span>
      </div>
    `).join("");
  $("scoreboard").innerHTML = rows;

  $("feed").innerHTML = (state.events || []).slice(-5).reverse().map(e => `
    <div class="feedItem ${e.type}">${escapeHtml(e.text)}</div>
  `).join("");
}

function initControls() {
  document.body.addEventListener("click", () => {
    $("scene").requestPointerLock?.();
    unlockAudio();
  });

  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement !== $("scene")) return;
    yaw -= e.movementX * 0.0023;
    pitch -= e.movementY * 0.0020;
    pitch = Math.max(-0.9, Math.min(0.9, pitch));
  });

  document.addEventListener("keydown", (e) => setKey(e.code, true));
  document.addEventListener("keyup", (e) => setKey(e.code, false));

  document.addEventListener("mousedown", (e) => {
    if (e.button === 0 && $("game").classList.contains("hidden") === false) shoot();
  });

  $("mobileShoot").onclick = (e) => {
    e.stopPropagation();
    shoot();
  };

  const stick = $("mobileStick");
  const knob = stick.querySelector("div");

  stick.addEventListener("touchstart", (e) => {
    touchMove.active = true;
    e.preventDefault();
  }, { passive: false });

  stick.addEventListener("touchmove", (e) => {
    const rect = stick.getBoundingClientRect();
    const t = e.touches[0];
    let dx = t.clientX - (rect.left + rect.width / 2);
    let dy = t.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    const max = 40;
    if (len > max) {
      dx = dx / len * max;
      dy = dy / len * max;
    }
    knob.style.left = `${34 + dx}px`;
    knob.style.top = `${34 + dy}px`;
    touchMove.dx = dx / max;
    touchMove.dy = dy / max;
    e.preventDefault();
  }, { passive: false });

  stick.addEventListener("touchend", () => {
    touchMove.active = false;
    touchMove.dx = 0;
    touchMove.dy = 0;
    knob.style.left = "34px";
    knob.style.top = "34px";
  });

  window.addEventListener("resize", () => {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function setKey(code, down) {
  if (code === "KeyW" || code === "ArrowUp") keys.w = down;
  if (code === "KeyA" || code === "ArrowLeft") keys.a = down;
  if (code === "KeyS" || code === "ArrowDown") keys.s = down;
  if (code === "KeyD" || code === "ArrowRight") keys.d = down;
}

function shoot() {
  unlockAudio();
  playShotSound(true);
  if (socket?.connected) socket.emit("shoot");
  muzzleFlash();
}

function muzzleFlash() {
  const flash = document.createElement("div");
  flash.style.position = "fixed";
  flash.style.left = "50%";
  flash.style.top = "50%";
  flash.style.transform = "translate(-50%, -50%)";
  flash.style.width = "90px";
  flash.style.height = "90px";
  flash.style.borderRadius = "50%";
  flash.style.background = "radial-gradient(circle, rgba(245,214,108,.9), transparent 65%)";
  flash.style.pointerEvents = "none";
  flash.style.zIndex = "999";
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 70);
}

function animate() {
  requestAnimationFrame(animate);

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }

  const now = performance.now();
  if (now - lastSent > 33) {
    lastSent = now;
    const input = {
      w: keys.w || touchMove.dy < -0.25,
      a: keys.a || touchMove.dx < -0.25,
      s: keys.s || touchMove.dy > 0.25,
      d: keys.d || touchMove.dx > 0.25,
      yaw,
      pitch
    };
    if (socket?.connected) socket.emit("input", input);
  }
}

function unlockAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function playShotSound(local) {
  if (!audioCtx) return;
  const ctx = audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(local ? 120 : 90, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(local ? 0.07 : 0.035, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

  noise.buffer = noiseBuffer;
  noiseGain.gain.setValueAtTime(local ? 0.05 : 0.02, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  osc.start();
  noise.start();
  osc.stop(ctx.currentTime + 0.12);
  noise.stop(ctx.currentTime + 0.08);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[s]));
}