/**
 * Iron Titans 3D — MissionSystem.js
 * Comprehensive Mission, Challenge & Achievement Architecture.
 * Includes:
 * - MissionDefinition: Blueprints for all mission varieties
 * - MissionProgress: Active instance state & increment logic
 * - MissionReward: Payout calculations & formatting
 * - MissionGenerator: Balanced daily (3) and weekly (5) rotation algorithms
 * - MissionStorage: Timestamp persistence with 24h/7d reset schedules
 * - MissionTracker: EventManager subscriber updating objectives without polling
 * - MissionManager: Central coordinator and UI data provider
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  // ── Mission Categories ──
  const CATEGORIES = Object.freeze({
    DAILY: 'DAILY',
    WEEKLY: 'WEEKLY',
    CAREER: 'CAREER',
    ACHIEVEMENT: 'ACHIEVEMENT',
    TUTORIAL: 'TUTORIAL'
  });

  // ── Objective Types ──
  const OBJECTIVES = Object.freeze({
    KILLS: 'KILLS',
    DAMAGE: 'DAMAGE',
    MATCHES: 'MATCHES',
    WINS: 'WINS',
    CAPTURES: 'CAPTURES',
    DEFENSES: 'DEFENSES',
    ABILITIES: 'ABILITIES',
    CRITICALS: 'CRITICALS',
    WEAPON_KILLS: 'WEAPON_KILLS',
    UPGRADE: 'UPGRADE'
  });

  // ── Mission Definition Pool ──
  const DAILY_POOL = {
    COMBAT: [
      { id: 'd_kill_5', title: 'Target Elimination', desc: 'Destroy 5 enemy mechs in any game mode.', type: OBJECTIVES.KILLS, target: 5, rewards: { credits: 800, xp: 400, materials: 15 }, icon: '🎯' },
      { id: 'd_kill_8', title: 'Combat Dominance', desc: 'Destroy 8 enemy mechs across battle arenas.', type: OBJECTIVES.KILLS, target: 8, rewards: { credits: 1200, xp: 550, materials: 20 }, icon: '💥' },
      { id: 'd_dmg_3k', title: 'Heavy Firepower', desc: 'Deal 3,000 points of total damage to enemy mechs.', type: OBJECTIVES.DAMAGE, target: 3000, rewards: { credits: 900, xp: 450, materials: 15 }, icon: '🔥' },
      { id: 'd_crit_4', title: 'Precision Marksman', desc: 'Land 4 critical hits on enemy mech weak points.', type: OBJECTIVES.CRITICALS, target: 4, rewards: { credits: 850, xp: 400, materials: 15 }, icon: '⚡' }
    ],
    OBJECTIVE: [
      { id: 'd_cap_2', title: 'Tactical Takeover', desc: 'Capture 2 control zones in Domination or Control Point.', type: OBJECTIVES.CAPTURES, target: 2, rewards: { credits: 900, xp: 450, materials: 15 }, icon: '📡' },
      { id: 'd_def_2', title: 'Perimeter Defense', desc: 'Successfully defend 2 allied control points.', type: OBJECTIVES.DEFENSES, target: 2, rewards: { credits: 850, xp: 400, materials: 15 }, icon: '🛡️' },
      { id: 'd_win_1', title: 'Squad Victory', desc: 'Win 1 match in any battle mode.', type: OBJECTIVES.WINS, target: 1, rewards: { credits: 1000, xp: 500, materials: 20 }, icon: '🏆' }
    ],
    GENERAL: [
      { id: 'd_match_2', title: 'Combat Readiness', desc: 'Complete 2 arena matches from start to finish.', type: OBJECTIVES.MATCHES, target: 2, rewards: { credits: 750, xp: 350, materials: 10 }, icon: '🎮' },
      { id: 'd_abil_5', title: 'Power Cycling', desc: 'Activate mech tactical abilities 5 times in battle.', type: OBJECTIVES.ABILITIES, target: 5, rewards: { credits: 800, xp: 400, materials: 10 }, icon: '⚡' },
      { id: 'd_upg_1', title: 'Armory Enhancement', desc: 'Upgrade any mech or weapon in the Garage.', type: OBJECTIVES.UPGRADE, target: 1, rewards: { credits: 900, xp: 450, materials: 15 }, icon: '🔧' }
    ]
  };

  const WEEKLY_POOL = [
    { id: 'w_kill_30', title: 'Arena Vanquisher', desc: 'Destroy 30 enemy mechs in competitive combat.', type: OBJECTIVES.KILLS, target: 30, rewards: { credits: 4000, xp: 2000, materials: 75, tokens: 3 }, icon: '☠️' },
    { id: 'w_dmg_25k', title: 'Devastation Protocol', desc: 'Deal 25,000 total damage across all battle theaters.', type: OBJECTIVES.DAMAGE, target: 25000, rewards: { credits: 4500, xp: 2200, materials: 80, tokens: 4 }, icon: '☄️' },
    { id: 'w_cap_10', title: 'Territory Commander', desc: 'Capture 10 strategic control zones.', type: OBJECTIVES.CAPTURES, target: 10, rewards: { credits: 3800, xp: 1900, materials: 70, tokens: 3 }, icon: '🚩' },
    { id: 'w_win_6', title: 'Champion of the Forge', desc: 'Achieve victory in 6 arena matches.', type: OBJECTIVES.WINS, target: 6, rewards: { credits: 5000, xp: 2500, materials: 100, tokens: 5 }, icon: '👑' },
    { id: 'w_abil_30', title: 'Reactor Surge', desc: 'Trigger tactical abilities 30 times during engagements.', type: OBJECTIVES.ABILITIES, target: 30, rewards: { credits: 3500, xp: 1800, materials: 60, tokens: 3 }, icon: '⚡' },
    { id: 'w_crit_25', title: 'Apex Sniper', desc: 'Score 25 weak-point critical hits with weapons.', type: OBJECTIVES.CRITICALS, target: 25, rewards: { credits: 4200, xp: 2100, materials: 75, tokens: 4 }, icon: '🎯' }
  ];

  const CAREER_DEFINITIONS = [
    { id: 'c_kills_50', title: 'Veteran Enforcer', desc: 'Eliminate 50 enemy mechs over your career.', type: OBJECTIVES.KILLS, target: 50, rewards: { credits: 3000, xp: 1500, materials: 50, tokens: 2 }, icon: '⚔️' },
    { id: 'c_kills_200', title: 'Titan Slayer', desc: 'Eliminate 200 enemy mechs over your career.', type: OBJECTIVES.KILLS, target: 200, rewards: { credits: 10000, xp: 5000, materials: 150, tokens: 8 }, icon: '💀' },
    { id: 'c_wins_25', title: 'Tactical Supremacy', desc: 'Achieve 25 career victories in the Arena.', type: OBJECTIVES.WINS, target: 25, rewards: { credits: 6000, xp: 3000, materials: 100, tokens: 5 }, icon: '🏅' },
    { id: 'c_caps_50', title: 'Grand Strategist', desc: 'Capture 50 strategic zones across all modes.', type: OBJECTIVES.CAPTURES, target: 50, rewards: { credits: 7500, xp: 3500, materials: 120, tokens: 6 }, icon: '🌐' },
    { id: 'c_dmg_100k', title: 'Cataclysm Engine', desc: 'Inflict 100,000 lifetime damage to opposing forces.', type: OBJECTIVES.DAMAGE, target: 100000, rewards: { credits: 12000, xp: 6000, materials: 200, tokens: 10 }, icon: '🌋' }
  ];

  const ACHIEVEMENT_DEFINITIONS = [
    { id: 'ach_first_blood', title: 'First Blood', desc: 'Score your very first enemy elimination.', type: OBJECTIVES.KILLS, target: 1, tokens: 1, icon: '🩸' },
    { id: 'ach_zone_guardian', title: 'Zone Guardian', desc: 'Capture 15 control zones in objective modes.', type: OBJECTIVES.CAPTURES, target: 15, tokens: 3, icon: '🛡️' },
    { id: 'ach_marksman', title: 'Surgical Precision', desc: 'Land 20 critical hits on mech weak points.', type: OBJECTIVES.CRITICALS, target: 20, tokens: 3, icon: '🎯' },
    { id: 'ach_tactician', title: 'Tactical Overdrive', desc: 'Activate mech tactical abilities 40 times.', type: OBJECTIVES.ABILITIES, target: 40, tokens: 4, icon: '⚡' },
    { id: 'ach_victor_streak', title: 'Unstoppable Momentum', desc: 'Win 5 arena matches.', type: OBJECTIVES.WINS, target: 5, tokens: 3, icon: '🔥' },
    { id: 'ach_iron_will', title: 'Iron Will', desc: 'Complete 20 full arena matches.', type: OBJECTIVES.MATCHES, target: 20, tokens: 5, icon: '🦾' },
    { id: 'ach_heavy_artillery', title: 'Heavy Artillery', desc: 'Inflict 50,000 total damage upon opponents.', type: OBJECTIVES.DAMAGE, target: 50000, tokens: 5, icon: '💣' },
    { id: 'ach_master_pilot', title: 'Master of the Arena', desc: 'Reach 100 total eliminations.', type: OBJECTIVES.KILLS, target: 100, tokens: 8, icon: '👑' }
  ];

  // ── MissionProgress Class ──
  class MissionProgress {
    constructor(data) {
      this.id = data.id;
      this.templateId = data.templateId || data.id;
      this.title = data.title;
      this.desc = data.desc;
      this.category = data.category;
      this.type = data.type;
      this.target = data.target;
      this.current = data.current || 0;
      this.isCompleted = Boolean(data.isCompleted || this.current >= this.target);
      this.isClaimed = Boolean(data.isClaimed);
      this.rewards = data.rewards || {};
      this.icon = data.icon || '🎯';
    }

    addProgress(amount) {
      if (this.isCompleted) return false;
      this.current = Math.min(this.target, this.current + amount);
      if (this.current >= this.target) {
        this.isCompleted = true;
        return true; // newly completed
      }
      return false;
    }

    getProgressRatio() {
      return Math.min(1, Math.max(0, this.current / this.target));
    }

    getProgressPercent() {
      return Math.round(this.getProgressRatio() * 100);
    }
  }

  // ── MissionStorage Class ──
  class MissionStorage {
    constructor() {
      this.DAY_MS = 24 * 60 * 60 * 1000;
      this.WEEK_MS = 7 * this.DAY_MS;
    }

    load() {
      const data = IT.SaveManager.getMissionsData();
      return {
        daily: (data.daily || []).map(m => new MissionProgress(m)),
        weekly: (data.weekly || []).map(m => new MissionProgress(m)),
        career: (data.career || []).map(m => new MissionProgress(m)),
        achievements: (data.achievements || []).map(m => new MissionProgress(m)),
        lastDailyReset: data.lastDailyReset || 0,
        lastWeeklyReset: data.lastWeeklyReset || 0
      };
    }

    save(state) {
      IT.SaveManager.updateMissionsData({
        daily: state.daily,
        weekly: state.weekly,
        career: state.career,
        achievements: state.achievements,
        lastDailyReset: state.lastDailyReset,
        lastWeeklyReset: state.lastWeeklyReset
      });
    }
  }

  // ── MissionTracker Class ──
  class MissionTracker {
    constructor(missionManager) {
      this.manager = missionManager;
      this._unsubscribers = [];
      this._bindEvents();
    }

    _bindEvents() {
      if (!IT.EventManager) return;
      const em = IT.EventManager;
      const EV = em.GAME_EVENTS;

      // Kills & Eliminations
      this._unsubscribers.push(
        em.on(EV.ENEMY_DESTROYED, (data) => {
          if (data && data.isPlayer) {
            this._advance(OBJECTIVES.KILLS, 1);
            if (data.isCritical) {
              this._advance(OBJECTIVES.CRITICALS, 1);
            }
          }
        })
      );

      // Damage dealt
      this._unsubscribers.push(
        em.on(EV.DAMAGE_DEALT, (data) => {
          if (data && data.isPlayer && data.amount > 0) {
            this._advance(OBJECTIVES.DAMAGE, Math.round(data.amount));
          }
        })
      );

      // Weak point criticals
      this._unsubscribers.push(
        em.on(EV.CRITICAL_HIT, (data) => {
          if (data && data.isPlayer) {
            this._advance(OBJECTIVES.CRITICALS, 1);
          }
        })
      );

      // Objectives: Capture
      this._unsubscribers.push(
        em.on(EV.OBJECTIVE_CAPTURED, (data) => {
          if (data && data.isPlayer) {
            this._advance(OBJECTIVES.CAPTURES, 1);
          }
        })
      );

      // Objectives: Defense
      this._unsubscribers.push(
        em.on(EV.OBJECTIVE_DEFENDED, (data) => {
          if (data && data.isPlayer) {
            this._advance(OBJECTIVES.DEFENSES, 1);
          }
        })
      );

      // Abilities
      this._unsubscribers.push(
        em.on(EV.ABILITY_USED, (data) => {
          if (data && data.isPlayer) {
            this._advance(OBJECTIVES.ABILITIES, 1);
          }
        })
      );

      // Match completion & wins
      this._unsubscribers.push(
        em.on(EV.MATCH_COMPLETED, (data) => {
          this._advance(OBJECTIVES.MATCHES, 1);
          if (data && data.won) {
            this._advance(OBJECTIVES.WINS, 1);
          }
          if (data && data.kills > 0) {
            // Backup catch for bulk match stats
          }
        })
      );
    }

    _advance(type, amount) {
      if (!amount || amount <= 0) return;
      const allActive = this.manager.getAllActiveMissions();

      for (const m of allActive) {
        if (m.type === type && !m.isCompleted) {
          const newlyCompleted = m.addProgress(amount);
          if (newlyCompleted) {
            this.manager.onMissionCompleted(m);
          }
        }
      }

      this.manager.saveMissions();
    }

    destroy() {
      this._unsubscribers.forEach(u => u());
      this._unsubscribers = [];
    }
  }

  // ── MissionManager Class ──
  class MissionManager {
    constructor() {
      this.storage = new MissionStorage();
      this.state = {
        daily: [],
        weekly: [],
        career: [],
        achievements: [],
        lastDailyReset: 0,
        lastWeeklyReset: 0
      };

      this.init();
      this.tracker = new MissionTracker(this);
    }

    init() {
      const loaded = this.storage.load();
      this.state = loaded;
      this.checkResets();
      this._ensureCareerAndAchievements();
    }

    checkResets() {
      const now = Date.now();
      let modified = false;

      // Daily Reset (24 Hours)
      if (!this.state.lastDailyReset || (now - this.state.lastDailyReset >= this.storage.DAY_MS) || this.state.daily.length === 0) {
        this.generateDailyMissions();
        this.state.lastDailyReset = now;
        modified = true;
      }

      // Weekly Reset (7 Days)
      if (!this.state.lastWeeklyReset || (now - this.state.lastWeeklyReset >= this.storage.WEEK_MS) || this.state.weekly.length === 0) {
        this.generateWeeklyMissions();
        this.state.lastWeeklyReset = now;
        modified = true;
      }

      if (modified) {
        this.saveMissions();
      }
    }

    generateDailyMissions() {
      const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

      const c = pickRandom(DAILY_POOL.COMBAT);
      const o = pickRandom(DAILY_POOL.OBJECTIVE);
      const g = pickRandom(DAILY_POOL.GENERAL);

      this.state.daily = [
        new MissionProgress({ ...c, category: CATEGORIES.DAILY, current: 0, isCompleted: false, isClaimed: false }),
        new MissionProgress({ ...o, category: CATEGORIES.DAILY, current: 0, isCompleted: false, isClaimed: false }),
        new MissionProgress({ ...g, category: CATEGORIES.DAILY, current: 0, isCompleted: false, isClaimed: false })
      ];
    }

    generateWeeklyMissions() {
      // Pick 5 distinct weekly missions from the pool of 6
      const shuffled = [...WEEKLY_POOL].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 5);

      this.state.weekly = selected.map(w => new MissionProgress({
        ...w,
        category: CATEGORIES.WEEKLY,
        current: 0,
        isCompleted: false,
        isClaimed: false
      }));
    }

    _ensureCareerAndAchievements() {
      let modified = false;

      // Initialize Career missions if missing or synchronize with career stats
      if (!this.state.career || this.state.career.length === 0) {
        const stats = (IT.SaveManager && IT.SaveManager.career) || {};
        this.state.career = CAREER_DEFINITIONS.map(c => {
          let current = 0;
          if (c.type === OBJECTIVES.KILLS) current = stats.kills || 0;
          else if (c.type === OBJECTIVES.WINS) current = stats.victories || 0;
          else if (c.type === OBJECTIVES.CAPTURES) current = stats.objectiveCaptures || 0;
          else if (c.type === OBJECTIVES.DAMAGE) current = stats.damageDealt || 0;

          return new MissionProgress({
            ...c,
            category: CATEGORIES.CAREER,
            current: Math.min(c.target, current),
            isCompleted: current >= c.target,
            isClaimed: false
          });
        });
        modified = true;
      }

      // Initialize Achievements if missing
      if (!this.state.achievements || this.state.achievements.length === 0) {
        const stats = (IT.SaveManager && IT.SaveManager.career) || {};
        this.state.achievements = ACHIEVEMENT_DEFINITIONS.map(a => {
          let current = 0;
          if (a.type === OBJECTIVES.KILLS) current = stats.kills || 0;
          else if (a.type === OBJECTIVES.CAPTURES) current = stats.objectiveCaptures || 0;
          else if (a.type === OBJECTIVES.DAMAGE) current = stats.damageDealt || 0;
          else if (a.type === OBJECTIVES.WINS) current = stats.victories || 0;
          else if (a.type === OBJECTIVES.MATCHES) current = stats.matchesPlayed || 0;

          return new MissionProgress({
            ...a,
            category: CATEGORIES.ACHIEVEMENT,
            current: Math.min(a.target, current),
            isCompleted: current >= a.target,
            isClaimed: false,
            rewards: { tokens: a.tokens }
          });
        });
        modified = true;
      }

      if (modified) {
        this.saveMissions();
      }
    }

    getAllActiveMissions() {
      return [
        ...this.state.daily,
        ...this.state.weekly,
        ...this.state.career,
        ...this.state.achievements
      ];
    }

    getMissionById(id) {
      return this.getAllActiveMissions().find(m => m.id === id);
    }

    getDailyMissions() {
      return this.state.daily;
    }

    getWeeklyMissions() {
      return this.state.weekly;
    }

    getCareerMissions() {
      return this.state.career;
    }

    getAchievements() {
      return this.state.achievements;
    }

    getUnclaimedCount() {
      return this.getAllActiveMissions().filter(m => m.isCompleted && !m.isClaimed).length;
    }

    onMissionCompleted(mission) {
      if (IT.NotificationManager) {
        if (mission.category === CATEGORIES.ACHIEVEMENT) {
          IT.NotificationManager.showAchievementUnlocked(mission);
        } else {
          IT.NotificationManager.showMissionComplete(mission);
        }
      }

      if (IT.EventManager) {
        IT.EventManager.emit(IT.GAME_EVENTS.MISSION_COMPLETED, { mission });
      }
    }

    getDailyTimeRemainingMs() {
      const now = Date.now();
      const nextReset = this.state.lastDailyReset + this.storage.DAY_MS;
      return Math.max(0, nextReset - now);
    }

    getWeeklyTimeRemainingMs() {
      const now = Date.now();
      const nextReset = this.state.lastWeeklyReset + this.storage.WEEK_MS;
      return Math.max(0, nextReset - now);
    }

    saveMissions() {
      this.storage.save(this.state);
    }

    // Developer / Debug helpers
    debugResetDaily() {
      this.generateDailyMissions();
      this.state.lastDailyReset = Date.now();
      this.saveMissions();
    }

    debugResetWeekly() {
      this.generateWeeklyMissions();
      this.state.lastWeeklyReset = Date.now();
      this.saveMissions();
    }

    debugCompleteFirstDaily() {
      const m = this.state.daily[0];
      if (m) {
        m.current = m.target;
        m.isCompleted = true;
        this.saveMissions();
        this.onMissionCompleted(m);
      }
    }
  }

  IT.CATEGORIES = CATEGORIES;
  IT.OBJECTIVES = OBJECTIVES;
  IT.MissionProgress = MissionProgress;
  IT.MissionManager = new MissionManager();
})(window.IT);
