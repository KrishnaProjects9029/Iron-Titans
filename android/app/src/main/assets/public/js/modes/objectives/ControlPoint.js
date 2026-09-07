/**
 * Iron Titans 3D — ControlPoint.js
 * Single Rotating Active Control Point for Control Point Mode:
 * - High-energy skyward beacon visible across the entire 3D arena
 * - Rotating holographic glyphs and radius boundary ring (10m radius)
 * - Dynamic sector relocation (Center -> North -> East -> West -> Center)
 * - Warning transition state before relocating ("NEXT OBJECTIVE: NORTH SECTOR")
 * - Presence detection, capture progress, and contested state
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const CP_COLORS = {
    neutral: { main: 0x778899, emissive: 0x445566, hex: '#778899' },
    blue: { main: 0x00c8ff, emissive: 0x0099ff, hex: '#00c8ff' },
    red: { main: 0xff3344, emissive: 0xcc1122, hex: '#ff3344' },
    contested: { main: 0xffaa00, emissive: 0xff8800, hex: '#ffaa00' },
    warning: { main: 0xff7700, emissive: 0xff5500, hex: '#ff7700' }
  };

  class ControlPoint {
    constructor(scene, config = {}) {
      this.scene = scene;
      this.sectorName = config.sectorName || 'CENTER';
      this.position = config.position || new THREE.Vector3(0, 0, 0);
      this.radius = config.radius || 10.0;

      // Ownership & Progress
      this.controllingTeam = null; // 'blue', 'red', or null
      this.captureProgress = 0; // -100 to 100
      this.captureSpeed = 33.3; // 3.0s to capture from 0 to 100
      this.isContested = false;
      this.isWarning = false;
      this.nextSectorName = '';

      this.blueCount = 0;
      this.redCount = 0;
      this.playerInside = false;

      this.group = new THREE.Group();
      this.group.name = 'ActiveControlPoint';
      this.group.position.copy(this.position);

      this.pulseTime = 0;
      this._buildVisuals();
      this.scene.add(this.group);
    }

    _buildVisuals() {
      // 1. Ground Boundary Ring
      const ringGeo = new THREE.RingGeometry(this.radius - 0.45, this.radius, 48);
      this.matRing = new THREE.MeshStandardMaterial({
        color: CP_COLORS.neutral.main,
        emissive: CP_COLORS.neutral.emissive,
        emissiveIntensity: 2.4,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, this.matRing);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      this.group.add(ring);

      // 2. Translucent Ground Disc
      const discGeo = new THREE.CircleGeometry(this.radius - 0.45, 36);
      this.matDisc = new THREE.MeshStandardMaterial({
        color: CP_COLORS.neutral.main,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const disc = new THREE.Mesh(discGeo, this.matDisc);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.06;
      this.group.add(disc);

      // 3. Skyward Towering Energy Beacon (Visible anywhere in the arena)
      const beaconGeo = new THREE.CylinderGeometry(0.5, 0.7, 16.0, 16, 1, true);
      this.matBeacon = new THREE.MeshStandardMaterial({
        color: CP_COLORS.neutral.main,
        emissive: CP_COLORS.neutral.emissive,
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
      });
      const beacon = new THREE.Mesh(beaconGeo, this.matBeacon);
      beacon.position.y = 8.0;
      this.group.add(beacon);

      // 4. Dual Rotating Holographic Energy Rings
      const r1Geo = new THREE.TorusGeometry(2.0, 0.1, 8, 24);
      this.matRings = new THREE.MeshStandardMaterial({
        color: CP_COLORS.neutral.main,
        emissive: CP_COLORS.neutral.emissive,
        emissiveIntensity: 3.0
      });
      this.ring1 = new THREE.Mesh(r1Geo, this.matRings);
      this.ring1.position.y = 6.0;
      this.group.add(this.ring1);

      const r2Geo = new THREE.TorusGeometry(1.4, 0.08, 8, 24);
      this.ring2 = new THREE.Mesh(r2Geo, this.matRings);
      this.ring2.position.y = 6.0;
      this.group.add(this.ring2);

      // 5. Overhead Sector Label Billboard
      this._buildSectorBillboard();
    }

    _buildSectorBillboard() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      this.billboardCtx = canvas.getContext('2d');
      this.billboardTex = new THREE.CanvasTexture(canvas);

      this._drawBillboard();

      const spriteMat = new THREE.SpriteMaterial({
        map: this.billboardTex,
        transparent: true,
        depthTest: false
      });
      this.sprite = new THREE.Sprite(spriteMat);
      this.sprite.position.set(0, 11.5, 0);
      this.sprite.scale.set(6.0, 3.0, 1.0);
      this.group.add(this.sprite);
    }

    _drawBillboard() {
      if (!this.billboardCtx) return;
      const ctx = this.billboardCtx;
      ctx.clearRect(0, 0, 256, 128);

      let color = CP_COLORS.neutral.hex;
      if (this.isWarning) color = CP_COLORS.warning.hex;
      else if (this.isContested) color = CP_COLORS.contested.hex;
      else if (this.controllingTeam === 'blue') color = CP_COLORS.blue.hex;
      else if (this.controllingTeam === 'red') color = CP_COLORS.red.hex;

      // Dark background pill
      ctx.fillStyle = 'rgba(10, 14, 26, 0.88)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(16, 16, 224, 96, 16);
      } else {
        ctx.rect(16, 16, 224, 96);
      }
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Top title
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(this.isWarning ? 'RELOCATING TO' : 'CONTROL POINT', 128, 48);

      // Sector name
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.isWarning ? this.nextSectorName : this.sectorName, 128, 86);

      if (this.billboardTex) {
        this.billboardTex.needsUpdate = true;
      }
    }

    relocate(newPosition, sectorName) {
      this.position.copy(newPosition);
      this.sectorName = sectorName;
      this.group.position.copy(newPosition);

      this.controllingTeam = null;
      this.captureProgress = 0;
      this.isContested = false;
      this.isWarning = false;
      this.nextSectorName = '';

      this._drawBillboard();
    }

    setWarning(isWarning, nextSectorName = '') {
      this.isWarning = isWarning;
      this.nextSectorName = nextSectorName;
      this._drawBillboard();
    }

    update(dt, allMechs, onCaptureEvent) {
      this.pulseTime += dt;

      // 1. Evaluate living mechs in radius
      this.blueCount = 0;
      this.redCount = 0;
      this.playerInside = false;

      if (allMechs) {
        for (let i = 0; i < allMechs.length; i++) {
          const m = allMechs[i];
          if (m.isDead) continue;

          const dx = m.position.x - this.position.x;
          const dz = m.position.z - this.position.z;
          const distSq = dx * dx + dz * dz;

          if (distSq <= this.radius * this.radius) {
            if (m.team === 'blue') {
              this.blueCount++;
              if (m.isPlayer) this.playerInside = true;
            } else if (m.team === 'red') {
              this.redCount++;
            }
          }
        }
      }

      // 2. Contested check
      const wasContested = this.isContested;
      this.isContested = this.blueCount > 0 && this.redCount > 0;

      if (this.isContested && !wasContested && onCaptureEvent) {
        onCaptureEvent('contested', this);
      }

      // 3. Capture progress
      if (!this.isContested) {
        if (this.blueCount > 0 && this.redCount === 0) {
          const rate = this.captureSpeed * Math.min(3, this.blueCount);
          const old = this.captureProgress;
          this.captureProgress = Math.min(100, this.captureProgress + rate * dt);

          if (old < 100 && this.captureProgress >= 100) {
            if (this.controllingTeam !== 'blue') {
              this.controllingTeam = 'blue';
              if (onCaptureEvent) onCaptureEvent('captured', this, 'blue');
            }
          }
        } else if (this.redCount > 0 && this.blueCount === 0) {
          const rate = this.captureSpeed * Math.min(3, this.redCount);
          const old = this.captureProgress;
          this.captureProgress = Math.max(-100, this.captureProgress - rate * dt);

          if (old > -100 && this.captureProgress <= -100) {
            if (this.controllingTeam !== 'red') {
              this.controllingTeam = 'red';
              if (onCaptureEvent) onCaptureEvent('captured', this, 'red');
            }
          }
        }
      }

      // 4. Update Visual Materials & Rotations
      this._updateVisuals();
    }

    _updateVisuals() {
      let activeColor = CP_COLORS.neutral;

      if (this.isWarning) {
        const flash = Math.sin(this.pulseTime * 8.0) > 0;
        activeColor = flash ? CP_COLORS.warning : CP_COLORS.neutral;
      } else if (this.isContested) {
        const flash = Math.sin(this.pulseTime * 10.0) > 0;
        activeColor = flash ? CP_COLORS.contested : CP_COLORS.neutral;
      } else if (this.controllingTeam === 'blue') {
        activeColor = CP_COLORS.blue;
      } else if (this.controllingTeam === 'red') {
        activeColor = CP_COLORS.red;
      } else if (this.captureProgress > 0) {
        activeColor = CP_COLORS.blue;
      } else if (this.captureProgress < 0) {
        activeColor = CP_COLORS.red;
      }

      this.matRing.color.setHex(activeColor.main);
      this.matRing.emissive.setHex(activeColor.emissive);

      this.matDisc.color.setHex(activeColor.main);
      this.matDisc.opacity = this.isContested ? 0.4 : 0.22 + Math.sin(this.pulseTime * 3.5) * 0.08;

      this.matBeacon.color.setHex(activeColor.main);
      this.matBeacon.emissive.setHex(activeColor.emissive);

      this.matRings.color.setHex(activeColor.main);
      this.matRings.emissive.setHex(activeColor.emissive);

      if (this.ring1) {
        this.ring1.rotation.x = this.pulseTime * 1.8;
        this.ring1.rotation.y = this.pulseTime * 1.2;
      }
      if (this.ring2) {
        this.ring2.rotation.y = -this.pulseTime * 2.2;
        this.ring2.rotation.z = this.pulseTime * 1.5;
      }

      this._drawBillboard();
    }

    destroy() {
      if (this.group && this.group.parent) {
        this.group.parent.remove(this.group);
      }
    }
  }

  IT.ControlPoint = ControlPoint;
})(window.IT);
