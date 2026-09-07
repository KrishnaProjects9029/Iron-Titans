// ============================================================
//  Iron Titans — Mech.js
//  Represents a player-controlled (or AI-controlled) mech unit.
// ============================================================

'use strict';

// ---------------------------------------------------------------------------
//  MECH_DEFS — static data for every mech archetype
// ---------------------------------------------------------------------------
const MECH_DEFS = {
  ironclad: {
    id: 'ironclad', name: 'Ironclad', role: 'Tank',
    hp: 500, shield: 200, shieldRegen: 15, shieldRegenDelay: 4,
    speed: 140, radius: 22, mass: 2.0,
    passive: 'damageReduction', passiveValue: 0.15,
    ability: 'fortify', abilityCooldown: 12, abilityDuration: 3,
    color: '#8899aa', accentColor: '#aabbcc',
    shape: 'hexagon',
    description: 'Heavy-armored siege mech. Takes 15% less damage.'
  },
  phantom: {
    id: 'phantom', name: 'Phantom', role: 'Scout',
    hp: 280, shield: 80, shieldRegen: 20, shieldRegenDelay: 3,
    speed: 230, radius: 18, mass: 0.8,
    passive: 'decoyDash', passiveValue: 2,
    ability: 'blink', abilityCooldown: 8, abilityDuration: 0,
    color: '#8844cc', accentColor: '#dd88ff',
    shape: 'diamond',
    description: 'Fast stealth mech. Dash leaves a decoy.'
  },
  voltaic: {
    id: 'voltaic', name: 'Voltaic', role: 'Support',
    hp: 320, shield: 140, shieldRegen: 25, shieldRegenDelay: 3,
    speed: 165, radius: 20, mass: 1.0,
    passive: 'healPulse', passiveValue: 30,
    ability: 'empPulse', abilityCooldown: 15, abilityDuration: 0,
    color: '#44ccff', accentColor: '#88ffee',
    shape: 'circle',
    description: 'Support mech. Emits periodic healing pulses.'
  },
  razorback: {
    id: 'razorback', name: 'Razorback', role: 'Assault',
    hp: 360, shield: 100, shieldRegen: 18, shieldRegenDelay: 3.5,
    speed: 185, radius: 20, mass: 1.2,
    passive: 'bloodRage', passiveValue: 0.20,
    ability: 'charge', abilityCooldown: 10, abilityDuration: 0.5,
    color: '#cc3333', accentColor: '#ff6644',
    shape: 'triangle',
    description: 'Assault mech. +20% damage at low HP.'
  },
  goliath: {
    id: 'goliath', name: 'Goliath', role: 'Siege',
    hp: 620, shield: 160, shieldRegen: 10, shieldRegenDelay: 5,
    speed: 110, radius: 28, mass: 3.0,
    passive: 'immovable', passiveValue: 1,
    ability: 'groundSlam', abilityCooldown: 18, abilityDuration: 0,
    color: '#5a4a2a', accentColor: '#aa8844',
    shape: 'square',
    description: 'Massive siege mech. Immune to knockback.'
  },
  wraith: {
    id: 'wraith', name: 'Wraith', role: 'Assassin',
    hp: 260, shield: 60, shieldRegen: 22, shieldRegenDelay: 2.5,
    speed: 210, radius: 17, mass: 0.7,
    passive: 'firstStrike', passiveValue: 2.0,
    ability: 'shadowstep', abilityCooldown: 9, abilityDuration: 0,
    color: '#224422', accentColor: '#44ff88',
    shape: 'star',
    description: 'Assassin mech. First hit always crits.'
  }
};

// ---------------------------------------------------------------------------
//  Global namespace & auto-increment id
// ---------------------------------------------------------------------------
window.IT = window.IT || {};
if (typeof window.IT._nextId === 'undefined') window.IT._nextId = 1;

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------
const _WORLD_W = 1600;
const _WORLD_H = 1200;
const _TEAM_COLORS = ['#4af', '#f44'];

