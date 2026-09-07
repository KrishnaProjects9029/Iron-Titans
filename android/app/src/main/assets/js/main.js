/**
 * Iron Titans — main.js
 * Top-level game loop, state machine, world management.
 * States: MENU → GARAGE → LOADING → PLAYING → RESULTS
 */

window.IT = window.IT || {};

(function (IT) {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────
  const WORLD_W = 1600;
  const WORLD_H = 1200;
  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const TICK_RATE = 60;
  const RESPAWN_TIME = 5;

  // Game mode win conditions
  const MODE_DEFS = {
    skirmish: {
      id: 'skirmish',
      name: 'Team Skirmish',
      description: 'Eliminate the enemy team. First to 10 kills wins.',
      killTarget: 10,
      timeLimit: 300,
      teams: 2,
      playersPerTeam: 2
    },
    domination: {
      id: 'domination',
      name: 'Domination',
      description: 'Capture and hold all 3 zones. First to 200 points wins.',
      pointTarget: 200,
      timeLimit: 300,
      teams: 2,
      playersPerTeam: 2
    },
    ffa: {
      id: 'ffa',
      name: 'Last Titan Standing',
      description: 'Free-for-all. Last mech standing wins. 3 lives each.',
      lives: 3,
      timeLimit: 240,
      teams: 0,
      playersPerTeam: 1
    }
  };

  IT.MODE_DEFS = MODE_DEFS;

  // ─── Entity ID Counter ─────────────────────────────────────────────────────
  let _nextId = 1;
  IT.nextId = () => _nextId++;

  // ─── World State ───────────────────────────────────────────────────────────
  class World {
    constructor() {
      this.mechs = [];
      this.projectiles = [];
      this.turrets = [];
      this.zones = [];
      this.effects = [];
      this.hazardTimers = {};
      this.map = null;
      this.obstacles = [];
      this.gameMode = 'skirmish';
      this.modeDef = MODE_DEFS.skirmish;
      this.playerMech = null;
      this.playerTeam = 0;
      this.scores = [0, 0];       // team scores
      this.kills = [0, 0];        // team kills
      this.lives = {};            // ffa lives: mechId → remaining
      this.time = 0;              // match elapsed time
      this.matchTimer = 0;        // countdown from timeLimit
      this.isOver = false;
      this.winTeam = -1;
      this.bots = [];             // BotAI instances
      this.respawnQueue = [];     // {mech, timer}
      this.killFeed = [];         // {killerId, killerName, killerTeam, victimId, victimName, victimTeam, time}
      this.domPoints = [0, 0];    // domination score
      this.ffaLives = {};         // mechId → lives remaining
    }

    addMech(mech) { this.mechs.push(mech); }
    addProjectile(p) { this.projectiles.push(p); }
    addTurret(t) { this.turrets.push(t); }
    addEffect(e) { this.effects.push(e); }

    removeDead() {
      this.projectiles = this.projectiles.filter(p => p.isAlive);
      this.turrets = this.turrets.filter(t => !t.isDead);
      this.effects = this.effects.filter(e => e.life > 0);
    }

    getEnemyMechs(team) {
      return this.mechs.filter(m => m.team !== team && !m.isDead);
    }

    getAllyMechs(team) {
      return this.mechs.filter(m => m.team === team && !m.isDead);
    }

    getLivingMechs() {
      return this.mechs.filter(m => !m.isDead);
    }
  }

  // ─── Game Class ────────────────────────────────────────────────────────────
  class Game {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.canvas.width = CANVAS_W;
      this.canvas.height = CANVAS_H;

      this.state = 'MENU';        // MENU | GARAGE | LOADING | PLAYING | RESULTS
      this.world = null;
      this.renderer = null;
      this.hud = null;
      this.input = null;
      this.menu = null;
      this.garage = null;

      this.lastTime = 0;
      this.accumulator = 0;
      this.frameStep = 1 / TICK_RATE;

      // Match config set by menu
      this.matchConfig = {
        mechId: 'ironclad',
        weapons: ['pulsarCannon', 'scatterFlechettes'],
        mode: 'skirmish',
        arenaId: 'forgeNexus',
        difficulty: 'normal'
      };

      this._rafId = null;
      this._resizeListener = null;
    }

    init() {
      // Create subsystems
      this.renderer = new IT.Renderer(this.canvas);
      this.hud = new IT.HUD(this.canvas);
      this.input = new IT.InputManager();
      this.input.init(this.canvas);
      this.menu = new IT.MenuScreen(this.canvas);
      this.garage = new IT.GarageScreen(this.canvas);

      // Wire up menu callbacks
      this.menu.onStartGame = (config) => {
        this.matchConfig = config;
        this._startMatch();
      };
      this.menu.onOpenGarage = () => {
        this.state = 'GARAGE';
      };
      this.garage.onBack = () => {
        this.state = 'MENU';
      };
      this.garage.onStartMatch = (loadout) => {
        this.matchConfig.mechId = loadout.mechId;
        this.matchConfig.weapons = loadout.weapons;
        this.state = 'MENU';
      };

      // Resize handler
      this._resizeListener = () => this._resize();
      window.addEventListener('resize', this._resizeListener);
      this._resize();

      // Start loop
      this._rafId = requestAnimationFrame((t) => this._loop(t));
    }

    _resize() {
      const scale = Math.min(
        window.innerWidth / CANVAS_W,
        window.innerHeight / CANVAS_H
      );
      this.canvas.style.width = (CANVAS_W * scale) + 'px';
      this.canvas.style.height = (CANVAS_H * scale) + 'px';
      this.canvas.style.left = ((window.innerWidth - CANVAS_W * scale) / 2) + 'px';
      this.canvas.style.top = ((window.innerHeight - CANVAS_H * scale) / 2) + 'px';
      if (this.input) this.input.setScale(scale, parseFloat(this.canvas.style.left), parseFloat(this.canvas.style.top));
    }

    _loop(timestamp) {
      this._rafId = requestAnimationFrame((t) => this._loop(t));
      const rawDt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
      this.lastTime = timestamp;

      this.renderer.update(rawDt);

      switch (this.state) {
        case 'MENU':
          this.menu.update(rawDt);
          this.menu.draw();
          break;
        case 'GARAGE':
          this.garage.update(rawDt);
          this.garage.draw();
          break;
        case 'PLAYING':
          this._updatePlaying(rawDt);
          this.renderer.draw(this.world);
          this.hud.draw(this.world, this.world.playerMech);
          break;
        case 'RESULTS':
          this._drawResults();
          break;
      }
    }

    // ─── Match Setup ──────────────────────────────────────────────────────────
    _startMatch() {
      this.state = 'LOADING';
      const cfg = this.matchConfig;

      // Build world
      const world = new World();
      world.gameMode = cfg.mode;
      world.modeDef = MODE_DEFS[cfg.mode];
      world.matchTimer = world.modeDef.timeLimit;
      this.world = world;

      // Load map
      const mapDef = IT.MapLoader.getMap(cfg.arenaId);
      world.map = mapDef;
      world.obstacles = IT.MapLoader.buildObstacles(mapDef);

      // Create zones for domination
      if (cfg.mode === 'domination' && mapDef.zones) {
        mapDef.zones.forEach((zd, i) => {
          const z = new IT.Zone(i, zd.x, zd.y, String.fromCharCode(65 + i));
          world.zones.push(z);
        });
      }

      // Spawn player mech
      const spawn0 = IT.MapLoader.getSpawnPoint(mapDef, 0, 0);
      const playerMech = new IT.Mech(cfg.mechId, 0, spawn0.x, spawn0.y, cfg.weapons);
      playerMech.isPlayer = true;
      world.addMech(playerMech);
      world.playerMech = playerMech;

      // Spawn bots
      this._spawnBots(world, cfg);

      // Init domination lives
      if (cfg.mode === 'ffa') {
        world.mechs.forEach(m => {
          world.ffaLives[m.id] = world.modeDef.lives;
        });
      }

      // Reset renderer camera
      this.renderer.camera.x = spawn0.x - CANVAS_W / 2;
      this.renderer.camera.y = spawn0.y - CANVAS_H / 2;
      this.renderer.particles = [];

      // Wire kill callback
      world.onKill = (killer, victim) => this._onKill(killer, victim);

      this.state = 'PLAYING';
    }

    _spawnBots(world, cfg) {
      const modeDef = world.modeDef;
      const mapDef = world.map;
      const diff = cfg.difficulty || 'normal';

      // Determine bot mechs and teams based on mode
      const botMechPool = Object.keys(IT.MECH_DEFS).filter(id => id !== cfg.mechId);
      const botWeaponPool = [
        ['pulsarCannon', 'scatterFlechettes'],
        ['torrentLauncher', 'arcBlade'],
        ['novaGrenades', 'cryoBeam'],
        ['gravityWell', 'sentinelTurret']
      ];

      let botConfigs = [];

      if (cfg.mode === 'ffa') {
        // 3 enemy bots, all different teams (FFA: team = mech index)
        for (let i = 0; i < 3; i++) {
          botConfigs.push({ team: i + 1, spawnIdx: i });
        }
      } else {
        // Team mode: 1 ally bot (team 0), 2 enemy bots (team 1)
        botConfigs.push({ team: 0, spawnIdx: 1 });
        botConfigs.push({ team: 1, spawnIdx: 0 });
        botConfigs.push({ team: 1, spawnIdx: 1 });
      }

      botConfigs.forEach((bc, i) => {
        const mechId = botMechPool[i % botMechPool.length];
        const weapons = botWeaponPool[i % botWeaponPool.length];
        const spawn = IT.MapLoader.getSpawnPoint(mapDef, bc.team, bc.spawnIdx);
        const mech = new IT.Mech(mechId, bc.team, spawn.x, spawn.y, weapons);
        mech.isBot = true;
        const bot = new IT.BotAI(mech, diff);
        bot.mode = cfg.mode === 'ffa' ? 'ffa' : cfg.mode === 'domination' ? 'domination' : 'skirmish';
        world.addMech(mech);
        world.bots.push({ ai: bot, mech });
      });
    }

    // ─── Match Update ─────────────────────────────────────────────────────────
    _updatePlaying(dt) {
      const world = this.world;
      if (!world || world.isOver) {
        if (world && world.isOver) {
          this._endMatchAfterDelay(dt);
        }
        return;
      }

      // Match timer
      world.time += dt;
      world.matchTimer -= dt;
      if (world.matchTimer <= 0) {
        world.matchTimer = 0;
        this._resolveTimeUp();
      }

      // Player input
      this._updatePlayerInput(dt);

      // Bot AI
      world.bots.forEach(b => b.ai.update(dt, world));

      // Update mechs
      world.mechs.forEach(m => {
        if (!m.isDead) {
          m.update(dt, world);
        }
      });

      // Update projectiles
      world.projectiles.forEach(p => p.update(dt, world));

      // Update turrets
      world.turrets.forEach(t => t.update(dt, world));

      // Update capture zones (domination)
      if (world.gameMode === 'domination') {
        world.zones.forEach(z => {
          z.update(dt, world.mechs);
          // Award points
          const pps = z.getPointsPerSecond();
          if (z.controllingTeam >= 0) {
            world.domPoints[z.controllingTeam] += pps * dt;
          }
        });
        world.scores[0] = Math.floor(world.domPoints[0]);
        world.scores[1] = Math.floor(world.domPoints[1]);

        // Check win
        const target = world.modeDef.pointTarget;
        if (world.domPoints[0] >= target) this._endMatch(0);
        if (world.domPoints[1] >= target) this._endMatch(1);
      }

      // Map hazards
      this._updateHazards(dt);

      // Respawn queue
      this._updateRespawns(dt);

      // Remove dead entities
      world.removeDead();

      // Remove dead effects
      world.effects = world.effects.filter(e => e.life > 0);
      world.effects.forEach(e => { e.life -= dt; });

      // Update HUD
      this.hud.update(dt);

      // Update renderer camera
      if (world.playerMech) {
        this.renderer.updateCamera(world.playerMech, WORLD_W, WORLD_H);
      }

      // Check skirmish win
      if (world.gameMode === 'skirmish') {
        if (world.kills[0] >= world.modeDef.killTarget) this._endMatch(0);
        if (world.kills[1] >= world.modeDef.killTarget) this._endMatch(1);
      }

      // Check FFA win
      if (world.gameMode === 'ffa') {
        const alive = world.mechs.filter(m => !m.isDead || (world.ffaLives[m.id] > 0));
        if (alive.length <= 1) {
          this._endMatch(alive[0] ? alive[0].team : -1);
        }
      }
    }

    _updatePlayerInput(dt) {
      const world = this.world;
      const pm = world.playerMech;
      if (!pm || pm.isDead) return;

      const mv = this.input.getMoveVector();
      pm.move(mv.x, mv.y, dt);

      const aimAngle = this.input.getAimAngle(
        pm.x - this.renderer.camera.x,
        pm.y - this.renderer.camera.y
      );
      pm.angle = aimAngle;

      // Primary fire
      if (this.input.isFirePressed()) {
        const dist = 400;
        const tx = pm.x + Math.cos(aimAngle) * dist;
        const ty = pm.y + Math.sin(aimAngle) * dist;
        const results = pm.weaponSystem.tryFire(0, tx, ty);
        this._processWeaponResults(results, world);
      }

      // Secondary fire
      if (this.input.isSecondaryFirePressed()) {
        const dist = 400;
        const tx = pm.x + Math.cos(aimAngle) * dist;
        const ty = pm.y + Math.sin(aimAngle) * dist;
        const results = pm.weaponSystem.tryFire(1, tx, ty);
        this._processWeaponResults(results, world);
      }

      // Ability
      if (this.input.isAbilityJustPressed()) {
        const dist = 300;
        const tx = pm.x + Math.cos(aimAngle) * dist;
        const ty = pm.y + Math.sin(aimAngle) * dist;
        pm.useAbility(tx, ty, world);
      }
    }

    _processWeaponResults(results, world) {
      if (!results) return;
      results.forEach(r => {
        if (r.type === 'projectile') {
          world.addProjectile(new IT.Projectile(r.config));
        } else if (r.type === 'turret') {
          world.addTurret(new IT.Turret(r.config.x, r.config.y, r.config.team, r.config.ownerId, r.config.def));
        } else if (r.type === 'effect') {
          world.addEffect(r.config);
        } else if (r.type === 'meleehit') {
          // Direct damage hit
          r.targets.forEach(({ entity, damage, isCrit }) => {
            if (!entity.isDead) {
              const actual = entity.takeDamage(damage, world.playerMech, isCrit);
              this.hud.addDamageNumber(entity.x, entity.y - entity.radius, actual, isCrit, false);
              this.renderer.addTrauma(actual > 60 ? 0.3 : 0.1);
            }
          });
        }
      });
    }

    _updateHazards(dt) {
      const world = this.world;
      const map = world.map;
      if (!map || !map.hazards) return;

      map.hazards.forEach((hz, i) => {
        this.world.hazardTimers[i] = (this.world.hazardTimers[i] || 0) + dt;
        if (this.world.hazardTimers[i] >= hz.interval) {
          this.world.hazardTimers[i] -= hz.interval;
        }

        // Check all mechs in hazard zone
        world.mechs.forEach(m => {
          if (m.isDead) return;
          if (IT.Physics.rectRect(m.x - m.radius, m.y - m.radius, m.radius * 2, m.radius * 2,
            hz.x, hz.y, hz.w, hz.h)) {
            if (hz.type === 'lava') {
              m.takeDamage(hz.damage * dt, null, false);
              if (!m.hasStatus('burning')) m.addStatusEffect('burning', 0.5, hz.damage);
            } else if (hz.type === 'water') {
              if (!m.hasStatus('slowed')) m.addStatusEffect('slowed', 0.3, 0.5);
            }
          }
        });
      });
    }

    _updateRespawns(dt) {
      const world = this.world;
      world.respawnQueue = world.respawnQueue.filter(entry => {
        entry.timer -= dt;
        if (entry.timer <= 0) {
          const spawn = IT.MapLoader.getSpawnPoint(world.map, entry.mech.team, entry.spawnIdx || 0);
          entry.mech.respawn(spawn.x, spawn.y);
          return false;
        }
        return true;
      });
    }

    // ─── Kill Handling ────────────────────────────────────────────────────────
    _onKill(killer, victim) {
      const world = this.world;

      // Kill feed
      this.hud.addKillFeedEntry(
        killer ? killer.def.name : 'Hazard',
        killer ? killer.team : -1,
        victim.def.name,
        victim.team
      );

      // Score for team modes
      if (world.gameMode === 'skirmish') {
        if (killer && killer.team !== victim.team) {
          world.kills[killer.team]++;
          world.scores[killer.team] = world.kills[killer.team];
        }
      }

      // FFA lives
      if (world.gameMode === 'ffa') {
        const remaining = (world.ffaLives[victim.id] || 1) - 1;
        world.ffaLives[victim.id] = remaining;
        if (remaining <= 0) {
          victim.isDead = true;
          return; // no respawn
        }
      }

      // Screen shake
      if (world.playerMech === victim) {
        this.renderer.addTrauma(0.8);
      } else if (killer === world.playerMech) {
        this.renderer.addTrauma(0.2);
      }

      // Respawn
      if (world.gameMode !== 'ffa') {
        world.respawnQueue.push({ mech: victim, timer: RESPAWN_TIME, spawnIdx: Math.floor(Math.random() * 2) });
      }

      // Particles
      this.renderer.spawnParticles(victim.x, victim.y, {
        count: 20,
        color: victim.def.color,
        spread: Math.PI * 2,
        speed: 200,
        size: 5,
        life: 0.8,
        gravity: 100,
        glow: true
      });

      // Explosion effect
      world.addEffect({
        type: 'explosion',
        x: victim.x,
        y: victim.y,
        r: victim.radius * 2,
        color: victim.def.accentColor,
        life: 0.6,
        maxLife: 0.6
      });
    }

    // ─── Match End ────────────────────────────────────────────────────────────
    _resolveTimeUp() {
      const world = this.world;
      if (world.gameMode === 'skirmish' || world.gameMode === 'ffa') {
        const winner = world.kills[0] >= world.kills[1] ? 0 : 1;
        this._endMatch(winner);
      } else if (world.gameMode === 'domination') {
        const winner = world.domPoints[0] >= world.domPoints[1] ? 0 : 1;
        this._endMatch(winner);
      }
    }

    _endMatch(winTeam) {
      if (this.world.isOver) return;
      this.world.isOver = true;
      this.world.winTeam = winTeam;
      this._endTimer = 3.0;

      // Award credits
      const playerTeam = this.world.playerMech ? this.world.playerMech.team : 0;
      const won = winTeam === playerTeam;
      const kills = this.world.playerMech ? this.world.playerMech.kills : 0;
      const deaths = this.world.playerMech ? this.world.playerMech.deaths : 0;
      const creditReward = (won ? 200 : 80) + kills * 25;

      IT.SaveManager.recordMatch(won, kills, deaths, creditReward);
    }

    _endMatchAfterDelay(dt) {
      this._endTimer = (this._endTimer || 3) - dt;
      if (this._endTimer <= 0) {
        this.state = 'RESULTS';
      }
    }

    _drawResults() {
      const ctx = this.canvas.getContext('2d');
      const world = this.world;
      const w = this.canvas.width;
      const h = this.canvas.height;

      ctx.fillStyle = 'rgba(0,0,0,0.92)';
      ctx.fillRect(0, 0, w, h);

      const won = world.winTeam === (world.playerMech ? world.playerMech.team : 0);
      const isDrawn = world.winTeam === -1;

      // Banner
      const bannerColor = isDrawn ? '#888' : (won ? '#4af' : '#f44');
      const bannerText = isDrawn ? 'DRAW' : (won ? 'VICTORY' : 'DEFEAT');

      ctx.save();
      ctx.shadowColor = bannerColor;
      ctx.shadowBlur = 40;
      ctx.fillStyle = bannerColor;
      ctx.font = 'bold 72px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(bannerText, w / 2, 120);
      ctx.restore();

      // Stats
      ctx.fillStyle = '#ccc';
      ctx.font = '20px system-ui';
      ctx.textAlign = 'center';

      if (world.playerMech) {
        const pm = world.playerMech;
        const rows = [
          ['Kills', pm.kills],
          ['Deaths', pm.deaths],
          ['Damage Dealt', Math.floor(pm.totalDamageDealt || 0)],
          ['Mode Score', world.scores[pm.team]]
        ];

        ctx.fillStyle = '#aaa';
        ctx.font = '18px system-ui';
        rows.forEach((row, i) => {
          ctx.fillStyle = '#888';
          ctx.textAlign = 'right';
          ctx.fillText(row[0], w / 2 - 10, 200 + i * 40);
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'left';
          ctx.fillText(row[1], w / 2 + 10, 200 + i * 40);
        });
      }

      // Credits earned
      const save = IT.SaveManager.load();
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`Credits: ${save.credits}`, w / 2, 390);

      // Buttons
      this._drawResultButton(ctx, w / 2 - 120, 450, 200, 50, 'PLAY AGAIN', '#4af', () => {
        this._startMatch();
      });
      this._drawResultButton(ctx, w / 2 + 40, 450, 200, 50, 'MAIN MENU', '#888', () => {
        this.state = 'MENU';
      });
    }

    _drawResultButton(ctx, x, y, w, h, text, color, onClick) {
      ctx.save();
      ctx.fillStyle = color + '33';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2);
      ctx.restore();

      // Register click (simple approach — checked in click handler)
      if (!this._resultButtons) this._resultButtons = [];
      this._resultButtons.push({ x, y, w, h, onClick });
    }

    destroy() {
      if (this._rafId) cancelAnimationFrame(this._rafId);
      if (this._resizeListener) window.removeEventListener('resize', this._resizeListener);
      if (this.input) this.input.destroy();
    }
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────
  IT.Game = Game;
  IT.WORLD_W = WORLD_W;
  IT.WORLD_H = WORLD_H;
  IT.CANVAS_W = CANVAS_W;
  IT.CANVAS_H = CANVAS_H;

  // Start game when DOM is ready
  function boot() {
    window._ironTitans = new Game();
    window._ironTitans.init();

    // Handle result screen clicks
    document.getElementById('game-canvas').addEventListener('click', (e) => {
      const g = window._ironTitans;
      if (g.state === 'RESULTS' && g._resultButtons) {
        const rect = g.canvas.getBoundingClientRect();
        const scaleX = IT.CANVAS_W / rect.width;
        const scaleY = IT.CANVAS_H / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        g._resultButtons.forEach(btn => {
          if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
            g._resultButtons = [];
            btn.onClick();
          }
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})(window.IT);
