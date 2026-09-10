/**
 * Iron Titans 3D — ThirdPersonCamera.js
 * Independent third-person orbital camera positioned behind and above the mech.
 * Supports:
 * - Smooth spring-damper follow and subtle inertia lag
 * - Multi-tiered dynamic camera shake (Normal fire kick, Hit flinch, Heavy impact, Destruction)
 * - Accessibility scaling (OFF, LOW, MEDIUM, HIGH)
 * - Spherical pitch/yaw orbital look with sensitivity adjustments
 * - Raycast wall collision pullback to prevent geometry clipping
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  // Reusable scratch vectors to avoid per-frame GC pressure
  const _camDesiredLookAt = new THREE.Vector3();
  const _camDir = new THREE.Vector3();
  const _camTargetPos = new THREE.Vector3();
  const _camLookFocus = new THREE.Vector3();
  const _camForward = new THREE.Vector3();
  const _camRight = new THREE.Vector3();

  class ThirdPersonCamera {
    constructor(camera, targetMech) {
      this.camera = camera;
      this.target = targetMech;

      // Spherical orbital coordinates
      this.yaw = (targetMech && typeof targetMech.heading === 'number') ? targetMech.heading : 0;
      this.pitch = 0.22;
      this.distance = 12.5;
      this.targetDistance = 12.5;
      this.heightOffset = 4.2;
      this.shoulderOffset = 1.0;

      // Sensitivity settings
      this.sensitivityX = 0.0035;
      this.sensitivityY = 0.0028;
      this.minPitch = -0.35;
      this.maxPitch = 0.85;

      // Current smoothed look-at and camera position
      this.currentLookAt = new THREE.Vector3();
      this.currentPos = new THREE.Vector3();

      // Camera Shake System
      this.shakeIntensity = 0;
      this.shakeTimer = 0;
      this.shakeDuration = 0;
      this.shakeScale = 1.0; // 0.0 = OFF, 0.4 = LOW, 0.8 = MED, 1.0 = HIGH

      // Pitch Recoil Recovery
      this.pitchRecoil = 0;

      // Wall collision raycaster
      this.raycaster = new THREE.Raycaster();

      // Mouse control tracking
      this.isMouseDown = false;
      this._setupMouseControls();
    }

    setShakeLevel(level = 'MEDIUM') {
      const mapping = { OFF: 0.0, LOW: 0.4, MEDIUM: 0.8, HIGH: 1.2 };
      this.shakeScale = mapping[level] !== undefined ? mapping[level] : 0.8;
    }

    addShake(intensity, duration = 0.25) {
      if (this.shakeScale <= 0) return;
      const scaledIntensity = intensity * this.shakeScale;
      if (scaledIntensity > this.shakeIntensity) {
        this.shakeIntensity = scaledIntensity;
        this.shakeDuration = duration;
        this.shakeTimer = duration;
      }
    }

    addRecoilKick(amount = 0.018) {
      if (this.shakeScale <= 0) return;
      this.pitchRecoil += amount * this.shakeScale;
      this.pitchRecoil = Math.min(0.08, this.pitchRecoil);
    }

    _setupMouseControls() {
      if (typeof window === 'undefined' || !window.addEventListener) return;
      window.addEventListener('mousedown', (e) => {
        if (e.button === 2 || e.button === 0) {
          this.isMouseDown = true;
        }
      });

      window.addEventListener('mouseup', () => {
        this.isMouseDown = false;
      });

      window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement || this.isMouseDown) {
          this.rotate(e.movementX, e.movementY);
        }
      });

      window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    rotate(deltaX, deltaY) {
      this.yaw += deltaX * this.sensitivityX;
      this.pitch += deltaY * this.sensitivityY;
      this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    }

    update(dt, arenaObstacles = []) {
      if (!this.target) return;

      const targetPos = this.target.position;

      // Desired look-at focus point
      _camDesiredLookAt.set(
        targetPos.x,
        targetPos.y + this.heightOffset,
        targetPos.z
      );

      // Smooth look-at lag
      this.currentLookAt.lerp(_camDesiredLookAt, Math.min(1.0, 18.0 * dt));

      // Pitch recoil recovery
      if (this.pitchRecoil > 0) {
        this.pitchRecoil = Math.max(0, this.pitchRecoil - dt * 0.15);
      }

      // Effective pitch with recoil
      const effectivePitch = Math.min(this.maxPitch, this.pitch + this.pitchRecoil);

      // Calculate camera ideal position based on spherical yaw/pitch
      const cosPitch = Math.cos(effectivePitch);
      const sinPitch = Math.sin(effectivePitch);
      const sinYaw = Math.sin(this.yaw);
      const cosYaw = Math.cos(this.yaw);

      // Shoulder offset vector
      const rightX = -cosYaw;
      const rightZ = sinYaw;

      let camX = this.currentLookAt.x - sinYaw * cosPitch * this.distance + rightX * this.shoulderOffset;
      let camY = this.currentLookAt.y + sinPitch * this.distance;
      let camZ = this.currentLookAt.z - cosYaw * cosPitch * this.distance + rightZ * this.shoulderOffset;

      // Ground clip prevention
      camY = Math.max(1.2, camY);

      // Wall collision pullback raycast
      if (arenaObstacles && arenaObstacles.length > 0) {
        _camDir.set(camX - this.currentLookAt.x, camY - this.currentLookAt.y, camZ - this.currentLookAt.z);
        const camDist = _camDir.length();
        if (camDist > 0.1) {
          _camDir.normalize();
          this.raycaster.set(this.currentLookAt, _camDir);
          const validObstacles = arenaObstacles.filter(o => o && o.isObject3D && o.visible !== false);
          if (validObstacles.length > 0) {
            const hits = this.raycaster.intersectObjects(validObstacles, false);
            if (hits.length > 0) {
              const hitDist = Math.max(2.5, hits[0].distance - 0.6);
              camX = this.currentLookAt.x + _camDir.x * hitDist;
              camY = this.currentLookAt.y + _camDir.y * hitDist;
              camZ = this.currentLookAt.z + _camDir.z * hitDist;
            }
          }
        }
      }

      // Camera Shake Application
      let shakeOffsetX = 0;
      let shakeOffsetY = 0;
      let shakeOffsetZ = 0;

      if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
        const decay = this.shakeTimer / this.shakeDuration;
        const currentAmp = this.shakeIntensity * decay;

        shakeOffsetX = (Math.random() * 2 - 1) * currentAmp;
        shakeOffsetY = (Math.random() * 2 - 1) * currentAmp * 0.8;
        shakeOffsetZ = (Math.random() * 2 - 1) * currentAmp;

        if (this.shakeTimer <= 0) {
          this.shakeIntensity = 0;
        }
      }

      // Smooth camera position damping with shake offset
      _camTargetPos.set(
        camX + shakeOffsetX,
        camY + shakeOffsetY,
        camZ + shakeOffsetZ
      );

      this.currentPos.lerp(_camTargetPos, Math.min(1.0, 22.0 * dt));
      this.camera.position.copy(this.currentPos);

      // Look at focus point (also lightly influenced by shake)
      _camLookFocus.copy(this.currentLookAt);
      if (this.shakeIntensity > 0) {
        _camLookFocus.x += shakeOffsetX * 0.4;
        _camLookFocus.y += shakeOffsetY * 0.4;
      }
      this.camera.lookAt(_camLookFocus);
    }

    getForwardDirection() {
      return _camForward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    }

    getRightDirection() {
      return _camRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    }
  }

  IT.ThirdPersonCamera = ThirdPersonCamera;
})(window.IT);
