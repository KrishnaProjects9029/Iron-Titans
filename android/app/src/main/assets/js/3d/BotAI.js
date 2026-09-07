/**
 * Iron Titans 3D — BotAI.js
 * Modular MechAIController implementing:
 * - Finite State Machine (PATROL, SEARCH, MOVE_TO_TARGET, ATTACK, TAKE_COVER, FLANK)
 * - Realistic Perception: 120° FOV vision cone & 65m range
 * - Raycast Line-of-Sight against arena obstacles (NO WALL HACKING)
 * - Cover-seeking behavior when health is low (< 35%)
 * - Target prioritization (proximity, low HP, active attackers)
 * - Realistic aim spread and torso tracking delay
 * - Archetype-tailored ability execution and tactical maneuvering
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const AI_STATES = {
    IDLE: 'IDLE',
    PATROL: 'PATROL',
    SEARCH: 'SEARCH',
    MOVE_TO_TARGET: 'MOVE_TO_TARGET',
    ATTACK: 'ATTACK',
    TAKE_COVER: 'TAKE_COVER',
    FLANK: 'FLANK',
    CAPTURE_OBJECTIVE: 'CAPTURE_OBJECTIVE',
    DEFEND_OBJECTIVE: 'DEFEND_OBJECTIVE',
    CONTEST_OBJECTIVE: 'CONTEST_OBJECTIVE',
    DEAD: 'DEAD'
  };

  // Default tactical waypoints fallback
  const ARENA_WAYPOINTS = [
    { x: 0, z: 0, name: 'Center Platform' },
    { x: 0, z: -20, name: 'South Ramp' },
    { x: 0, z: 20, name: 'North Ramp' },
    { x: -28, z: 0, name: 'West Corridor' },
    { x: 28, z: 0, name: 'East Skybridge' },
    { x: -24, z: -28, name: 'SW Crate Cluster' },
    { x: 24, z: -28, name: 'SE Crate Cluster' },
    { x: -24, z: 28, name: 'NW Crate Cluster' },
    { x: 24, z: 28, name: 'NE Crate Cluster' },
    { x: 0, z: -48, name: 'South Yard' },
    { x: 0, z: 48, name: 'North Yard' }
  ];

  class MechAIController {
    constructor(mech, options = {}) {
      this.mech = mech;
      this.role = mech.role || 'Assault';
      this.archetype = mech.archetype || 'ASSAULT';
      this.state = AI_STATES.PATROL;

      // Arena waypoints configuration
      this.waypoints = options.waypoints || ARENA_WAYPOINTS;
      this.assignedObjective = null;
      this.objectiveEvalTimer = Math.random() * 1.5;

      // Perception configuration
      this.visionRange = options.visionRange || 65.0;
      this.visionFov = options.visionFov || (Math.PI * 2 / 3); // 120 degrees FOV
      this.visionCos = Math.cos(this.visionFov / 2); // 0.5 threshold

      // Combat engagement ranges
      this.idealRange = this.archetype === 'STRIKER' ? 45 : (this.archetype === 'TANK' ? 22 : 28);
      this.minRange = this.archetype === 'TANK' ? 12 : 18;

      // Aiming & Tracking
      this.currentTarget = null;
      this.lastKnownTargetPos = new THREE.Vector3();
      this.lastAttacker = null;
      this.lastAttackedTime = 0;
      this.aimPoint = new THREE.Vector3();
      this.targetLeadPoint = new THREE.Vector3();

      // Aim spread based on archetype
      const spreadValues = { ASSAULT: 1.2, TANK: 1.8, SCOUT: 1.0, STRIKER: 0.45 };
      this.aimSpread = spreadValues[this.archetype] || 1.2;

      // Tactical timers
      this.stateTimer = 0;
      this.perceptionTimer = Math.random() * 0.2; // Staggered perception loop
      this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      this.strafeTimer = 0;
      this.currentWaypoint = null;
      this.coverPoint = null;

      // Select random initial waypoint
      this._pickNewWaypoint();

      // Directional damage notification hook
      this.mech.onDamageReceived = (attackerPos, amount) => {
        this.lastAttackedTime = 4.0;
        // If healthy enough to counter-attack and no current target, turn towards threat
        if (this.state === AI_STATES.PATROL || this.state === AI_STATES.SEARCH) {
          this.state = AI_STATES.SEARCH;
          this.stateTimer = 2.0;
          if (attackerPos) this.lastKnownTargetPos.copy(attackerPos);
        }
      };
    }

    _pickNewWaypoint() {
      const list = (this.waypoints && this.waypoints.length > 0) ? this.waypoints : ARENA_WAYPOINTS;
      const idx = Math.floor(Math.random() * list.length);
      this.currentWaypoint = list[idx];
    }

    /**
     * Realistic Line-of-Sight check against static AABB arena colliders.
     * Returns true ONLY if no solid collider blocks the ray between bot and target.
     */
    hasLineOfSight(targetMech, arenaColliders) {
      if (!targetMech || targetMech.isDead) return false;

      const origin = this.mech.position;
      const target = targetMech.position;

      const ox = origin.x, oz = origin.z;
      const tx = target.x, tz = target.z;
      const dist = Math.hypot(tx - ox, tz - oz);

      if (dist > this.visionRange) return false;

      // Direction ray
      const dx = (tx - ox) / dist;
      const dz = (tz - oz) / dist;

      // 2D Broadphase bounding box for quick rejection of out-of-path colliders
      const bMinX = Math.min(ox, tx) - 0.5;
      const bMaxX = Math.max(ox, tx) + 0.5;
      const bMinZ = Math.min(oz, tz) - 0.5;
      const bMaxZ = Math.max(oz, tz) + 0.5;

      // Ray-box intersection check against arena colliders
      if (arenaColliders && arenaColliders.length > 0) {
        for (let i = 0; i < arenaColliders.length; i++) {
          const c = arenaColliders[i];
          // Broadphase early-out
          if (c.maxX < bMinX || c.minX > bMaxX || c.maxZ < bMinZ || c.minZ > bMaxZ) continue;

          // Skip elevated bridges/floors that are above or below line of sight
          if (c.maxY < 1.0) continue;

          // 2D Liang-Barsky / Slab method for ray vs AABB
          let tmin = 0;
          let tmax = dist;

          // X slab
          if (Math.abs(dx) > 0.0001) {
            let t1 = (c.minX - ox) / dx;
            let t2 = (c.maxX - ox) / dx;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmin > tmax) continue;
          } else {
            if (ox < c.minX || ox > c.maxX) continue;
          }

          // Z slab
          if (Math.abs(dz) > 0.0001) {
            let t1 = (c.minZ - oz) / dz;
            let t2 = (c.maxZ - oz) / dz;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmin > tmax) continue;
          } else {
            if (oz < c.minZ || oz > c.maxZ) continue;
          }

          // Intersection occurs before target
          if (tmin < dist - 1.5 && tmax > 1.5) {
            return false; // Obstructed by wall or crate!
          }
        }
      }

      return true;
    }

    /**
     * Checks if target is within 120° forward field of view
     */
    isInVisionCone(targetMech) {
      if (!targetMech || targetMech.isDead) return false;

      const dx = targetMech.position.x - this.mech.position.x;
      const dz = targetMech.position.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist === 0) return true;

      // Heading forward vector
      const fwdX = Math.sin(this.mech.heading);
      const fwdZ = Math.cos(this.mech.heading);

      // Dot product to test angle
      const dot = (fwdX * dx + fwdZ * dz) / dist;
      return dot >= this.visionCos;
    }

    /**
     * Evaluates all visible enemies and selects highest priority target
     */
    evaluateTarget(enemies, arenaColliders) {
      let bestTarget = null;
      let highestScore = -999;

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.isDead || e.isInvulnerable) continue;

        const d = this.mech.position.distanceTo(e.position);
        if (d > this.visionRange) continue;

        const inLoS = this.hasLineOfSight(e, arenaColliders);
        if (!inLoS) continue;

        const inFov = this.isInVisionCone(e);
        // If not in forward FOV, only notice if very close (< 18m) or enemy is shooting
        if (!inFov && d > 18) continue;

        // Threat scoring
        const distScore = (1 - (d / this.visionRange)) * 40;
        const hpScore = (1 - (e.hp / e.maxHp)) * 35;
        const threatScore = distScore + hpScore;

        if (threatScore > highestScore) {
          highestScore = threatScore;
          bestTarget = e;
        }
      }

      return bestTarget;
    }

    /**
     * Finds nearest cover obstacle that obstructs line of sight from the attacker
     */
    findCoverPosition(attackerPos, arenaColliders) {
      if (!attackerPos || !arenaColliders || arenaColliders.length === 0) {
        return null;
      }

      let bestCover = null;
      let minScore = 9999;

      for (let i = 0; i < arenaColliders.length; i++) {
        const c = arenaColliders[i];
        if (c.maxY < 2.0) continue; // Must be tall enough to hide behind

        const cx = (c.minX + c.maxX) / 2;
        const cz = (c.minZ + c.maxZ) / 2;

        // Cover point is on opposite side of collider relative to attacker
        const toAttackerX = attackerPos.x - cx;
        const toAttackerZ = attackerPos.z - cz;
        const mag = Math.hypot(toAttackerX, toAttackerZ);
        if (mag === 0) continue;

        const safeX = cx - (toAttackerX / mag) * 4.5;
        const safeZ = cz - (toAttackerZ / mag) * 4.5;

        const distToCover = Math.hypot(safeX - this.mech.position.x, safeZ - this.mech.position.z);
        if (distToCover < minScore && distToCover > 2.0) {
          minScore = distToCover;
          bestCover = { x: safeX, z: safeZ };
        }
      }

      return bestCover;
    }

    update(dt, enemies, arenaColliders, onFireCallback, activeObjectives = []) {
      if (this.mech.isDead) {
        this.state = AI_STATES.DEAD;
        return;
      }

      this.stateTimer += dt;
      this.strafeTimer += dt;
      if (this.lastAttackedTime > 0) this.lastAttackedTime -= dt;

      // Low frequency perception cycle (~4 Hz) to conserve performance
      this.perceptionTimer -= dt;
      if (this.perceptionTimer <= 0) {
        this.perceptionTimer = 0.22 + Math.random() * 0.06;
        const newTarget = this.evaluateTarget(enemies, arenaColliders);
        if (newTarget) {
          this.currentTarget = newTarget;
          this.lastKnownTargetPos.copy(newTarget.position);
        } else if (this.currentTarget && !this.hasLineOfSight(this.currentTarget, arenaColliders)) {
          // Lost line of sight
          this.currentTarget = null;
        }
      }

      // Check low health cover reaction
      const isCritical = this.mech.hp < (this.mech.maxHp * 0.32);
      if (isCritical && this.state !== AI_STATES.TAKE_COVER && this.lastAttackedTime > 0) {
        const cover = this.findCoverPosition(this.lastKnownTargetPos, arenaColliders);
        if (cover) {
          this.coverPoint = cover;
          this.state = AI_STATES.TAKE_COVER;
          this.stateTimer = 0;
          // Trigger archetype defensive ability
          this.mech.useAbility();
        }
      }

      // Objective awareness evaluation (Every ~1.5 - 2.0s)
      if (activeObjectives && activeObjectives.length > 0) {
        this.objectiveEvalTimer -= dt;
        if (this.objectiveEvalTimer <= 0) {
          this.objectiveEvalTimer = 1.4 + Math.random() * 0.8;
          this._evaluateObjectiveDecision(activeObjectives, enemies, arenaColliders);
        }
      }

      // ── Finite State Machine ──
      const moveInput = new THREE.Vector3();

      switch (this.state) {
        case AI_STATES.PATROL:
          this._handlePatrol(dt, moveInput);
          break;

        case AI_STATES.SEARCH:
          this._handleSearch(dt, moveInput);
          break;

        case AI_STATES.MOVE_TO_TARGET:
          this._handleMoveToTarget(dt, moveInput, arenaColliders);
          break;

        case AI_STATES.ATTACK:
          this._handleAttack(dt, moveInput, arenaColliders, onFireCallback);
          break;

        case AI_STATES.TAKE_COVER:
          this._handleTakeCover(dt, moveInput, arenaColliders);
          break;

        case AI_STATES.FLANK:
          this._handleFlank(dt, moveInput, arenaColliders, onFireCallback);
          break;

        case AI_STATES.CAPTURE_OBJECTIVE:
          this._handleCaptureObjective(dt, moveInput, arenaColliders, onFireCallback);
          break;

        case AI_STATES.DEFEND_OBJECTIVE:
          this._handleDefendObjective(dt, moveInput, arenaColliders, onFireCallback);
          break;

        case AI_STATES.CONTEST_OBJECTIVE:
          this._handleContestObjective(dt, moveInput, arenaColliders, onFireCallback);
          break;

        default:
          this.state = AI_STATES.PATROL;
          break;
      }

      // Local collision avoidance feelers so bots don't stick to walls
      this._applyObstacleRepulsion(moveInput, arenaColliders);

      // Aim torso and update mech kinematics
      this.mech.update(dt, moveInput, this.aimPoint, (x, z, r) => {
        // Arena physics collision
        return { x, z }; // Let Main3D arena resolver handle final collision
      });
    }

    _handlePatrol(dt, moveInput) {
      if (this.currentTarget) {
        this.state = AI_STATES.ATTACK;
        this.stateTimer = 0;
        return;
      }

      if (!this.currentWaypoint) {
        this._pickNewWaypoint();
      }

      const dx = this.currentWaypoint.x - this.mech.position.x;
      const dz = this.currentWaypoint.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 4.5 || this.stateTimer > 10.0) {
        this._pickNewWaypoint();
        this.stateTimer = 0;
      } else {
        moveInput.x = dx / dist;
        moveInput.z = dz / dist;
      }

      // Look toward waypoint
      this.aimPoint.set(this.currentWaypoint.x, 2.5, this.currentWaypoint.z);
    }

    _handleSearch(dt, moveInput) {
      if (this.currentTarget) {
        this.state = AI_STATES.ATTACK;
        this.stateTimer = 0;
        return;
      }

      // Move toward last known target position
      const dx = this.lastKnownTargetPos.x - this.mech.position.x;
      const dz = this.lastKnownTargetPos.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 5.0 || this.stateTimer > 5.0) {
        this.state = AI_STATES.PATROL;
        this._pickNewWaypoint();
      } else {
        moveInput.x = dx / dist;
        moveInput.z = dz / dist;
        this.aimPoint.copy(this.lastKnownTargetPos);
      }
    }

    _handleMoveToTarget(dt, moveInput, arenaColliders) {
      if (!this.currentTarget || this.currentTarget.isDead) {
        this.state = AI_STATES.SEARCH;
        return;
      }

      const dx = this.currentTarget.position.x - this.mech.position.x;
      const dz = this.currentTarget.position.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= this.idealRange && this.hasLineOfSight(this.currentTarget, arenaColliders)) {
        this.state = AI_STATES.ATTACK;
        this.stateTimer = 0;
      } else {
        moveInput.x = dx / dist;
        moveInput.z = dz / dist;
      }

      this.aimPoint.copy(this.currentTarget.position).add(new THREE.Vector3(0, 2.5, 0));
    }

    _handleAttack(dt, moveInput, arenaColliders, onFireCallback) {
      const target = this.currentTarget;
      if (!target || target.isDead || !this.hasLineOfSight(target, arenaColliders)) {
        this.state = AI_STATES.SEARCH;
        this.currentTarget = null;
        return;
      }

      const dx = target.position.x - this.mech.position.x;
      const dz = target.position.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);

      // Circle strafing movement
      if (this.strafeTimer > 2.5 + Math.random() * 1.5) {
        this.strafeDir *= -1;
        this.strafeTimer = 0;
      }

      // Perpendicular vector for strafing
      const perpX = -dz / dist * this.strafeDir;
      const perpZ = dx / dist * this.strafeDir;

      let forwardBias = 0;
      if (dist > this.idealRange) forwardBias = 0.55;
      else if (dist < this.minRange) forwardBias = -0.55;

      moveInput.x = perpX * 0.7 + (dx / dist) * forwardBias;
      moveInput.z = perpZ * 0.7 + (dz / dist) * forwardBias;
      moveInput.normalize();

      // Lead target aim point + aim spread
      this.aimPoint.copy(target.position).add(new THREE.Vector3(
        (Math.random() - 0.5) * this.aimSpread,
        2.5 + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * this.aimSpread
      ));

      // Ability use when in intense battle
      if (dist < 22 && Math.random() < 0.05) {
        this.mech.useAbility();
      }

      // Fire weapon on cooldown
      if (this.mech.weaponCooldown <= 0 && onFireCallback) {
        this.mech.weaponCooldown = this.mech.fireRate + (Math.random() * 0.05);
        this.mech.activeSlot = (this.mech.activeSlot + 1) % 2;
        this.mech.triggerWeaponFire(this.mech.activeSlot);

        onFireCallback(this.mech, this.aimPoint, target);
      }
    }

    _handleTakeCover(dt, moveInput, arenaColliders) {
      if (!this.coverPoint) {
        this.state = AI_STATES.PATROL;
        return;
      }

      const dx = this.coverPoint.x - this.mech.position.x;
      const dz = this.coverPoint.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 2.5 || this.stateTimer > 6.0) {
        // Safely in cover, wait for shield to regenerate
        moveInput.set(0, 0, 0);
        if (this.mech.shield >= this.mech.maxShield * 0.65 || this.stateTimer > 6.0) {
          this.state = AI_STATES.SEARCH;
          this.stateTimer = 0;
        }
      } else {
        moveInput.x = dx / dist;
        moveInput.z = dz / dist;
      }

      this.aimPoint.copy(this.lastKnownTargetPos);
    }

    _handleFlank(dt, moveInput, arenaColliders, onFireCallback) {
      // Approach target from side angles
      if (!this.currentTarget || this.currentTarget.isDead) {
        this.state = AI_STATES.PATROL;
        return;
      }
      this._handleAttack(dt, moveInput, arenaColliders, onFireCallback);
    }

    _applyObstacleRepulsion(moveInput, arenaColliders) {
      if (!arenaColliders || moveInput.lengthSq() === 0) return;

      const px = this.mech.position.x;
      const pz = this.mech.position.z;
      const feelerDist = 5.0;

      for (let i = 0; i < arenaColliders.length; i++) {
        const c = arenaColliders[i];
        if (c.maxY < 1.0) continue;

        const cx = (c.minX + c.maxX) / 2;
        const cz = (c.minZ + c.maxZ) / 2;
        const dist = Math.hypot(px - cx, pz - cz);

        if (dist < feelerDist + 2.5) {
          const pushX = (px - cx) / dist;
          const pushZ = (pz - cz) / dist;
          moveInput.x += pushX * 0.8;
          moveInput.z += pushZ * 0.8;
          moveInput.normalize();
        }
      }
    }

    // ── Objective Decision Making & Tactical Roles ──
    _evaluateObjectiveDecision(activeObjectives, enemies, arenaColliders) {
      if (!activeObjectives || activeObjectives.length === 0) return;
      if (this.state === AI_STATES.TAKE_COVER) return;

      const myPos = this.mech.position;
      const myTeam = this.mech.team;

      const contestedObjs = activeObjectives.filter(o => o.isContested);
      const enemyObjs = activeObjectives.filter(o => o.controllingTeam && o.controllingTeam !== myTeam);
      const neutralObjs = activeObjectives.filter(o => !o.controllingTeam);
      const myObjs = activeObjectives.filter(o => o.controllingTeam === myTeam);

      let targetObj = null;
      let desiredState = AI_STATES.CAPTURE_OBJECTIVE;

      const role = (this.mech.role || this.archetype || '').toUpperCase();

      if (role.includes('TANK')) {
        // Tank: Anchor & Hold. Prioritizes contested zones, then defending friendly points
        if (contestedObjs.length > 0) {
          targetObj = this._findClosestObjective(contestedObjs, myPos);
          desiredState = AI_STATES.CONTEST_OBJECTIVE;
        } else if (myObjs.length > 0) {
          targetObj = this._findClosestObjective(myObjs, myPos);
          desiredState = AI_STATES.DEFEND_OBJECTIVE;
        } else if (neutralObjs.length > 0) {
          targetObj = this._findClosestObjective(neutralObjs, myPos);
          desiredState = AI_STATES.CAPTURE_OBJECTIVE;
        } else if (enemyObjs.length > 0) {
          targetObj = this._findClosestObjective(enemyObjs, myPos);
          desiredState = AI_STATES.CAPTURE_OBJECTIVE;
        }
      } else if (role.includes('SCOUT')) {
        // Scout: Fast Flanker & Capturer. Attacks unheld or enemy zones
        if (neutralObjs.length > 0) {
          targetObj = this._findClosestObjective(neutralObjs, myPos);
          desiredState = AI_STATES.CAPTURE_OBJECTIVE;
        } else if (enemyObjs.length > 0) {
          targetObj = this._findClosestObjective(enemyObjs, myPos);
          desiredState = AI_STATES.CAPTURE_OBJECTIVE;
        } else if (contestedObjs.length > 0) {
          targetObj = this._findClosestObjective(contestedObjs, myPos);
          desiredState = AI_STATES.CONTEST_OBJECTIVE;
        } else if (myObjs.length > 0) {
          targetObj = this._findClosestObjective(myObjs, myPos);
          desiredState = AI_STATES.DEFEND_OBJECTIVE;
        }
      } else if (role.includes('DEFENDER')) {
        // Defender: Zone Fortress. Prioritizes defending already held zones or anchoring contested points
        if (myObjs.length > 0) {
          targetObj = this._findClosestObjective(myObjs, myPos);
          desiredState = AI_STATES.DEFEND_OBJECTIVE;
        } else if (contestedObjs.length > 0) {
          targetObj = this._findClosestObjective(contestedObjs, myPos);
          desiredState = AI_STATES.CONTEST_OBJECTIVE;
        } else if (neutralObjs.length > 0) {
          targetObj = this._findClosestObjective(neutralObjs, myPos);
          desiredState = AI_STATES.CAPTURE_OBJECTIVE;
        }
      } else if (role.includes('STRIKER') || role.includes('RANGE')) {
        // Striker / Long Range: Overlook Support. Positions near objective to snipe enemies capping/defending
        const pool = contestedObjs.length > 0 ? contestedObjs : (enemyObjs.length > 0 ? enemyObjs : activeObjectives);
        targetObj = this._findClosestObjective(pool, myPos);
        desiredState = AI_STATES.DEFEND_OBJECTIVE;
      } else {
        // Assault: Frontline Pusher
        if (contestedObjs.length > 0) {
          targetObj = this._findClosestObjective(contestedObjs, myPos);
          desiredState = AI_STATES.CONTEST_OBJECTIVE;
        } else if (enemyObjs.length > 0) {
          targetObj = this._findClosestObjective(enemyObjs, myPos);
          desiredState = AI_STATES.CAPTURE_OBJECTIVE;
        } else if (neutralObjs.length > 0) {
          targetObj = this._findClosestObjective(neutralObjs, myPos);
          desiredState = AI_STATES.CAPTURE_OBJECTIVE;
        } else if (myObjs.length > 0) {
          targetObj = this._findClosestObjective(myObjs, myPos);
          desiredState = AI_STATES.DEFEND_OBJECTIVE;
        }
      }

      if (targetObj) {
        this.assignedObjective = targetObj;
        if (this.state !== AI_STATES.TAKE_COVER && this.state !== AI_STATES.ATTACK) {
          this.state = desiredState;
        }
      }
    }

    _findClosestObjective(objs, pos) {
      let closest = objs[0];
      let minD = 999999;
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        const d = Math.hypot(o.position.x - pos.x, o.position.z - pos.z);
        if (d < minD) {
          minD = d;
          closest = o;
        }
      }
      return closest;
    }

    _handleCaptureObjective(dt, moveInput, arenaColliders, onFireCallback) {
      if (!this.assignedObjective) {
        this.state = AI_STATES.PATROL;
        return;
      }

      const dest = this.assignedObjective.position;
      const dx = dest.x - this.mech.position.x;
      const dz = dest.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);
      const capRadius = (this.assignedObjective.radius || 8.5) * 0.7;

      if (dist > capRadius) {
        // Move towards zone center
        moveInput.x = dx / dist;
        moveInput.z = dz / dist;

        // Use mobility ability to close distance faster
        if (dist > 18 && Math.random() < 0.04) {
          this.mech.useAbility();
        }
      } else {
        // Inside capture zone: hold position, circle strafe slowly inside ring
        const perpX = -dz / (dist || 1);
        const perpZ = dx / (dist || 1);
        moveInput.x = perpX * 0.3;
        moveInput.z = perpZ * 0.3;
      }

      // If enemy is in sight, engage while continuing to capture
      if (this.currentTarget && !this.currentTarget.isDead && this.hasLineOfSight(this.currentTarget, arenaColliders)) {
        this.aimPoint.copy(this.currentTarget.position).add(new THREE.Vector3(0, 2.5, 0));
        if (this.mech.weaponCooldown <= 0 && onFireCallback) {
          this.mech.weaponCooldown = this.mech.fireRate + (Math.random() * 0.05);
          this.mech.activeSlot = (this.mech.activeSlot + 1) % 2;
          this.mech.triggerWeaponFire(this.mech.activeSlot);
          onFireCallback(this.mech, this.aimPoint, this.currentTarget);
        }
      } else {
        this.aimPoint.set(dest.x, 2.5, dest.z);
      }
    }

    _handleDefendObjective(dt, moveInput, arenaColliders, onFireCallback) {
      if (!this.assignedObjective) {
        this.state = AI_STATES.PATROL;
        return;
      }

      const dest = this.assignedObjective.position;
      const dx = dest.x - this.mech.position.x;
      const dz = dest.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);
      const defRadius = (this.assignedObjective.radius || 8.5) + 3.0;

      if (dist > defRadius + 8.0) {
        // Return to defensive post
        moveInput.x = dx / dist;
        moveInput.z = dz / dist;
      } else {
        // Patrol defensive perimeter
        const perpX = -dz / (dist || 1);
        const perpZ = dx / (dist || 1);
        moveInput.x = perpX * 0.45;
        moveInput.z = perpZ * 0.45;
      }

      // Engage approaching enemies
      if (this.currentTarget && !this.currentTarget.isDead && this.hasLineOfSight(this.currentTarget, arenaColliders)) {
        this.aimPoint.copy(this.currentTarget.position).add(new THREE.Vector3(0, 2.5, 0));

        // Use defensive abilities (Deploy Shield, Energy Charge) when under attack
        if (Math.random() < 0.06) {
          this.mech.useAbility();
        }

        if (this.mech.weaponCooldown <= 0 && onFireCallback) {
          this.mech.weaponCooldown = this.mech.fireRate + (Math.random() * 0.05);
          this.mech.activeSlot = (this.mech.activeSlot + 1) % 2;
          this.mech.triggerWeaponFire(this.mech.activeSlot);
          onFireCallback(this.mech, this.aimPoint, this.currentTarget);
        }
      } else {
        this.aimPoint.set(dest.x, 2.5, dest.z);
      }
    }

    _handleContestObjective(dt, moveInput, arenaColliders, onFireCallback) {
      if (!this.assignedObjective) {
        this.state = AI_STATES.PATROL;
        return;
      }

      const dest = this.assignedObjective.position;
      const dx = dest.x - this.mech.position.x;
      const dz = dest.z - this.mech.position.z;
      const dist = Math.hypot(dx, dz);

      // Aggressively charge into zone to halt enemy progress
      moveInput.x = dx / (dist || 1);
      moveInput.z = dz / (dist || 1);

      // Use combat abilities to break through
      if (dist < 20 && Math.random() < 0.08) {
        this.mech.useAbility();
      }

      if (this.currentTarget && !this.currentTarget.isDead) {
        this.aimPoint.copy(this.currentTarget.position).add(new THREE.Vector3(0, 2.5, 0));
        if (this.mech.weaponCooldown <= 0 && onFireCallback) {
          this.mech.weaponCooldown = this.mech.fireRate + (Math.random() * 0.05);
          this.mech.activeSlot = (this.mech.activeSlot + 1) % 2;
          this.mech.triggerWeaponFire(this.mech.activeSlot);
          onFireCallback(this.mech, this.aimPoint, this.currentTarget);
        }
      } else {
        this.aimPoint.set(dest.x, 2.5, dest.z);
      }
    }
  }

  IT.AI_STATES = AI_STATES;
  IT.MechAIController = MechAIController;
})(window.IT);
