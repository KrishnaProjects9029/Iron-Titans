/**
 * Iron Titans 3D — Main3D.js
 * Phase 4 Master Orchestrator:
 * Integrates:
 * - 3D Interactive Garage & Hangar Environment
 * - Modular Loadout Selection (5 Mechs & 6 Weapons)
 * - Dynamic 5v5 Battle Spawning with equipped weapons and upgraded stats
 * - Bot Loadouts across all 5 mechs and 6 weapons
 * - Economy & Career Match Rewards (XP, Credits, Level-Ups)
 * - Mobile Touch & Desktop Keyboard/Mouse input continuity
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class Main3D {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.engine = new IT.Engine3D(this.canvas);
      this.scene = this.engine.scene;
      this.camera = this.engine.camera;

      // Game state mode: 'MENU' or 'BATTLE'
      this.gameMode = 'MENU';

      // 1. Build Neon Forge 3D Arena
      this.arena = new IT.Arena3D(this.scene);
      this.arena.arenaGroup.visible = false; // Initially hidden while in Garage/Menu

      // 2. Build 3D Hangar Garage Scene
      this.garage = new IT.GarageScene(this.scene, this.camera);
      this.garage.show();

      // 3. Initialize Core Managers
      this.teamManager = new IT.TeamManager();
      this.spawnManager = new IT.SpawnManager();
      this.hud = new IT.MobileHUD();
      this.matchManager = new IT.MatchManager(this.teamManager, this.spawnManager, this.hud);
      this.combat = new IT.Combat3D(this.scene, this.camera);
      this.input = new IT.InputManager();
      this.gameModeManager = new IT.GameModeManager();

      // Phase 6 VFX & Performance Tracking
      this.vfx = new IT.VFXManager(this.scene);
      IT._activeVFXManager = this.vfx;
      this.frameCount = 0;
      this.fpsTimer = 0;

      this.currentArenaId = 'NEON_FORGE';
      this.currentMode = null;
      this.isPlayerDead = false;
      this.spectatorKillerTarget = null;
      this.deathTimer = 0;

      // Battle rosters & controllers
      this.allMechs = [];
      this.aiControllers = [];
      this.playerMech = null;
      this.tpCamera = null;
      IT._activeCamera = null;
      IT._main3D = this;

      // Attach engine hooks to NetworkManager
      if (IT.NetworkManager) {
        IT.NetworkManager.activeScene = this.scene;
        IT.NetworkManager.activeCamera = this.camera;
        IT.NetworkManager.activeCombat3D = this.combat;
        IT.NetworkManager.activeHud = this.hud;
      }

      // 4. Initialize UI Manager
      this.uiManager = new IT.UIManager(this.garage, (loadout, modeId, arenaId) => {
        this.startBattleWithLoadout(loadout, modeId, arenaId);
      });

      // 5. Connect Match Events
      this._wireMatchEvents();

      // 6. Setup Controls & Leave Battle Button
      this._setupControlsUI();

      // 7. Start Master Render Loop (with headless / background fallback ticker)
      this._lastLoopTime = performance.now();
      this._animate = () => {
        this._lastLoopTime = performance.now();
        this.loop();
      };
      requestAnimationFrame(this._animate);

      const checkHeartbeat = () => {
        if (performance.now() - this._lastLoopTime > 32) {
          this._animate();
        }
        setTimeout(checkHeartbeat, 16);
      };
      setTimeout(checkHeartbeat, 50);
    }

    _wireMatchEvents() {
      // Real-time kill feed
      this.matchManager.onKillFeedEvent = () => {
        this.hud.renderKillFeed(this.matchManager.killFeed);
      };

      // Match Over fallback event -> Show Match Rewards Screen with Credits & XP
      this.matchManager.onMatchOver = (result) => {
        if (this.currentMode && this.currentMode.state === IT.MODE_STATES.ACTIVE) {
          this.currentMode.end(result.playerWon ? 'blue' : (result.isDraw ? 'draw' : 'red'));
        }
      };
    }

    _setupControlsUI() {
      this.targetIndicatorEl = document.getElementById('target-indicator');
      this.fctContainer = document.getElementById('fct-container');

      // Leave Battle / Return to Garage button
      const btnLeave = document.getElementById('btn-battle-leave');
      if (btnLeave) {
        btnLeave.addEventListener('click', () => {
          this.endBattleAndReturnToGarage();
        });
      }

      // Desktop Toggle Touch UI button
      const btnToggle = document.getElementById('btn-toggle-touch');
      if (btnToggle) {
        btnToggle.addEventListener('click', () => {
          const joy = document.getElementById('joystick-zone');
          const panel = document.getElementById('touch-action-panel');
          const isHidden = joy && joy.style.display === 'none';

          if (joy) joy.style.display = isHidden ? 'flex' : 'none';
          if (panel) panel.style.display = isHidden ? 'flex' : 'none';

          btnToggle.textContent = isHidden ? '📱 TOUCH ON' : '💻 DESKTOP';
        });
      }
    }

    startBattleWithLoadout(loadout, modeId = 'SKIRMISH', arenaId = 'NEON_FORGE') {
      this.gameMode = 'BATTLE';
      this.isPlayerDead = false;
      this.spectatorKillerTarget = null;
      this.deathTimer = 0;
      if (this.hud && this.hud.hideDeathScreen) this.hud.hideDeathScreen();

      // 1. Dynamic Arena Loading & Lazy Disposal
      if (!this.arena || this.currentArenaId !== arenaId) {
        if (this.arena) {
          this.arena.destroy();
        }
        this.currentArenaId = arenaId;
        const arenaDef = IT.ArenaRegistry.get(arenaId);
        const BuilderClass = (arenaDef && IT[arenaDef.builderClass]) ? IT[arenaDef.builderClass] : IT.Arena3D;
        this.arena = new BuilderClass(this.scene);
      }

      this.garage.hide();
      this.arena.arenaGroup.visible = true;

      const arenaConfig = (this.arena.getConfig && this.arena.getConfig()) || IT.ArenaRegistry.get(arenaId);

      // 2. Clear previous battle mechs from scene
      this.allMechs.forEach(m => {
        if (m.mesh && m.mesh.parent) {
          m.mesh.parent.remove(m.mesh);
        }
      });
      this.allMechs = [];
      this.aiControllers = [];
      this.teamManager.reset();
      this.spawnManager.reset();

      // 3. Spawn 5v5 Mechs using Player's Loadout and Arena Spawns
      this._spawnBattleRosters(loadout, arenaConfig);

      // 4. Initialize Third-Person Camera tracking the chosen player mech
      this.tpCamera = new IT.ThirdPersonCamera(this.camera, this.playerMech);
      IT._activeCamera = this.tpCamera;
      if (IT.SaveManager.settings && IT.SaveManager.settings.screenShake && this.tpCamera.setShakeLevel) {
        this.tpCamera.setShakeLevel(IT.SaveManager.settings.screenShake);
      }

      // Performance Monitor HUD display state
      const fpsEl = document.getElementById('debug-fps-counter');
      if (fpsEl) {
        fpsEl.style.display = (IT.SaveManager.settings && IT.SaveManager.settings.showFPS) ? 'block' : 'none';
      }

      // 5. Configure player weapon stats in combat system
      const priLvl = IT.SaveManager.getWeaponLevel(loadout.primaryId);
      const secLvl = IT.SaveManager.getWeaponLevel(loadout.secondaryId);
      const priStats = IT.WeaponRegistry.getStatsForLevel(loadout.primaryId, priLvl);
      const secStats = IT.WeaponRegistry.getStatsForLevel(loadout.secondaryId, secLvl);
      this.combat.configurePlayerWeapons(priStats, secStats);

      // 6. Update HUD ammo & player status card
      const nameEl = document.getElementById('hud-player-name');
      const ammoLabel = document.getElementById('hud-ammo-label');
      if (nameEl) nameEl.textContent = this.playerMech.name;
      if (ammoLabel) ammoLabel.textContent = priStats.name;

      // 7. Setup Game Mode & Objectives
      this.gameModeManager.setMode(modeId);
      this.currentMode = this.gameModeManager.getActiveMode();
      this.currentMode.initialize({
        scene: this.scene,
        arena: this.arena,
        arenaConfig,
        teamManager: this.teamManager,
        spawnManager: this.spawnManager,
        hud: this.hud,
        allMechs: this.allMechs,
        playerMech: this.playerMech
      });
      this.currentMode.start();
      this.hud.setMode(modeId, this.currentMode.targetScore);

      this.currentMode.onAnnouncement = (evt) => {
        const text = typeof evt === 'string' ? evt : evt.text;
        const type = evt.type || 'info';
        const duration = evt.duration || 2.5;
        this.hud.showAnnouncement(text, type, duration);
      };

      this.currentMode.onMatchOver = (result) => {
        const playerStats = this.matchManager.getMechStats(this.playerMech) || {};
        const perf = this.currentMode.getPlayerPerformance ? this.currentMode.getPlayerPerformance(this.playerMech) : {};
        const streak = this.currentMode.getPlayerStreak ? this.currentMode.getPlayerStreak(this.playerMech) : 0;

        this.uiManager.showMatchRewards({
          playerWon: result.playerWon,
          isDraw: result.isDraw,
          kills: playerStats.kills || 0,
          deaths: playerStats.deaths || 0,
          assists: playerStats.assists || 0,
          damageDealt: playerStats.damageDealt || 0,
          damageTaken: (this.playerMech.maxHp + this.playerMech.maxShield) - (this.playerMech.hp + this.playerMech.shield),
          objectiveCaptures: perf.captures || 0,
          objectiveDefenses: perf.defenses || 0,
          timeOnPoint: perf.timeOnPoint || 0,
          bestStreak: Math.max(playerStats.bestStreak || 0, streak),
          score: result.playerScore || 0,
          modeId: this.currentMode.modeId,
          arenaId: this.currentArenaId
        });
      };

      // 8. Start 5v5 Match Countdown
      this.matchManager.resetMatch(this.allMechs);

      if (this.uiManager) {
        this.uiManager.showScreen(IT.SCREENS.BATTLE);
      }
    }

    startOnlineBattle(room) {
      this.gameMode = 'BATTLE';
      this.isPlayerDead = false;
      this.spectatorKillerTarget = null;
      this.deathTimer = 0;
      if (this.hud && this.hud.hideDeathScreen) this.hud.hideDeathScreen();

      // 1. Dynamic Arena Loading
      const arenaId = room.arenaId || 'NEON_FORGE';
      if (!this.arena || this.currentArenaId !== arenaId) {
        if (this.arena) this.arena.destroy();
        this.currentArenaId = arenaId;
        const arenaDef = IT.ArenaRegistry.get(arenaId);
        const BuilderClass = (arenaDef && IT[arenaDef.builderClass]) ? IT[arenaDef.builderClass] : IT.Arena3D;
        this.arena = new BuilderClass(this.scene);
      }

      this.garage.hide();
      this.arena.arenaGroup.visible = true;
      const arenaConfig = (this.arena.getConfig && this.arena.getConfig()) || IT.ArenaRegistry.get(arenaId);

      // 2. Clear previous battle mechs
      this.allMechs.forEach(m => {
        if (m.mesh && m.mesh.parent) m.mesh.parent.remove(m.mesh);
      });
      this.allMechs = [];
      this.aiControllers = [];
      this.teamManager.reset();
      this.spawnManager.reset();

      // 3. Spawn Local Player Mech & Remote Mechs from Room
      const blueSpawns = (arenaConfig && arenaConfig.blueSpawns) || IT.BLUE_SPAWNS;
      const redSpawns = (arenaConfig && arenaConfig.redSpawns) || IT.RED_SPAWNS;
      const waypoints = (arenaConfig && arenaConfig.aiWaypoints) || [];

      let blueIdx = 0, redIdx = 0;
      room.getAllPlayers().forEach(p => {
        const isBlue = p.team === 'blue';
        const spawn = isBlue ? (blueSpawns[blueIdx++] || blueSpawns[0]) : (redSpawns[redIdx++] || redSpawns[0]);

        const mechLvl = p.isLocal ? IT.SaveManager.getMechLevel(p.mechId) : 1;
        const mechStats = IT.MechRegistry.getStatsForLevel(p.mechId, mechLvl);

        const mech = new IT.Mech3D({
          mechId: p.mechId,
          name: p.name,
          role: mechStats.role,
          team: p.team,
          isPlayer: p.isLocal,
          color: isBlue ? 0x00f0ff : 0xff3344,
          accentColor: isBlue ? 0x0088ff : 0xaa1122,
          position: new THREE.Vector3(spawn.x, spawn.y || 0, spawn.z),
          rotation: spawn.yaw || 0,
          hp: mechStats.hp,
          maxHp: mechStats.hp,
          shield: mechStats.shield,
          maxShield: mechStats.shield,
          speed: mechStats.speed,
          primaryWeapon: IT.WeaponRegistry.get(p.primaryWeapon),
          secondaryWeapon: IT.WeaponRegistry.get(p.secondaryWeapon)
        });

        this.scene.add(mech.mesh);
        this.allMechs.push(mech);
        this.teamManager.registerMech(mech, p.team);
        p.attachMech(mech);

        if (p.isLocal) {
          this.playerMech = mech;
          if (IT.NetworkManager) IT.NetworkManager.localMech = mech;
        } else if (p.isAI) {
          const ai = new IT.BotAI(mech, {
            skillLevel: 'NORMAL',
            preferredDistance: 18,
            waypoints
          });
          this.aiControllers.push(ai);
        }
      });

      // 4. Initialize Third-Person Camera
      this.tpCamera = new IT.ThirdPersonCamera(this.camera, this.playerMech);
      IT._activeCamera = this.tpCamera;
      if (IT.SaveManager.settings && IT.SaveManager.settings.screenShake && this.tpCamera.setShakeLevel) {
        this.tpCamera.setShakeLevel(IT.SaveManager.settings.screenShake);
      }

      // 5. Configure player weapons
      const loadout = IT.SaveManager.getLoadout();
      const priLvl = IT.SaveManager.getWeaponLevel(loadout.primaryId);
      const secLvl = IT.SaveManager.getWeaponLevel(loadout.secondaryId);
      const priStats = IT.WeaponRegistry.getStatsForLevel(loadout.primaryId, priLvl);
      const secStats = IT.WeaponRegistry.getStatsForLevel(loadout.secondaryId, secLvl);
      this.combat.configurePlayerWeapons(priStats, secStats);

      // 6. Setup Game Mode
      this.gameModeManager.setMode(room.gameMode);
      this.currentMode = this.gameModeManager.getActiveMode();
      this.currentMode.initialize({
        scene: this.scene,
        arena: this.arena,
        arenaConfig,
        teamManager: this.teamManager,
        spawnManager: this.spawnManager,
        hud: this.hud,
        allMechs: this.allMechs,
        playerMech: this.playerMech
      });
      this.currentMode.start();
      this.hud.setMode(room.gameMode, room.targetScore);
      this.matchManager.resetMatch(this.allMechs);

      if (this.uiManager) {
        this.uiManager.showScreen(IT.SCREENS.BATTLE);
      }
    }

    handleOnlineMatchOver(outcome) {
      if (this.uiManager) {
        this.uiManager.showMatchRewards({
          playerWon: outcome.won,
          isDraw: false,
          kills: outcome.kills,
          deaths: outcome.deaths,
          assists: outcome.assists,
          damageDealt: outcome.damageDealt,
          damageTaken: 0,
          objectiveCaptures: 0,
          objectiveDefenses: 0,
          timeOnPoint: 0,
          bestStreak: outcome.kills,
          score: outcome.scores ? (outcome.won ? outcome.scores.blue : outcome.scores.red) : 0,
          modeId: outcome.modeId,
          arenaId: outcome.arenaId
        });
      }
    }

    endBattleAndReturnToGarage() {
      this.gameMode = 'MENU';
      this.arena.arenaGroup.visible = false;
      if (this.currentMode && this.currentMode.reset) {
        this.currentMode.reset();
      }
      if (this.hud && this.hud.hideDeathScreen) {
        this.hud.hideDeathScreen();
      }
      if (this.combat && this.combat.destroy) {
        this.combat.destroy();
      }
      if (this.vfx && this.vfx.destroy) {
        this.vfx.destroy();
      }
      this.allMechs.forEach(m => {
        if (m.destroy) m.destroy();
        else if (m.mesh && m.mesh.parent) m.mesh.parent.remove(m.mesh);
      });
      this.allMechs = [];
      this.aiControllers = [];
      this.playerMech = null;
      this.tpCamera = null;
      IT._activeCamera = null;

      if (this.garage) {
        this.garage.show();
      }
      this.uiManager.showScreen(IT.SCREENS.MECH_GARAGE);
    }

    _spawnBattleRosters(loadout, arenaConfig) {
      const blueSpawns = (arenaConfig && arenaConfig.blueSpawns) || IT.BLUE_SPAWNS;
      const redSpawns = (arenaConfig && arenaConfig.redSpawns) || IT.RED_SPAWNS;
      const waypoints = (arenaConfig && arenaConfig.aiWaypoints) || [];

      const playerMechId = loadout.mechId || 'ironclad';
      const playerLvl = IT.SaveManager.getMechLevel(playerMechId);
      const playerMechStats = IT.MechRegistry.getStatsForLevel(playerMechId, playerLvl);

      // ── Spawn Player Mech ──
      this.playerMech = new IT.Mech3D({
        mechId: playerMechId,
        name: playerMechStats.name,
        role: playerMechStats.role,
        level: playerLvl,
        hp: playerMechStats.maxHp,
        shield: playerMechStats.maxShield,
        speed: playerMechStats.speed,
        turnSpeed: playerMechStats.turnSpeed,
        primaryWeapon: loadout.primaryId || 'pulseCannon',
        secondaryWeapon: loadout.secondaryId || 'scatterBlaster',
        team: 'blue',
        isPlayer: true,
        x: blueSpawns[0].x,
        y: 0,
        z: blueSpawns[0].z,
        heading: blueSpawns[0].heading
      });

      this.scene.add(this.playerMech.mesh);
      this.teamManager.addMech(this.playerMech, 'blue');
      this.allMechs.push(this.playerMech);
      this.matchManager.initMechStats(this.playerMech);

      this.playerMech.onDamageReceived = (attackerPos, amount) => {
        this.hud.addDamageIndicator(this.playerMech.position, this.playerMech.heading, attackerPos);
        this.hud.triggerDamageVignette(amount);
        if (this.tpCamera) {
          const shakeIntensity = Math.min(0.2, (amount / 100) * 0.15);
          this.tpCamera.addShake(shakeIntensity, 0.2);
        }
      };

      // ── 4 Blue AI Allies with Varied Equipment & Tactical Roles ──
      const blueAlliesConfig = [
        { id: 'bastion', name: 'TITAN-BASTION', role: 'Defender', pri: 'pulseCannon', sec: 'missileRack', spawn: blueSpawns[1] },
        { id: 'vortex', name: 'AERO-VORTEX', role: 'Scout', pri: 'scatterBlaster', sec: 'arcRifle', spawn: blueSpawns[2] },
        { id: 'striker', name: 'APEX-STRIKER', role: 'Striker', pri: 'railSpear', sec: 'pulseCannon', spawn: blueSpawns[3] },
        { id: 'nova', name: 'ORION-NOVA', role: 'Assault', pri: 'arcRifle', sec: 'missileRack', spawn: blueSpawns[4] }
      ];

      blueAlliesConfig.forEach(cfg => {
        const ally = new IT.Mech3D({
          mechId: cfg.id,
          name: cfg.name,
          role: cfg.role,
          primaryWeapon: cfg.pri,
          secondaryWeapon: cfg.sec,
          team: 'blue',
          isPlayer: false,
          x: cfg.spawn.x,
          y: 0,
          z: cfg.spawn.z,
          heading: cfg.spawn.heading
        });
        this.scene.add(ally.mesh);
        this.teamManager.addMech(ally, 'blue');
        this.allMechs.push(ally);
        this.matchManager.initMechStats(ally);

        const ai = new IT.MechAIController(ally, { waypoints });
        ai.role = cfg.role;
        this.aiControllers.push(ai);
      });

      // ── 5 Red AI Enemies with Varied Equipment & Tactical Roles ──
      const redEnemiesConfig = [
        { id: 'bastion', name: 'CRIMSON-BASTION', role: 'Defender', pri: 'plasmaLauncher', sec: 'scatterBlaster', spawn: redSpawns[0] },
        { id: 'vortex', name: 'VIPER-VORTEX', role: 'Scout', pri: 'scatterBlaster', sec: 'missileRack', spawn: redSpawns[1] },
        { id: 'striker', name: 'WARLORD-STRIKER', role: 'Striker', pri: 'pulseCannon', sec: 'arcRifle', spawn: redSpawns[2] },
        { id: 'nova', name: 'RAVEN-NOVA', role: 'Assault', pri: 'railSpear', sec: 'pulseCannon', spawn: redSpawns[3] },
        { id: 'ironclad', name: 'DREAD-IRONCLAD', role: 'Tank', pri: 'plasmaLauncher', sec: 'scatterBlaster', spawn: redSpawns[4] }
      ];

      redEnemiesConfig.forEach(cfg => {
        const enemy = new IT.Mech3D({
          mechId: cfg.id,
          name: cfg.name,
          role: cfg.role,
          primaryWeapon: cfg.pri,
          secondaryWeapon: cfg.sec,
          team: 'red',
          isPlayer: false,
          x: cfg.spawn.x,
          y: 0,
          z: cfg.spawn.z,
          heading: cfg.spawn.heading
        });
        this.scene.add(enemy.mesh);
        this.teamManager.addMech(enemy, 'red');
        this.allMechs.push(enemy);
        this.matchManager.initMechStats(enemy);

        const ai = new IT.MechAIController(enemy, { waypoints });
        ai.role = cfg.role;
        this.aiControllers.push(ai);
      });

      // Wire death & respawn callbacks for all mechs
      this.allMechs.forEach(mech => {
        mech.onKilled = (victim, killer) => {
          this.matchManager.recordKill(victim, killer);
          if (this.currentMode) {
            this.currentMode.handleKill(victim, killer);
          }

          // Death camera & killer spectator handling
          if (victim.isPlayer) {
            this.isPlayerDead = true;
            this.spectatorKillerTarget = killer;
            this.deathTimer = 3.0;
            const dist = killer && killer.position ? victim.position.distanceTo(killer.position) : 0;
            this.hud.showDeathScreen(
              killer ? killer.name : 'ENEMY TITAN',
              killer ? killer.primaryWeapon : 'KINETIC CANNON',
              dist,
              3.0
            );
          }

          this.spawnManager.queueRespawn(victim, (respawnedMech, spawn) => {
            if (respawnedMech.isPlayer) {
              this.isPlayerDead = false;
              this.spectatorKillerTarget = null;
              this.hud.hideDeathScreen();
              if (this.tpCamera) {
                this.tpCamera.target = this.playerMech;
                this.tpCamera.yaw = this.playerMech.heading;
              }
            }

            const ai = this.aiControllers.find(c => c.mech === respawnedMech);
            if (ai) {
              ai.state = IT.AI_STATES.PATROL;
              ai.currentTarget = null;
            }
          });
        };
      });
    }

    _showFloatingDamage(screenX, screenY, amount, isCrit = false) {
      if (!this.fctContainer) return;
      if (IT.SaveManager && IT.SaveManager.settings && IT.SaveManager.settings.showDamageNumbers === false) return;
      if (this.fctContainer.children.length > 20) {
        this.fctContainer.removeChild(this.fctContainer.firstElementChild);
      }
      const num = document.createElement('div');
      num.className = isCrit ? 'damage-pop crit' : 'damage-pop';
      num.textContent = isCrit ? `CRIT -${amount}` : `-${amount}`;
      num.style.left = `${screenX}px`;
      num.style.top = `${screenY}px`;
      this.fctContainer.appendChild(num);
      setTimeout(() => {
        if (num.parentElement) num.parentElement.removeChild(num);
      }, 700);
    }

    loop() {
      this._lastLoopTime = performance.now();
      requestAnimationFrame(this._animate);

      try {
        const dt = this.engine.getDelta();

        // ── MODE 1: GARAGE / MENUS ──
        if (this.gameMode === 'MENU') {
          this.garage.update(dt);
          this.engine.render();
          return;
        }

        // ── MODE 2: ACTIVE 5v5 BATTLE ──
        this.matchManager.update(dt);
        this.hud.updateCountdownBanner(this.matchManager.state, this.matchManager.countdownTimer);

      const isMatchActive = this.matchManager.state === IT.MATCH_STATES.ACTIVE;

      // Update Game Mode Lifecycle & Objective scoring
      if (this.currentMode && isMatchActive) {
        this.currentMode.update(dt);
        this.hud.matchTime = this.currentMode.getRemainingTime();
        this.hud.blueScore = this.currentMode.blueScore;
        this.hud.redScore = this.currentMode.redScore;

        if (this.currentMode.modeId === 'DOMINATION') {
          this.hud.updateDominationZones(this.currentMode.getObjectives());
        } else if (this.currentMode.modeId === 'CONTROL_POINT') {
          this.hud.updateControlPointHUD(this.currentMode.getControlPoint());
        }
      }

      const getEnemiesForTeam = (team) => this.teamManager.getEnemiesOf(team);
      this.spawnManager.update(dt, getEnemiesForTeam, this.allMechs);

      const activeObjectives = this.currentMode ? this.currentMode.getObjectives() : [];

      // Process Player Death / Spectator Camera
      if (this.isPlayerDead) {
        this.deathTimer = Math.max(0, this.deathTimer - dt);
        this.hud.updateDeathCountdown(this.deathTimer);

        if (this.spectatorKillerTarget && !this.spectatorKillerTarget.isDead) {
          this.tpCamera.target = this.spectatorKillerTarget;
        }
      } else {
        if (this.tpCamera) this.tpCamera.target = this.playerMech;

        // 1. Process Player Movement
        const rawMove = this.input.getMoveVector();
        const fwd = this.tpCamera.getForwardDirection();
        const right = this.tpCamera.getRightDirection();

        const moveInput = new THREE.Vector3();
        if (rawMove.y !== 0) moveInput.addScaledVector(fwd, rawMove.y);
        if (rawMove.x !== 0) moveInput.addScaledVector(right, rawMove.x);

        // 2. Process Camera Look
        const camDelta = this.input.consumeCameraDelta();
        if (camDelta.x !== 0 || camDelta.y !== 0) {
          this.tpCamera.rotate(camDelta.x, camDelta.y);
        }

        // 3. Target Lock
        const redEnemies = this.teamManager.getEnemiesOf('blue');
        if (this.input.consumeTargetLock()) {
          this.combat.toggleTargetLock(redEnemies);
          this.hud.vibrate(20);
        }

        if (this.combat.isTargetLocked && this.combat.lockedTarget && !this.combat.lockedTarget.isDead) {
          const targetPos = this.combat.lockedTarget.position.clone().add(new THREE.Vector3(0, 2.5, 0));
          const camPos = this.camera.position;
          const toTarget = targetPos.clone().sub(camPos).normalize();

          const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
          let yawDiff = desiredYaw - this.tpCamera.yaw;
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
          this.tpCamera.yaw += yawDiff * Math.min(1.0, 5.0 * dt);
        }

        // 4. Special Ability & Reload
        if (this.input.consumeAbility()) {
          const activated = this.playerMech.useAbility(this.scene);
          if (activated) {
            this.hud.vibrate([40, 60, 40]);
            if (IT.NetworkManager && IT.NetworkManager.isOnline) {
              IT.NetworkManager.combat.onLocalAbilityUsed(this.playerMech.abilityId);
            }
            if (IT.EventManager) {
              IT.EventManager.emit(IT.GAME_EVENTS.ABILITY_USED, { isPlayer: true, abilityId: this.playerMech.abilityId });
            }
          }
        }

        if (this.input.consumeReload()) {
          this.combat.startReload();
        }

        // 5. Update Aim Point
        const aimTarget = this.combat.updateAimTarget(
          this.arena.getRaycastTargets(),
          redEnemies
        );

        if (this.targetIndicatorEl) {
          if (this.combat.aimTargetEntity || this.combat.isTargetLocked) {
            this.targetIndicatorEl.classList.add('locked');
          } else {
            this.targetIndicatorEl.classList.remove('locked');
          }
        }

        // 6. Update Player Mech
        this.playerMech.update(dt, moveInput, aimTarget, (x, z, r) => {
          return this.arena.resolveCollision(x, z, r);
        });

        // 8. Player Weapon Firing
        if (isMatchActive) {
          const fired = this.combat.tryFire(this.playerMech, this.input.isFirePressed());
          if (fired) {
            this.hud.vibrate(10);
            if (this.tpCamera) {
              this.tpCamera.addRecoilKick(0.015);
              this.tpCamera.addShake(0.03, 0.08);
            }
            if (IT.NetworkManager && IT.NetworkManager.isOnline) {
              const pri = this.playerMech.primaryWeapon;
              IT.NetworkManager.combat.onLocalWeaponFire(
                pri ? pri.id : 'pulseCannon',
                this.playerMech.position,
                this.tpCamera.getForwardDirection(),
                false
              );
            }
            if (IT.EventManager) {
              IT.EventManager.emit(IT.GAME_EVENTS.WEAPON_FIRED, { isPlayer: true });
            }
          }

          const firedSec = this.combat.tryFireSecondary(this.playerMech, this.input.isSecondaryPressed());
          if (firedSec) {
            this.hud.vibrate([20, 30, 20]);
            if (this.tpCamera) {
              this.tpCamera.addRecoilKick(0.025);
              this.tpCamera.addShake(0.05, 0.12);
            }
            if (IT.NetworkManager && IT.NetworkManager.isOnline) {
              const sec = this.playerMech.secondaryWeapon;
              IT.NetworkManager.combat.onLocalWeaponFire(
                sec ? sec.id : 'scatterBlaster',
                this.playerMech.position,
                this.tpCamera.getForwardDirection(),
                true
              );
            }
            if (IT.EventManager) {
              IT.EventManager.emit(IT.GAME_EVENTS.WEAPON_FIRED, { isPlayer: true });
            }
          }
        }
      }

      // 7. Update All 9 Bot AI Controllers with active objectives
      this.aiControllers.forEach(ai => {
        const enemies = this.teamManager.getEnemiesOf(ai.mech.team);
        ai.update(dt, enemies, this.arena.colliders, (botMech, targetPoint) => {
          if (isMatchActive) {
            this.combat.fireBotWeapon(botMech, targetPoint);
          }
        }, activeObjectives);

        const resolved = this.arena.resolveCollision(ai.mech.position.x, ai.mech.position.z, ai.mech.radius);
        ai.mech.position.x = resolved.x;
        ai.mech.position.z = resolved.z;
      });

      // 9. Update Combat Projectiles & Impacts
      this.combat.update(dt, this.arena.getRaycastTargets(), this.allMechs, (hitPos, target, sourceMech, dmg, isExplosion, isCrit) => {
        if (target && sourceMech) {
          this.matchManager.recordDamage(sourceMech, target, dmg || 45);
          if (this.currentMode && this.currentMode.recordDamage) {
            this.currentMode.recordDamage(sourceMech, target, dmg || 45);
          }

          if (sourceMech.isPlayer) {
            if (IT.EventManager) {
              IT.EventManager.emit(IT.GAME_EVENTS.DAMAGE_DEALT, {
                amount: dmg || 45,
                isPlayer: true,
                isCritical: Boolean(isCrit)
              });
              if (target.isDead) {
                IT.EventManager.emit(IT.GAME_EVENTS.ENEMY_DESTROYED, {
                  isPlayer: true,
                  weaponId: sourceMech.primaryWeapon ? sourceMech.primaryWeapon.id : 'pulseCannon',
                  isCritical: Boolean(isCrit)
                });
              }
            }

            // Center Hit Marker feedback
            const markerType = isCrit ? 'CRITICAL' : (target.isDead ? 'ELIMINATION' : 'NORMAL');
            this.hud.showHitMarker(markerType);

            const screenPos = hitPos.clone().project(this.camera);
            const sx = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
            this._showFloatingDamage(sx, sy, dmg || 45, isCrit);
          }
        }
      });

      // 10. Update Network Manager (remote player interpolation & snapshot broadcasting)
      if (IT.NetworkManager) {
        IT.NetworkManager.update(dt);
      }

      // 11. Update Third-Person Camera
      this.tpCamera.update(dt, this.arena.getRaycastTargets());

      // 11. Update Tactical HUD & Minimap with active objectives
      this.hud.update(
        dt,
        this.playerMech,
        this.combat,
        this.arena.colliders,
        this.allMechs,
        this.tpCamera.yaw,
        activeObjectives
      );

      // 12. Update VFX & Arena Props
      if (this.vfx) this.vfx.update(dt);
      if (this.arena && this.arena.update) this.arena.update(dt);

      // 13. Live Performance Monitor Calculation
      this.frameCount = (this.frameCount || 0) + 1;
      this.fpsTimer = (this.fpsTimer || 0) + dt;
      if (this.fpsTimer >= 0.5) {
        const fps = Math.round(this.frameCount / this.fpsTimer);
        const frameTime = (dt * 1000).toFixed(1);
        const info = this.engine && this.engine.renderer ? this.engine.renderer.info : null;
        const drawCalls = info ? info.render.calls : 0;
        const triangles = info ? info.render.triangles : 0;
        const activeProjectiles = this.combat ? this.combat.projectiles.length : 0;
        const activeVfx = this.vfx ? (this.vfx.sparks.length + this.vfx.smokePlumes.length + this.vfx.muzzleFlashes.length) : 0;
        const ping = (IT.NetworkManager && IT.NetworkManager.client && IT.NetworkManager.client.currentPing) ? IT.NetworkManager.client.currentPing : 18;
        if (this.hud && this.hud.updateDebugPerformance) {
          this.hud.updateDebugPerformance(fps, frameTime, drawCalls, activeProjectiles, triangles, activeVfx, ping);
        }
        this.frameCount = 0;
        this.fpsTimer = 0;
      }

      // 14. Render Frame
      this.engine.render();
    } catch (renderError) {
      console.error('[IT-RENDER-CRASH] Exception in combat render loop:', renderError);
      const errScreen = document.getElementById('screen-error');
      if (errScreen) {
        errScreen.style.display = 'flex';
        const desc = document.getElementById('error-desc-text');
        if (desc && renderError.message) desc.textContent = renderError.message;
      }
    }
  }
  }

  IT.Main3D = Main3D;

  function boot3D() {
    window._ironTitans3D = new Main3D();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot3D);
  } else {
    boot3D();
  }
})(window.IT);

