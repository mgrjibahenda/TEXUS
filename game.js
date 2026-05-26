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
let round = 0;
let busy = false;
let yaw = 0;
let zoom = 1;

const cameraEl = document.getElementById('camera');
const propsEl = document.getElementById('props');
const players3dEl = document.getElementById('players3d');
const tableCards3d = document.getElementById('tableCards3d');
const tableChips3d = document.getElementById('tableChips3d');
const handEl = document.getElementById('handCards');
const playersPanel = document.getElementById('playersPanel');
const logEl = document.getElementById('log');
const targetRankEl = document.getElementById('targetRank');
const chamberText = document.getElementById('chamberText');
const statusText = document.getElementById('statusText');
const toast = document.getElementById('toast');

function set3d(el, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  el.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
}

function makeEl(cls, parent = propsEl) {
  const el = document.createElement('div');
  el.className = cls;
  parent.appendChild(el);
  return el;
}

function buildTavern() {
  propsEl.innerHTML = '';
  players3dEl.innerHTML = '';
  tableCards3d.innerHTML = '';
  tableChips3d.innerHTML = '';

  for (let i = -5; i <= 5; i++) {
    const b = makeEl('beam');
    set3d(b, i * 190, 0, 600, 0, 0, 90);
    const b2 = makeEl('beam');
    set3d(b2, 0, i * 190, 602, 0, 0, 0);
  }

  [-420, 420].forEach(x => {
    const w = makeEl('window');
    set3d(w, x, -1050, 230, 90, 0, 0);
  });

  const fp = makeEl('fireplace');
  set3d(fp, 0, -1080, 45, 90, 0, 0);
  for (let i = 0; i < 8; i++) {
    const f = makeEl('flame');
    fp.appendChild(f);
    f.style.left = `${85 + i * 13}px`;
    f.style.bottom = `${8 + Math.random() * 10}px`;
    f.style.animationDelay = `${Math.random()}s`;
  }

  const bar = makeEl('bar3d');
  set3d(bar, 610, -720, 8, 0, 0, 0);
  const shelf = makeEl('shelf');
  set3d(shelf, 610, -990, 190, 90, 0, 0);
  for (let i = 0; i < 56; i++) {
    const bot = makeEl('bottle');
    shelf.appendChild(bot);
    bot.style.left = `${18 + (i % 14) * 27}px`;
    bot.style.top = `${20 + Math.floor(i / 14) * 45}px`;
    const colors = ['rgba(49,113,56,.78)', 'rgba(95,50,28,.78)', 'rgba(42,56,118,.78)', 'rgba(118,30,30,.78)'];
    bot.style.background = `linear-gradient(90deg,rgba(255,255,255,.25),${colors[i % colors.length]})`;
  }

  for (let i = 0; i < 9; i++) {
    const l = makeEl('lamp');
    set3d(l, -720 + i * 180, -200 + Math.sin(i) * 360, 420, 0, 0, 0);
  }

  for (let i = 0; i < 13; i++) {
    const c = makeEl('candle');
    const angle = (Math.PI * 2 * i) / 13;
    const r = 250 + Math.random() * 560;
    set3d(c, Math.cos(angle) * r, Math.sin(angle) * r, -22, 0, 0, Math.random() * 30);
  }

  for (let i = 0; i < 40; i++) addChip3d(Math.random() * 360, 60 + Math.random() * 150, i % 3);
  for (let i = 0; i < 9; i++) addTableCard(-80 + i * 17, -10 + Math.sin(i) * 8, i * 7, i % 2 === 0);

  ['你', 'Raven', 'Doc', 'Viper'].forEach((name, i) => addPlayer3d(name, i));
  updateCamera();
}

function addTableCard(x, y, rz, face = false) {
  const c = makeEl(`card3d ${face ? '' : 'back'}`, tableCards3d);
  c.textContent = face ? ['K', 'Q', 'A'][Math.floor(Math.random() * 3)] : '';
  set3d(c, x, y, 0, 0, 0, rz);
  return c;
}

function addChip3d(angleDeg, r, kind = 0) {
  const chip = makeEl('chip3d', tableChips3d);
  const angle = angleDeg * Math.PI / 180;
  chip.style.background = ['#8d221e', '#d6a84f', '#101010'][kind % 3];
  set3d(chip, Math.cos(angle) * r, Math.sin(angle) * r, 0, 0, 0, angleDeg);
  return chip;
}

function addPlayer3d(name, i) {
  const p = makeEl('player3d', players3dEl);
  p.dataset.index = i;
  p.innerHTML = `<div class="nameplate">${name}</div><div class="chair"></div><div class="body"></div><div class="head"></div><div class="hat"></div><div class="arm a1"></div><div class="arm a2"></div>`;
  const pos = [
    { x: 0, y: 430, z: 5, rz: 180 },
    { x: 480, y: 0, z: 5, rz: -90 },
    { x: 0, y: -430, z: 5, rz: 0 },
    { x: -480, y: 0, z: 5, rz: 90 },
  ][i];
  set3d(p, pos.x, pos.y, pos.z, 0, 0, pos.rz);
}

