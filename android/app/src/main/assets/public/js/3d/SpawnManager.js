/**
 * Iron Titans 3D — SpawnManager.js
 * Manages tactical base spawn points for Blue and Red teams, safe spawn selection
 * (maximizing distance from active enemy threats), 3-second respawn queues,
 * and 2-second invulnerability protection shields upon entry.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const BLUE_SPAWNS = [
    { x: 0, z: -55, heading: 0 },
    { x: -22, z: -50, heading: 0.2 },
    { x: 22, z: -50, heading: -0.2 },
    { x: -35, z: -42, heading: 0.4 },
    { x: 35, z: -42, heading: -0.4 }
  ];

  const RED_SPAWNS = [
    { x: 0, z: 55, heading: Math.PI },
    { x: -22, z: 50, heading: Math.PI - 0.2 },
    { x: 22, z: 50, heading: Math.PI + 0.2 },
    { x: -35, z: 42, heading: Math.PI - 0.4 },
    { x: 35, z: 42, heading: Math.PI + 0.4 }
  ];

  class SpawnManager {
    constructor() {
      this.respawnQueue = []; // [{ mech, timer, onRespawn }]
      this.respawnDelay = 3.0; // 3 seconds
    }

    getSpawnPoints(team) {
      if (IT.ArenaRegistry && IT._activeArenaId) {
        const arenaConfig = IT.ArenaRegistry.get(IT._activeArenaId);
        if (arenaConfig) {
          return team === 'red' ? (arenaConfig.redSpawns || RED_SPAWNS) : (arenaConfig.blueSpawns || BLUE_SPAWNS);
        }
      }
      return team === 'red' ? RED_SPAWNS : BLUE_SPAWNS;
    }

    /**
     * Chooses the safest spawn point for the team that is furthest from any living enemy mechs
     */
    selectSafeSpawn(team, enemyMechs, allMechs) {
      const candidateSpawns = this.getSpawnPoints(team);
      let bestSpawn = candidateSpawns[0];
      let bestSafetyScore = -999999;

      for (let s of candidateSpawns) {
        let minEnemyDist = 99999;

        if (enemyMechs && enemyMechs.length > 0) {
          for (let e of enemyMechs) {
            if (e.isDead) continue;
            const d = Math.hypot(e.position.x - s.x, e.position.z - s.z);
            if (d < minEnemyDist) {
              minEnemyDist = d;
            }
          }
        } else {
          minEnemyDist = 100;
        }

        // Avoid spawning right on top of an ally
        let allyCrowdingPenalty = 0;
        if (allMechs) {
          for (let m of allMechs) {
            if (m.isDead) continue;
            const d = Math.hypot(m.position.x - s.x, m.position.z - s.z);
            if (d < 4.0) allyCrowdingPenalty += 50;
          }
        }

        const score = minEnemyDist - allyCrowdingPenalty;
        if (score > bestSafetyScore) {
          bestSafetyScore = score;
          bestSpawn = s;
        }
      }

      return bestSpawn;
    }

    queueRespawn(mech, onRespawnCallback, delay = this.respawnDelay) {
      // Remove any existing queued entry for this mech
      this.respawnQueue = this.respawnQueue.filter(entry => entry.mech !== mech);

      this.respawnQueue.push({
        mech,
        timer: delay,
        onRespawn: onRespawnCallback
      });
    }

    update(dt, enemyMechsByTeam, allMechs) {
      for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
        const entry = this.respawnQueue[i];
        entry.timer -= dt;

        if (entry.timer <= 0) {
          const team = entry.mech.team;
          const enemies = enemyMechsByTeam ? enemyMechsByTeam(team) : [];
          const spawn = this.selectSafeSpawn(team, enemies, allMechs);

          entry.mech.heading = spawn.heading || 0;
          entry.mech.respawn(spawn.x, 0, spawn.z);

          if (entry.onRespawn) {
            entry.onRespawn(entry.mech, spawn);
          }

          this.respawnQueue.splice(i, 1);
        }
      }
    }

    reset() {
      this.respawnQueue = [];
    }
  }

  IT.BLUE_SPAWNS = BLUE_SPAWNS;
  IT.RED_SPAWNS = RED_SPAWNS;
  IT.SpawnManager = SpawnManager;
})(window.IT);
