/**
 * Iron Titans 3D — Local Multiplayer & Matchmaking Server
 * Zero-dependency RFC 6455 WebSocket & HTTP Server for Node.js.
 * 
 * Features:
 * - Built purely with native Node.js 'http' and 'crypto' modules (No npm install required)
 * - Static HTTP file server for instant browser play
 * - 5v5 Matchmaking Queue with human aggregation and hybrid AI slot filling
 * - 20 Hz authoritative room simulation loop (damage validation, objectives, timer)
 * - Multi-client room synchronization (movement, weapon fire, hits, death & respawn)
 * 
 * Usage:
 *   node server/server.js
 *   Open http://localhost:8090 in two browser tabs for multi-client testing!
 */

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8090;
const ROOT_DIR = path.resolve(__dirname, '..');

// ── MIME Types for Static File Serving ──
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// ── WebSocket Protocol Helpers (RFC 6455) ──
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function computeAcceptKey(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function encodeFrame(payloadText) {
  const payloadBuf = Buffer.from(payloadText, 'utf8');
  const len = payloadBuf.length;

  let header;
  if (len <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = len;
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, payloadBuf]);
}

function decodeFrame(buf) {
  if (buf.length < 2) return null;

  const firstByte = buf[0];
  const secondByte = buf[1];
  const opcode = firstByte & 0x0f;
  const isMasked = Boolean(secondByte & 0x80);
  let payloadLen = secondByte & 0x7f;

  let offset = 2;
  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  if (!isMasked || buf.length < offset + 4 + payloadLen) return null;

  const maskKey = buf.subarray(offset, offset + 4);
  offset += 4;

  const payload = Buffer.alloc(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    payload[i] = buf[offset + i] ^ maskKey[i % 4];
  }

  return {
    opcode,
    text: opcode === 1 ? payload.toString('utf8') : null,
    totalBytes: offset + payloadLen
  };
}

// ── Game Server Room & Simulation Logic ──
class ServerRoom {
  constructor(id, mode = 'SKIRMISH', arena = 'NEON_FORGE') {
    this.id = id;
    this.mode = mode;
    this.arena = arena;
    this.players = new Map(); // id -> player obj
    this.sockets = new Map(); // id -> socket
    this.scores = { blue: 0, red: 0 };
    this.targetScore = mode === 'DOMINATION' ? 300 : 25;
    this.timer = 300;
    this.isOver = false;

    // Objectives
    this.objectives = {
      zones: {
        A: { id: 'A', owner: 'neutral', progress: 0, contested: false },
        B: { id: 'B', owner: 'neutral', progress: 0, contested: false },
        C: { id: 'C', owner: 'neutral', progress: 0, contested: false }
      },
      activePoint: 'A'
    };

    // 20 Hz Authoritative Game Loop (50ms interval)
    this.intervalId = setInterval(() => this.tick(), 50);
  }

  addPlayer(player, socket) {
    this.players.set(player.id, player);
    if (socket) this.sockets.set(player.id, socket);
  }

  removePlayer(id) {
    this.players.delete(id);
    this.sockets.delete(id);
  }

  broadcast(type, payload) {
    const frame = encodeFrame(JSON.stringify({ type, timestamp: Date.now(), payload }));
    for (const socket of this.sockets.values()) {
      try {
        if (!socket.destroyed) socket.write(frame);
      } catch (e) {}
    }
  }

  tick() {
    if (this.isOver) return;

    // 1. Tick timer once per second
    if (!this._lastSec || Date.now() - this._lastSec >= 1000) {
      this._lastSec = Date.now();
      this.timer = Math.max(0, this.timer - 1);

      // Objective score ticking in Domination
      if (this.mode === 'DOMINATION') {
        let blueZones = 0, redZones = 0;
        Object.values(this.objectives.zones).forEach(z => {
          if (z.owner === 'blue') blueZones++;
          if (z.owner === 'red') redZones++;
        });
        this.scores.blue = Math.min(this.targetScore, this.scores.blue + blueZones * 2);
        this.scores.red = Math.min(this.targetScore, this.scores.red + redZones * 2);
      }

      // Check Match Over conditions
      if (this.timer <= 0 || this.scores.blue >= this.targetScore || this.scores.red >= this.targetScore) {
        this.isOver = true;
        const winner = this.scores.blue >= this.scores.red ? 'blue' : 'red';
        this.broadcast('MATCH_END', {
          winningTeam: winner,
          scores: this.scores,
          reason: this.timer <= 0 ? 'TIME_EXPIRED' : 'TARGET_REACHED'
        });
        clearInterval(this.intervalId);
        return;
      }
    }

    // 2. Broadcast 20 Hz tick with transforms & match state
    const playerTransforms = [];
    for (const [id, p] of this.players) {
      playerTransforms.push({
        id,
        t: p.transform || { p: [0, 0, 0], v: [0, 0, 0], r: [0, 0], h: [p.hp, p.shield], a: 'IDLE', d: p.isDead ? 1 : 0, t: Date.now() }
      });
    }

    this.broadcast('MATCH_TICK', {
      timer: this.timer,
      scores: this.scores,
      objectives: this.objectives,
      players: playerTransforms
    });
  }