function updateCamera() {
  cameraEl.style.transform = `rotateX(63deg) rotateZ(${yaw}deg) translateZ(${-160 * zoom}px) scale(${zoom})`;
}

function safeId() { return `card-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function buildDeck() {
  const d = [];
  for (const r of ranks) for (const s of suits) d.push({ rank: r, suit: s, id: safeId() });
  for (let i = 0; i < 8; i++) d.push({ rank: 'JOKER', suit: '★', id: safeId() });
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
  tableCards3d.innerHTML = '';
  tableChips3d.innerHTML = '';
  for (let i = 0; i < 36; i++) addChip3d(Math.random() * 360, 50 + Math.random() * 150, i % 3);
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
    const p3d = document.querySelector(`.player3d[data-index="${i}"]`);
    if (p3d) {
      p3d.classList.toggle('active', i === currentPlayer && p.alive);
      p3d.classList.toggle('dead', !p.alive);
      const name = p3d.querySelector('.nameplate');
      name.textContent = `${p.name} · ${p.chips}`;
    }
  });
  renderHand();
  document.getElementById('challengeBtn').disabled = !lastPlay || busy || currentPlayer !== 0;
  document.getElementById('playBtn').disabled = busy || currentPlayer !== 0 || players[0].hand.length === 0;
  document.getElementById('passBtn').disabled = busy || currentPlayer !== 0;
  statusText.textContent = currentPlayer === 0
    ? (lastPlay && players[lastPlay.playerIndex].hand.length === 0 ? `${players[lastPlay.playerIndex].name} 已出完最后一手。你可以质疑；如果观察，他将赢下本局。` : '轮到你。选择手牌，或者直接观察/质疑上一家。')
    : `${players[currentPlayer].name} 正在思考……`;
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
  if (players[currentPlayer].ai) setTimeout(aiTurn, 850 + Math.random() * 950);
}

function playCards(playerIndex, cardIndexes, claimedCount) {
  const p = players[playerIndex];
  const actual = cardIndexes.map(i => p.hand[i]);
  p.hand = p.hand.filter((_, i) => !cardIndexes.includes(i));
  lastPlay = { playerIndex, cards: actual, claimedCount, honest: actual.every(c => c.rank === targetRank || c.rank === 'JOKER') };
  p.lastAction = `声明 ${claimedCount} 张 ${targetRank}`;
  p.chips = Math.max(0, p.chips - 20 * claimedCount);
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
    log(lastPlay.honest ? `${challenged.name} 没有撒谎，${challenger.name} 质疑失败。` : `${challenged.name} 被抓到诈唬。`, 'danger');
    const roundEnded = roulette(loserIndex);
    lastPlay = null;
    if (!roundEnded) setTimeout(() => { busy = false; nextPlayer(); }, 1700);
  }, 900);
}

function roulette(playerIndex) {
  const p = players[playerIndex];
  const shot = Math.random() < p.risk / 6;
  document.querySelector('.revolver').classList.remove('kick');
  void document.querySelector('.revolver').offsetWidth;
  document.querySelector('.revolver').classList.add('kick');
  if (shot) {
    p.alive = false;
    p.lastAction = '中弹出局';
    p.chips = Math.max(0, p.chips - 300);
    log(`${p.name} 扣下扳机：砰！出局。`, 'danger');
    showToast(`${p.name} 出局！`);
  } else {
    p.risk++;
    p.chips = Math.max(0, p.chips - 120);
    log(`${p.name} 扣下扳机：咔哒，空响。风险升到 ${p.risk}/6。`);
    showToast('咔哒……空枪');
  }
  chamber = Math.max(chamber, p.risk);
  if (checkEnd()) return true;
  updateUI();
  return false;
}

function finishRound(winnerIndex, reason = '拿走酒馆桌上的筹码') {
  busy = true;
  const winner = players[winnerIndex] || players.find(p => p.alive) || players[0];
  winner.chips += 800;
  winner.lastAction = '本局赢家';
  log(`${winner.name} ${reason}。`);
  showToast(`${winner.name} 获胜`);
  animatePotToWinner(winnerIndex);
  updateUI();
  setTimeout(() => { busy = false; newGame(); }, 2500);
}

function checkEnd() {
  const aliveIndexes = players.map((p, i) => p.alive ? i : -1).filter(i => i >= 0);
  if (aliveIndexes.length <= 1) {
    finishRound(aliveIndexes[0] ?? 0, '成为最后赢家，拿走酒馆桌上的筹码');
    return true;
  }
  return false;
}

function aiTurn() {
  if (currentPlayer === 0 || busy) return;
  const p = players[currentPlayer];
  if (!p.alive) return nextPlayer();
  const suspicion = lastPlay ? (lastPlay.claimedCount * .18 + (players[lastPlay.playerIndex].risk - 1) * .08 + Math.random() * .45) : 0;
  if (lastPlay && suspicion > .55) return challenge(currentPlayer);
  if (lastPlay && players[lastPlay.playerIndex].hand.length === 0) {
    finishRound(lastPlay.playerIndex, '最后一手没有被质疑，安全离桌');
    lastPlay = null;
    return;
  }
  const count = Math.min(p.hand.length, 1 + Math.floor(Math.random() * 3));
  const honestIndexes = p.hand.map((c, i) => (c.rank === targetRank || c.rank === 'JOKER') ? i : -1).filter(i => i >= 0);
  let indexes = [];
  if (honestIndexes.length >= count && Math.random() > .28) indexes = honestIndexes.slice(0, count);
  else indexes = [...Array(p.hand.length).keys()].sort(() => Math.random() - .5).slice(0, count);
  playCards(currentPlayer, indexes, count);
}

function playerPoint(index) {
  return [
    { x: 0, y: 330 }, { x: 360, y: 0 }, { x: 0, y: -330 }, { x: -360, y: 0 }
  ][index];
}

function animateCardThrow(playerIndex, count) {
  const start = playerPoint(playerIndex);
  for (let i = 0; i < count; i++) {
    const card = addTableCard(start.x * .4, start.y * .4, Math.random() * 40, false);
    card.style.transition = 'transform .75s cubic-bezier(.2,.85,.18,1)';
    setTimeout(() => set3d(card, -50 + Math.random() * 100, -40 + Math.random() * 80, 50 + i * 4, 0, 0, Math.random() * 50), 20);
  }
}

function animateChips(playerIndex, count) {
  const start = playerPoint(playerIndex);
  for (let i = 0; i < 4 + count * 3; i++) {
    const chip = addChip3d(0, 0, i % 3);
    chip.style.transition = 'transform .85s cubic-bezier(.2,.85,.18,1)';
    set3d(chip, start.x * .45, start.y * .45, 70, 0, 0, 0);
    setTimeout(() => set3d(chip, -85 + Math.random() * 170, -65 + Math.random() * 130, 55, 0, 0, Math.random() * 360), 35);
  }
}

function animatePotToWinner(winnerIndex) {
  const end = playerPoint(winnerIndex);
  document.querySelectorAll('.chip3d').forEach((chip, i) => {
    chip.style.transition = 'transform .9s cubic-bezier(.2,.85,.18,1), opacity .9s ease';
    setTimeout(() => {
      set3d(chip, end.x * .45 + Math.random() * 60 - 30, end.y * .45 + Math.random() * 60 - 30, 85, 0, 0, Math.random() * 360);
      chip.style.opacity = '.2';
    }, i * 12);
  });
}

function animateAccuse(from, to) {
  const a = playerPoint(from), b = playerPoint(to);
  const line = makeEl('accuse-line', propsEl);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  line.style.position = 'absolute';
  line.style.width = `${len}px`;
  line.style.height = '8px';
  line.style.background = 'linear-gradient(90deg, transparent, #ff342e, transparent)';
  line.style.boxShadow = '0 0 26px #ff342e';
  line.style.opacity = '1';
  line.style.transition = 'opacity .8s ease';
  set3d(line, a.x, a.y, 120, 0, 0, Math.atan2(dy, dx) * 180 / Math.PI);
  setTimeout(() => line.style.opacity = '0', 300);
  setTimeout(() => line.remove(), 1200);
}

let dragging = false, lastX = 0;
document.getElementById('worldWrap').addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => { if (dragging) { yaw += (e.clientX - lastX) * .12; lastX = e.clientX; updateCamera(); } });
addEventListener('wheel', e => { zoom = Math.max(.72, Math.min(1.35, zoom + Math.sign(e.deltaY) * .06)); updateCamera(); }, { passive: true });

function tick() {
  document.querySelectorAll('.player3d').forEach((el, i) => {
    if (!el.classList.contains('dead')) el.style.filter = `brightness(${.92 + Math.sin(Date.now()/600 + i) * .06})`;
  });
  requestAnimationFrame(tick);
}

document.getElementById('playBtn').onclick = () => {
  if (currentPlayer !== 0 || busy) return;
  const claimed = Number(document.getElementById('claimCount').value);
  const chosen = [...selected];
  if (chosen.length === 0) {
    const auto = [...Array(players[0].hand.length).keys()].slice(0, Math.min(claimed, players[0].hand.length));
    playCards(0, auto, auto.length);
  } else playCards(0, chosen, chosen.length);
};
document.getElementById('challengeBtn').onclick = () => challenge(0);
document.getElementById('passBtn').onclick = () => {
  players[0].lastAction = '观察';
  log('你选择观察一回合。');
  if (lastPlay && players[lastPlay.playerIndex].hand.length === 0) {
    finishRound(lastPlay.playerIndex, '最后一手没有被你质疑，安全离桌');
    lastPlay = null;
    return;
  }
  nextPlayer();
};
document.getElementById('newRoundBtn').onclick = newGame;
document.getElementById('peekBtn').onclick = () => { showHand = !showHand; renderHand(); };
document.getElementById('rulesToggle').onclick = () => document.querySelector('.rules').classList.toggle('open');

buildTavern();
newGame();
tick();