function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function _dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// ---------------------------------------------------------------------------
//  Mech
// ---------------------------------------------------------------------------
class Mech {
  /**
   * @param {string} mechDefId
   * @param {number} team       0=Blue 1=Red
   * @param {number} x          world X
   * @param {number} y          world Y
   * @param {Array}  weapons    array of two weapon-def id strings
   */
  constructor(mechDefId, team, x, y, weapons = []) {
    this.id        = window.IT._nextId++;
    this.mechDefId = mechDefId;
    this.def       = MECH_DEFS[mechDefId];
    if (!this.def) throw new Error(`[Mech] Unknown mechDefId: "${mechDefId}"`);

    this.team  = team;
    this.x     = x;
    this.y     = y;
    this.angle = team === 0 ? 0 : Math.PI;

    // HP & Shield
    this.maxHp     = this.def.hp;
    this.hp        = this.maxHp;
    this.maxShield = this.def.shield;
    this.shield    = this.maxShield;

    // Movement
    this.vx     = 0;
    this.vy     = 0;
    this.speed  = this.def.speed;
    this.radius = this.def.radius;
    this.mass   = this.def.mass;

    // Status effects: [{type, duration, value}]
    this.statusEffects = [];

    // Ability
    this.abilityTimer       = 0;
    this.abilityCooldown    = this.def.abilityCooldown;
    this.abilityActive      = false;
    this.abilityActiveTimer = 0;

    // Shield regen delay counter
    this.shieldRegenTimer = 0;

    // Passive-specific
    this.passiveCooldown  = 0;    // voltaic heal pulse
    this.firstStrikeReady = true; // wraith

    // Razorback charge
    this.isCharging  = false;
    this.chargeDir   = { x: 0, y: 0 };
    this.chargeTimer = 0;

    // Ironclad fortify
    this.isFortifying = false;

    // State
    this.isDead = false;

    // Match stats
    this.kills  = 0;
    this.deaths = 0;

    // Weapon system (injected when WeaponSystem class is available)
    this.weaponSystem = window.IT.WeaponSystem
      ? new window.IT.WeaponSystem(this, weapons)
      : null;

    // Rank from SaveManager
    this.rank = (window.IT.SaveManager && window.IT.SaveManager.getRank)
      ? window.IT.SaveManager.getRank(mechDefId)
      : 0;

    // Local particle effects
    this.particles = [];
  }

  // =========================================================================
  //  UPDATE
  // =========================================================================
  update(dt, world) {
    if (this.isDead) return;

    this._tickStatusEffects(dt);

    if (this.hasStatus('stunned')) {
      this.vx *= Math.pow(0.05, dt);
      this.vy *= Math.pow(0.05, dt);
      this._applyVelocity(dt, world);
      return;
    }

    // Active ability duration countdown
    if (this.abilityActive) {
      this.abilityActiveTimer -= dt;
      if (this.abilityActiveTimer <= 0) {
        this.abilityActive = false;
        this._onAbilityEnd();
      }
    }

    // Ability cooldown
    if (this.abilityTimer > 0) this.abilityTimer -= dt;

    // Shield regen
    this._tickShieldRegen(dt);

    // Passive: voltaic heal pulse every 5 s
    if (this.def.passive === 'healPulse') {
      this.passiveCooldown -= dt;
      if (this.passiveCooldown <= 0) {
        this.passiveCooldown = 5;
        this._doHealPulse(world);
      }
    }

    // Razorback charge movement
    if (this.isCharging) {
      this.chargeTimer -= dt;
      const CHARGE_SPD = 900;
      this.vx = this.chargeDir.x * CHARGE_SPD;
      this.vy = this.chargeDir.y * CHARGE_SPD;

      if (world && world.mechs) {
        for (const m of world.mechs) {
          if (m === this || m.isDead || m.team === this.team) continue;
          const d2   = _dist2(this.x, this.y, m.x, m.y);
          const minD = this.radius + m.radius;
          if (d2 < minD * minD) {
            m.takeDamage(80, this, false);
            const dx = m.x - this.x, dy = m.y - this.y;
            const dl = Math.sqrt(dx * dx + dy * dy) || 1;
            m.vx += (dx / dl) * 400;
            m.vy += (dy / dl) * 400;
          }
        }
      }

      if (this.chargeTimer <= 0) {
        this.isCharging = false;
        this.vx = 0;
        this.vy = 0;
      }
    }

    this._applyVelocity(dt, world);

    if (this.weaponSystem) this.weaponSystem.update(dt, world);

    this._tickParticles(dt);
  }

