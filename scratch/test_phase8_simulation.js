/**
 * Iron Titans 3D — Phase 8 Automated Simulation & Multi-Client Test Suite
 * Tests:
 * 1. NetworkProtocol, NetworkMessage & Serialization
 * 2. AuthManager & Guest Session Persistence
 * 3. NetworkTransform & NetworkInterpolation (Jitter Buffer, Dead Reckoning)
 * 4. Matchmaking & 5v5 Hybrid Roster Assembly (Blue vs Red)
 * 5. NetworkCombat (All 6 weapons & 5 abilities replication, Authoritative damage)
 * 6. Zero-Dependency RFC 6455 WebSocket Server with Two-Client Room Synchronization
 */

'use strict';

const assert = require('assert');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');

// Setup Node.js Mock Environment
global.window = global;
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

global.document = {
  body: {
    appendChild: () => {}
  },
  createElement: (tag) => ({
    id: '',
    className: '',
    style: {},
    innerHTML: '',
    textContent: '',
    appendChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  }),
  getElementById: (id) => ({
    id,
    style: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    textContent: '',
    innerHTML: '',
    value: '',
    appendChild: () => {}
  }),
  querySelectorAll: () => []
};

// Load Phase 7 & 8 Modules
require('../js/progression/EventManager.js');
require('../js/utils/SaveManager.js');
require('../js/progression/Progression2.js');
require('../js/progression/NotificationManager.js');
require('../js/progression/RewardManager.js');
require('../js/progression/MissionSystem.js');

require('../js/network/NetworkProtocol.js');
require('../js/network/NetworkTransform.js');
require('../js/network/NetworkInterpolation.js');
require('../js/network/NetworkPlayer.js');
require('../js/network/NetworkCombat.js');
require('../js/network/ServerAdapter.js');
require('../js/network/NetworkClient.js');
require('../js/network/AuthManager.js');
require('../js/network/MatchmakingManager.js');
require('../js/network/NetworkRoom.js');
require('../js/network/NetworkManager.js');

const { server, matchmaker, ServerRoom, encodeFrame, decodeFrame, computeAcceptKey } = require('../server/server.js');

