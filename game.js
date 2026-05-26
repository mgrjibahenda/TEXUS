import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080403);
scene.fog = new THREE.FogExp2(0x090504, 0.035);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 6.5, 10.5);
camera.lookAt(0, 1.4, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const colors = {
  wood: 0x3d1d10,
  darkWood: 0x1e0e08,
  gold: 0xd6a84f,
  red: 0x8d221e,
  green: 0x21382a,
  brass: 0xa36a25,
  paper: 0xe2c486,
  black: 0x080606,
  skin: 0x7a4a2e,
};

const mats = {
  wood: new THREE.MeshStandardMaterial({ color: colors.wood, roughness: 0.72, metalness: 0.04 }),
  darkWood: new THREE.MeshStandardMaterial({ color: colors.darkWood, roughness: 0.88 }),
  gold: new THREE.MeshStandardMaterial({ color: colors.gold, roughness: 0.4, metalness: 0.45, emissive: 0x1b1100 }),
  brass: new THREE.MeshStandardMaterial({ color: colors.brass, roughness: 0.32, metalness: 0.65 }),
  red: new THREE.MeshStandardMaterial({ color: colors.red, roughness: 0.65 }),
  green: new THREE.MeshStandardMaterial({ color: colors.green, roughness: 0.8 }),
  paper: new THREE.MeshStandardMaterial({ color: colors.paper, roughness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: colors.black, roughness: 0.7 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xffc16c, transparent: true, opacity: 0.22, roughness: 0.08, transmission: 0.3 }),
  cardBack: new THREE.MeshStandardMaterial({ color: 0x5b1513, roughness: 0.55, metalness: 0.02 }),
  cardFace: new THREE.MeshStandardMaterial({ color: 0xf2d9a0, roughness: 0.52 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
};

function mesh(geo, mat, pos, rot = [0, 0, 0], cast = true, receive = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.castShadow = cast;
  m.receiveShadow = receive;
  scene.add(m);
  return m;
}

function addBox(w, h, d, mat, x, y, z, rotY = 0) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, [x, y, z], [0, rotY, 0]);
}

function addCylinder(r1, r2, h, seg, mat, x, y, z, rot = [0, 0, 0]) {
  return mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat, [x, y, z], rot);
}

