/**
 * Iron Titans — Menu.js
 * Main menu, mode selection, arena selection, and pilot career stats screens.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class MenuScreen {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.state = 'main'; // 'main' | 'modeSelect' | 'arenaSelect' | 'stats'
      this.animTime = 0;

      this.selectedMode = 'skirmish';
      this.selectedArena = 'forgeNexus';
      this.difficulty = 'normal';
      this.selectedMech = 'ironclad';
      this.selectedWeapons = ['pulsarCannon', 'scatterFlechettes'];

      this.buttons = [];
      this.stars = [];
      this._initStars();

      // Callbacks to main game
      this.onStartGame = null;
      this.onOpenGarage = null;

      // Click / Touch listener
      this._clickHandler = (e) => this._onClick(e);
      this.canvas.addEventListener('pointerdown', this._clickHandler);
    }

    _initStars() {
      for (let i = 0; i < 90; i++) {
        this.stars.push({
          x: Math.random() * 800,
          y: Math.random() * 600,
          size: Math.random() * 2 + 1,
          alpha: Math.random() * 0.8 + 0.2,
          speed: Math.random() * 15 + 8
        });
      }
    }

    update(dt) {
      this.animTime += dt;
      // Drift starfield
      this.stars.forEach(s => {
        s.y += s.speed * dt;
        if (s.y > 600) {
          s.y = 0;
          s.x = Math.random() * 800;
        }
      });
    }

    _registerButton(id, x, y, w, h, text, style = 'primary', onClick) {
      this.buttons.push({ id, x, y, w, h, text, style, onClick });
    }

    _onClick(e) {
      const g = window._ironTitans;
      if (!g || g.state !== 'MENU') return;

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = 800 / rect.width;
      const scaleY = 600 / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      for (let i = 0; i < this.buttons.length; i++) {
        const btn = this.buttons[i];
        if (cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
          if (btn.onClick) btn.onClick();
          break;
        }
      }
    }

    draw() {
      const ctx = this.ctx;
      const w = 800;
      const h = 600;

      this.buttons = []; // Clear registered buttons each frame

      // Background
      ctx.fillStyle = '#090b12';
      ctx.fillRect(0, 0, w, h);

      // Starfield
      ctx.fillStyle = '#ffffff';
      this.stars.forEach(s => {
        ctx.globalAlpha = s.alpha * (Math.sin(this.animTime * 2 + s.x) * 0.3 + 0.7);
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1.0;

      // Screen routing
      if (this.state === 'main') {
        this._drawMainMenu(w, h);
      } else if (this.state === 'modeSelect') {
        this._drawModeSelect(w, h);
      } else if (this.state === 'arenaSelect') {
        this._drawArenaSelect(w, h);
      } else if (this.state === 'stats') {
        this._drawStatsScreen(w, h);
      }

      // Draw all registered buttons
      this._renderButtons();
    }

    _drawMainMenu(w, h) {
      const ctx = this.ctx;

      // Game Title
      ctx.save();
      ctx.shadowColor = '#00e1ff';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 64px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('IRON TITANS', w / 2, 140);
      ctx.restore();

      ctx.fillStyle = '#4aaeff';
      ctx.font = 'bold 16px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('HIGH-IMPACT MOBILE MECH PVP ARENA', w / 2, 175);

      // Menu Buttons
      const bw = 280;
      const bh = 50;
      const bx = (w - bw) / 2;

      this._registerButton('quick', bx, 230, bw, bh, 'QUICK SKIRMISH', 'primary', () => {
        if (this.onStartGame) {
          this.onStartGame({
            mechId: this.selectedMech,
            weapons: this.selectedWeapons,
            mode: 'skirmish',
            arenaId: 'forgeNexus',
            difficulty: this.difficulty
          });
        }
      });

      this._registerButton('mode', bx, 295, bw, bh, 'SELECT MODE & ARENA', 'secondary', () => {
        this.state = 'modeSelect';
      });

      this._registerButton('garage', bx, 360, bw, bh, 'TITAN GARAGE & LOADOUT', 'secondary', () => {
        if (this.onOpenGarage) this.onOpenGarage();
      });

      this._registerButton('stats', bx, 425, bw, bh, 'CAREER STATS', 'secondary', () => {
        this.state = 'stats';
      });

      // Version tag
      ctx.fillStyle = '#556080';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('v1.0.0 • Pure HTML5 Canvas 2D Engine', w / 2, 560);
    }

    _drawModeSelect(w, h) {
      const ctx = this.ctx;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('SELECT BATTLE MODE', w / 2, 80);

      const modes = [
        { id: 'skirmish', title: 'TEAM SKIRMISH', desc: '2v2 Team Deathmatch. First team to 10 kills wins.' },
        { id: 'domination', title: 'DOMINATION', desc: 'Capture and hold 3 strategic nodes. First to 200 points.' },
        { id: 'ffa', title: 'LAST TITAN STANDING', desc: '4-Mech free-for-all showdown. 3 lives each.' }
      ];

      modes.forEach((m, idx) => {
        const cardX = 100;
        const cardY = 130 + idx * 105;
        const cardW = 600;
        const cardH = 85;
        const isSelected = this.selectedMode === m.id;

        ctx.fillStyle = isSelected ? 'rgba(74, 174, 255, 0.22)' : 'rgba(20, 26, 40, 0.7)';
        ctx.strokeStyle = isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#00f0ff' : '#ffffff';
        ctx.font = 'bold 20px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(m.title, cardX + 24, cardY + 35);

        ctx.fillStyle = '#99a8c7';
        ctx.font = '14px system-ui';
        ctx.fillText(m.desc, cardX + 24, cardY + 62);

        this._registerButton(`mode_${m.id}`, cardX, cardY, cardW, cardH, '', 'invisible', () => {
          this.selectedMode = m.id;
        });
      });

      this._registerButton('back', 100, 485, 160, 45, 'BACK', 'secondary', () => {
        this.state = 'main';
      });

      this._registerButton('next', 540, 485, 160, 45, 'NEXT: ARENA', 'primary', () => {
        this.state = 'arenaSelect';
      });
    }

    _drawArenaSelect(w, h) {
      const ctx = this.ctx;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('SELECT COMBAT ARENA', w / 2, 70);

      const arenas = [
        { id: 'forgeNexus', title: 'FORGE NEXUS', desc: 'Heavy industrial factory with moving molten lava hazards.' },
        { id: 'crystalSpire', title: 'CRYSTAL SPIRE', desc: 'Alien planetary surface with destructible crystal pillars.' },
        { id: 'sunkenCitadel', title: 'SUNKEN CITADEL', desc: 'Flooded ancient citadel with elevated platforms and water pools.' }
      ];

      arenas.forEach((a, idx) => {
        const cardX = 100;
        const cardY = 110 + idx * 95;
        const cardW = 600;
        const cardH = 78;
        const isSelected = this.selectedArena === a.id;

        ctx.fillStyle = isSelected ? 'rgba(255, 130, 40, 0.22)' : 'rgba(20, 26, 40, 0.7)';
        ctx.strokeStyle = isSelected ? '#ff8822' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isSelected ? '#ffaa44' : '#ffffff';
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(a.title, cardX + 24, cardY + 32);

        ctx.fillStyle = '#99a8c7';
        ctx.font = '13px system-ui';
        ctx.fillText(a.desc, cardX + 24, cardY + 56);

        this._registerButton(`arena_${a.id}`, cardX, cardY, cardW, cardH, '', 'invisible', () => {
          this.selectedArena = a.id;
        });
      });

      // Difficulty toggle buttons
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('AI DIFFICULTY:', 100, 435);

      const diffs = ['easy', 'normal', 'hard'];
      diffs.forEach((d, i) => {
        const dx = 240 + i * 110;
        const isSel = this.difficulty === d;
        this._registerButton(`diff_${d}`, dx, 412, 100, 36, d.toUpperCase(), isSel ? 'primary' : 'secondary', () => {
          this.difficulty = d;
        });
      });

      this._registerButton('back_arena', 100, 490, 160, 45, 'BACK', 'secondary', () => {
        this.state = 'modeSelect';
      });

      this._registerButton('deploy', 540, 490, 160, 45, 'DEPLOY TO ARENA', 'primary', () => {
        if (this.onStartGame) {
          this.onStartGame({
            mechId: this.selectedMech,
            weapons: this.selectedWeapons,
            mode: this.selectedMode,
            arenaId: this.selectedArena,
            difficulty: this.difficulty
          });
        }
      });
    }

    _drawStatsScreen(w, h) {
      const ctx = this.ctx;
      const save = IT.SaveManager ? IT.SaveManager.load() : { stats: {}, credits: 0 };
      const stats = save.stats || { matchesPlayed: 0, wins: 0, kills: 0, deaths: 0 };

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('PILOT CAREER DOSSIER', w / 2, 90);

      const panelX = 180;
      const panelY = 140;
      const panelW = 440;
      const panelH = 290;

      ctx.fillStyle = 'rgba(16, 22, 36, 0.85)';
      ctx.strokeStyle = 'rgba(74, 174, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 10);
      ctx.fill();
      ctx.stroke();

      const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills;
      const winPct = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;

      const rows = [
        ['Credits Balance', `${save.credits || 0} ⬡`],
        ['Matches Participated', stats.matchesPlayed],
        ['Victories Confirmed', stats.wins],
        ['Win Rate', `${winPct}%`],
        ['Enemy Titans Eliminated', stats.kills],
        ['Chassis Destroyed', stats.deaths],
        ['Kill / Death Efficiency', kd]
      ];

      rows.forEach((row, i) => {
        const ry = panelY + 40 + i * 34;
        ctx.fillStyle = '#8f9bb3';
        ctx.font = '15px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(row[0], panelX + 30, ry);

        ctx.fillStyle = i === 0 ? '#ffd043' : '#ffffff';
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'right';
        ctx.fillText(String(row[1]), panelX + panelW - 30, ry);
      });

      this._registerButton('back_stats', 320, 465, 160, 45, 'BACK TO MENU', 'primary', () => {
        this.state = 'main';
      });
    }

    _renderButtons() {
      const ctx = this.ctx;
      this.buttons.forEach(btn => {
        if (btn.style === 'invisible') return;

        const isPrimary = btn.style === 'primary';
        ctx.save();
        ctx.fillStyle = isPrimary
          ? 'linear-gradient(to right, #ff6600, #ff3300)'
          : 'rgba(25, 32, 50, 0.85)';

        if (isPrimary) {
          ctx.fillStyle = '#ff5500';
          ctx.shadowColor = 'rgba(255, 85, 0, 0.6)';
          ctx.shadowBlur = 12;
        } else {
          ctx.fillStyle = 'rgba(30, 40, 65, 0.85)';
        }

        ctx.strokeStyle = isPrimary ? '#ffa366' : 'rgba(74, 174, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
        ctx.restore();
      });
    }
  }

  IT.MenuScreen = MenuScreen;
})(window.IT);
