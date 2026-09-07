/**
 * Iron Titans 3D — UIManager.js
 * Comprehensive UI Controller for Menu Navigation, Mech Selection,
 * Weapon Equipment, Upgrade Flows, Player Career, and Match Rewards.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const SCREENS = {
    MAIN_MENU: 'screen-main-menu',
    GAME_MODES: 'screen-game-modes',
    ARENA_SELECT: 'screen-arena-select',
    MECH_GARAGE: 'screen-mech-garage',
    WEAPONS_GARAGE: 'screen-weapons-garage',
    LOADOUT: 'screen-loadout',
    CAREER: 'screen-career',
    SETTINGS: 'screen-settings',
    MISSIONS: 'screen-missions',
    LOADING: 'screen-loading',
    BATTLE: 'screen-battle'
  };

  class UIManager {
    constructor(garageScene, onStartBattleCallback) {
      this.garageScene = garageScene;
      this.onStartBattle = onStartBattleCallback;

      this.currentScreen = SCREENS.MAIN_MENU;
      this.selectedInspectMechId = 'ironclad';
      this.selectedInspectWeaponId = 'pulseCannon';
      this.activeMissionTab = 'DAILY';

      this._cacheElements();
      this._bindNavigationEvents();
      this._bindGameModeEvents();
      this._bindArenaSelectEvents();
      this._bindMechGarageEvents();
      this._bindWeaponGarageEvents();
      this._bindLoadoutEvents();
      this._bindCareerEvents();
      this._bindSettingsEvents();
      this._bindRewardEvents();
      this._bindMatchmakingEvents();
      this._bindMissionsEvents();
      this._bindDailyLoginEvents();
      this._bindNetworkSettingsEvents();
      this._bindPhase10ReleaseEvents();

      // Initial header update and screen selection (with URL hash deep linking support)
      this.updateHeaderCurrencies();
      const hash = (window.location && window.location.hash) || '';
      const search = (window.location && window.location.search) || '';
      const route = (hash + ' ' + search).toLowerCase();

      if (route.includes('garage')) this.showScreen(SCREENS.MECH_GARAGE);
      else if (route.includes('weapons')) this.showScreen(SCREENS.WEAPONS_GARAGE);
      else if (route.includes('loadout')) this.showScreen(SCREENS.LOADOUT);
      else if (route.includes('career') || route.includes('profile')) this.showScreen(SCREENS.CAREER);
      else if (route.includes('missions')) {
        this.showScreen(SCREENS.MISSIONS);
        this.renderMissions(this.activeMissionTab);
      }
      else if (route.includes('matchmaking')) {
        this.showScreen(SCREENS.MAIN_MENU);
        this.openMatchmakingModal();
      }
      else if (route.includes('daily')) {
        this.showScreen(SCREENS.MAIN_MENU);
        this.showDailyLoginModal();
      }
      else if (route.includes('netdebug')) {
        this.showScreen(SCREENS.MAIN_MENU);
        this.toggleNetworkDebugPanel();
      }
      else if (route.includes('modes')) this.showScreen(SCREENS.GAME_MODES);
      else if (route.includes('arenas')) this.showScreen(SCREENS.ARENA_SELECT);
      else if (route.includes('settings')) this.showScreen(SCREENS.SETTINGS);
      else if (route.includes('loading')) {
        this.showScreen(SCREENS.LOADING);
        const fill = document.getElementById('loading-bar-fill');
        if (fill) fill.style.width = '65%';
      }
      else if (route.includes('battle')) {
        setTimeout(() => {
          if (route.includes('domination')) IT.SaveManager.preferredMode = 'DOMINATION';
          else if (route.includes('controlpoint')) IT.SaveManager.preferredMode = 'CONTROL_POINT';
          if (route.includes('titandocks')) IT.SaveManager.preferredArena = 'TITAN_DOCKS';
          else if (route.includes('ashenreactor')) IT.SaveManager.preferredArena = 'ASHEN_REACTOR';
          const loadout = IT.SaveManager.getLoadout();
          this._launchBattle(loadout);
        }, 100);
      }
      else this.showScreen(SCREENS.MAIN_MENU);
    }

    _cacheElements() {
      // Screens
      this.screens = {};
      Object.values(SCREENS).forEach(id => {
        this.screens[id] = document.getElementById(id);
      });

      // Top Currency / Level Header in Menus
      this.headerCredits = document.getElementById('menu-credits-val');
      this.headerLevel = document.getElementById('menu-level-val');
      this.headerXPBar = document.getElementById('menu-xp-progress');

      // Modals
      this.upgradeModal = document.getElementById('upgrade-modal');
      this.rewardModal = document.getElementById('match-reward-modal');
      this.matchmakingOverlay = document.getElementById('matchmaking-overlay');
    }

    _bindNavigationEvents() {
      const playClick = () => {
        if (IT.AudioManager) IT.AudioManager.playUI('CLICK');
      };

      // Main menu buttons
      this._on('btn-menu-play', 'click', () => { playClick(); this.showScreen(SCREENS.GAME_MODES); });
      this._on('btn-menu-missions', 'click', () => { playClick(); this.showScreen(SCREENS.MISSIONS); this.renderMissions(this.activeMissionTab); });
      this._on('btn-menu-daily', 'click', () => { playClick(); this.showDailyLoginModal(); });
      this._on('btn-menu-garage', 'click', () => { playClick(); this.showScreen(SCREENS.MECH_GARAGE); });
      this._on('btn-menu-weapons', 'click', () => { playClick(); this.showScreen(SCREENS.WEAPONS_GARAGE); });
      this._on('btn-menu-loadout', 'click', () => { playClick(); this.showScreen(SCREENS.LOADOUT); });
      this._on('btn-menu-career', 'click', () => { playClick(); this.showScreen(SCREENS.CAREER); });
      this._on('btn-menu-settings', 'click', () => { playClick(); this.showScreen(SCREENS.SETTINGS); });

      // Back buttons on sub-screens
      this._on('btn-back-from-modes', 'click', () => { playClick(); this.showScreen(SCREENS.MAIN_MENU); });
      this._on('btn-back-from-arenas', 'click', () => { playClick(); this.showScreen(SCREENS.GAME_MODES); });
      this._on('btn-back-from-missions', 'click', () => { playClick(); this.showScreen(SCREENS.MAIN_MENU); });

      document.querySelectorAll('.btn-back-menu').forEach(btn => {
        if (btn.id !== 'btn-back-from-modes' && btn.id !== 'btn-back-from-arenas') {
          btn.addEventListener('click', () => { playClick(); this.showScreen(SCREENS.MAIN_MENU); });
        }
      });
    }

    showScreen(screenId) {
      Object.keys(this.screens).forEach(id => {
        if (this.screens[id]) {
          this.screens[id].style.display = (id === screenId) ? 'flex' : 'none';
        }
      });

      this.currentScreen = screenId;
      this.updateHeaderCurrencies();

      // Music context switching
      if (IT.AudioManager) {
        if (screenId === SCREENS.BATTLE) {
          IT.AudioManager.startMusic('BATTLE');
        } else if (screenId !== SCREENS.LOADING) {
          IT.AudioManager.startMusic('HANGAR');
        }
      }
      this.updateHeaderCurrencies();

      // Manage 3D Garage preview vs Battle Arena
      if (screenId === SCREENS.BATTLE) {
        if (this.garageScene) this.garageScene.hide();
      } else {
        if (this.garageScene) this.garageScene.show();

        if (screenId === SCREENS.MECH_GARAGE || screenId === SCREENS.MAIN_MENU || screenId === SCREENS.LOADOUT) {
          const loadout = IT.SaveManager.getLoadout();
          const mechToInspect = screenId === SCREENS.MECH_GARAGE ? this.selectedInspectMechId : loadout.mechId;
          this.garageScene.previewMech(mechToInspect, loadout.primaryId, loadout.secondaryId);
          if (screenId === SCREENS.MECH_GARAGE) this._renderMechInspectCard(this.selectedInspectMechId);
          if (screenId === SCREENS.LOADOUT) this._renderLoadoutSummary();
        } else if (screenId === SCREENS.WEAPONS_GARAGE) {
          this.garageScene.previewWeapon(this.selectedInspectWeaponId);
          this._renderWeaponInspectCard(this.selectedInspectWeaponId);
        } else if (screenId === SCREENS.CAREER) {
          this._renderCareerStats();
        }
      }
    }

    updateHeaderCurrencies() {
      const credits = IT.SaveManager.credits;
      const level = IT.SaveManager.playerLevel;
      const xp = IT.SaveManager.playerXP;
      const needed = IT.SaveManager.getXPRequiredForLevel(level);

      if (this.headerCredits) this.headerCredits.textContent = credits.toLocaleString();
      if (this.headerLevel) this.headerLevel.textContent = level;
      if (this.headerXPBar) {
        const pct = Math.min(100, Math.round((xp / needed) * 100));
        this.headerXPBar.style.width = `${pct}%`;
        const xpText = document.getElementById('menu-xp-text');
        if (xpText) xpText.textContent = `${xp} / ${needed} XP`;
      }
    }

    // ── GAME MODE SELECTION ──
    _bindGameModeEvents() {
      const modeCards = document.querySelectorAll('.mode-card');
      const curMode = IT.SaveManager.preferredMode || 'SKIRMISH';

      modeCards.forEach(card => {
        const modeId = card.getAttribute('data-mode');
        if (modeId === curMode) card.classList.add('selected');
        else card.classList.remove('selected');

        card.addEventListener('click', () => {
          modeCards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          IT.SaveManager.preferredMode = modeId;

          setTimeout(() => {
            this.showScreen(SCREENS.ARENA_SELECT);
          }, 150);
        });
      });
    }

    // ── ARENA SELECTION ──
    _bindArenaSelectEvents() {
      const arenaCards = document.querySelectorAll('.arena-card');
      const curArena = IT.SaveManager.preferredArena || 'NEON_FORGE';

      arenaCards.forEach(card => {
        const arenaId = card.getAttribute('data-arena');
        if (arenaId === curArena) card.classList.add('selected');
        else card.classList.remove('selected');

        card.addEventListener('click', () => {
          arenaCards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          IT.SaveManager.preferredArena = arenaId;

          setTimeout(() => {
            this.showScreen(SCREENS.LOADOUT);
          }, 150);
        });
      });
    }

    // ── MECH GARAGE & SELECTION ──
    _bindMechGarageEvents() {
      const listContainer = document.getElementById('mech-selection-list');
      if (!listContainer) return;

      const mechs = IT.MechRegistry.getAll();
      listContainer.innerHTML = '';

      mechs.forEach(m => {
        const card = document.createElement('div');
        card.className = 'mech-select-card';
        card.id = `mech-card-${m.id}`;
        card.innerHTML = `
          <div class="mech-card-header">
            <span class="mech-card-name">${m.name}</span>
            <span class="mech-card-role badge">${m.role}</span>
          </div>
          <div class="mech-card-status" id="mech-status-${m.id}"></div>
        `;

        card.addEventListener('click', () => {
          this.selectedInspectMechId = m.id;
          document.querySelectorAll('.mech-select-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');

          const loadout = IT.SaveManager.getLoadout();
          this.garageScene.previewMech(m.id, loadout.primaryId, loadout.secondaryId);
          this._renderMechInspectCard(m.id);
        });

        listContainer.appendChild(card);
      });

      // Select / Equip Button
      this._on('btn-mech-equip', 'click', () => {
        if (!IT.SaveManager.isMechUnlocked(this.selectedInspectMechId)) return;
        IT.SaveManager.setLoadout({ mechId: this.selectedInspectMechId });
        this._renderMechInspectCard(this.selectedInspectMechId);
      });

      // Upgrade Button
      this._on('btn-mech-upgrade', 'click', () => {
        this._openMechUpgradeModal(this.selectedInspectMechId);
      });
    }

    _renderMechInspectCard(mechId) {
      const isUnlocked = IT.SaveManager.isMechUnlocked(mechId);
      const curLvl = IT.SaveManager.getMechLevel(mechId);
      const stats = IT.MechRegistry.getStatsForLevel(mechId, curLvl);
      const loadout = IT.SaveManager.getLoadout();
      const isEquipped = loadout.mechId === mechId;

      const nameEl = document.getElementById('mech-inspect-name');
      const roleEl = document.getElementById('mech-inspect-role');
      const lvlEl = document.getElementById('mech-inspect-level');
      const descEl = document.getElementById('mech-inspect-desc');
      const abilityNameEl = document.getElementById('mech-inspect-ability-name');
      const abilityDescEl = document.getElementById('mech-inspect-ability-desc');

      if (nameEl) nameEl.textContent = stats.name;
      if (roleEl) roleEl.textContent = stats.role;
      if (lvlEl) lvlEl.textContent = `LEVEL ${curLvl}`;
      if (descEl) descEl.textContent = stats.description || '';
      if (abilityNameEl) abilityNameEl.textContent = stats.abilityName;
      if (abilityDescEl) abilityDescEl.textContent = stats.abilityDesc;

      // Stat bars
      this._setBar('mech-bar-hp', stats.maxHp, 7000, `${stats.maxHp} HP`);
      this._setBar('mech-bar-shield', stats.maxShield, 3500, `${stats.maxShield} SHIELD`);
      this._setBar('mech-bar-speed', stats.speed, 25, `${stats.speed} SPEED`);
      this._setBar('mech-bar-armor', stats.damageReduction * 100, 30, `${stats.armorRating}`);

      // Equip button state
      const btnEquip = document.getElementById('btn-mech-equip');
      const btnUpgrade = document.getElementById('btn-mech-upgrade');

      if (btnEquip) {
        if (!isUnlocked) {
          btnEquip.textContent = `🔒 UNLOCK AT LEVEL ${stats.unlockLevel}`;
          btnEquip.className = 'btn-pill locked';
          btnEquip.disabled = true;
        } else if (isEquipped) {
          btnEquip.textContent = '✓ EQUIPPED';
          btnEquip.className = 'btn-pill equipped';
          btnEquip.disabled = true;
        } else {
          btnEquip.textContent = 'SELECT MECH';
          btnEquip.className = 'btn-pill active-glow';
          btnEquip.disabled = false;
        }
      }

      if (btnUpgrade) {
        if (!isUnlocked) {
          btnUpgrade.style.display = 'none';
        } else {
          btnUpgrade.style.display = 'block';
          const cost = IT.MechRegistry.getUpgradeCost(curLvl);
          btnUpgrade.textContent = cost ? `UPGRADE (${cost} C)` : 'MAX LEVEL';
          btnUpgrade.disabled = !cost;
        }
      }
    }

    _openMechUpgradeModal(mechId) {
      const curLvl = IT.SaveManager.getMechLevel(mechId);
      if (curLvl >= 10) return;

      const curStats = IT.MechRegistry.getStatsForLevel(mechId, curLvl);
      const nextStats = IT.MechRegistry.getStatsForLevel(mechId, curLvl + 1);
      const cost = IT.MechRegistry.getUpgradeCost(curLvl);

      const modal = this.upgradeModal;
      if (!modal) return;
      modal.style.display = 'flex';

      const title = document.getElementById('upgrade-modal-title');
      const body = document.getElementById('upgrade-modal-body');
      const btnConfirm = document.getElementById('btn-upgrade-confirm');
      const btnCancel = document.getElementById('btn-upgrade-cancel');

      if (title) title.textContent = `UPGRADE ${curStats.name}`;
      if (body) {
        body.innerHTML = `
          <div class="upgrade-row">
            <span>LEVEL:</span>
            <span class="val-change">${curLvl} ➔ <b class="highlight">${curLvl + 1}</b></span>
          </div>
          <div class="upgrade-row">
            <span>HULL INTEGRITY:</span>
            <span class="val-change">${curStats.maxHp} ➔ <b class="highlight">${nextStats.maxHp}</b></span>
          </div>
          <div class="upgrade-row">
            <span>SHIELD CAPACITY:</span>
            <span class="val-change">${curStats.maxShield} ➔ <b class="highlight">${nextStats.maxShield}</b></span>
          </div>
          <div class="upgrade-row">
            <span>TOP SPEED:</span>
            <span class="val-change">${curStats.speed} ➔ <b class="highlight">${nextStats.speed}</b></span>
          </div>
          <div class="upgrade-cost-row">
            <span>UPGRADE COST:</span>
            <span class="cost-val"><b class="cost-credits">${cost}</b> CREDITS</span>
          </div>
        `;
      }

      btnConfirm.onclick = () => {
        const res = IT.SaveManager.upgradeMech(mechId);
        if (res.success) {
          modal.style.display = 'none';
          this.updateHeaderCurrencies();
          this._renderMechInspectCard(mechId);
          this._showToast(`UPGRADE SUCCESSFUL! ${curStats.name} IS NOW LEVEL ${res.newLevel}`);
        } else {
          this._showToast(res.reason || 'UPGRADE FAILED');
        }
      };

      btnCancel.onclick = () => {
        modal.style.display = 'none';
      };
    }

    // ── WEAPON GARAGE & SELECTION ──
    _bindWeaponGarageEvents() {
      const listContainer = document.getElementById('weapon-selection-list');
      if (!listContainer) return;

      const weapons = IT.WeaponRegistry.getAll();
      listContainer.innerHTML = '';

      weapons.forEach(w => {
        const card = document.createElement('div');
        card.className = 'weapon-select-card';
        card.id = `weapon-card-${w.id}`;
        card.innerHTML = `
          <div class="weapon-card-header">
            <span class="weapon-card-name">${w.name}</span>
            <span class="weapon-card-type badge">${w.slotType}</span>
          </div>
          <div class="weapon-card-status" id="weapon-status-${w.id}"></div>
        `;

        card.addEventListener('click', () => {
          this.selectedInspectWeaponId = w.id;
          document.querySelectorAll('.weapon-select-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');

          this.garageScene.previewWeapon(w.id);
          this._renderWeaponInspectCard(w.id);
        });

        listContainer.appendChild(card);
      });

      // Equip Buttons
      this._on('btn-weapon-equip-primary', 'click', () => {
        if (!IT.SaveManager.isWeaponUnlocked(this.selectedInspectWeaponId)) return;
        IT.SaveManager.setLoadout({ primaryId: this.selectedInspectWeaponId });
        this._renderWeaponInspectCard(this.selectedInspectWeaponId);
        this._showToast(`EQUIPPED ${this.selectedInspectWeaponId.toUpperCase()} AS PRIMARY`);
      });

      this._on('btn-weapon-equip-secondary', 'click', () => {
        if (!IT.SaveManager.isWeaponUnlocked(this.selectedInspectWeaponId)) return;
        IT.SaveManager.setLoadout({ secondaryId: this.selectedInspectWeaponId });
        this._renderWeaponInspectCard(this.selectedInspectWeaponId);
        this._showToast(`EQUIPPED ${this.selectedInspectWeaponId.toUpperCase()} AS SECONDARY`);
      });

      // Upgrade Button
      this._on('btn-weapon-upgrade', 'click', () => {
        this._openWeaponUpgradeModal(this.selectedInspectWeaponId);
      });
    }

    _renderWeaponInspectCard(weaponId) {
      const isUnlocked = IT.SaveManager.isWeaponUnlocked(weaponId);
      const curLvl = IT.SaveManager.getWeaponLevel(weaponId);
      const stats = IT.WeaponRegistry.getStatsForLevel(weaponId, curLvl);
      const loadout = IT.SaveManager.getLoadout();

      const nameEl = document.getElementById('weapon-inspect-name');
      const typeEl = document.getElementById('weapon-inspect-type');
      const lvlEl = document.getElementById('weapon-inspect-level');
      const descEl = document.getElementById('weapon-inspect-desc');

      if (nameEl) nameEl.textContent = stats.name;
      if (typeEl) typeEl.textContent = stats.slotType;
      if (lvlEl) lvlEl.textContent = `LEVEL ${curLvl}`;
      if (descEl) descEl.textContent = stats.description || '';

      // Stats bars
      this._setBar('wep-bar-dmg', stats.damage, 200, `${stats.damage} DMG`);
      this._setBar('wep-bar-rate', 3.0 - stats.fireRate, 3.0, `${stats.fireRate}s`);
      this._setBar('wep-bar-mag', stats.magazine, 50, `${stats.magazine} RDS`);
      this._setBar('wep-bar-reload', 3.5 - stats.reloadTime, 3.5, `${stats.reloadTime}s`);

      const btnPrimary = document.getElementById('btn-weapon-equip-primary');
      const btnSecondary = document.getElementById('btn-weapon-equip-secondary');
      const btnUpgrade = document.getElementById('btn-weapon-upgrade');

      if (!isUnlocked) {
        if (btnPrimary) {
          btnPrimary.textContent = `🔒 UNLOCK AT LEVEL ${stats.unlockLevel}`;
          btnPrimary.disabled = true;
          btnPrimary.className = 'btn-pill locked';
        }
        if (btnSecondary) btnSecondary.style.display = 'none';
        if (btnUpgrade) btnUpgrade.style.display = 'none';
      } else {
        if (btnSecondary) btnSecondary.style.display = 'inline-block';
        if (btnUpgrade) btnUpgrade.style.display = 'inline-block';

        if (btnPrimary) {
          const isPri = loadout.primaryId === weaponId;
          btnPrimary.textContent = isPri ? '✓ PRIMARY EQUIPPED' : 'EQUIP PRIMARY';
          btnPrimary.className = isPri ? 'btn-pill equipped' : 'btn-pill active-glow';
          btnPrimary.disabled = isPri;
        }

        if (btnSecondary) {
          const isSec = loadout.secondaryId === weaponId;
          btnSecondary.textContent = isSec ? '✓ SECONDARY EQUIPPED' : 'EQUIP SECONDARY';
          btnSecondary.className = isSec ? 'btn-pill equipped' : 'btn-pill active-glow';
          btnSecondary.disabled = isSec;
        }

        if (btnUpgrade) {
          const cost = IT.WeaponRegistry.getUpgradeCost(curLvl);
          btnUpgrade.textContent = cost ? `UPGRADE (${cost} C)` : 'MAX LEVEL';
          btnUpgrade.disabled = !cost;
        }
      }
    }

    _openWeaponUpgradeModal(weaponId) {
      const curLvl = IT.SaveManager.getWeaponLevel(weaponId);
      if (curLvl >= 10) return;

      const curStats = IT.WeaponRegistry.getStatsForLevel(weaponId, curLvl);
      const nextStats = IT.WeaponRegistry.getStatsForLevel(weaponId, curLvl + 1);
      const cost = IT.WeaponRegistry.getUpgradeCost(curLvl);

      const modal = this.upgradeModal;
      if (!modal) return;
      modal.style.display = 'flex';

      const title = document.getElementById('upgrade-modal-title');
      const body = document.getElementById('upgrade-modal-body');
      const btnConfirm = document.getElementById('btn-upgrade-confirm');
      const btnCancel = document.getElementById('btn-upgrade-cancel');

      if (title) title.textContent = `UPGRADE ${curStats.name}`;
      if (body) {
        body.innerHTML = `
          <div class="upgrade-row">
            <span>TIER:</span>
            <span class="val-change">LEVEL ${curLvl} ➔ <b class="highlight">LEVEL ${curLvl + 1}</b></span>
          </div>
          <div class="upgrade-row">
            <span>DAMAGE PER SHOT:</span>
            <span class="val-change">${curStats.damage} ➔ <b class="highlight">${nextStats.damage}</b></span>
          </div>
          <div class="upgrade-row">
            <span>MAGAZINE CAPACITY:</span>
            <span class="val-change">${curStats.magazine} ➔ <b class="highlight">${nextStats.magazine}</b></span>
          </div>
          <div class="upgrade-row">
            <span>RELOAD TIME:</span>
            <span class="val-change">${curStats.reloadTime}s ➔ <b class="highlight">${nextStats.reloadTime}s</b></span>
          </div>
          <div class="upgrade-cost-row">
            <span>UPGRADE COST:</span>
            <span class="cost-val"><b class="cost-credits">${cost}</b> CREDITS</span>
          </div>
        `;
      }

      btnConfirm.onclick = () => {
        const res = IT.SaveManager.upgradeWeapon(weaponId);
        if (res.success) {
          modal.style.display = 'none';
          this.updateHeaderCurrencies();
          this._renderWeaponInspectCard(weaponId);
          this._showToast(`UPGRADE SUCCESSFUL! ${curStats.name} IS NOW LEVEL ${res.newLevel}`);
        } else {
          this._showToast(res.reason || 'UPGRADE FAILED');
        }
      };

      btnCancel.onclick = () => {
        modal.style.display = 'none';
      };
    }

    // ── LOADOUT SCREEN & BATTLE VALIDATION ──
    _bindLoadoutEvents() {
      this._on('btn-start-battle', 'click', () => {
        const loadout = IT.SaveManager.getLoadout();

        // Validate battle loadout
        const mech = IT.MechRegistry.get(loadout.mechId);
        const pri = IT.WeaponRegistry.get(loadout.primaryId);
        const sec = IT.WeaponRegistry.get(loadout.secondaryId);

        if (!mech || !pri || !sec) {
          this._showToast('INVALID LOADOUT: MISSING EQUIPMENT');
          return;
        }

        // Trigger simulated matchmaking countdown
        this._triggerMatchmaking(loadout);
      });
    }

    _triggerMatchmaking(loadout) {
      this.showScreen(SCREENS.LOADING);
      if (IT.AudioManager) {
        IT.AudioManager.playUI('MATCH_FOUND');
      }

      const statusEl = document.getElementById('loading-status-text');
      const fillEl = document.getElementById('loading-bar-fill');
      const tipEl = document.getElementById('loading-tip-text');

      const tips = [
        'TACTICAL TIP: Targeting rear reactor cores scores 1.75x critical damage.',
        'TACTICAL TIP: Sensor masts and head optics score 1.5x critical damage.',
        'TACTICAL TIP: Kinetic autocannons deliver devastating single-target punch.',
        'TACTICAL TIP: Scatter blasters are lethal in close-quarters skirmishes.',
        'TACTICAL TIP: Keep moving to make tracking harder for enemy lock-on systems.',
        'TACTICAL TIP: Heavy mechs have larger hitboxes but possess high-durability armor.'
      ];
      if (tipEl) {
        tipEl.textContent = tips[Math.floor(Math.random() * tips.length)];
      }

      const stages = [
        { pct: 25, text: 'INITIALIZING WEAPON SYSTEMS...', sound: 'COUNTDOWN' },
        { pct: 55, text: 'CONNECTING SENSOR ARRAYS...', sound: 'COUNTDOWN' },
        { pct: 85, text: 'ENGAGING COMBAT PROTOCOLS...', sound: 'COUNTDOWN' },
        { pct: 100, text: 'DEPLOYING TO BATTLE...', sound: 'DEPLOY' }
      ];

      let stageIdx = 0;
      if (fillEl) fillEl.style.width = '10%';
      if (statusEl) statusEl.textContent = 'ESTABLISHING ARENA UPLINK...';

      const interval = setInterval(() => {
        if (stageIdx < stages.length) {
          const st = stages[stageIdx];
          if (fillEl) fillEl.style.width = `${st.pct}%`;
          if (statusEl) statusEl.textContent = st.text;
          if (IT.AudioManager) IT.AudioManager.playUI(st.sound);
          stageIdx++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            if (IT.AudioManager) IT.AudioManager.startMusic('BATTLE');
            this._launchBattle(loadout);
          }, 200);
        }
      }, 350);
    }

    _launchBattle(loadout) {
      this.showScreen(SCREENS.BATTLE);
      if (this.onStartBattle) {
        let arenaId = IT.SaveManager.preferredArena || 'NEON_FORGE';
        if (arenaId === 'RANDOM') {
          const arenas = ['NEON_FORGE', 'TITAN_DOCKS', 'ASHEN_REACTOR'];
          arenaId = arenas[Math.floor(Math.random() * arenas.length)];
        }
        const modeId = IT.SaveManager.preferredMode || 'SKIRMISH';
        this.onStartBattle(loadout, modeId, arenaId);
      }
    }

    _renderLoadoutSummary() {
      const loadout = IT.SaveManager.getLoadout();
      const mechDef = IT.MechRegistry.get(loadout.mechId);
      const priDef = IT.WeaponRegistry.get(loadout.primaryId);
      const secDef = IT.WeaponRegistry.get(loadout.secondaryId);

      const mechLvl = IT.SaveManager.getMechLevel(loadout.mechId);
      const priLvl = IT.SaveManager.getWeaponLevel(loadout.primaryId);
      const secLvl = IT.SaveManager.getWeaponLevel(loadout.secondaryId);

      const mName = document.getElementById('loadout-mech-name');
      const mRole = document.getElementById('loadout-mech-role');
      const pName = document.getElementById('loadout-pri-name');
      const sName = document.getElementById('loadout-sec-name');
      const aName = document.getElementById('loadout-ability-name');

      if (mName) mName.textContent = `${mechDef.name} (LVL ${mechLvl})`;
      if (mRole) mRole.textContent = mechDef.role;
      if (pName) pName.textContent = `${priDef.name} (LVL ${priLvl})`;
      if (sName) sName.textContent = `${secDef.name} (LVL ${secLvl})`;
      if (aName) aName.textContent = mechDef.abilityName;
    }

    // ── CAREER STATS ──
    _bindCareerEvents() {}

    // ── SETTINGS CONFIGURATION ──
    _bindSettingsEvents() {
      const s = IT.SaveManager.settings || {};
      const toPct = (val, def) => {
        if (val === undefined || val === null) return def;
        return val <= 1.0 ? Math.round(val * 100) : Math.round(val);
      };

      // Master Volume
      const slMaster = document.getElementById('setting-slider-master');
      const lblMaster = document.getElementById('setting-lbl-master');
      if (slMaster && lblMaster) {
        slMaster.value = toPct(s.masterVolume, 80);
        lblMaster.textContent = `${slMaster.value}%`;
        slMaster.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          lblMaster.textContent = `${val}%`;
          if (IT.AudioManager) IT.AudioManager.setMasterVolume(val / 100);
          IT.SaveManager.updateSettings({ masterVolume: val });
        });
      }

      // Music Volume
      const slMusic = document.getElementById('setting-slider-music');
      const lblMusic = document.getElementById('setting-lbl-music');
      if (slMusic && lblMusic) {
        slMusic.value = toPct(s.musicVolume, 60);
        lblMusic.textContent = `${slMusic.value}%`;
        slMusic.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          lblMusic.textContent = `${val}%`;
          if (IT.AudioManager) IT.AudioManager.setMusicVolume(val / 100);
          IT.SaveManager.updateSettings({ musicVolume: val });
        });
      }

      // SFX Volume
      const slSfx = document.getElementById('setting-slider-sfx');
      const lblSfx = document.getElementById('setting-lbl-sfx');
      if (slSfx && lblSfx) {
        slSfx.value = toPct(s.sfxVolume, 85);
        lblSfx.textContent = `${slSfx.value}%`;
        slSfx.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          lblSfx.textContent = `${val}%`;
          if (IT.AudioManager) IT.AudioManager.setSfxVolume(val / 100);
          IT.SaveManager.updateSettings({ sfxVolume: val });
        });
      }

      // UI Volume
      const slUi = document.getElementById('setting-slider-ui');
      const lblUi = document.getElementById('setting-lbl-ui');
      if (slUi && lblUi) {
        slUi.value = toPct(s.uiVolume, 75);
        lblUi.textContent = `${slUi.value}%`;
        slUi.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          lblUi.textContent = `${val}%`;
          if (IT.AudioManager) IT.AudioManager.setUIVolume(val / 100);
          IT.SaveManager.updateSettings({ uiVolume: val });
        });
      }

      // Mute Toggle
      const btnMute = document.getElementById('setting-btn-mute');
      if (btnMute) {
        btnMute.textContent = s.muted ? 'MUTED' : 'UNMUTED';
        if (s.muted) btnMute.classList.add('active');
        btnMute.addEventListener('click', () => {
          const nowMuted = !IT.SaveManager.settings.muted;
          btnMute.textContent = nowMuted ? 'MUTED' : 'UNMUTED';
          if (nowMuted) btnMute.classList.add('active');
          else btnMute.classList.remove('active');
          if (IT.AudioManager) IT.AudioManager.setMuted(nowMuted);
          IT.SaveManager.updateSettings({ muted: nowMuted });
          if (IT.AudioManager) IT.AudioManager.playUI('TOGGLE');
        });
      }

      // Graphics Presets
      const btnGraphics = document.getElementById('setting-btn-graphics');
      const graphicsModes = ['LOW', 'MEDIUM', 'HIGH', 'AUTO'];
      if (btnGraphics) {
        btnGraphics.textContent = s.graphicsPreset || 'HIGH';
        btnGraphics.addEventListener('click', () => {
          let curIdx = graphicsModes.indexOf(btnGraphics.textContent);
          let nextIdx = (curIdx + 1) % graphicsModes.length;
          const nextVal = graphicsModes[nextIdx];
          btnGraphics.textContent = nextVal;
          IT.SaveManager.updateSettings({ graphicsPreset: nextVal });
          if (IT._main3D && IT._main3D.engine && IT._main3D.engine.setGraphicsPreset) {
            IT._main3D.engine.setGraphicsPreset(nextVal);
          }
          if (IT._activeVFXManager && IT._activeVFXManager.setGraphicsPreset) {
            IT._activeVFXManager.setGraphicsPreset(nextVal);
          }
          if (IT.AudioManager) IT.AudioManager.playUI('SELECT');
        });
      }

      // FPS Performance Monitor
      const btnFps = document.getElementById('setting-btn-fps');
      if (btnFps) {
        btnFps.textContent = s.showFPS ? 'ON' : 'OFF';
        if (s.showFPS) btnFps.classList.add('active');
        btnFps.addEventListener('click', () => {
          const nowShow = !IT.SaveManager.settings.showFPS;
          btnFps.textContent = nowShow ? 'ON' : 'OFF';
          if (nowShow) btnFps.classList.add('active');
          else btnFps.classList.remove('active');
          IT.SaveManager.updateSettings({ showFPS: nowShow });
          const fpsEl = document.getElementById('debug-fps-counter');
          if (fpsEl) fpsEl.style.display = nowShow ? 'block' : 'none';
          if (IT.AudioManager) IT.AudioManager.playUI('TOGGLE');
        });
      }

      // Screen Shake
      const btnShake = document.getElementById('setting-btn-shake');
      const shakeLevels = ['OFF', 'LOW', 'MEDIUM', 'HIGH'];
      if (btnShake) {
        btnShake.textContent = s.screenShake || 'MEDIUM';
        btnShake.addEventListener('click', () => {
          let curIdx = shakeLevels.indexOf(btnShake.textContent);
          let nextIdx = (curIdx + 1) % shakeLevels.length;
          const nextVal = shakeLevels[nextIdx];
          btnShake.textContent = nextVal;
          IT.SaveManager.updateSettings({ screenShake: nextVal });
          if (IT._activeCamera && IT._activeCamera.setShakeLevel) IT._activeCamera.setShakeLevel(nextVal);
          if (IT.AudioManager) IT.AudioManager.playUI('SELECT');
        });
      }

      // UI Scale
      const btnUiScale = document.getElementById('setting-btn-uiscale');
      const scaleLevels = ['SMALL', 'MEDIUM', 'LARGE'];
      if (btnUiScale) {
        btnUiScale.textContent = s.uiScale || 'MEDIUM';
        btnUiScale.addEventListener('click', () => {
          let curIdx = scaleLevels.indexOf(btnUiScale.textContent);
          let nextIdx = (curIdx + 1) % scaleLevels.length;
          const nextVal = scaleLevels[nextIdx];
          btnUiScale.textContent = nextVal;
          IT.SaveManager.updateSettings({ uiScale: nextVal });
          document.body.classList.remove('scale-small', 'scale-medium', 'scale-large');
          document.body.classList.add(`scale-${nextVal.toLowerCase()}`);
          if (IT.AudioManager) IT.AudioManager.playUI('SELECT');
        });
      }

      // Crosshair Size
      const btnCrosshair = document.getElementById('setting-btn-crosshair');
      const crossSizes = ['SMALL', 'MEDIUM', 'LARGE'];
      if (btnCrosshair) {
        btnCrosshair.textContent = s.crosshairSize || 'MEDIUM';
        btnCrosshair.addEventListener('click', () => {
          let curIdx = crossSizes.indexOf(btnCrosshair.textContent);
          let nextIdx = (curIdx + 1) % crossSizes.length;
          const nextVal = crossSizes[nextIdx];
          btnCrosshair.textContent = nextVal;
          IT.SaveManager.updateSettings({ crosshairSize: nextVal });
          const chEl = document.getElementById('hud-crosshair');
          if (chEl) {
            chEl.classList.remove('crosshair-sm', 'crosshair-md', 'crosshair-lg');
            if (nextVal === 'SMALL') chEl.classList.add('crosshair-sm');
            else if (nextVal === 'LARGE') chEl.classList.add('crosshair-lg');
            else chEl.classList.add('crosshair-md');
          }
          if (IT.AudioManager) IT.AudioManager.playUI('SELECT');
        });
      }

      // Colorblind Mode
      const btnColorblind = document.getElementById('setting-btn-colorblind');
      const cbModes = ['DEFAULT', 'PROTANOPIA', 'DEUTERANOPIA', 'TRITANOPIA'];
      if (btnColorblind) {
        btnColorblind.textContent = s.colorblindMode || 'DEFAULT';
        btnColorblind.addEventListener('click', () => {
          let curIdx = cbModes.indexOf(btnColorblind.textContent);
          let nextIdx = (curIdx + 1) % cbModes.length;
          const nextVal = cbModes[nextIdx];
          btnColorblind.textContent = nextVal;
          IT.SaveManager.updateSettings({ colorblindMode: nextVal });
          document.body.classList.remove('cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia');
          if (nextVal !== 'DEFAULT') {
            document.body.classList.add(`cb-${nextVal.toLowerCase()}`);
          }
          if (IT.MaterialSystem && IT.MaterialSystem.setColorblindMode) IT.MaterialSystem.setColorblindMode(nextVal);
          if (IT.AudioManager) IT.AudioManager.playUI('SELECT');
        });
      }

      // Haptic Vibration Toggle
      const btnVibe = document.getElementById('setting-btn-vibe');
      if (btnVibe) {
        btnVibe.textContent = s.vibration !== false ? 'ENABLED' : 'DISABLED';
        btnVibe.addEventListener('click', () => {
          const nextVal = !(IT.SaveManager.settings.vibration !== false);
          btnVibe.textContent = nextVal ? 'ENABLED' : 'DISABLED';
          IT.SaveManager.updateSettings({ vibration: nextVal });
          if (IT._main3D && IT._main3D.hud) IT._main3D.hud.vibrationEnabled = nextVal;
          if (IT.AudioManager) IT.AudioManager.playUI('TOGGLE');
        });
      }

      // Damage Numbers Toggle
      const btnDmgNums = document.getElementById('setting-btn-damagenumbers');
      if (btnDmgNums) {
        btnDmgNums.textContent = s.showDamageNumbers !== false ? 'ENABLED' : 'DISABLED';
        btnDmgNums.addEventListener('click', () => {
          const nextVal = !(IT.SaveManager.settings.showDamageNumbers !== false);
          btnDmgNums.textContent = nextVal ? 'ENABLED' : 'DISABLED';
          IT.SaveManager.updateSettings({ showDamageNumbers: nextVal });
          if (IT.AudioManager) IT.AudioManager.playUI('TOGGLE');
        });
      }

      // Export Save Data
      const btnExport = document.getElementById('setting-btn-export-save');
      if (btnExport) {
        btnExport.addEventListener('click', () => {
          const json = IT.SaveManager.exportSave();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(() => {
              this.showToast('SAVE COPIED', 'Progression JSON copied to clipboard!', '💾');
            }).catch(() => {
              prompt('Copy your save data JSON below:', json);
            });
          } else {
            prompt('Copy your save data JSON below:', json);
          }
          if (IT.AudioManager) IT.AudioManager.playUI('SELECT');
        });
      }

      // Import Save Data
      const btnImport = document.getElementById('setting-btn-import-save');
      if (btnImport) {
        btnImport.addEventListener('click', () => {
          const input = prompt('Paste your Iron Titans save JSON below:');
          if (input) {
            const res = IT.SaveManager.importSave(input);
            if (res.success) {
              this.showToast('SAVE RESTORED', 'Progression successfully loaded!', '✅');
              this.updateHeaderCurrencies();
              this._bindSettingsEvents();
            } else {
              alert('Failed to import save: ' + res.error);
            }
          }
        });
      }

      // Reset Progression
      const btnReset = document.getElementById('setting-btn-reset-save');
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          if (confirm('Are you sure you want to reset all game progression? This cannot be undone.')) {
            IT.SaveManager.reset();
            this.updateHeaderCurrencies();
            this.showToast('PROGRESSION RESET', 'Save file reset to factory defaults.', '⚠️');
            this._bindSettingsEvents();
          }
        });
      }

      // ── Phase 10: Fullscreen & PWA Install ──
      const btnFullscreen = document.getElementById('setting-btn-fullscreen');
      if (btnFullscreen) {
        btnFullscreen.addEventListener('click', () => {
          if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(() => {});
            }
            btnFullscreen.textContent = 'EXIT';
          } else {
            if (document.exitFullscreen) {
              document.exitFullscreen().catch(() => {});
            }
            btnFullscreen.textContent = 'TOGGLE';
          }
          if (IT.AudioManager) IT.AudioManager.playUI('TOGGLE');
        });
      }

      const btnInstall = document.getElementById('setting-btn-install');
      if (btnInstall) {
        btnInstall.addEventListener('click', async () => {
          if (window.deferredInstallPrompt) {
            window.deferredInstallPrompt.prompt();
            const choice = await window.deferredInstallPrompt.userChoice;
            console.log('[PWA] User response to install:', choice.outcome);
            window.deferredInstallPrompt = null;
            const row = document.getElementById('setting-row-install');
            if (row) row.style.display = 'none';
          } else {
            this._showToast('PWA CAN BE INSTALLED FROM BROWSER MENU');
          }
        });
      }

      const envLabel = document.getElementById('setting-env-label');
      if (envLabel) {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(window.navigator.standalone);
        envLabel.textContent = isStandalone ? 'STANDALONE APP' : 'WEB BROWSER (RELEASE)';
      }
    }

    _renderCareerStats() {
      const c = IT.SaveManager.career;
      const winRate = c.matchesPlayed > 0 ? Math.round((c.victories / c.matchesPlayed) * 100) : 0;
      const kd = c.deaths > 0 ? (c.kills / c.deaths).toFixed(2) : c.kills.toFixed(2);

      this._setText('career-level', `LEVEL ${IT.SaveManager.playerLevel}`);
      this._setText('career-matches', c.matchesPlayed);
      this._setText('career-wins', c.victories);
      this._setText('career-losses', c.defeats);
      this._setText('career-winrate', `${winRate}%`);
      this._setText('career-kills', c.kills);
      this._setText('career-deaths', c.deaths);
      this._setText('career-kd', kd);
      this._setText('career-assists', c.assists);
      this._setText('career-dmg-dealt', c.damageDealt.toLocaleString());
      this._setText('career-credits', `${IT.SaveManager.credits.toLocaleString()} C`);

      // Objective & Streak stats
      this._setText('career-captures', c.objectiveCaptures || 0);
      this._setText('career-defenses', c.objectiveDefenses || 0);
      this._setText('career-obj-time', `${Math.round(c.objectiveTime || 0)}s`);
      this._setText('career-best-streak', c.bestStreak || 0);
      this._setText('career-best-score', c.bestScore || 0);
    }

    // ── MATCH REWARD SCREEN ──
    _bindRewardEvents() {
      this._on('btn-reward-play-again', 'click', () => {
        if (this.rewardModal) this.rewardModal.style.display = 'none';
        this.showScreen(SCREENS.LOADOUT);
      });

      this._on('btn-reward-garage', 'click', () => {
        if (this.rewardModal) this.rewardModal.style.display = 'none';
        this.showScreen(SCREENS.MECH_GARAGE);
      });

      this._on('btn-reward-menu', 'click', () => {
        if (this.rewardModal) this.rewardModal.style.display = 'none';
        this.showScreen(SCREENS.MAIN_MENU);
      });
    }

    showMatchRewards(result) {
      if (!this.rewardModal) return;
      this.rewardModal.style.display = 'flex';

      const won = result.playerWon;
      const kills = result.kills || 0;
      const assists = result.assists || 0;
      const captures = result.objectiveCaptures || 0;
      const defenses = result.objectiveDefenses || 0;
      const timeOnPoint = result.timeOnPoint || 0;
      const damage = Math.round(result.damageDealt || 0);
      const modeId = result.modeId || IT.SaveManager.preferredMode || 'SKIRMISH';
      const arenaId = result.arenaId || IT.SaveManager.preferredArena || 'NEON_FORGE';
      const bestStreak = result.bestStreak || 0;
      const score = result.score || 0;

      // Earnings calculation including objective performance
      const baseXP = won ? 400 : 180;
      const objXP = (captures * 75) + (defenses * 50);
      const xpEarned = baseXP + (kills * 40) + (assists * 20) + objXP;

      const baseCredits = won ? 500 : 250;
      const objCredits = (captures * 100) + (defenses * 60);
      const creditsEarned = baseCredits + (kills * 50) + (assists * 25) + objCredits;

      // Record in save manager
      const outcome = IT.SaveManager.recordMatchOutcome({
        won,
        kills,
        deaths: result.deaths || 0,
        assists,
        damageDealt: damage,
        damageTaken: result.damageTaken || 0,
        xpEarned,
        creditsEarned,
        modeId,
        arenaId,
        captures,
        defenses,
        timeOnPoint,
        score,
        bestStreak
      });

      this._setText('reward-title', won ? 'VICTORY' : (result.isDraw ? 'DRAW' : 'DEFEAT'));
      const titleEl = document.getElementById('reward-title');
      if (titleEl) {
        titleEl.className = `reward-title ${won ? 'win' : 'lose'}`;
      }

      this._setText('reward-kills-val', kills);
      this._setText('reward-assists-val', assists);
      this._setText('reward-objectives-val', captures + defenses);
      this._setText('reward-damage-val', damage.toLocaleString());
      this._setText('reward-xp-val', `+${xpEarned} XP`);
      this._setText('reward-credits-val', `+${creditsEarned} CREDITS`);
      this._setText('reward-new-credits', `${outcome.credits.toLocaleString()} C`);

      // Level-Up celebration notification
      const levelUpEl = document.getElementById('reward-levelup-banner');
      if (levelUpEl) {
        if (outcome.xpResult && outcome.xpResult.leveledUp) {
          levelUpEl.style.display = 'block';
          levelUpEl.innerHTML = `
            <div class="levelup-title">🎉 LEVEL UP! YOU ARE NOW LEVEL ${outcome.xpResult.newLevel}</div>
            ${outcome.xpResult.newUnlocks.map(u => `<div class="unlock-item">★ NEW UNLOCK: ${u.item.name} (${u.type})</div>`).join('')}
          `;
        } else {
          levelUpEl.style.display = 'none';
        }
      }

      this.updateHeaderCurrencies();
    }

    // ── Helper Utilities ──
    _setBar(id, val, max, label) {
      const bar = document.getElementById(id);
      if (!bar) return;
      const pct = Math.max(5, Math.min(100, Math.round((val / max) * 100)));
      bar.style.width = `${pct}%`;
      const txt = document.getElementById(`${id}-text`);
      if (txt) txt.textContent = label;
    }

    _setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    _on(id, evt, handler) {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evt, handler);
    }

    updateHeaderCurrencies() {
      if (!IT.SaveManager) return;
      const sm = IT.SaveManager;

      const credits = Number(sm.credits !== undefined ? sm.credits : (sm._data && sm._data.credits) || 0);
      const level = sm.playerLevel !== undefined ? sm.playerLevel : (sm._data && sm._data.playerLevel) || 1;
      const mats = Number(sm.materials !== undefined ? sm.materials : (sm._data && sm._data.upgradeMaterials) || 0);
      const tokens = Number(sm.tokens !== undefined ? sm.tokens : (sm._data && sm._data.achievementTokens) || 0);

      this._setText('menu-credits-val', credits.toLocaleString());
      this._setText('menu-level-val', level);
      this._setText('menu-mats-val', mats.toLocaleString());
      this._setText('menu-tokens-val', tokens.toLocaleString());

      const title = IT.Progression2 ? IT.Progression2.getTitleForLevel(level) : 'PILOT';
      this._setText('menu-pilot-title', title);

      const neededXP = sm.getXPRequiredForLevel ? sm.getXPRequiredForLevel(level) : 800;
      const curXP = Number(sm.playerXP !== undefined ? sm.playerXP : (sm._data && sm._data.playerXP) || 0);
      const pct = Math.min(100, Math.round((curXP / Math.max(1, neededXP)) * 100));

      const xpBar = document.getElementById('menu-xp-progress');
      if (xpBar) xpBar.style.width = `${pct}%`;
      this._setText('menu-xp-text', `${curXP.toLocaleString()} / ${neededXP.toLocaleString()} XP`);

      this.updateNotificationBadges();
    }

    updateNotificationBadges() {
      // Missions Unclaimed Badge
      const badgeMissions = document.getElementById('badge-missions');
      if (badgeMissions && IT.MissionManager) {
        const unclaimed = IT.MissionManager.getUnclaimedCount();
        if (unclaimed > 0) {
          badgeMissions.style.display = 'inline-block';
          badgeMissions.textContent = unclaimed;
        } else {
          badgeMissions.style.display = 'none';
        }
      }

      // Daily Reward Badge
      const badgeDaily = document.getElementById('badge-daily-reward');
      if (badgeDaily && IT.RewardManager) {
        const status = IT.RewardManager.checkDailyLogin();
        badgeDaily.style.display = (status && status.canClaim) ? 'inline-block' : 'none';
      }
    }

    // ── MULTIPLAYER MATCHMAKING (Phase 8) ──
    _bindMatchmakingEvents() {
      const playClick = () => {
        if (IT.AudioManager) IT.AudioManager.playUI('CLICK');
      };

      this._on('btn-menu-play-online', 'click', () => {
        playClick();
        this.openMatchmakingModal();
      });

      this._on('btn-cancel-matchmaking', 'click', () => {
        playClick();
        if (IT.NetworkManager && IT.NetworkManager.matchmaking) {
          IT.NetworkManager.matchmaking.cancelQueue();
        }
        const modal = document.getElementById('modal-matchmaking');
        if (modal) modal.style.display = 'none';
      });

      if (IT.NetworkManager && IT.NetworkManager.matchmaking) {
        IT.NetworkManager.matchmaking.onStatusChange = (status) => {
          this._updateMatchmakingUI(status);
        };
      }
    }

    openMatchmakingModal() {
      const modal = document.getElementById('modal-matchmaking');
      if (modal) modal.style.display = 'flex';

      // Reset slot visuals
      for (let i = 1; i <= 4; i++) {
        const bSlot = document.getElementById(`mm-slot-blue-${i}`);
        if (bSlot) {
          bSlot.className = 'mm-slot searching';
          bSlot.innerHTML = `<span class="slot-name">Searching...</span>`;
        }
      }
      for (let i = 0; i <= 4; i++) {
        const rSlot = document.getElementById(`mm-slot-red-${i}`);
        if (rSlot) {
          rSlot.className = 'mm-slot searching';
          rSlot.innerHTML = `<span class="slot-name">Searching...</span>`;
        }
      }

      if (IT.NetworkManager && IT.NetworkManager.matchmaking) {
        IT.NetworkManager.matchmaking.startQueue({
          mode: IT.SaveManager.preferredMode,
          arena: IT.SaveManager.preferredArena
        });
      }
    }

    _updateMatchmakingUI(status) {
      this._setText('mm-status-text', status.statusText || 'Searching for players...');
      this._setText('mm-found-count', status.playersFound || 1);

      // Dynamically fill slots as players/bots are found
      const count = status.playersFound || 1;
      const blueFilled = Math.min(5, Math.ceil(count / 2));
      const redFilled = Math.min(5, Math.floor(count / 2));

      for (let i = 1; i < blueFilled; i++) {
        const slot = document.getElementById(`mm-slot-blue-${i}`);
        if (slot && slot.classList.contains('searching')) {
          slot.className = 'mm-slot filled';
          slot.innerHTML = `<span class="slot-name">Ally_Pilot_${i}</span><span class="slot-tag">ALLY</span>`;
        }
      }

      for (let i = 0; i < redFilled; i++) {
        const slot = document.getElementById(`mm-slot-red-${i}`);
        if (slot && slot.classList.contains('searching')) {
          slot.className = 'mm-slot filled';
          slot.innerHTML = `<span class="slot-name">Opponent_${i + 1}</span><span class="slot-tag">OPPONENT</span>`;
        }
      }

      if (status.state === 'STARTING') {
        setTimeout(() => {
          const modal = document.getElementById('modal-matchmaking');
          if (modal) modal.style.display = 'none';
        }, 800);
      }
    }

    // ── MISSIONS & CHALLENGES (Phase 7) ──
    _bindMissionsEvents() {
      const tabs = ['daily', 'weekly', 'career', 'achievements'];
      tabs.forEach(t => {
        this._on(`tab-btn-${t}`, 'click', () => {
          if (IT.AudioManager) IT.AudioManager.playUI('CLICK');
          document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
          const activeBtn = document.getElementById(`tab-btn-${t}`);
          if (activeBtn) activeBtn.classList.add('active');
          this.activeMissionTab = t.toUpperCase();
          this.renderMissions(this.activeMissionTab);
        });
      });
    }

    renderMissions(category = 'DAILY') {
      if (!IT.MissionManager) return;
      const container = document.getElementById('missions-cards-container');
      if (!container) return;

      container.innerHTML = '';

      let list = [];
      if (category === 'DAILY') list = IT.MissionManager.getDailyMissions();
      else if (category === 'WEEKLY') list = IT.MissionManager.getWeeklyMissions();
      else if (category === 'CAREER') list = IT.MissionManager.getCareerMissions();
      else if (category === 'ACHIEVEMENTS') list = IT.MissionManager.getAchievements();

      // Update timer banner
      const timerBanner = document.getElementById('missions-timer-text');
      if (timerBanner) {
        if (category === 'DAILY') {
          const ms = IT.MissionManager.getDailyTimeRemainingMs();
          const hrs = Math.floor(ms / (1000 * 60 * 60));
          const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
          timerBanner.textContent = `DAILY ROTATION RESETS IN ${hrs}h ${mins}m`;
        } else if (category === 'WEEKLY') {
          const ms = IT.MissionManager.getWeeklyTimeRemainingMs();
          const days = Math.floor(ms / (1000 * 60 * 60 * 24));
          const hrs = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          timerBanner.textContent = `WEEKLY REFRESH IN ${days}d ${hrs}h`;
        } else {
          timerBanner.textContent = `PERMANENT PILOT DIRECTIVES & CAREER MILESTONES`;
        }
      }

      list.forEach(m => {
        const card = document.createElement('div');
        card.className = `mission-card ${m.isCompleted ? 'completed' : ''} ${m.isClaimed ? 'claimed' : ''}`;

        const pct = m.getProgressPercent ? m.getProgressPercent() : Math.min(100, Math.round((m.current / m.target) * 100));

        let rewardText = '';
        if (m.rewards.credits) rewardText += `+${m.rewards.credits} 💎 `;
        if (m.rewards.xp) rewardText += `+${m.rewards.xp} XP `;
        if (m.rewards.materials) rewardText += `+${m.rewards.materials} 🔧 `;
        if (m.rewards.tokens) rewardText += `+${m.rewards.tokens} 🪙 `;

        let actionBtnHtml = '';
        if (m.isClaimed) {
          actionBtnHtml = `<button class="btn-claim-mission" disabled>CLAIMED ✓</button>`;
        } else if (m.isCompleted) {
          actionBtnHtml = `<button class="btn-claim-mission btn-claim-active" data-id="${m.id}">CLAIM</button>`;
        } else {
          actionBtnHtml = `<button class="btn-claim-mission" disabled>${pct}%</button>`;
        }

        card.innerHTML = `
          <div class="mission-header">
            <div class="mission-icon">${m.icon || '🎯'}</div>
            <div class="mission-title-wrap">
              <div class="mission-title">${m.title}</div>
              <div class="mission-desc">${m.desc}</div>
            </div>
          </div>
          <div class="mission-progress-wrap">
            <div class="mission-progress-labels">
              <span>PROGRESS</span>
              <span>${m.current.toLocaleString()} / ${m.target.toLocaleString()}</span>
            </div>
            <div class="mission-progress-track">
              <div class="mission-progress-bar" style="width: ${pct}%;"></div>
            </div>
          </div>
          <div class="mission-footer">
            <div class="mission-rewards">${rewardText}</div>
            ${actionBtnHtml}
          </div>
        `;

        const claimBtn = card.querySelector('.btn-claim-active');
        if (claimBtn) {
          claimBtn.addEventListener('click', () => {
            if (IT.RewardManager) {
              const res = IT.RewardManager.claimMission(m.id);
              if (res && res.success) {
                this.renderMissions(this.activeMissionTab);
                this.updateHeaderCurrencies();
              }
            }
          });
        }

        container.appendChild(card);
      });
    }

    // ── 7-DAY DAILY LOGIN CALENDAR ──
    _bindDailyLoginEvents() {
      this._on('btn-claim-daily-reward', 'click', () => {
        if (IT.RewardManager) {
          const res = IT.RewardManager.claimDailyReward();
          if (res && res.success) {
            this.renderDailyCalendar();
            this.updateHeaderCurrencies();
          }
        }
      });

      this._on('btn-close-daily-reward', 'click', () => {
        const modal = document.getElementById('modal-daily-login');
        if (modal) modal.style.display = 'none';
      });
    }

    showDailyLoginModal() {
      const modal = document.getElementById('modal-daily-login');
      if (modal) modal.style.display = 'flex';
      this.renderDailyCalendar();
    }

    renderDailyCalendar() {
      if (!IT.RewardManager) return;
      const status = IT.RewardManager.checkDailyLogin();
      if (!status) return;

      const streakBadge = document.getElementById('daily-streak-badge');
      if (streakBadge) {
        streakBadge.textContent = `🔥 ${status.streak}-DAY PILOT LOGIN STREAK`;
      }

      const grid = document.getElementById('daily-calendar-grid');
      if (!grid) return;
      grid.innerHTML = '';

      status.schedule.forEach(item => {
        const isCurrent = item.day === status.currentDay;
        const isPast = item.day < status.currentDay;

        const dayCard = document.createElement('div');
        dayCard.className = `daily-day-card ${isCurrent ? 'active' : ''} ${isPast ? 'claimed' : ''}`;
        dayCard.innerHTML = `
          <div class="daily-day-label">DAY ${item.day}</div>
          <div class="daily-day-icon">${item.icon}</div>
          <div class="daily-day-reward">+${item.credits} 💎</div>
        `;
        grid.appendChild(dayCard);
      });

      const claimBtn = document.getElementById('btn-claim-daily-reward');
      if (claimBtn) {
        if (status.canClaim) {
          claimBtn.disabled = false;
          claimBtn.textContent = "CLAIM TODAY'S REWARD";
        } else {
          claimBtn.disabled = true;
          claimBtn.textContent = 'CLAIMED FOR TODAY';
        }
      }
    }

    // ── NETWORK SETTINGS & TELEMETRY DEBUG ──
    _bindNetworkSettingsEvents() {
      const sm = IT.SaveManager;

      // Callsign Input
      const callsignInput = document.getElementById('setting-input-callsign');
      if (callsignInput) {
        callsignInput.value = sm.pilotName;
        callsignInput.addEventListener('change', () => {
          if (IT.AuthManager) IT.AuthManager.setCallsign(callsignInput.value);
          else sm.pilotName = callsignInput.value;
        });
      }

      // Region Toggle
      const regions = ['US-EAST', 'US-WEST', 'EU-CENTRAL', 'ASIA-EAST'];
      let regionIdx = 0;
      this._on('setting-btn-region', 'click', () => {
        regionIdx = (regionIdx + 1) % regions.length;
        const reg = regions[regionIdx];
        this._setText('setting-btn-region', reg);
        sm.updateNetworkSettings({ region: reg });
      });

      // Show Ping Toggle
      this._on('setting-btn-showping', 'click', () => {
        const cur = sm.networkSettings.showPing;
        sm.updateNetworkSettings({ showPing: !cur });
        this._setText('setting-btn-showping', !cur ? 'ENABLED' : 'DISABLED');
      });

      // Adapter Toggle (AUTO / WS / LOOPBACK)
      const adapters = ['AUTO', 'WS', 'LOOPBACK'];
      let adaptIdx = 0;
      this._on('setting-btn-adapter', 'click', () => {
        adaptIdx = (adaptIdx + 1) % adapters.length;
        const a = adapters[adaptIdx];
        this._setText('setting-btn-adapter', a);
        sm.updateNetworkSettings({ adapterMode: a });
      });

      // Dev Net Panel Toggle
      this._on('setting-btn-devnet', 'click', () => {
        this.toggleNetworkDebugPanel();
      });

      this._on('btn-close-dev-net', 'click', () => {
        const panel = document.getElementById('dev-network-panel');
        if (panel) panel.style.display = 'none';
      });

      // Hotkey: Ctrl+Shift+N toggles dev network overlay
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
          this.toggleNetworkDebugPanel();
        }
      });
    }

    toggleNetworkDebugPanel() {
      const panel = document.getElementById('dev-network-panel');
      if (!panel) return;
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';

      if (!isVisible && IT.NetworkManager) {
        const nm = IT.NetworkManager;
        this._setText('net-dbg-status', nm.client.state);
        this._setText('net-dbg-ping', `${nm.client.ping || 35} ms`);
        this._setText('net-dbg-adapter', (IT.SaveManager.networkSettings && IT.SaveManager.networkSettings.adapterMode) || 'AUTO');
        this._setText('net-dbg-room', nm.room ? nm.room.roomId : 'LOBBY');
        this._setText('net-dbg-players', nm.room ? `${nm.room.players.size} / 10` : '0 / 10');
      }
    }

    _bindPhase10ReleaseEvents() {
      // 1. First-Launch Onboarding Modal
      const firstLaunchModal = document.getElementById('modal-first-launch');
      const btnFirstLaunch = document.getElementById('btn-first-launch-confirm');
      const inputFirstLaunch = document.getElementById('input-first-launch-name');

      if (IT.SaveManager.isFirstLaunch && firstLaunchModal) {
        firstLaunchModal.style.display = 'flex';
        if (inputFirstLaunch && IT.SaveManager.pilotName) {
          inputFirstLaunch.value = IT.SaveManager.pilotName;
        }
      }

      if (btnFirstLaunch) {
        btnFirstLaunch.addEventListener('click', () => {
          const callsign = (inputFirstLaunch && inputFirstLaunch.value.trim()) || 'TitanPilot';
          IT.SaveManager.pilotName = callsign;
          IT.SaveManager.setFirstLaunchComplete();
          if (firstLaunchModal) firstLaunchModal.style.display = 'none';
          this.updateHeaderCurrencies();
          this.showToast('PILOT REGISTERED', `Welcome Commander ${callsign}! Combat link established.`, '🤖');
          if (IT.AudioManager) IT.AudioManager.playUI('UPGRADE');
        });
      }

      // 2. Hardware / Browser Back Button Handling (popstate)
      window.addEventListener('popstate', () => {
        // If in battle, prompt exit confirmation
        if (this.currentScreen === SCREENS.BATTLE) {
          this._promptExitBattle();
          return;
        }

        // If any modal is active, close it
        const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
        if (activeModal && activeModal.id !== 'modal-first-launch') {
          activeModal.style.display = 'none';
          return;
        }

        // If in sub-screen, return to main menu
        if (this.currentScreen !== SCREENS.MAIN_MENU) {
          this.showScreen(SCREENS.MAIN_MENU);
        }
      });

      // 3. Battle Exit Confirmation Modal
      const modalExit = document.getElementById('modal-exit-confirm');
      const btnExitYes = document.getElementById('btn-exit-confirm-yes');
      const btnExitCancel = document.getElementById('btn-exit-confirm-cancel');

      if (btnExitCancel && modalExit) {
        btnExitCancel.addEventListener('click', () => {
          modalExit.style.display = 'none';
        });
      }

      if (btnExitYes && modalExit) {
        btnExitYes.addEventListener('click', () => {
          modalExit.style.display = 'none';
          if (IT.MatchManager && IT.MatchManager.activeMatch) {
            IT.MatchManager.activeMatch.endMatch('ABANDONED');
          } else {
            this.showScreen(SCREENS.MAIN_MENU);
          }
        });
      }

      // 4. Online / Offline Dynamic Detection
      const updateOnlineState = (explicitState) => {
        const isOnline = typeof explicitState === 'boolean' ? explicitState : (navigator.onLine !== false);
        const pill = document.getElementById('net-status-pill');
        const text = document.getElementById('net-status-text');
        const ping = document.getElementById('net-ping-display');
        if (pill && text) {
          if (isOnline) {
            pill.className = 'net-status-pill net-online';
            text.textContent = 'ONLINE';
            if (ping) ping.style.display = 'inline';
          } else {
            pill.className = 'net-status-pill net-offline';
            text.textContent = 'OFFLINE';
            if (ping) ping.style.display = 'none';
          }
        }
      };

      window.addEventListener('online', () => {
        updateOnlineState(true);
        this.showToast('NETWORK RESTORED', 'Reconnected to Iron Titans central command.', '🌐');
      });
      window.addEventListener('offline', () => {
        updateOnlineState(false);
        this.showToast('OFFLINE MODE', 'Operating offline. Local combat & simulation active.', '📶');
      });
      updateOnlineState();

      // 5. Error Screen Recovery Buttons
      const btnErrReload = document.getElementById('btn-error-reload');
      const btnErrMenu = document.getElementById('btn-error-menu');
      const errScreen = document.getElementById('screen-error');

      if (btnErrReload) {
        btnErrReload.addEventListener('click', () => {
          window.location.reload();
        });
      }
      if (btnErrMenu && errScreen) {
        btnErrMenu.addEventListener('click', () => {
          errScreen.style.display = 'none';
          this.showScreen(SCREENS.MAIN_MENU);
        });
      }
    }

    _promptExitBattle() {
      const modalExit = document.getElementById('modal-exit-confirm');
      if (modalExit) {
        modalExit.style.display = 'flex';
      }
    }
  }

  IT.UIManager = UIManager;
  IT.SCREENS = SCREENS;
})(window.IT);
