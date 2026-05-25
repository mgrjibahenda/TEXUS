const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const MAP_SIZE = 60;
const PLAYER_RADIUS = 0.65;
const MAX_PLAYERS = 4;
const TICK_RATE = 30;
const RESPAWN_MS = 2500;
const MAX_HEALTH = 100;

const walls = [
  { x: 0, z: -28, w: 60, d: 3 },
  { x: 0, z: 28, w: 60, d: 3 },
  { x: -28, z: 0, w: 3, d: 60 },
  { x: 28, z: 0, w: 3, d: 60 },
  { x: 0, z: 0, w: 7, d: 16 },
  { x: -14, z: -12, w: 14, d: 4 },
  { x: 14, z: 12, w: 14, d: 4 },
  { x: -16, z: 14, w: 5, d: 10 },
  { x: 17, z: -15, w: 5, d: 10 },
  { x: 0, z: 21, w: 18, d: 3 },
  { x: 0, z: -21, w: 18, d: 3 }
];

const spawns = [
  { x: -22, y: 1.6, z: -22, yaw: Math.PI / 4 },
  { x: 22, y: 1.6, z: 22, yaw: -3 * Math.PI / 4 },
  { x: -22, y: 1.6, z: 22, yaw: -Math.PI / 4 },
  { x: 22, y: 1.6, z: -22, yaw: 3 * Math.PI / 4 }
];

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[crypto.randomInt(chars.length)];
  return code;
}

function createRoom(hostId) {
  let code;
  do code = makeRoomCode();
  while (rooms.has(code));

  const room = {
    code,
    hostId,
    players: new Map(),
    bullets: [],
    events: [],
    startedAt: Date.now()
  };
  rooms.set(code, room);
  return room;
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    walls,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      health: p.health,
      alive: p.alive,
      kills: p.kills,
      deaths: p.deaths,
      color: p.color,
      shootingUntil: p.shootingUntil || 0,
      respawnAt: p.respawnAt || 0
    })),
    bullets: room.bullets,
    events: room.events.slice(-8),
    now: Date.now()
  };
}

function spawnForIndex(idx) {
  return { ...spawns[idx % spawns.length] };
}

function makePlayer(socket, name, idx) {
  const s = spawnForIndex(idx);
  return {
    id: socket.id,
    name: String(name || "Player").trim().slice(0, 16) || "Player",
    x: s.x,
    y: s.y,
    z: s.z,
    yaw: s.yaw,
    pitch: 0,
    health: MAX_HEALTH,
    alive: true,
    kills: 0,
    deaths: 0,
    color: ["#ff5252", "#52a7ff", "#52ff8a", "#f5d66c"][idx % 4],
    input: { w: false, a: false, s: false, d: false },
    lastShot: 0,
    respawnAt: 0,
    shootingUntil: 0
  };
}

function findPlayerRoom(id) {
  for (const room of rooms.values()) {
    if (room.players.has(id)) return room;
  }
  return null;
}

function isInsideWall(x, z, wall, pad = PLAYER_RADIUS) {
  return x > wall.x - wall.w / 2 - pad &&
    x < wall.x + wall.w / 2 + pad &&
    z > wall.z - wall.d / 2 - pad &&
    z < wall.z + wall.d / 2 + pad;
}

function collides(x, z) {
  if (x < -MAP_SIZE / 2 + PLAYER_RADIUS || x > MAP_SIZE / 2 - PLAYER_RADIUS ||
      z < -MAP_SIZE / 2 + PLAYER_RADIUS || z > MAP_SIZE / 2 - PLAYER_RADIUS) {
    return true;
  }
  return walls.some(w => isInsideWall(x, z, w));
}

function hasLineOfSight(room, from, to) {
  const steps = 50;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    if (walls.some(w => isInsideWall(x, z, w, 0.05))) return false;
  }
  return true;
}

function rayHit(room, shooter, dir) {
  let best = null;
  const origin = { x: shooter.x, y: shooter.y, z: shooter.z };

  for (const target of room.players.values()) {
    if (target.id === shooter.id || !target.alive) continue;

    const to = {
      x: target.x - origin.x,
      y: target.y - origin.y,
      z: target.z - origin.z
    };
    const projection = to.x * dir.x + to.y * dir.y + to.z * dir.z;
    if (projection <= 0 || projection > 80) continue;

    const closest = {
      x: origin.x + dir.x * projection,
      y: origin.y + dir.y * projection,
      z: origin.z + dir.z * projection
    };
    const dx = target.x - closest.x;
    const dy = target.y - closest.y;
    const dz = target.z - closest.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 0.85 && hasLineOfSight(room, origin, target)) {
      if (!best || projection < best.distance) best = { target, distance: projection };
    }
  }
  return best;
}