  // =========================================================================
  //  MOVE
  // =========================================================================
  move(dx, dy, dt) {
    if (this.isDead || this.hasStatus('stunned') || this.isCharging) return;

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const nx  = dx / len;
      const ny  = dy / len;
      const spd = this.getEffectiveSpeed();
      this.vx   = nx * spd;
      this.vy   = ny * spd;
      this.angle = Math.atan2(ny, nx);
    } else {
      this.vx *= Math.pow(0.02, dt);
      this.vy *= Math.pow(0.02, dt);
    }
  }

  // =========================================================================
  //  TAKE DAMAGE
  // =========================================================================
  takeDamage(amount, source, isCrit = false) {
    if (this.isDead) return 0;

    let dmg = amount;

    // Ironclad passive: 15% flat reduction
    if (this.def.passive === 'damageReduction') {
      dmg *= (1 - this.def.passiveValue);
    }

    // Fortify: additional 50% while active
    if (this.isFortifying) dmg *= 0.5;

    dmg = Math.max(1, Math.round(dmg));

    // Reset shield regen delay on any hit
    this.shieldRegenTimer = this.def.shieldRegenDelay;

    // Absorb with shield first
    let shieldAbs = 0;
    if (this.shield > 0) {
      shieldAbs    = Math.min(this.shield, dmg);
      this.shield -= shieldAbs;
      dmg         -= shieldAbs;
    }

    const hpDmg = Math.min(this.hp, dmg);
    this.hp    -= hpDmg;

    this._spawnHitParticles(isCrit);

    if (this.hp <= 0) {
      this.hp = 0;
      this.die(source);
    }

    return shieldAbs + hpDmg;
  }

  // =========================================================================
  //  HEAL
  // =========================================================================
  heal(amount) {
    if (this.isDead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // =========================================================================
  //  STATUS EFFECTS
  // =========================================================================
  addStatusEffect(type, duration, value = 0) {
    const existing = this.statusEffects.find(s => s.type === type);
    if (existing) {
      existing.duration = Math.max(existing.duration, duration);
      existing.value    = value;
    } else {
      this.statusEffects.push({ type, duration, value });
    }
  }

  removeStatusEffect(type) {
    this.statusEffects = this.statusEffects.filter(s => s.type !== type);
  }

  hasStatus(type) {
    return this.statusEffects.some(s => s.type === type);
  }

  getStatusValue(type) {
    const s = this.statusEffects.find(s => s.type === type);
    return s ? s.value : 0;
  }

  // =========================================================================
  //  ABILITY
  // =========================================================================
  useAbility(targetX, targetY, world) {
    if (this.isDead)                   return false;
    if (this.abilityTimer > 0)         return false;
    if (this.hasStatus('stunned'))     return false;
    if (this.hasStatus('disrupted'))   return false;

    switch (this.def.ability) {
      case 'fortify':    this._abilityFortify();                        break;
      case 'blink':      this._abilityBlink(targetX, targetY, world);  break;
      case 'empPulse':   this._abilityEmpPulse(world);                 break;
      case 'charge':     this._abilityCharge(targetX, targetY);        break;
      case 'groundSlam': this._abilityGroundSlam(world);               break;
      case 'shadowstep': this._abilityShadowstep(targetX, targetY, world); break;
      default:
        console.warn('[Mech] Unknown ability:', this.def.ability);
        return false;
    }

    this.abilityTimer = this.abilityCooldown;
    return true;
  }

  // --- Ironclad: fortify ---
  _abilityFortify() {
    this.isFortifying       = true;
    this.abilityActive      = true;
    this.abilityActiveTimer = this.def.abilityDuration;
    this._spawnAbilityParticles('#aabbcc', 14);
  }

  // --- Phantom: blink ---
  _abilityBlink(tx, ty, world) {
    // Place decoy at current position
    if (world && window.IT.Decoy) {
      const decoy = new window.IT.Decoy(this.x, this.y, this.team, this.def);
      if (world.decoys) world.decoys.push(decoy);
    }

    const dx  = tx - this.x, dy = ty - this.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx  = dx / len, ny = dy / len;
    const d   = Math.min(200, len);

    this.x  = _clamp(this.x + nx * d, this.radius, _WORLD_W - this.radius);
    this.y  = _clamp(this.y + ny * d, this.radius, _WORLD_H - this.radius);
    this.vx = 0;
    this.vy = 0;

    this._spawnAbilityParticles('#dd88ff', 20);
  }

  // --- Voltaic: EMP pulse ---
  _abilityEmpPulse(world) {
    const RANGE = 200, DMG = 100;
    if (!world || !world.mechs) return;

    for (const m of world.mechs) {
      if (m === this || m.isDead || m.team === this.team) continue;
      if (_dist2(this.x, this.y, m.x, m.y) < RANGE * RANGE) {
        m.takeDamage(DMG, this, false);
        m.addStatusEffect('disrupted', 2, 1);
        m._spawnAbilityParticles('#44ccff', 10);
      }
    }

    this._spawnAbilityParticles('#88ffee', 30);
  }

  // --- Razorback: charge ---
  _abilityCharge(tx, ty) {
    const dx  = tx - this.x, dy = ty - this.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.chargeDir   = { x: dx / len, y: dy / len };
    this.chargeTimer = this.def.abilityDuration;
    this.isCharging  = true;
    this.angle       = Math.atan2(dy, dx);
    this._spawnAbilityParticles('#ff6644', 18);
  }

  // --- Goliath: ground slam ---
  _abilityGroundSlam(world) {
    const RANGE = 200, DMG = 120, STUN = 2;
    if (!world || !world.mechs) return;

    for (const m of world.mechs) {
      if (m === this || m.isDead || m.team === this.team) continue;
      const d2 = _dist2(this.x, this.y, m.x, m.y);
      if (d2 < RANGE * RANGE) {
        m.takeDamage(DMG, this, false);
        m.addStatusEffect('stunned', STUN, 1);
        const dx = m.x - this.x, dy = m.y - this.y;
        const dl = Math.sqrt(dx * dx + dy * dy) || 1;
        m.vx += (dx / dl) * 500;
        m.vy += (dy / dl) * 500;
      }
    }

    this._spawnAbilityParticles('#aa8844', 40, 220);
  }

  // --- Wraith: shadowstep ---
  _abilityShadowstep(tx, ty, world) {
    let nearest = null, bestD2 = Infinity;
    if (world && world.mechs) {
      for (const m of world.mechs) {
        if (m === this || m.isDead || m.team === this.team) continue;
        const d2 = _dist2(this.x, this.y, m.x, m.y);
        if (d2 < bestD2) { bestD2 = d2; nearest = m; }
      }
    }

    if (nearest) {
      const behindD = nearest.radius + this.radius + 5;
      const bx = nearest.x - Math.cos(nearest.angle) * behindD;
      const by = nearest.y - Math.sin(nearest.angle) * behindD;
      this.x = _clamp(bx, this.radius, _WORLD_W - this.radius);
      this.y = _clamp(by, this.radius, _WORLD_H - this.radius);
    } else {
      const dx = tx - this.x, dy = ty - this.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.x = _clamp(this.x + (dx / len) * 200, this.radius, _WORLD_W - this.radius);
      this.y = _clamp(this.y + (dy / len) * 200, this.radius, _WORLD_H - this.radius);
    }

    this.vx = 0;
    this.vy = 0;
    this.firstStrikeReady = true;
    this._spawnAbilityParticles('#44ff88', 22);
  }

  _onAbilityEnd() {
    if (this.def.ability === 'fortify') this.isFortifying = false;
  }

  // =========================================================================
  //  DIE / RESPAWN
  // =========================================================================
  die(killer) {
    if (this.isDead) return;
    this.isDead = true;
    this.deaths++;
    this.vx = 0;
    this.vy = 0;

    if (killer && killer.kills !== undefined) {
      killer.kills++;
      if (killer.def && killer.def.passive === 'firstStrike') {
        killer.firstStrikeReady = true;
      }
    }

    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 200;
      this.particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 0.6 + Math.random() * 0.6, maxLife: 1.2,
        r: 4 + Math.random() * 6,
        color: _TEAM_COLORS[this.team]
      });
    }
  }

  respawn(x, y) {
    this.isDead           = false;
    this.x                = x;
    this.y                = y;
    this.vx               = 0;
    this.vy               = 0;
    this.hp               = this.maxHp;
    this.shield           = this.maxShield;
    this.statusEffects    = [];
    this.abilityTimer     = 0;
    this.abilityActive    = false;
    this.isFortifying     = false;
    this.isCharging       = false;
    this.firstStrikeReady = true;
    this.passiveCooldown  = 0;
    this.shieldRegenTimer = 0;
    this.particles        = [];
    this.angle = this.team === 0 ? 0 : Math.PI;
  }

  // =========================================================================
  //  DERIVED STATS
  // =========================================================================
  getEffectiveSpeed() {
    let spd = this.speed;
    if (this.hasStatus('slowed')) {
      spd *= (1 - _clamp(this.getStatusValue('slowed'), 0, 0.9));
    }
    return spd;
  }

  getDamageMultiplier() {
    let mul = 1.0;
    if (this.def.passive === 'bloodRage' && this.hp <= this.maxHp * 0.3) {
      mul += this.def.passiveValue;
    }
    return mul;
  }

  // =========================================================================
  //  PRIVATE HELPERS
  // =========================================================================

  _applyVelocity(dt, world) {
    const nx = this.x + this.vx * dt;
    const ny = this.y + this.vy * dt;

    if (window.IT.Physics) {
      const obstacles = world ? (world.obstacles || world.tiles || []) : [];
      const resolved = window.IT.Physics.resolveAABB(
        nx, ny, this.radius,
        obstacles
      );
      this.x = _clamp(resolved.x, this.radius, _WORLD_W - this.radius);
      this.y = _clamp(resolved.y, this.radius, _WORLD_H - this.radius);
    } else {
      this.x = _clamp(nx, this.radius, _WORLD_W - this.radius);
      this.y = _clamp(ny, this.radius, _WORLD_H - this.radius);
    }

    if (!this.isCharging) {
      const friction = Math.pow(0.02, dt);
      this.vx *= friction;
      this.vy *= friction;
    }
  }

  _tickStatusEffects(dt) {
    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      this.statusEffects[i].duration -= dt;
      if (this.statusEffects[i].duration <= 0) this.statusEffects.splice(i, 1);
    }
    if (this.hasStatus('burning')) {
      this.hp = Math.max(0, this.hp - 8 * dt);
      if (this.hp <= 0 && !this.isDead) this.die(null);
    }
  }

  _tickShieldRegen(dt) {
    if (this.shield >= this.maxShield) return;
    if (this.shieldRegenTimer > 0) { this.shieldRegenTimer -= dt; return; }
    this.shield = Math.min(this.maxShield, this.shield + this.def.shieldRegen * dt);
  }

  _doHealPulse(world) {
    if (!world || !world.mechs) return;
    const R2 = 150 * 150;
    for (const m of world.mechs) {
      if (m.isDead || m.team !== this.team) continue;
      if (_dist2(this.x, this.y, m.x, m.y) < R2) m.heal(this.def.passiveValue);
    }
    this._spawnAbilityParticles('#88ffee', 12, 150);
  }

  _tickParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92;     p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _spawnHitParticles(isCrit) {
    const count = isCrit ? 12 : 6;
    const col   = isCrit ? '#ff0' : '#fff';
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 80;
      this.particles.push({
        x: this.x, y: this.y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 0.2 + Math.random() * 0.2, maxLife: 0.4,
        r: isCrit ? 5 : 3, color: col
      });
    }
  }

  _spawnAbilityParticles(color, count, spreadRadius) {
    if (spreadRadius === undefined) spreadRadius = this.radius * 2;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 60 + Math.random() * 120;
      this.particles.push({
        x: this.x + Math.cos(ang) * this.radius,
        y: this.y + Math.sin(ang) * this.radius,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
        r: 3 + Math.random() * 4, color
      });
    }
  }
}

// ---------------------------------------------------------------------------
//  Expose
// ---------------------------------------------------------------------------
window.IT.Mech      = Mech;
window.IT.MECH_DEFS = MECH_DEFS;
