/**
 * Iron Titans — Garage.js
 * Titan Hangar & Arsenal screen: customize mech chassis, swap weapons,
 * upgrade chassis ranks and weapon tiers using earned battle credits.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class GarageScreen {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.animTime = 0;

      this.selectedMechId = 'ironclad';
      this.selectedSlot = 0; // 0 or 1
      this.selectedWeapons = ['pulsarCannon', 'scatterFlechettes'];
      this.currentTab = 'mechs'; // 'mechs' | 'weapons'

      this.buttons = [];
      this.onBack = null;
      this.onStartMatch = null;

      // Pointer event listener
      this._clickHandler = (e) => this._onClick(e);
      this.canvas.addEventListener('pointerdown', this._clickHandler);
    }

    update(dt) {
      this.animTime += dt;
    }

    _registerButton(id, x, y, w, h, text, style = 'primary', onClick) {
      this.buttons.push({ id, x, y, w, h, text, style, onClick });
    }

    _onClick(e) {
      const g = window._ironTitans;
      if (!g || g.state !== 'GARAGE') return;

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
      this.buttons = [];

      // Dark futuristic garage backdrop
      ctx.fillStyle = '#0a0d16';
      ctx.fillRect(0, 0, w, h);

      // Tech hangar floor lines
      ctx.strokeStyle = 'rgba(74, 174, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 80; y <= h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 1. Header
      this._drawHeader(w, h);

      // 2. Tab switcher (Mechs / Arsenal)
      this._drawTabs(w, h);

      // 3. Main Content based on Tab
      if (this.currentTab === 'mechs') {
        this._drawMechsTab(w, h);
      } else {
        this._drawArsenalTab(w, h);
      }

      // 4. Render all hit-tested buttons
      this._renderButtons();
    }

    _drawHeader(w, h) {
      const ctx = this.ctx;
      const save = IT.SaveManager ? IT.SaveManager.load() : { credits: 500 };

      // Top bar
      ctx.fillStyle = 'rgba(15, 20, 32, 0.95)';
      ctx.fillRect(0, 0, w, 56);
      ctx.strokeStyle = 'rgba(74, 174, 255, 0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, 56);

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('TITAN HANGAR & WEAPONS LAB', 130, 36);

      // Credits Display
      ctx.fillStyle = '#ffd043';
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${save.credits || 0} ⬡ CREDITS`, w - 24, 36);

      // Back to Menu button
      this._registerButton('back', 16, 12, 95, 32, '◄ MENU', 'secondary', () => {
        if (this.onBack) this.onBack();
      });
    }

    _drawTabs(w, h) {
      const isMechs = this.currentTab === 'mechs';
      this._registerButton('tab_mechs', 20, 68, 160, 36, 'TITAN CHASSIS', isMechs ? 'primary' : 'secondary', () => {
        this.currentTab = 'mechs';
      });
      this._registerButton('tab_weapons', 190, 68, 160, 36, 'WEAPON ARSENAL', !isMechs ? 'primary' : 'secondary', () => {
        this.currentTab = 'weapons';
      });

      // Confirm / Equip Loadout button
      this._registerButton('confirm', w - 180, 68, 160, 36, 'EQUIP & READY', 'primary', () => {
        if (this.onStartMatch) {
          this.onStartMatch({
            mechId: this.selectedMechId,
            weapons: this.selectedWeapons
          });
        }
      });
    }

    _drawMechsTab(w, h) {
      const ctx = this.ctx;
      const mechs = IT.MECH_DEFS ? Object.values(IT.MECH_DEFS) : [];
      const save = IT.SaveManager ? IT.SaveManager.load() : { unlockedMechs: ['ironclad', 'razorback'] };
      const unlocked = save.unlockedMechs || ['ironclad', 'razorback'];

      // Left column: 6 Mech cards
      const colX = 20;
      const startY = 116;
      const cardW = 270;
      const cardH = 68;

      mechs.forEach((m, idx) => {
        const x = colX;
        const y = startY + idx * 76;
        const isSel = this.selectedMechId === m.id;
        const isOwned = unlocked.includes(m.id);

        ctx.fillStyle = isSel ? 'rgba(74, 174, 255, 0.25)' : 'rgba(18, 24, 38, 0.75)';
        ctx.strokeStyle = isSel ? '#00e1ff' : (isOwned ? 'rgba(255, 255, 255, 0.15)' : '#444455');
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();

        // Mini mech icon circle
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(x + 30, y + 34, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = m.accentColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Name & Role
        ctx.fillStyle = isOwned ? '#ffffff' : '#888899';
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(m.name, x + 58, y + 28);

        ctx.fillStyle = isOwned ? '#4aaeff' : '#666677';
        ctx.font = '12px system-ui';
        ctx.fillText(isOwned ? `${m.role} • Owned` : `${m.role} • 800 ⬡`, x + 58, y + 48);

        this._registerButton(`mech_${m.id}`, x, y, cardW, cardH, '', 'invisible', () => {
          this.selectedMechId = m.id;
        });
      });

      // Right column: Detailed Chassis Specification Panel
      const currentDef = IT.MECH_DEFS ? IT.MECH_DEFS[this.selectedMechId] : null;
      if (currentDef) {
        this._drawMechDetails(currentDef, 310, 116, 470, 450, unlocked.includes(currentDef.id), save);
      }
    }

    _drawMechDetails(m, px, py, pw, ph, isOwned, save) {
      const ctx = this.ctx;

      ctx.fillStyle = 'rgba(14, 18, 28, 0.9)';
      ctx.strokeStyle = 'rgba(74, 174, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 8);
      ctx.fill();
      ctx.stroke();

      // Mech Large Silhouette Display
      ctx.save();
      ctx.translate(px + 70, py + 70);
      ctx.fillStyle = m.color;
      ctx.strokeStyle = m.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(10, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Title & Overview
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(m.name.toUpperCase(), px + 130, py + 52);

      ctx.fillStyle = '#4aaeff';
      ctx.font = '14px system-ui';
      ctx.fillText(`ARCHETYPE: ${m.role.toUpperCase()} CLASS`, px + 130, py + 78);

      const rank = (IT.SaveManager && IT.SaveManager.getRank) ? IT.SaveManager.getRank(m.id) : 1;
      ctx.fillStyle = '#ffd043';
      ctx.fillText(`CHASSIS RANK: ${rank} / 5`, px + 130, py + 100);

      // Stat bars
      const statX = px + 24;
      let statY = py + 140;

      this._drawStatBar(statX, statY, 420, 'HULL INTEGRITY (HP)', m.hp, 700, '#00ff88');
      statY += 44;
      this._drawStatBar(statX, statY, 420, 'ENERGY SHIELD', m.shield, 300, '#00e1ff');
      statY += 44;
      this._drawStatBar(statX, statY, 420, 'MOBILITY SPEED', m.speed, 250, '#ffaa00');
      statY += 44;

      // Passive & Ability
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui';
      ctx.fillText('TACTICAL CAPABILITIES', statX, statY);
      statY += 22;

      ctx.fillStyle = '#7f8ba6';
      ctx.font = '13px system-ui';
      ctx.fillText(`Passive: ${m.description}`, statX, statY);
      statY += 22;
      ctx.fillText(`Active [Space]: ${m.ability.toUpperCase()} (${m.abilityCooldown}s cooldown)`, statX, statY);

      // Bottom Action Button (Unlock or Upgrade Rank)
      if (!isOwned) {
        this._registerButton('unlock_mech', px + 24, py + ph - 55, 420, 42, 'UNLOCK CHASSIS (800 ⬡)', 'primary', () => {
          if (save.credits >= 800) {
            save.credits -= 800;
            save.unlockedMechs.push(m.id);
            if (IT.SaveManager) IT.SaveManager.save();
          }
        });
      } else {
        const upCost = rank * 250;
        const canUpgrade = rank < 5;
        const btnText = canUpgrade ? `UPGRADE CHASSIS RANK (COST: ${upCost} ⬡)` : 'MAX RANK ATTAINED';
        this._registerButton('upgrade_mech', px + 24, py + ph - 55, 420, 42, btnText, canUpgrade ? 'primary' : 'secondary', () => {
          if (canUpgrade && save.credits >= upCost) {
            save.credits -= upCost;
            if (!save.mechs[m.id]) save.mechs[m.id] = { rank: 1, xp: 0 };
            save.mechs[m.id].rank = rank + 1;
            if (IT.SaveManager) IT.SaveManager.save();
          }
        });
      }
    }

    _drawArsenalTab(w, h) {
      const ctx = this.ctx;
      const weapons = IT.WEAPONS ? Object.values(IT.WEAPONS) : [];
      const save = IT.SaveManager ? IT.SaveManager.load() : { unlockedWeapons: ['pulsarCannon', 'scatterFlechettes', 'arcBlade'] };
      const unlocked = save.unlockedWeapons || ['pulsarCannon', 'scatterFlechettes', 'arcBlade'];

      // Active Slot Switcher [Primary Slot] vs [Secondary Slot]
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('SELECT ACTIVE SLOT TO EQUIP:', 24, 130);

      this._registerButton('slot_0', 270, 112, 180, 32, `SLOT 1: ${this.selectedWeapons[0]}`, this.selectedSlot === 0 ? 'primary' : 'secondary', () => {
        this.selectedSlot = 0;
      });
      this._registerButton('slot_1', 465, 112, 180, 32, `SLOT 2: ${this.selectedWeapons[1]}`, this.selectedSlot === 1 ? 'primary' : 'secondary', () => {
        this.selectedSlot = 1;
      });

      // 4x2 Grid of Weapons
      const startX = 24;
      const startY = 160;
      const cardW = 360;
      const cardH = 92;

      weapons.forEach((wp, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = startX + col * 380;
        const y = startY + row * 102;
        const isEquippedInActive = this.selectedWeapons[this.selectedSlot] === wp.id;
        const isOwned = unlocked.includes(wp.id);

        ctx.fillStyle = isEquippedInActive ? 'rgba(74, 174, 255, 0.25)' : 'rgba(18, 24, 38, 0.75)';
        ctx.strokeStyle = isEquippedInActive ? '#00e1ff' : (isOwned ? 'rgba(255, 255, 255, 0.15)' : '#444455');
        ctx.lineWidth = isEquippedInActive ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, cardW, cardH, 6);
        ctx.fill();
        ctx.stroke();

        // Weapon name & type
        ctx.fillStyle = wp.color;
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(wp.name, x + 16, y + 26);

        ctx.fillStyle = '#7f8ba6';
        ctx.font = '12px system-ui';
        ctx.fillText(`[${wp.type.toUpperCase()}] Dmg: ${wp.damage} • Range: ${wp.range}m`, x + 16, y + 46);
        ctx.fillText(wp.description, x + 16, y + 66);

        // Status tag
        ctx.font = 'bold 12px system-ui';
        if (isEquippedInActive) {
          ctx.fillStyle = '#00ff88';
          ctx.fillText('EQUIPPED', x + cardW - 80, y + 26);
        } else if (!isOwned) {
          ctx.fillStyle = '#ffaa00';
          ctx.fillText('LOCKED (600 ⬡)', x + cardW - 110, y + 26);
        }

        this._registerButton(`wp_${wp.id}`, x, y, cardW, cardH, '', 'invisible', () => {
          if (isOwned) {
            this.selectedWeapons[this.selectedSlot] = wp.id;
          } else if (save.credits >= 600) {
            save.credits -= 600;
            save.unlockedWeapons.push(wp.id);
            this.selectedWeapons[this.selectedSlot] = wp.id;
            if (IT.SaveManager) IT.SaveManager.save();
          }
        });
      });
    }

    _drawStatBar(x, y, w, label, cur, max, color) {
      const ctx = this.ctx;
      const pct = Math.max(0, Math.min(1, cur / max));

      ctx.fillStyle = '#7f8ba6';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(label, x, y);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(String(cur), x + w, y);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x, y + 6, w, 8);

      ctx.fillStyle = color;
      ctx.fillRect(x, y + 6, w * pct, 8);
    }

    _renderButtons() {
      const ctx = this.ctx;
      this.buttons.forEach(btn => {
        if (btn.style === 'invisible') return;

        const isPrimary = btn.style === 'primary';
        ctx.save();
        ctx.fillStyle = isPrimary ? '#ff5500' : 'rgba(30, 40, 65, 0.85)';
        if (isPrimary) {
          ctx.shadowColor = 'rgba(255, 85, 0, 0.5)';
          ctx.shadowBlur = 10;
        }

        ctx.strokeStyle = isPrimary ? '#ffa366' : 'rgba(74, 174, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
        ctx.restore();
      });
    }
  }

  IT.GarageScreen = GarageScreen;
})(window.IT);