function shoot(room, shooter) {
  const now = Date.now();
  if (!shooter.alive) return;
  if (now - shooter.lastShot < 180) return;
  shooter.lastShot = now;
  shooter.shootingUntil = now + 120;

  const dir = {
    x: Math.sin(shooter.yaw) * Math.cos(shooter.pitch),
    y: Math.sin(shooter.pitch),
    z: Math.cos(shooter.yaw) * Math.cos(shooter.pitch)
  };

  room.bullets.push({
    id: now + "-" + crypto.randomInt(999999),
    from: shooter.id,
    x: shooter.x,
    y: shooter.y,
    z: shooter.z,
    dx: dir.x,
    dy: dir.y,
    dz: dir.z,
    born: now,
    life: 180
  });

  const hit = rayHit(room, shooter, dir);
  if (hit) {
    const damage = hit.distance < 18 ? 34 : 25;
    hit.target.health = Math.max(0, hit.target.health - damage);
    room.events.push({
      id: "hit-" + now,
      type: "hit",
      text: `${shooter.name} hit ${hit.target.name} -${damage}`,
      ts: now
    });

    if (hit.target.health <= 0) {
      hit.target.alive = false;
      hit.target.deaths += 1;
      hit.target.respawnAt = now + RESPAWN_MS;
      shooter.kills += 1;
      room.events.push({
        id: "kill-" + now,
        type: "kill",
        text: `${shooter.name} eliminated ${hit.target.name}`,
        ts: now
      });
    }
  }
}

function respawn(room, p) {
  const idx = Array.from(room.players.keys()).indexOf(p.id);
  const s = spawnForIndex(idx);
  p.x = s.x;
  p.y = s.y;
  p.z = s.z;
  p.yaw = s.yaw;
  p.pitch = 0;
  p.health = MAX_HEALTH;
  p.alive = true;
  p.respawnAt = 0;
  room.events.push({
    id: "respawn-" + Date.now() + "-" + p.id,
    type: "respawn",
    text: `${p.name} respawned`,
    ts: Date.now()
  });
}

function updateRoom(room, dt) {
  const now = Date.now();

  for (const p of room.players.values()) {
    if (!p.alive) {
      if (p.respawnAt && now >= p.respawnAt) respawn(room, p);
      continue;
    }

    const forwardX = Math.sin(p.yaw);
    const forwardZ = Math.cos(p.yaw);
    const rightX = Math.cos(p.yaw);
    const rightZ = -Math.sin(p.yaw);
    let vx = 0;
    let vz = 0;

    if (p.input.w) { vx += forwardX; vz += forwardZ; }
    if (p.input.s) { vx -= forwardX; vz -= forwardZ; }
    if (p.input.d) { vx += rightX; vz += rightZ; }
    if (p.input.a) { vx -= rightX; vz -= rightZ; }

    const len = Math.hypot(vx, vz) || 1;
    const speed = 10;
    vx = (vx / len) * speed * dt;
    vz = (vz / len) * speed * dt;

    const nx = p.x + vx;
    const nz = p.z + vz;
    if (!collides(nx, p.z)) p.x = nx;
    if (!collides(p.x, nz)) p.z = nz;
  }

  room.bullets = room.bullets.filter(b => now - b.born < b.life);
  room.events = room.events.filter(e => now - e.ts < 6000);
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }, cb) => {
    const room = createRoom(socket.id);
    const player = makePlayer(socket, name, 0);
    room.players.set(socket.id, player);
    socket.join(room.code);
    cb?.({ ok: true, code: room.code, id: socket.id });
    io.to(room.code).emit("state", publicRoom(room));
  });

  socket.on("joinRoom", ({ name, code }, cb) => {
    const room = rooms.get(String(code || "").trim().toUpperCase());
    if (!room) return cb?.({ ok: false, error: "Room not found." });
    if (room.players.size >= MAX_PLAYERS) return cb?.({ ok: false, error: "Room full." });

    const player = makePlayer(socket, name, room.players.size);
    room.players.set(socket.id, player);
    socket.join(room.code);
    cb?.({ ok: true, code: room.code, id: socket.id });
    room.events.push({
      id: "join-" + Date.now(),
      type: "join",
      text: `${player.name} joined`,
      ts: Date.now()
    });
    io.to(room.code).emit("state", publicRoom(room));
  });

  socket.on("input", (input) => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.input = {
      w: !!input.w,
      a: !!input.a,
      s: !!input.s,
      d: !!input.d
    };
    if (Number.isFinite(input.yaw)) p.yaw = input.yaw;
    if (Number.isFinite(input.pitch)) p.pitch = Math.max(-0.9, Math.min(0.9, input.pitch));
  });

  socket.on("shoot", () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    shoot(room, p);
    io.to(room.code).emit("state", publicRoom(room));
  });

  socket.on("disconnect", () => {
    const room = findPlayerRoom(socket.id);
    if (!room) return;
    const p = room.players.get(socket.id);
    room.players.delete(socket.id);

    if (room.players.size === 0) {
      rooms.delete(room.code);
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players.keys().next().value;
    }

    room.events.push({
      id: "leave-" + Date.now(),
      type: "leave",
      text: `${p?.name || "Player"} disconnected`,
      ts: Date.now()
    });
    io.to(room.code).emit("state", publicRoom(room));
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    updateRoom(room, 1 / TICK_RATE);
    io.to(room.code).emit("state", publicRoom(room));
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`Mini FPS v1 running on port ${PORT}`);
});