/**
 * BotAI.js — Iron Titans Mech Arena
 * Finite State Machine AI controller for bot mechs.
 * States: SPAWN_WAIT → PATROL → CHASE → ATTACK → FLEE → CAPTURE
 *
 * Depends on: window.IT.MathUtils, window.IT.Physics
 * Loaded after: MECH_DEFS, WEAPON_DEFS, Mech, Projectile, Zone
 */

(function (IT) {
    'use strict';

    // ─── Constants ────────────────────────────────────────────────────────────

    const STATE = Object.freeze({
        SPAWN_WAIT : 'SPAWN_WAIT',
        PATROL     : 'PATROL',
        CHASE      : 'CHASE',
        ATTACK     : 'ATTACK',
        FLEE       : 'FLEE',
        CAPTURE    : 'CAPTURE',
    });

    const WORLD_W        = 1600;
    const WORLD_H        = 1200;
    const TILE           = 40;
    const SPAWN_WAIT_T   = 1.2;
    const FLEE_DURATION  = 3.0;
    const FLEE_HP_RATIO  = 0.25;
    const RETURN_HP_RATIO = 0.40;
    const STRAFE_FLIP_MIN = 0.6;
    const STRAFE_FLIP_MAX = 1.4;
    const AIM_NOISE_LERP  = 2.5;
    const SIGHT_RANGE     = 600;

    // ─── Difficulty presets ───────────────────────────────────────────────────

    const DIFFICULTY = {
        easy   : { reactionTime: 0.80, accuracy: 0.50, dodgeChance: 0.20 },
        normal : { reactionTime: 0.40, accuracy: 0.75, dodgeChance: 0.45 },
        hard   : { reactionTime: 0.15, accuracy: 0.92, dodgeChance: 0.70 },
    };

    // ─── BotAI class ─────────────────────────────────────────────────────────

    class BotAI {
        /**
         * @param {Mech}   mech       — the mech this AI controls
         * @param {string} difficulty — 'easy' | 'normal' | 'hard'
         */
        constructor(mech, difficulty = 'normal') {
            this.mech   = mech;
            this.isBot  = true;

            const cfg         = DIFFICULTY[difficulty] || DIFFICULTY.normal;
            this.reactionTime = cfg.reactionTime;
            this.accuracy     = cfg.accuracy;
            this.dodgeChance  = cfg.dodgeChance;

            this.state      = STATE.SPAWN_WAIT;
            this.stateTimer = 0;

            this.target        = null;
            this.reactionTimer = 0;

            this.aimNoise = 0;

            this.patrolTarget = this._selectPatrolPoint(null);

            this.strafeDir   = Math.random() < 0.5 ? -1 : 1;
            this.strafeTimer = this._nextStrafeTime();

            this.weaponSlot = 0;

            this.mode          = 'skirmish';
            this.captureTarget = null;

            this._dodging    = false;
            this._dodgeTimer = 0;
            this._dodgeVec   = { x: 0, y: 0 };
        }

        // ─── Public API ───────────────────────────────────────────────────────

        update(dt, world) {
            this._selectMode(world);

            this.stateTimer   += dt;
            this.reactionTimer = Math.max(0, this.reactionTimer - dt);

            // Decay aim noise exponentially
            this.aimNoise *= Math.exp(-AIM_NOISE_LERP * dt);

            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) {
                this.strafeDir   = -this.strafeDir;
                this.strafeTimer = this._nextStrafeTime();
            }

            if (this._dodging) {
                this._dodgeTimer -= dt;
                if (this._dodgeTimer <= 0) this._dodging = false;
            }

            switch (this.state) {
                case STATE.SPAWN_WAIT: this._stateSpawnWait(dt, world); break;
                case STATE.PATROL:     this._statePatrol(dt, world);    break;
                case STATE.CHASE:      this._stateChase(dt, world);     break;
                case STATE.ATTACK:     this._stateAttack(dt, world);    break;
                case STATE.FLEE:       this._stateFlee(dt, world);      break;
                case STATE.CAPTURE:    this._stateCapture(dt, world);   break;
                default:               this._setState(STATE.PATROL);    break;
            }
        }

        // ─── State handlers ───────────────────────────────────────────────────

        _stateSpawnWait(dt, world) {
            applyInput(this.mech, 0, 0, this.mech.angle, false, 0, world);
            if (this.stateTimer >= SPAWN_WAIT_T) {
                this._setState(this.mode === 'domination' ? STATE.CAPTURE : STATE.PATROL);
            }
        }

        _statePatrol(dt, world) {
            const mech = this.mech;

            if (this.reactionTimer <= 0) {
                this.target        = this._findBestTarget(world);
                this.reactionTimer = this.reactionTime;
            }

            if (this.target && this._isTargetValid(world)) {
                this._setState(STATE.CHASE);
                return;
            }

            if (this.mode === 'domination') {
                this._setState(STATE.CAPTURE);
                return;
            }

            const dx   = this.patrolTarget.x - mech.x;
            const dy   = this.patrolTarget.y - mech.y;
            const dist = Math.hypot(dx, dy);

            if (dist < TILE * 1.5) {
                this.patrolTarget = this._selectPatrolPoint(world);
            }

            const angle = Math.atan2(dy, dx);
            applyInput(mech, dx / (dist || 1), dy / (dist || 1), angle, false, 0, world);
        }

        _stateChase(dt, world) {
            const mech = this.mech;

            if (this._isLowHp()) { this._setState(STATE.FLEE); return; }

            if (this.reactionTimer <= 0) {
                const nt = this._findBestTarget(world);
                if (nt) this.target = nt;
                this.reactionTimer = this.reactionTime;
            }

            if (!this.target || !this._isTargetValid(world)) {
                this.target = null;
                this._setState(STATE.PATROL);
                return;
            }

            const dx   = this.target.x - mech.x;
            const dy   = this.target.y - mech.y;
            const dist = Math.hypot(dx, dy);
            const range = this._getWeaponRange();

            if (dist <= range * 0.85) { this._setState(STATE.ATTACK); return; }

            const toAngle = Math.atan2(dy, dx);
            const strafeX = -Math.sin(toAngle) * this.strafeDir;
            const strafeY =  Math.cos(toAngle) * this.strafeDir;

            applyInput(mech,
                dx / (dist || 1) * 0.8 + strafeX * 0.2,
                dy / (dist || 1) * 0.8 + strafeY * 0.2,
                toAngle, false, this.weaponSlot, world);
        }

        _stateAttack(dt, world) {
            const mech = this.mech;

            if (this._isLowHp()) { this._setState(STATE.FLEE); return; }

            if (this.reactionTimer <= 0) {
                const nt = this._findBestTarget(world);
                if (nt) this.target = nt;
                this.reactionTimer = this.reactionTime;
                this._addAimNoise();
            }

            if (!this.target || !this._isTargetValid(world)) {
                this.target = null;
                this._setState(STATE.PATROL);
                return;
            }

            const dx    = this.target.x - mech.x;
            const dy    = this.target.y - mech.y;
            const dist  = Math.hypot(dx, dy);
            const range = this._getWeaponRange();

            if (dist > range * 1.15) { this._setState(STATE.CHASE); return; }

            const aimAngle = this._getAimedAngle();
            const strafeX  = -Math.sin(aimAngle) * this.strafeDir;
            const strafeY  =  Math.cos(aimAngle) * this.strafeDir;

            let moveX = strafeX;
            let moveY = strafeY;

            if (this._dodging) {
                moveX = this._dodgeVec.x;
                moveY = this._dodgeVec.y;
            } else if (this._shouldDodge(world)) {
                this._startDodge(aimAngle);
                moveX = this._dodgeVec.x;
                moveY = this._dodgeVec.y;
            }

            if (mech.abilitySystem && mech.abilitySystem.isReady()) {
                mech.abilitySystem.activate(world);
            }

            applyInput(mech, moveX, moveY, aimAngle, this._shouldFire(world), this.weaponSlot, world);
        }

        _stateFlee(dt, world) {
            const mech = this.mech;

            if (mech.abilitySystem && mech.abilitySystem.isReady()) {
                mech.abilitySystem.activate(world);
            }

            let fleeX = (Math.random() - 0.5);
            let fleeY = (Math.random() - 0.5);

            if (this.target) {
                const dx = mech.x - this.target.x;
                const dy = mech.y - this.target.y;
                const d  = Math.hypot(dx, dy) || 1;
                fleeX = dx / d;
                fleeY = dy / d;
            }

            applyInput(mech, fleeX, fleeY, Math.atan2(fleeY, fleeX), false, 0, world);

            if (this.stateTimer >= FLEE_DURATION || mech.hp / mech.maxHp >= RETURN_HP_RATIO) {
                this.target = null;
                this._setState(this.mode === 'domination' ? STATE.CAPTURE : STATE.PATROL);
            }
        }

        _stateCapture(dt, world) {
            const mech  = this.mech;
            const zones = world.zones || [];

            if (this._isLowHp()) { this._setState(STATE.FLEE); return; }

            if (this.reactionTimer <= 0) {
                this.target        = this._findBestTarget(world);
                this.reactionTimer = this.reactionTime;
            }

            if (this.target && this._isTargetValid(world)) {
                const dx   = this.target.x - mech.x;
                const dy   = this.target.y - mech.y;
                const dist = Math.hypot(dx, dy);
                if (dist < this._getWeaponRange() * 1.2) {
                    this._setState(STATE.ATTACK);
                    return;
                }
            }

            if (!this.captureTarget || this._isZoneFriendly(this.captureTarget, mech.team)) {
                this.captureTarget = this._findBestZone(zones, mech);
            }

            if (!this.captureTarget) { this._setState(STATE.PATROL); return; }

            const dx   = this.captureTarget.x - mech.x;
            const dy   = this.captureTarget.y - mech.y;
            const dist = Math.hypot(dx, dy);

            if (dist < TILE) {
                const angle = Math.atan2(dy, dx);
                applyInput(mech,
                    -Math.sin(angle) * this.strafeDir * 0.3,
                     Math.cos(angle) * this.strafeDir * 0.3,
                    mech.angle, false, 0, world);
            } else {
                const angle = Math.atan2(dy, dx);
                applyInput(mech, dx / dist, dy / dist, angle, false, 0, world);
            }
        }

        // ─── Targeting ────────────────────────────────────────────────────────

        _findBestTarget(world) {
            const mech  = this.mech;
            const mechs = world.mechs || world.entities || [];
            let bestDist = Infinity;
            let best     = null;

            for (const e of mechs) {
                if (!e || e === mech)                            continue;
                if (e.team === mech.team)                        continue;
                if (e.hp !== undefined && e.hp <= 0)             continue;

                const dx   = e.x - mech.x;
                const dy   = e.y - mech.y;
                const dist = Math.hypot(dx, dy);

                if (dist > SIGHT_RANGE) continue;

                const los = IT.Physics && IT.Physics.lineOfSight
                    ? IT.Physics.lineOfSight(mech, e, world)
                    : true;

                if (!los) continue;

                if (dist < bestDist) { bestDist = dist; best = e; }
            }

            return best;
        }

        _isTargetValid(world) {
            if (!this.target) return false;
            if (this.target.hp !== undefined && this.target.hp <= 0) return false;
            const dx   = this.target.x - this.mech.x;
            const dy   = this.target.y - this.mech.y;
            return Math.hypot(dx, dy) <= SIGHT_RANGE * 1.3;
        }

        // ─── Aim ──────────────────────────────────────────────────────────────

        _getAimedAngle() {
            if (!this.target) return this.mech.angle;
            const dx = this.target.x - this.mech.x;
            const dy = this.target.y - this.mech.y;
            return Math.atan2(dy, dx) + this.aimNoise * (1 - this.accuracy);
        }

        _addAimNoise() {
            const maxNoise = (1 - this.accuracy) * (Math.PI * 0.4);
            this.aimNoise  = (Math.random() * 2 - 1) * maxNoise;
        }

        // ─── Fire ─────────────────────────────────────────────────────────────

        _shouldFire(world) {
            if (!this.target) return false;
            if (this.target.hp !== undefined && this.target.hp <= 0) return false;

            const mech  = this.mech;
            const range = this._getWeaponRange();
            const dx    = this.target.x - mech.x;
            const dy    = this.target.y - mech.y;
            const dist  = Math.hypot(dx, dy);

            if (dist > range) return false;

            const los = IT.Physics && IT.Physics.lineOfSight
                ? IT.Physics.lineOfSight(mech, this.target, world)
                : true;
            if (!los) return false;

            const ws = mech.weaponSystem;
            if (ws && ws.isReloading && ws.isReloading(this.weaponSlot)) return false;

            if (Math.abs(this.aimNoise * (1 - this.accuracy)) > Math.PI * 0.15) return false;

            return Math.random() <= 0.85 + this.accuracy * 0.15;
        }

        // ─── Dodge ────────────────────────────────────────────────────────────

        _shouldDodge(world) {
            if (this._dodging)                      return false;
            if (Math.random() > this.dodgeChance)   return false;

            const projectiles = world.projectiles || [];
            for (const p of projectiles) {
                if (!p || p.team === this.mech.team) continue;
                const dx   = p.x - this.mech.x;
                const dy   = p.y - this.mech.y;
                if (Math.hypot(dx, dy) < TILE * 5)  return true;
            }
            return false;
        }

        _startDodge(aimAngle) {
            const dir        = Math.random() < 0.5 ? -1 : 1;
            this._dodging    = true;
            this._dodgeTimer = 0.25 + Math.random() * 0.15;
            this._dodgeVec   = {
                x: -Math.sin(aimAngle) * dir,
                y:  Math.cos(aimAngle) * dir,
            };
        }

        // ─── Zone helpers ─────────────────────────────────────────────────────

        _findBestZone(zones, mech) {
            if (!zones || zones.length === 0) return null;

            let best      = null;
            let bestScore = -Infinity;

            for (const zone of zones) {
                if (this._isZoneFriendly(zone, mech.team)) continue;

                const dx    = zone.x - mech.x;
                const dy    = zone.y - mech.y;
                const dist  = Math.hypot(dx, dy);

                let score = -dist;
                score += (zone.team === -1 || zone.team === undefined) ? 5000 : 2000;

                if (score > bestScore) { bestScore = score; best = zone; }
            }

            return best;
        }

        _isZoneFriendly(zone, team) {
            return zone && zone.team === team && zone.captureProgress >= 1.0;
        }

        // ─── Patrol ───────────────────────────────────────────────────────────

        _selectPatrolPoint(world) {
            const margin = TILE * 2;
            const COLS   = Math.floor(WORLD_W / TILE);
            const ROWS   = Math.floor(WORLD_H / TILE);

            for (let attempt = 0; attempt < 40; attempt++) {
                const col = Math.floor(Math.random() * COLS);
                const row = Math.floor(Math.random() * ROWS);
                const px  = col * TILE + TILE / 2;
                const py  = row * TILE + TILE / 2;

                if (px < margin || px > WORLD_W - margin) continue;
                if (py < margin || py > WORLD_H - margin) continue;

                if (world && world.tileMap) {
                    const tile = world.tileMap.getTile(col, row);
                    if (tile && tile.solid) continue;
                }

                return { x: px, y: py };
            }

            return {
                x: WORLD_W / 2 + (Math.random() - 0.5) * 400,
                y: WORLD_H / 2 + (Math.random() - 0.5) * 300,
            };
        }

        // ─── Mode ─────────────────────────────────────────────────────────────

        _selectMode(world) {
            if (world) this.mode = world.gameMode || 'skirmish';
        }

        // ─── Util ─────────────────────────────────────────────────────────────

        _setState(newState) {
            this.state      = newState;
            this.stateTimer = 0;
        }

        _isLowHp() {
            return (this.mech.hp / this.mech.maxHp) < FLEE_HP_RATIO;
        }

        _getWeaponRange() {
            const ws = this.mech.weaponSystem;
            if (ws && ws.getRange) return ws.getRange(this.weaponSlot);
            return 300;
        }

        _nextStrafeTime() {
            return STRAFE_FLIP_MIN + Math.random() * (STRAFE_FLIP_MAX - STRAFE_FLIP_MIN);
        }
    }

    // ─── applyInput helper (module-level) ────────────────────────────────────

    function applyInput(mech, dx, dy, angle, fire, slot, world) {
        if (!mech) return;

        const len   = Math.hypot(dx, dy);
        const nx    = len > 0 ? dx / len : 0;
        const ny    = len > 0 ? dy / len : 0;
        const speed = mech.speed || 160;

        mech.vx    = nx * speed;
        mech.vy    = ny * speed;
        mech.angle = angle;

        if (fire && mech.weaponSystem && mech.weaponSystem.tryFire) {
            mech.weaponSystem.tryFire(slot, angle, world);
        }
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    IT.BotAI = BotAI;

}(window.IT = window.IT || {}));