function makeTextTexture(text, opts = {}) {
  const size = opts.size || 512;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = opts.bg || 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${opts.weight || 900} ${opts.fontSize || 120}px Georgia, serif`;
  ctx.fillStyle = opts.color || '#f6d184';
  ctx.shadowColor = 'rgba(0,0,0,.8)';
  ctx.shadowBlur = 12;
  ctx.fillText(text, size / 2, size / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabel(text, x, y, z, scale = 1) {
  const mat = new THREE.SpriteMaterial({ map: makeTextTexture(text, { fontSize: 86 }), transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.position.set(x, y, z);
  sp.scale.set(1.8 * scale, 1.8 * scale, 1);
  scene.add(sp);
  return sp;
}

// Room: floor, walls, beams
mesh(new THREE.PlaneGeometry(42, 42), mats.darkWood, [0, -0.03, 0], [-Math.PI / 2, 0, 0], false, true);
for (let i = -20; i <= 20; i += 2.4) {
  addBox(0.08, 0.03, 42, mats.wood, i, 0.01, 0, 0);
  addBox(42, 0.035, 0.08, mats.wood, 0, 0.015, i, 0);
}
addBox(42, 8, 0.45, mats.darkWood, 0, 4, -18);
addBox(42, 8, 0.45, mats.darkWood, 0, 4, 18);
addBox(0.45, 8, 42, mats.darkWood, -18, 4, 0);
addBox(0.45, 8, 42, mats.darkWood, 18, 4, 0);
for (let x of [-14, -7, 0, 7, 14]) addBox(0.35, 8, 0.35, mats.wood, x, 4, -17.6);
for (let z of [-14, -7, 0, 7, 14]) addBox(0.35, 8, 0.35, mats.wood, -17.6, 4, z);
for (let x of [-10, 0, 10]) addBox(2, 0.4, 42, mats.wood, x, 7.8, 0);
for (let z of [-10, 0, 10]) addBox(42, 0.35, 2, mats.wood, 0, 7.9, z);

// Windows with moon glow
for (let x of [-10, 10]) {
  const w = addBox(4, 2.8, 0.08, new THREE.MeshStandardMaterial({ color: 0x263a48, emissive: 0x102a3d, roughness: 0.2 }), x, 4.2, -17.72);
  addBox(0.12, 3, 0.1, mats.wood, x, 4.2, -17.64);
  addBox(4.2, 0.12, 0.1, mats.wood, x, 4.2, -17.63);
}

// Fireplace
addBox(5.2, 3.4, 0.65, mats.wood, 0, 1.8, -17.35);
addBox(3.8, 2.25, 0.75, mats.black, 0, 1.05, -16.95);
const fireGroup = new THREE.Group();
scene.add(fireGroup);
for (let i = 0; i < 7; i++) {
  const flame = addCylinder(0.08, 0.28, 1.1 + Math.random() * 0.55, 18, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff9d2e : 0xd93218, transparent: true, opacity: 0.75 }), -1.1 + i * 0.36, 0.72, -16.54, [0, 0, Math.random() * 0.4]);
  fireGroup.add(flame);
}
const fireLight = new THREE.PointLight(0xff7b24, 4.5, 16, 1.6);
fireLight.position.set(0, 1.3, -15.8);
fireLight.castShadow = true;
scene.add(fireLight);

// Bar shelves and bottles
addBox(9, 0.8, 2, mats.wood, 13.2, 0.4, -13.8);
addBox(9.5, 4.2, 0.55, mats.darkWood, 13.2, 2.8, -16.4);
for (let y of [1.7, 2.7, 3.7, 4.7]) addBox(9, 0.12, 0.7, mats.wood, 13.2, y, -15.95);
for (let i = 0; i < 48; i++) {
  const x = 9.1 + Math.random() * 8.2;
  const y = 1.85 + Math.floor(i / 12) * 1.0;
  const z = -15.7 + Math.random() * 0.25;
  const bottleMat = new THREE.MeshPhysicalMaterial({ color: [0x365c38, 0x63371e, 0x1c2c4a, 0x6d1919][i % 4], transparent: true, opacity: 0.72, roughness: 0.18, transmission: 0.15 });
  addCylinder(0.09, 0.11, 0.48 + Math.random() * 0.2, 12, bottleMat, x, y, z);
  addCylinder(0.04, 0.05, 0.22, 10, bottleMat, x, y + 0.34, z);
}

// Main table
const table = new THREE.Group(); scene.add(table);
const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(4.15, 4.45, 0.55, 80), mats.wood);
tableTop.position.y = 1.05; tableTop.castShadow = true; tableTop.receiveShadow = true; table.add(tableTop);
const felt = new THREE.Mesh(new THREE.CylinderGeometry(3.62, 3.62, 0.07, 80), mats.green);
felt.position.y = 1.37; felt.castShadow = true; felt.receiveShadow = true; table.add(felt);
const rim = new THREE.Mesh(new THREE.TorusGeometry(4.18, 0.16, 18, 90), mats.gold);
rim.position.y = 1.39; rim.rotation.x = Math.PI / 2; rim.castShadow = true; table.add(rim);
for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.4, 18), mats.wood);
  leg.position.set(Math.cos(a) * 2.4, 0.4, Math.sin(a) * 2.4); leg.castShadow = true; table.add(leg);
}

// Props on table
for (let i = 0; i < 32; i++) {
  const angle = Math.random() * Math.PI * 2;
  const r = 0.6 + Math.random() * 2.6;
  const chip = addCylinder(0.13, 0.13, 0.045, 24, i % 3 === 0 ? mats.red : i % 3 === 1 ? mats.gold : mats.black, Math.cos(angle) * r, 1.49 + i * 0.003, Math.sin(angle) * r);
  chip.rotation.x = Math.PI / 2;
}
for (let i = 0; i < 11; i++) {
  const c = addBox(0.58, 0.025, 0.82, i % 2 ? mats.cardBack : mats.cardFace, -1.6 + i * 0.27, 1.52 + i * 0.003, 0.2 + Math.sin(i) * 0.05, 0.12 * i);
  c.rotation.x = -Math.PI / 2;
}
const revolver = new THREE.Group(); scene.add(revolver);
revolver.position.set(1.55, 1.56, -0.78); revolver.rotation.y = -0.65;
revolver.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.22), mats.brass));
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.05, 20), mats.black);
barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.78; revolver.add(barrel);
const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 24), mats.brass);
drum.rotation.z = Math.PI / 2; drum.position.x = 0.15; revolver.add(drum);
const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.18), mats.wood);
handle.position.set(-0.36, -0.35, 0); handle.rotation.z = -0.35; revolver.add(handle);

// Chairs and players
const playerMeshes = [];
function makePlayer(i, name, angle) {
  const group = new THREE.Group();
  const x = Math.cos(angle) * 6.0, z = Math.sin(angle) * 6.0;
  group.position.set(x, 0, z);
  group.lookAt(0, 0, 0);
  scene.add(group);
  const chair = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.25, 1.25), mats.wood); chair.position.y = 0.62; group.add(chair);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.65, 0.22), mats.wood); back.position.set(0, 1.35, 0.58); group.add(back);
  const bodyMat = new THREE.MeshStandardMaterial({ color: [0x34211e, 0x1f2733, 0x2c301c, 0x3a1f24][i], roughness: .75 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.92, 12, 20), bodyMat); body.position.y = 1.35; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), new THREE.MeshStandardMaterial({ color: [0x8a5736,0x654027,0x9b6740,0x734628][i], roughness: .6 })); head.position.y = 2.1; head.castShadow = true; group.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.32, 24), mats.black); hat.position.y = 2.48; hat.castShadow = true; group.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.055, 28), mats.black); brim.position.y = 2.3; group.add(brim);
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.82, 8, 14), bodyMat); leftArm.position.set(-0.52, 1.42, -0.2); leftArm.rotation.z = 0.42; leftArm.rotation.x = 0.55; group.add(leftArm);
  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.82, 8, 14), bodyMat); rightArm.position.set(0.52, 1.42, -0.2); rightArm.rotation.z = -0.42; rightArm.rotation.x = 0.55; group.add(rightArm);
  const label = makeLabel(name, x, 3.15, z, 0.62);
  playerMeshes.push({ group, body, head, label, angle, baseY: 0, name });
}
['你', 'Raven', 'Doc', 'Viper'].forEach((n, i) => makePlayer(i, n, -Math.PI / 2 + i * Math.PI / 2));

// Ambient props: side tables, candles, hanging lights, paintings
for (let i = 0; i < 10; i++) {
  const x = -14 + Math.random() * 28;
  const z = -12 + Math.random() * 24;
  if (Math.hypot(x, z) < 7) continue;
  addCylinder(0.65, 0.75, 0.22, 30, mats.wood, x, .55, z);
  addCylinder(0.12, 0.18, 1.05, 14, mats.wood, x, .15, z);
  const candle = addCylinder(0.08, 0.08, 0.35, 16, mats.paper, x + .2, .88, z + .1);
  const light = new THREE.PointLight(0xffbf64, .6, 4, 2);
  light.position.set(x + .2, 1.2, z + .1); scene.add(light);
}
for (let i = 0; i < 7; i++) {
  const light = new THREE.PointLight(0xffb65b, 1.5, 9, 1.7);
  light.position.set(-12 + i * 4, 5.8, -2 + Math.sin(i) * 6);
  light.castShadow = i % 2 === 0;
  scene.add(light);
  addCylinder(0.24, 0.32, 0.28, 24, mats.brass, light.position.x, light.position.y + .05, light.position.z);
}
const moon = new THREE.DirectionalLight(0x99c8ff, 0.55);
moon.position.set(-6, 12, -10); moon.castShadow = true; scene.add(moon);
scene.add(new THREE.AmbientLight(0x2b1811, 0.75));

// Game logic
const ranks = ['KING', 'QUEEN', 'ACE'];
const suits = ['♠', '♥', '♦', '♣'];
let deck = [];
let players = [];
let currentPlayer = 0;
let targetRank = 'KING';
let selected = new Set();
let showHand = true;
let lastPlay = null;
let chamber = 1;
let round = 1;
let busy = false;

const handEl = document.getElementById('handCards');
const playersPanel = document.getElementById('playersPanel');
const logEl = document.getElementById('log');
const targetRankEl = document.getElementById('targetRank');
const chamberText = document.getElementById('chamberText');
const statusText = document.getElementById('statusText');
const toast = document.getElementById('toast');

function buildDeck() {
  const d = [];
  for (const r of ranks) for (const s of suits) d.push({ rank: r, suit: s, id: crypto.randomUUID() });
  for (let i = 0; i < 8; i++) d.push({ rank: 'JOKER', suit: '★', id: crypto.randomUUID() });
  return d.sort(() => Math.random() - 0.5);
}

function newGame() {
  deck = buildDeck();
  targetRank = ranks[Math.floor(Math.random() * ranks.length)];
  players = ['你', 'Raven', 'Doc', 'Viper'].map((name, i) => ({
    name, chips: 1000, alive: true, risk: 1, hand: deck.splice(0, 5), lastAction: '等待', ai: i !== 0
  }));
  currentPlayer = 0;
  selected.clear();
  lastPlay = null;
  chamber = 1;
  round++;
  logEl.innerHTML = '';
  log(`第 ${round} 局开始。目标牌是 ${targetRank}。`);
  updateUI();
  showToast(`目标牌：${targetRank}`);
}

function log(text, type = '') {
  const item = document.createElement('div');
  item.className = `log-item ${type}`;
  item.textContent = text;
  logEl.prepend(item);
  while (logEl.children.length > 10) logEl.lastChild.remove();
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1500);
}

function updateUI() {
  targetRankEl.textContent = targetRank;
  chamberText.textContent = `${chamber} / 6`;
  playersPanel.innerHTML = '';
  players.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = `player-card ${i === currentPlayer ? 'active' : ''}`;
    const pct = Math.max(5, Math.min(100, p.chips / 10));
    el.innerHTML = `<div class="player-top"><span class="player-name">${p.name}</span><span class="player-status">${p.alive ? p.lastAction : '出局'}</span></div><div class="player-status">筹码 ${p.chips} · 手牌 ${p.hand.length} · 风险 ${p.risk}/6</div><div class="chips"><span style="width:${pct}%"></span></div>`;
    playersPanel.appendChild(el);
  });
  renderHand();
  document.getElementById('challengeBtn').disabled = !lastPlay || busy || currentPlayer !== 0;
  document.getElementById('playBtn').disabled = busy || currentPlayer !== 0 || players[0].hand.length === 0;
  document.getElementById('passBtn').disabled = busy || currentPlayer !== 0;
  statusText.textContent = currentPlayer === 0 ? '轮到你。选择手牌，或者直接观察/质疑上一家。' : `${players[currentPlayer].name} 正在思考……`;
  playerMeshes.forEach((pm, i) => {
    pm.label.material.opacity = players[i].alive ? 1 : .28;
    pm.body.material.emissive = new THREE.Color(i === currentPlayer ? 0x2d1600 : 0x000000);
    pm.body.material.emissiveIntensity = i === currentPlayer ? .8 : 0;
  });
}

function renderHand() {
  handEl.innerHTML = '';
  players[0].hand.forEach((card, idx) => {
    const div = document.createElement('div');
    div.className = `card-ui ${(card.suit === '♥' || card.suit === '♦') ? 'red' : ''} ${selected.has(idx) ? 'selected' : ''} ${showHand ? '' : 'back'}`;
    div.innerHTML = showHand ? `<small>${card.suit}</small><b>${card.rank[0]}</b>` : '<b>?</b>';
    div.onclick = () => {
      if (currentPlayer !== 0 || busy) return;
      if (selected.has(idx)) selected.delete(idx); else if (selected.size < 3) selected.add(idx);
      renderHand();
    };
    handEl.appendChild(div);
  });
}

function nextPlayer() {
  let tries = 0;
  do { currentPlayer = (currentPlayer + 1) % players.length; tries++; } while ((!players[currentPlayer].alive || players[currentPlayer].hand.length === 0) && tries < 10);
  updateUI();
  if (players[currentPlayer].ai) setTimeout(aiTurn, 900 + Math.random() * 1100);
}

function playCards(playerIndex, cardIndexes, claimedCount) {
  const p = players[playerIndex];
  const actual = cardIndexes.map(i => p.hand[i]);
  p.hand = p.hand.filter((_, i) => !cardIndexes.includes(i));
  lastPlay = { playerIndex, cards: actual, claimedCount, honest: actual.every(c => c.rank === targetRank || c.rank === 'JOKER') };
  p.lastAction = `声明 ${claimedCount} 张 ${targetRank}`;
  p.chips -= 20 * claimedCount;
  animateCardThrow(playerIndex, claimedCount);
  animateChips(playerIndex, claimedCount);
  log(`${p.name} 推出 ${claimedCount} 张牌，并声称全是 ${targetRank}。`);
  selected.clear();
  if (p.hand.length === 0) log(`${p.name} 已经清空手牌，压力来到其他玩家。`);
  nextPlayer();
}

function challenge(challengerIndex) {
  if (!lastPlay || busy) return;
  busy = true;
  const challenged = players[lastPlay.playerIndex];
  const challenger = players[challengerIndex];
  challenged.lastAction = '被质疑';
  challenger.lastAction = '质疑';
  log(`${challenger.name} 拍桌质疑 ${challenged.name}！`, 'danger');
  showToast('质疑！开牌……');
  animateAccuse(challengerIndex, lastPlay.playerIndex);
  setTimeout(() => {
    const loserIndex = lastPlay.honest ? challengerIndex : lastPlay.playerIndex;
    const loser = players[loserIndex];
    log(lastPlay.honest ? `${challenged.name} 没有撒谎，${challenger.name} 质疑失败。` : `${challenged.name} 被抓到诈唬。`, 'danger');
    roulette(loserIndex);
    lastPlay = null;
    setTimeout(() => { busy = false; nextPlayer(); }, 2100);
  }, 1200);
}

function roulette(playerIndex) {
  const p = players[playerIndex];
  const shot = Math.random() < p.risk / 6;
  rotateRevolver();
  if (shot) {
    p.alive = false;
    p.lastAction = '中弹出局';
    p.chips = Math.max(0, p.chips - 300);
    log(`${p.name} 扣下扳机：砰！出局。`, 'danger');
    showToast(`${p.name} 出局！`);
    playerMeshes[playerIndex].group.rotation.z = 0.45;
  } else {
    p.risk++;
    p.chips = Math.max(0, p.chips - 120);
    log(`${p.name} 扣下扳机：空响。风险升到 ${p.risk}/6。`);
    showToast('咔哒……空枪');
  }
  chamber = Math.max(chamber, p.risk);
  checkEnd();
  updateUI();
}

function checkEnd() {
  const alive = players.filter(p => p.alive);
  if (alive.length <= 1) {
    const winner = alive[0] || players[0];
    winner.chips += 800;
    log(`${winner.name} 成为最后赢家，拿走酒馆桌上的筹码。`);
    showToast(`${winner.name} 获胜`);
    setTimeout(newGame, 2800);
  }
}

function aiTurn() {
  if (currentPlayer === 0 || busy) return;
  const p = players[currentPlayer];
  if (!p.alive) return nextPlayer();
  const suspicion = lastPlay ? (lastPlay.claimedCount * .18 + (players[lastPlay.playerIndex].risk - 1) * .08 + Math.random() * .45) : 0;
  if (lastPlay && suspicion > .55) return challenge(currentPlayer);
  const count = Math.min(p.hand.length, 1 + Math.floor(Math.random() * 3));
  const honestIndexes = p.hand.map((c, i) => (c.rank === targetRank || c.rank === 'JOKER') ? i : -1).filter(i => i >= 0);
  let indexes = [];
  if (honestIndexes.length >= count && Math.random() > .28) indexes = honestIndexes.slice(0, count);
  else indexes = [...Array(p.hand.length).keys()].sort(() => Math.random() - .5).slice(0, count);
  playCards(currentPlayer, indexes, count);
}

function animateCardThrow(playerIndex, count) {
  const pm = playerMeshes[playerIndex];
  for (let i = 0; i < count; i++) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.018, 0.7), mats.cardBack);
    card.position.copy(pm.group.position).multiplyScalar(.72);
    card.position.y = 1.7;
    card.rotation.set(Math.random(), pm.angle, Math.random());
    scene.add(card);
    card.userData.fly = { t: 0, sx: card.position.clone(), ex: new THREE.Vector3((Math.random()-.5)*1.6, 1.64 + i*.025, (Math.random()-.5)*1.2), spin: Math.random() * 8 + 4 };
  }
}

function animateChips(playerIndex, count) {
  const pm = playerMeshes[playerIndex];
  for (let i = 0; i < 4 + count * 3; i++) {
    const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, .04, 18), [mats.red, mats.gold, mats.black][i % 3]);
    chip.position.copy(pm.group.position).multiplyScalar(.68);
    chip.position.y = 1.08 + Math.random()*.4;
    chip.rotation.x = Math.PI/2;
    chip.castShadow = true;
    scene.add(chip);
    chip.userData.fly = { t: 0, sx: chip.position.clone(), ex: new THREE.Vector3((Math.random()-.5)*1.1, 1.65 + Math.random()*.2, (Math.random()-.5)*1.1), spin: Math.random() * 10 + 8 };
  }
}

function animateAccuse(from, to) {
  const a = playerMeshes[from].group.position.clone();
  const b = playerMeshes[to].group.position.clone();
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, 2.7, a.z), new THREE.Vector3(b.x, 2.7, b.z)]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xff302a, transparent: true, opacity: .95 }));
  scene.add(line);
  line.userData.fade = 1.0;
}

function rotateRevolver() {
  revolver.userData.kick = 1;
  fireLight.intensity = 8;
  setTimeout(() => fireLight.intensity = 4.5, 180);
}

// Controls
let orbitYaw = 0;
let dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => { if (dragging) { orbitYaw += (e.clientX - lastX) * 0.004; lastX = e.clientX; } });
addEventListener('wheel', e => { camera.position.multiplyScalar(1 + Math.sign(e.deltaY) * .04); camera.position.clampLength(7, 16); });

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  fireGroup.children.forEach((f, i) => { f.scale.y = 0.82 + Math.sin(t * 7 + i) * .22 + Math.random()*.04; f.material.opacity = .55 + Math.sin(t*5+i)*.18; });
  fireLight.intensity += (4.5 + Math.sin(t*8)*.55 - fireLight.intensity) * .08;
  table.rotation.y = Math.sin(t * .25) * .015;
  playerMeshes.forEach((pm, i) => {
    pm.head.position.y = 2.1 + Math.sin(t * 1.6 + i) * .025;
    pm.group.position.y = Math.sin(t * 1.2 + i) * .01;
  });
  scene.children.forEach(obj => {
    if (obj.userData.fly) {
      const f = obj.userData.fly;
      f.t += 0.028;
      const k = Math.min(1, f.t);
      obj.position.lerpVectors(f.sx, f.ex, k);
      obj.position.y += Math.sin(k * Math.PI) * 1.4;
      obj.rotation.y += 0.15;
      obj.rotation.z += 0.08;
      if (k >= 1) delete obj.userData.fly;
    }
    if (obj.userData.fade) {
      obj.userData.fade -= .025;
      obj.material.opacity = obj.userData.fade;
      if (obj.userData.fade <= 0) scene.remove(obj);
    }
  });
  if (revolver.userData.kick) {
    revolver.rotation.z = Math.sin(t * 42) * .25 * revolver.userData.kick;
    revolver.userData.kick *= .9;
    if (revolver.userData.kick < .03) { revolver.userData.kick = 0; revolver.rotation.z = 0; }
  }
  const radius = camera.position.length();
  camera.position.x = Math.sin(orbitYaw) * radius * .42;
  camera.position.z = Math.cos(orbitYaw) * radius;
  camera.lookAt(0, 1.5, 0);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

document.getElementById('playBtn').onclick = () => {
  if (currentPlayer !== 0 || busy) return;
  const claimed = Number(document.getElementById('claimCount').value);
  const chosen = [...selected];
  if (chosen.length === 0) {
    const auto = [...Array(players[0].hand.length).keys()].slice(0, Math.min(claimed, players[0].hand.length));
    playCards(0, auto, auto.length);
  } else {
    playCards(0, chosen, chosen.length);
  }
};
document.getElementById('challengeBtn').onclick = () => challenge(0);
document.getElementById('passBtn').onclick = () => { players[0].lastAction = '观察'; log('你选择观察一回合。'); nextPlayer(); };
document.getElementById('newRoundBtn').onclick = newGame;
document.getElementById('peekBtn').onclick = () => { showHand = !showHand; renderHand(); };
document.getElementById('rulesToggle').onclick = () => document.querySelector('.rules').classList.toggle('open');

newGame();
animate();