  handlePlayerFire(shooterId, data) {
    const shooter = this.players.get(shooterId);
    if (!shooter || shooter.isDead) return;

    // Anti-exploit: rate of fire validation
    const now = Date.now();
    if (shooter.lastFireTime && (now - shooter.lastFireTime) < 80) return; // 80ms clamp
    shooter.lastFireTime = now;

    // Broadcast fire event to all players in the room
    this.broadcast('WEAPON_FIRE', {
      shooterId,
      weaponId: data.weaponId,
      origin: data.origin,
      direction: data.direction,
      isSecondary: data.isSecondary
    });

    // Authoritative hit calculation for simulation
    this._resolveHitDetection(shooter, data);
  }

  _resolveHitDetection(shooter, data) {
    // Check targets on the opposing team
    for (const [vId, victim] of this.players) {
      if (victim.team !== shooter.team && !victim.isDead && victim.transform && victim.transform.p) {
        const vp = victim.transform.p;
        const ox = data.origin[0], oz = data.origin[2];
        const dx = data.direction[0], dz = data.direction[2];

        // Ray to point distance
        const toVx = vp[0] - ox;
        const toVz = vp[2] - oz;
        const dot = toVx * dx + toVz * dz;

        if (dot > 0 && dot < 60) {
          const perpDistSq = (toVx - dot * dx) ** 2 + (toVz - dot * dz) ** 2;
          if (perpDistSq < 4.0) { // Hit within 2m bounding cylinder
            const baseDamage = 180;
            const isCritical = perpDistSq < 0.6; // Close to center weak point
            const totalDmg = Math.round(baseDamage * (isCritical ? 1.5 : 1.0));

            let isShield = false;
            if (victim.shield > 0) {
              isShield = true;
              victim.shield = Math.max(0, victim.shield - totalDmg);
            } else {
              victim.hp = Math.max(0, victim.hp - totalDmg);
            }

            this.broadcast('DAMAGE_APPLIED', {
              victimId: vId,
              attackerId: shooter.id,
              damage: totalDmg,
              isCritical,
              isShield,
              remainingHp: victim.hp,
              remainingShield: victim.shield
            });

            // Elimination
            if (victim.hp <= 0 && !victim.isDead) {
              victim.isDead = true;
              shooter.kills = (shooter.kills || 0) + 1;
              victim.deaths = (victim.deaths || 0) + 1;

              if (shooter.team === 'blue') this.scores.blue++;
              else this.scores.red++;

              this.broadcast('PLAYER_KILLED', {
                victimId: vId,
                killerId: shooter.id,
                weaponId: data.weaponId
              });

              // Trigger 2-second respawn
              setTimeout(() => {
                victim.isDead = false;
                victim.hp = victim.maxHp;
                victim.shield = victim.maxShield;
              }, 2000);
            }
            break;
          }
        }
      }
    }
  }

  destroy() {
    clearInterval(this.intervalId);
    this.players.clear();
    this.sockets.clear();
  }
}

// ── Matchmaking Queue Manager ──
class ServerMatchmaker {
  constructor() {
    this.queue = [];
    this.rooms = new Map();
  }

  enqueue(playerData, socket) {
    this.queue.push({ data: playerData, socket, joinedAt: Date.now() });
    this._checkQueue();
  }

  removeSocket(socket) {
    this.queue = this.queue.filter(q => q.socket !== socket);
    for (const room of this.rooms.values()) {
      for (const [id, s] of room.sockets) {
        if (s === socket) {
          room.removePlayer(id);
        }
      }
    }
  }

  _checkQueue() {
    if (this.queue.length === 0) return;

    // Check if we have 2+ human players ready to pair together,
    // OR if single player has waited > 1.5 seconds, start hybrid 5v5 match immediately!
    const now = Date.now();
    const oldest = this.queue[0];

    if (this.queue.length >= 2 || (now - oldest.joinedAt >= 1500)) {
      const matchHumans = this.queue.splice(0, 10);
      this._launchMatch(matchHumans);
    }
  }

