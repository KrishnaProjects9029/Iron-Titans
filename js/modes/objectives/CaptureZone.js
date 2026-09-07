/**
 * Iron Titans 3D — CaptureZone.js
 * 3D Holographic Capture Zone for Domination Mode:
 * - Real 3D interactive object in Three.js world
 * - Ground hazard ring, rotating holographic glyph, energy pillar, and overhead letter banner (A, B, C)
 * - Capture progress mechanics with team-presence detection
 * - Contested detection with progress freeze
 * - Dynamic color transitions: Neutral (Cyan-grey) -> Blue -> Red -> Contested (Flashing Amber)
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  const ZONE_COLORS = {
    neutral: { main: 0x667788, emissive: 0x334455, hex: '#778899' },
    blue: { main: 0x00c8ff, emissive: 0x0088ff, hex: '#00c8ff' },
    red: { main: 0xff3344, emissive: 0xcc1122, hex: '#ff3344' },
    contested: { main: 0xffaa00, emissive: 0xff7700, hex: '#ffaa00' }
  };

  class CaptureZone {
    constructor(scene, config = {}) {
      this.scene = scene;
      this.id = config.id || 'A';
      this.label = config.label || `ZONE ${this.id}`;
      this.position = config.position || new THREE.Vector3();
      this.radius = config.radius || 8.5;

      // Ownership & Progress
      this.controllingTeam = null; // null (neutral), 'blue', 'red'
      this.captureProgress = 0; // -100 (full red) to +100 (full blue)
      this.captureSpeed = 25.0; // 25% per second = 4.0 seconds for neutral -> captured
      this.isContested = false;

      // Presence tracking
      this.blueCount = 0;
      this.redCount = 0;
      this.playerInside = false;

      // 3D Objects
      this.group = new THREE.Group();
      this.group.name = `CaptureZone_${this.id}`;
      this.group.position.copy(this.position);

      this.pulseTime = 0;
      this._buildVisuals();
      this.scene.add(this.group);
    }

    _buildVisuals() {
      // 1. Ground Ring Base (Outer boundary)
      const ringGeo = new THREE.RingGeometry(this.radius - 0.35, this.radius, 48);
      this.matRing = new THREE.MeshStandardMaterial({
        color: ZONE_COLORS.neutral.main,
        emissive: ZONE_COLORS.neutral.emissive,
        emissiveIntensity: 2.0,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, this.matRing);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      this.group.add(ring);

      // 2. Inner Holographic Floor Disc (translucent)
      const discGeo = new THREE.CircleGeometry(this.radius - 0.35, 32);
      this.matDisc = new THREE.MeshStandardMaterial({
        color: ZONE_COLORS.neutral.main,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const disc = new THREE.Mesh(discGeo, this.matDisc);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.06;
      this.group.add(disc);

      // 3. Central Energy Pillar (Vertical beam of light)
      const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 7.0, 16, 1, true);
      this.matPillar = new THREE.MeshStandardMaterial({
        color: ZONE_COLORS.neutral.main,
        emissive: ZONE_COLORS.neutral.emissive,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      const pillar = new THREE.Mesh(pillarGeo, this.matPillar);
      pillar.position.y = 3.5;
      this.group.add(pillar);

      // 4. Rotating Holographic Beacon Ring at top
      const topRingGeo = new THREE.TorusGeometry(1.2, 0.08, 8, 24);
      this.matTopRing = new THREE.MeshStandardMaterial({
        color: ZONE_COLORS.neutral.main,
        emissive: ZONE_COLORS.neutral.emissive,
        emissiveIntensity: 2.5
      });
      this.topRing = new THREE.Mesh(topRingGeo, this.matTopRing);
      this.topRing.position.y = 5.5;
      this.group.add(this.topRing);

      // 5. Overhead Billboard Sprite Canvas (Letter A, B, or C)
      this._buildLetterBillboard();
    }

    _buildLetterBillboard() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      this.billboardCtx = canvas.getContext('2d');
      this.billboardTex = new THREE.CanvasTexture(canvas);

      this._drawBillboardTexture();

      const spriteMat = new THREE.SpriteMaterial({
        map: this.billboardTex,
        transparent: true,
        depthTest: false
      });
      this.sprite = new THREE.Sprite(spriteMat);
      this.sprite.position.set(0, 7.5, 0);
      this.sprite.scale.set(3.5, 3.5, 1.0);
      this.group.add(this.sprite);
    }

    _drawBillboardTexture() {
      if (!this.billboardCtx) return;
      const ctx = this.billboardCtx;
      ctx.clearRect(0, 0, 128, 128);

      let color = ZONE_COLORS.neutral.hex;
      if (this.isContested) color = ZONE_COLORS.contested.hex;
      else if (this.controllingTeam === 'blue') color = ZONE_COLORS.blue.hex;
      else if (this.controllingTeam === 'red') color = ZONE_COLORS.red.hex;

      // Outer glow circle
      ctx.beginPath();
      ctx.arc(64, 64, 52, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 14, 24, 0.85)';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Zone Letter
      ctx.font = 'bold 64px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.id, 64, 64);

      if (this.billboardTex) {
        this.billboardTex.needsUpdate = true;
      }
    }

    update(dt, allMechs, onCaptureEvent) {
      this.pulseTime += dt;

      // 1. Evaluate Mechs inside Zone radius
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

      // 3. Progress adjustment
      if (!this.isContested) {
        if (this.blueCount > 0 && this.redCount === 0) {
          // Blue capping
          const rate = this.captureSpeed * Math.min(3, this.blueCount);
          const oldProgress = this.captureProgress;
          this.captureProgress = Math.min(100, this.captureProgress + rate * dt);

          if (oldProgress < 100 && this.captureProgress >= 100) {
            if (this.controllingTeam !== 'blue') {
              this.controllingTeam = 'blue';
              if (onCaptureEvent) onCaptureEvent('captured', this, 'blue');
            }
          }
        } else if (this.redCount > 0 && this.blueCount === 0) {
          // Red capping
          const rate = this.captureSpeed * Math.min(3, this.redCount);
          const oldProgress = this.captureProgress;
          this.captureProgress = Math.max(-100, this.captureProgress - rate * dt);

          if (oldProgress > -100 && this.captureProgress <= -100) {
            if (this.controllingTeam !== 'red') {
              this.controllingTeam = 'red';
              if (onCaptureEvent) onCaptureEvent('captured', this, 'red');
            }
          }
        }
      }

      // 4. Update Visual Materials & Pulsing
      this._updateVisualState();
    }

    _updateVisualState() {
      let activeColor = ZONE_COLORS.neutral;

      if (this.isContested) {
        // Flashing amber
        const flash = Math.sin(this.pulseTime * 10.0) > 0;
        activeColor = flash ? ZONE_COLORS.contested : ZONE_COLORS.neutral;
      } else if (this.controllingTeam === 'blue') {
        activeColor = ZONE_COLORS.blue;
      } else if (this.controllingTeam === 'red') {
        activeColor = ZONE_COLORS.red;
      } else if (this.captureProgress > 0) {
        activeColor = ZONE_COLORS.blue;
      } else if (this.captureProgress < 0) {
        activeColor = ZONE_COLORS.red;
      }

      this.matRing.color.setHex(activeColor.main);
      this.matRing.emissive.setHex(activeColor.emissive);

      this.matDisc.color.setHex(activeColor.main);
      this.matDisc.opacity = this.isContested ? 0.35 : 0.2 + Math.sin(this.pulseTime * 3.0) * 0.08;

      this.matPillar.color.setHex(activeColor.main);
      this.matPillar.emissive.setHex(activeColor.emissive);

      this.matTopRing.color.setHex(activeColor.main);
      this.matTopRing.emissive.setHex(activeColor.emissive);

      // Rotate top beacon ring
      if (this.topRing) {
        this.topRing.rotation.x = this.pulseTime * 1.5;
        this.topRing.rotation.y = this.pulseTime * 2.2;
      }

      // Refresh billboard icon
      this._drawBillboardTexture();
    }

    getCapturePercent() {
      return Math.round(Math.abs(this.captureProgress));
    }

    getCaptureColorHex() {
      if (this.isContested) return ZONE_COLORS.contested.hex;
      if (this.controllingTeam === 'blue') return ZONE_COLORS.blue.hex;
      if (this.controllingTeam === 'red') return ZONE_COLORS.red.hex;
      return ZONE_COLORS.neutral.hex;
    }

    destroy() {
      if (this.group && this.group.parent) {
        this.group.parent.remove(this.group);
      }
    }
  }

  IT.CaptureZone = CaptureZone;
})(window.IT);