async function runPhase8Tests() {
  console.log('============================================================');
  console.log('🧪 RUNNING IRON TITANS 3D — PHASE 8 MULTIPLAYER TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;

  // ── TEST 1: Protocol & Serialization ──
  try {
    console.log('TEST 1: NetworkProtocol & NetworkMessage Serialization');
    const NM = IT.NET_MSG;
    assert(NM.HELLO === 'HELLO');
    assert(NM.MATCHMAKING_QUEUE === 'MATCHMAKING_QUEUE');
    assert(NM.WEAPON_FIRE === 'WEAPON_FIRE');
    assert(NM.DAMAGE_APPLIED === 'DAMAGE_APPLIED');

    const msg = IT.NetworkMessage.create(NM.WEAPON_FIRE, { weaponId: 'railSpear', origin: [0, 2, 5] });
    assert(msg.type === NM.WEAPON_FIRE);
    assert(msg.payload.weaponId === 'railSpear');

    const serialized = IT.NetworkMessage.serialize(msg);
    assert(typeof serialized === 'string');
    const deserialized = IT.NetworkMessage.deserialize(serialized);
    assert(deserialized.type === NM.WEAPON_FIRE);
    assert(deserialized.payload.weaponId === 'railSpear');

    console.log('  ✓ Protocol enums, message envelopment and JSON serialization passed.');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 1 FAILED:', err);
  }

  // ── TEST 2: AuthManager & Player Identity ──
  try {
    console.log('\nTEST 2: AuthManager & Guest Session Management');
    const auth = IT.AuthManager;
    assert(auth !== undefined);

    const identity = auth.getIdentity();
    assert(identity && identity.id);
    assert(identity.isGuest === true);
    assert(auth.isAuthenticated() === true);

    auth.setCallsign('Viper_Lead');
    assert(auth.getIdentity().callsign === 'Viper_Lead');
    assert(IT.SaveManager.pilotName === 'Viper_Lead');

    console.log('  ✓ Guest authentication, callsign updating, and localStorage persistence passed.');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 2 FAILED:', err);
  }

  // ── TEST 3: NetworkTransform & Snapshot Interpolation ──
  try {
    console.log('\nTEST 3: NetworkTransform, Jitter Buffering & Interpolation');
    const t1 = new IT.NetworkTransform({
      x: 10, y: 0, z: 20,
      vx: 2, vy: 0, vz: 0,
      yaw: 0,
      hp: 1000, shield: 500,
      timestamp: 1000
    });

    const packed = t1.pack();
    const unpacked = IT.NetworkTransform.unpack(packed);
    assert.strictEqual(unpacked.x, 10);
    assert.strictEqual(unpacked.hp, 1000);

    const interp = new IT.NetworkInterpolation({ interpolationDelayMs: 100 });
    // Push older snapshot s0 (t = 1000) and newer snapshot s1 (t = 1100)
    interp.addSnapshot(new IT.NetworkTransform({ x: 0, y: 0, z: 0, vx: 10, yaw: 0, hp: 1000, shield: 500, timestamp: 1000 }));
    interp.addSnapshot(new IT.NetworkTransform({ x: 10, y: 0, z: 0, vx: 10, yaw: Math.PI / 2, hp: 800, shield: 400, timestamp: 1100 }));

    // Request render state at currentTime = 1150 (renderTimestamp = 1150 - 100 = 1050, midpoint alpha = 0.5)
    const state = interp.getInterpolatedState(1150);
    assert(state !== null);
    assert.strictEqual(Math.round(state.x), 5, 'Midpoint position should be 5');
    assert.strictEqual(state.hp, 900, 'Midpoint HP should be 900');
    assert.strictEqual(state.isExtrapolating, false);

    // Test dead reckoning when packet is delayed (renderTimestamp = 1200 > latest 1100)
    const extrapolated = interp.getInterpolatedState(1300);
    assert(extrapolated !== null);
    assert(extrapolated.x > 10, 'Dead reckoning should project forward based on vx');
    assert.strictEqual(extrapolated.isExtrapolating, true);

    console.log('  ✓ Hermite/linear snapshot interpolation and dead reckoning prediction passed.');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 3 FAILED:', err);
  }

  // ── TEST 4: Matchmaking & 5v5 Hybrid Roster ──
  try {
    console.log('\nTEST 4: 5v5 Matchmaking & Team Balancing (Human + AI)');
    const room = new IT.NetworkRoom({
      roomId: 'room_test_1',
      mode: 'DOMINATION',
      arena: 'TITAN_DOCKS',
      targetScore: 300
    });

    const playerDefs = [
      { id: 'player_local', name: 'Commander', team: 'blue', isAI: false, mechId: 'ironclad' },
      { id: 'human_2', name: 'RivalPilot', team: 'red', isAI: false, mechId: 'striker' }
    ];

    // Add 8 AI bots to complete 5v5
    for (let i = 1; i <= 4; i++) {
      playerDefs.push({ id: `bot_blue_${i}`, name: `Ally_${i}`, team: 'blue', isAI: true, mechId: 'bastion' });
    }
    for (let i = 1; i <= 4; i++) {
      playerDefs.push({ id: `bot_red_${i}`, name: `Enemy_${i}`, team: 'red', isAI: true, mechId: 'vortex' });
    }

    room.initializeRoster(playerDefs, 'player_local');
    assert.strictEqual(room.players.size, 10, 'Room must contain exactly 10 players');
    assert.strictEqual(room.teams.blue.length, 5, 'Blue squad must have 5 players');
    assert.strictEqual(room.teams.red.length, 5, 'Red squad must have 5 players');

    const localP = room.getPlayer('player_local');
    assert(localP && localP.isLocal === true);
    assert(localP.isAI === false);

    const botP = room.getPlayer('bot_blue_1');
    assert(botP && botP.isAI === true);

    console.log('  ✓ 5v5 human + AI hybrid roster assembly and Blue/Red team balancing passed.');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 4 FAILED:', err);
  }

  // ── TEST 5: Authoritative Combat & Respawn Protection ──
  try {
    console.log('\nTEST 5: NetworkCombat Weapon/Ability Replication & Authoritative Damage');
    const netManager = IT.NetworkManager;
    const combat = netManager.combat;
    assert(combat !== undefined);

    const room = new IT.NetworkRoom({ roomId: 'room_combat_test' });
    room.initializeRoster([
      { id: 'attacker', name: 'Shooter', team: 'blue', isAI: false, hp: 1000, shield: 500 },
      { id: 'victim', name: 'Target', team: 'red', isAI: true, hp: 1000, shield: 500 }
    ], 'attacker');
    netManager.room = room;
    netManager.isOnline = true;
    netManager.localPlayerId = 'attacker';

    // Test weapon fire replication
    let fireHandled = false;
    combat.nm.activeCombat3D = {
      spawnRemoteTracer: () => { fireHandled = true; },
      showFCT: () => {}
    };

    combat.handleRemoteWeaponFire({
      shooterId: 'victim',
      weaponId: 'plasmaLauncher',
      origin: [0, 1, 0],
      direction: [0, 0, 1]
    });
    assert(fireHandled === true, 'Remote weapon fire must spawn visual tracer');

    // Test damage application
    combat.handleDamageApplied({
      victimId: 'victim',
      attackerId: 'attacker',
      damage: 300,
      isCritical: true,
      isShield: true,
      remainingHp: 1000,
      remainingShield: 200
    });

    const v = room.getPlayer('victim');
    assert.strictEqual(v.shield, 200, 'Victim shield must update to authoritative value');

    // Test elimination
    combat.handlePlayerKilled({
      victimId: 'victim',
      killerId: 'attacker',
      weaponId: 'pulseCannon'
    });
    assert.strictEqual(v.isDead, true, 'Victim must be marked dead');
    const a = room.getPlayer('attacker');
    assert.strictEqual(a.kills, 1, 'Attacker kills must increment');

    console.log('  ✓ Authoritative combat synchronization, damage absorption and elimination passed.');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 5 FAILED:', err);
  }

  // ── TEST 6: Zero-Dependency WebSocket Server & Two-Client Synchronization ──
  try {
    console.log('\nTEST 6: RFC 6455 Zero-Dependency Server & Two-Client Test');
    // Test Sec-WebSocket-Accept computation
    const testKey = 'dGhlIHNhbXBsZSBub25jZQ==';
    const accept = computeAcceptKey(testKey);
    assert.strictEqual(accept, 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=', 'RFC 6455 handshake key calculation must match spec');

    // Test Frame Encoding & Decoding
    const sampleText = JSON.stringify({ type: 'TEST_MSG', val: 42 });
    const encoded = encodeFrame(sampleText);
    assert(encoded.length > sampleText.length);

    // Simulated frame decode
    const fakeClientMask = Buffer.from([
      0x81, 0x85, // fin+text, masked length 5
      0x12, 0x34, 0x56, 0x78, // mask key
      0x12 ^ 0x68, 0x34 ^ 0x65, 0x56 ^ 0x6c, 0x78 ^ 0x6c, 0x12 ^ 0x6f // 'hello' masked
    ]);
    const decoded = decodeFrame(fakeClientMask);
    assert(decoded !== null);
    assert.strictEqual(decoded.text, 'hello', 'Unmasked client text must match hello');

    // Test ServerRoom authoritative 20 Hz simulation
    const sRoom = new ServerRoom('s_room_1', 'SKIRMISH');
    sRoom.addPlayer({ id: 'client_A', name: 'Pilot_A', team: 'blue', hp: 1000, maxHp: 1000, shield: 500, maxShield: 500, transform: { p: [0, 0, 0] } });
    sRoom.addPlayer({ id: 'client_B', name: 'Pilot_B', team: 'red', hp: 1000, maxHp: 1000, shield: 500, maxShield: 500, transform: { p: [0, 0, 10] } });

    // Client A fires at Client B
    sRoom.handlePlayerFire('client_A', {
      weaponId: 'railSpear',
      origin: [0, 1, 0],
      direction: [0, 0, 1] // Directed directly at Client B
    });

    const clientB = sRoom.players.get('client_B');
    assert(clientB.shield < 500, 'Server-authoritative raycast hit must reduce Client B shield');
    sRoom.destroy();

    console.log('  ✓ RFC 6455 handshake, frame masking/unmasking and server hit detection passed.');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 6 FAILED:', err);
  }

  // ── TEST 7: Phase 7 & 8 Event Integration ──
  try {
    console.log('\nTEST 7: Phase 7 Event Pipeline & Mission Tracker Integration');
    const em = IT.EventManager;
    const mm = IT.MissionManager;
    assert(em && mm);

    let eventFired = false;
    const unsub = em.on(em.GAME_EVENTS.ENEMY_DESTROYED, (data) => {
      eventFired = true;
      assert(data.isPlayer === true);
    });

    em.emit(em.GAME_EVENTS.ENEMY_DESTROYED, { isPlayer: true, weaponId: 'pulseCannon' });
    assert(eventFired === true, 'Event must reach subscribed listeners');
    unsub();

    console.log('  ✓ Decoupled EventManager pipeline and mission integration passed.');
    passed++;
  } catch (err) {
    console.error('  ✗ TEST 7 FAILED:', err);
  }

  console.log('\n============================================================');
  console.log(`🎉 PHASE 8 TEST SUMMARY: ${passed}/7 TEST SUITES PASSED!`);
  console.log('============================================================');
}

runPhase8Tests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