  _launchMatch(humanEntries) {
    const roomId = 'room_' + Math.random().toString(36).substr(2, 6);
    const mode = humanEntries[0].data.mode || 'SKIRMISH';
    const arena = humanEntries[0].data.arena || 'NEON_FORGE';

    const room = new ServerRoom(roomId, mode, arena);
    this.rooms.set(roomId, room);

    const playersRoster = [];

    // Add Human players
    humanEntries.forEach((entry, idx) => {
      const team = idx % 2 === 0 ? 'blue' : 'red';
      const p = {
        id: entry.data.player.id,
        name: entry.data.player.name || `Player_${idx + 1}`,
        team,
        isAI: false,
        hp: 1000,
        maxHp: 1000,
        shield: 500,
        maxShield: 500,
        mechId: (entry.data.player.loadout && entry.data.player.loadout.mechId) || 'ironclad',
        primaryWeapon: (entry.data.player.loadout && entry.data.player.loadout.primaryId) || 'pulseCannon',
        secondaryWeapon: (entry.data.player.loadout && entry.data.player.loadout.secondaryId) || 'scatterBlaster'
      };
      room.addPlayer(p, entry.socket);
      playersRoster.push(p);
    });

    // Fill remaining slots up to 10 with AI
    const MECHS = ['ironclad', 'vortex', 'bastion', 'striker', 'nova'];
    const WEAPONS = ['pulseCannon', 'scatterBlaster', 'plasmaLauncher', 'arcRifle', 'missileRack', 'railSpear'];
    const BOT_NAMES = ['Valkyrie', 'Goliath', 'Specter', 'Aegis', 'Nemesis', 'Onslaught', 'Tempest', 'Havoc', 'Reaper'];

    let botIdx = 0;
    while (playersRoster.length < 10) {
      const blueCount = playersRoster.filter(p => p.team === 'blue').length;
      const redCount = playersRoster.filter(p => p.team === 'red').length;
      const team = blueCount <= redCount ? 'blue' : 'red';

      const bot = {
        id: `bot_${botIdx + 1}`,
        name: BOT_NAMES[botIdx % BOT_NAMES.length],
        team,
        isAI: true,
        hp: 1000,
        maxHp: 1000,
        shield: 500,
        maxShield: 500,
        mechId: MECHS[botIdx % MECHS.length],
        primaryWeapon: WEAPONS[botIdx % WEAPONS.length],
        secondaryWeapon: WEAPONS[(botIdx + 1) % WEAPONS.length],
        transform: {
          p: [team === 'blue' ? -20 + botIdx * 4 : 20 - botIdx * 4, 0, (botIdx % 3) * 6 - 6],
          v: [0, 0, 0],
          r: [0, 0],
          h: [1000, 500],
          a: 'IDLE',
          d: 0,
          t: Date.now()
        }
      };
      room.addPlayer(bot, null);
      playersRoster.push(bot);
      botIdx++;
    }

    // Send MATCH_START to all humans in room
    room.broadcast('MATCH_START', {
      roomId,
      mode,
      arena,
      players: playersRoster,
      matchDuration: 300,
      targetScore: room.targetScore
    });
  }
}

const matchmaker = new ServerMatchmaker();

// ── HTTP & Static File Server ──
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(ROOT_DIR, reqPath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// ── WebSocket Upgrade Handler (RFC 6455) ──
server.on('upgrade', (req, socket, head) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = computeAcceptKey(key.trim());
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '\r\n'
  ];

  socket.write(responseHeaders.join('\r\n'));

  // Socket state tracking
  let buffer = Buffer.alloc(0);
  let assignedPlayerId = null;
  let activeRoom = null;

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length > 0) {
      const frame = decodeFrame(buffer);
      if (!frame) break;

      buffer = buffer.subarray(frame.totalBytes);

      if (frame.opcode === 8) { // Close
        socket.destroy();
        break;
      }

      if (frame.opcode === 9) { // Ping
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a; // Pong
        pong[1] = 0;
        socket.write(pong);
        continue;
      }

      if (frame.opcode === 1 && frame.text) { // Text JSON
        try {
          const msg = JSON.parse(frame.text);
          handleClientMessage(msg, socket);
        } catch (e) {
          console.warn('[WS] Invalid JSON payload:', e);
        }
      }
    }
  });

  socket.on('close', () => {
    matchmaker.removeSocket(socket);
  });

  socket.on('error', () => {
    socket.destroy();
  });

  function handleClientMessage(msg, s) {
    const { type, payload } = msg;

    if (type === 'HELLO') {
      const resp = encodeFrame(JSON.stringify({
        type: 'WELCOME',
        timestamp: Date.now(),
        payload: { version: 1, server: 'IronTitans-Node-WS' }
      }));
      s.write(resp);
    } else if (type === 'PING') {
      const resp = encodeFrame(JSON.stringify({
        type: 'PONG',
        timestamp: Date.now(),
        payload: { clientTime: payload.timestamp }
      }));
      s.write(resp);
    } else if (type === 'MATCHMAKING_QUEUE') {
      assignedPlayerId = payload.player ? payload.player.id : null;
      matchmaker.enqueue(payload, s);
    } else if (type === 'PLAYER_SNAPSHOT') {
      for (const room of matchmaker.rooms.values()) {
        const p = room.players.get(payload.id);
        if (p) {
          p.transform = payload.t;
          break;
        }
      }
    } else if (type === 'WEAPON_FIRE') {
      for (const room of matchmaker.rooms.values()) {
        if (room.players.has(assignedPlayerId)) {
          room.handlePlayerFire(assignedPlayerId, payload);
          break;
        }
      }
    }
  }
});

// ── Start Server ──
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 IRON TITANS 3D — MULTIPLAYER SERVER ACTIVE`);
    console.log(`🌐 HTTP Web Client: http://localhost:${PORT}`);
    console.log(`⚡ WebSocket Server: ws://localhost:${PORT}`);
    console.log(`👥 Mode: 5v5 Hybrid Human + AI Matchmaking`);
    console.log(`====================================================`);
  });
}

// Export for automated testing
module.exports = { server, matchmaker, ServerRoom, encodeFrame, decodeFrame, computeAcceptKey };
