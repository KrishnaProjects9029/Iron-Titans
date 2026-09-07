/**
 * Iron Titans 3D — GarageScene.js
 * 3D Industrial Hangar Environment for Mech & Weapon Inspection:
 * - Rotating inspection turntable platform with glowing energy hazard trim
 * - High industrial ceiling girders, spotlights, robotic maintenance arms
 * - Interactive orbit controls: mouse drag / 1-finger swipe to rotate, wheel / pinch to zoom
 * - Idle mechanical animations (breathing sway, joint micro-movements)
 * - Seamless switching between full Mech inspection and standalone Weapon inspection
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class GarageScene {
    constructor(scene, camera) {
      this.scene = scene;
      this.camera = camera;

      this.hangarGroup = new THREE.Group();
      this.hangarGroup.name = 'HangarGarage';
      this.scene.add(this.hangarGroup);

      // Inspection state
      this.yaw = 0.2;
      this.pitch = 0.12;
      this.distance = 14.0;
      this.minDistance = 7.0;
      this.maxDistance = 24.0;
      this.targetLookAt = new THREE.Vector3(0, 2.5, 0);

      // Drag / touch interaction
      this.isDragging = false;
      this.lastMouseX = 0;
      this.lastMouseY = 0;
      this.touchStartDist = 0;

      // Current 3D preview model
      this.currentMechRig = null;
      this.currentWeaponRig = null;
      this.animTime = 0;

      this._buildHangarEnvironment();
      this._setupInputListeners();
    }

    _buildHangarEnvironment() {
      // 1. Concrete Industrial Floor with hazard stripes
      const floorGeo = new THREE.PlaneGeometry(80, 80);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x121620,
        roughness: 0.65,
        metalness: 0.35
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.hangarGroup.add(floor);

      // Floor grid trim lines
      const gridGeo = new THREE.PlaneGeometry(60, 0.3);
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x243044, roughness: 0.4 });
      for (let z = -25; z <= 25; z += 10) {
        const line = new THREE.Mesh(gridGeo, trimMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.02, z);
        this.hangarGroup.add(line);
      }

      // 2. Heavy Hydraulic Turntable Platform
      const tableGeo = new THREE.CylinderGeometry(5.2, 5.6, 0.6, 32);
      const tableMat = new THREE.MeshStandardMaterial({
        color: 0x1c2432,
        metalness: 0.85,
        roughness: 0.35
      });
      this.turntable = new THREE.Mesh(tableGeo, tableMat);
      this.turntable.position.set(0, 0.3, 0);
      this.turntable.receiveShadow = true;
      this.hangarGroup.add(this.turntable);

      // Glowing circular hazard neon ring on turntable
      const ringGeo = new THREE.TorusGeometry(4.8, 0.1, 8, 32);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x00c8ff,
        emissiveIntensity: 2.0
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.61, 0);
      this.hangarGroup.add(ring);

      // 3. High Industrial Ceiling Girders & Rafters
      const girderMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, metalness: 0.9, roughness: 0.5 });
      [-12, 0, 12].forEach(gx => {
        const beamGeo = new THREE.BoxGeometry(1.2, 1.2, 50);
        const beam = new THREE.Mesh(beamGeo, girderMat);
        beam.position.set(gx, 15, 0);
        this.hangarGroup.add(beam);
      });

      // 4. Robotic Maintenance Station Arms
      [-7, 7].forEach(rx => {
        const baseGeo = new THREE.CylinderGeometry(0.8, 1.0, 3.5, 8);
        const base = new THREE.Mesh(baseGeo, girderMat);
        base.position.set(rx, 1.75, -5);
        this.hangarGroup.add(base);

        const armGeo = new THREE.BoxGeometry(0.4, 0.4, 5.0);
        const arm = new THREE.Mesh(armGeo, tableMat);
        arm.position.set(rx, 4.0, -3.0);
        arm.rotation.x = -Math.PI * 0.15;
        this.hangarGroup.add(arm);
      });

      // 5. Dramatic Hangar Lighting Rig
      const keyLight = new THREE.DirectionalLight(0xddeeff, 1.4);
      keyLight.position.set(10, 18, 12);
      keyLight.castShadow = true;
      this.hangarGroup.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x00c8ff, 1.2);
      rimLight.position.set(-12, 12, -10);
      this.hangarGroup.add(rimLight);

      const fillLight = new THREE.PointLight(0xff7722, 1.5, 25);
      fillLight.position.set(0, 1.5, 6);
      this.hangarGroup.add(fillLight);
    }

    _setupInputListeners() {
      // Desktop mouse drag & wheel zoom
      window.addEventListener('mousedown', (e) => {
        if (!this.hangarGroup.visible) return;
        // Ignore clicks on HUD/UI overlays
        if (e.target.closest('#hud-container') || e.target.closest('button') || e.target.closest('.garage-panel')) return;
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging || !this.hangarGroup.visible) return;
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        this.yaw -= dx * 0.008;
        this.pitch = Math.max(-0.2, Math.min(0.5, this.pitch + dy * 0.006));
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });

      window.addEventListener('wheel', (e) => {
        if (!this.hangarGroup.visible) return;
        if (e.target.closest('.garage-panel') || e.target.closest('.scrollable')) return;
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + e.deltaY * 0.015));
      }, { passive: true });

      // Mobile Touch Swipe Rotation & Pinch Zoom
      window.addEventListener('touchstart', (e) => {
        if (!this.hangarGroup.visible) return;
        if (e.target.closest('button') || e.target.closest('.garage-panel')) return;

        if (e.touches.length === 1) {
          this.isDragging = true;
          this.lastMouseX = e.touches[0].clientX;
          this.lastMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          this.isDragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          this.touchStartDist = Math.hypot(dx, dy);
        }
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (!this.hangarGroup.visible) return;
        if (e.target.closest('button') || e.target.closest('.garage-panel')) return;

        if (e.touches.length === 1 && this.isDragging) {
          const dx = e.touches[0].clientX - this.lastMouseX;
          const dy = e.touches[0].clientY - this.lastMouseY;
          this.lastMouseX = e.touches[0].clientX;
          this.lastMouseY = e.touches[0].clientY;

          this.yaw -= dx * 0.01;
          this.pitch = Math.max(-0.2, Math.min(0.5, this.pitch + dy * 0.008));
        } else if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const curDist = Math.hypot(dx, dy);
          if (this.touchStartDist > 0) {
            const delta = (this.touchStartDist - curDist) * 0.04;
            this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + delta));
            this.touchStartDist = curDist;
          }
        }
      }, { passive: true });

      window.addEventListener('touchend', () => {
        this.isDragging = false;
        this.touchStartDist = 0;
      });
    }

    show() {
      this.hangarGroup.visible = true;
      this.distance = 13.5;
      this.targetLookAt.set(0, 2.5, 0);
    }

    hide() {
      this.hangarGroup.visible = false;
    }

    /**
     * Spawns and previews the selected mech with its equipped weapons on the turntable.
     */
    previewMech(mechId, primaryWeaponId = 'pulseCannon', secondaryWeaponId = 'scatterBlaster') {
      if (this.currentMechRig) {
        this.hangarGroup.remove(this.currentMechRig.root);
        this.currentMechRig = null;
      }
      if (this.currentWeaponRig) {
        this.hangarGroup.remove(this.currentWeaponRig.root);
        this.currentWeaponRig = null;
      }

      this.currentMechRig = IT.MechBuilder3D.buildMech(mechId, {
        team: 'blue',
        primaryWeapon: primaryWeaponId,
        secondaryWeapon: secondaryWeaponId
      });

      this.currentMechRig.root.position.set(0, 0.6, 0);
      this.hangarGroup.add(this.currentMechRig.root);
      this.targetLookAt.set(0, 2.7, 0);
    }

    /**
     * Inspects a single weapon on an elevated pedestal.
     */
    previewWeapon(weaponId) {
      if (this.currentMechRig) {
        this.hangarGroup.remove(this.currentMechRig.root);
        this.currentMechRig = null;
      }
      if (this.currentWeaponRig) {
        this.hangarGroup.remove(this.currentWeaponRig.root);
        this.currentWeaponRig = null;
      }

      const wep = IT.WeaponBuilder3D.buildWeapon(weaponId, { team: 'blue' });
      wep.root.position.set(0, 2.2, 0);
      wep.root.scale.set(1.8, 1.8, 1.8);
      this.hangarGroup.add(wep.root);
      this.currentWeaponRig = wep;
      this.targetLookAt.set(0, 2.2, 0);
      this.distance = 9.0;
    }

    update(dt) {
      if (!this.hangarGroup.visible) return;
      this.animTime += dt;

      // Gentle auto-rotation when user is not dragging
      if (!this.isDragging) {
        this.yaw += dt * 0.18;
      }

      // Rotate turntable platform slowly
      if (this.turntable) {
        this.turntable.rotation.y += dt * 0.12;
      }

      // ── Idle Breathing Animation on Mech ──
      if (this.currentMechRig) {
        const breath = Math.sin(this.animTime * 2.0) * 0.04;
        this.currentMechRig.pelvisGroup.position.y = 2.6 + breath;

        // Gentle arm sway
        if (this.currentMechRig.arms && this.currentMechRig.arms.length >= 2) {
          this.currentMechRig.arms[0].rotation.x = Math.sin(this.animTime * 1.5) * 0.03;
          this.currentMechRig.arms[1].rotation.x = -Math.sin(this.animTime * 1.5) * 0.03;
        }

        // Reactor glow pulse
        if (this.currentMechRig.materials && this.currentMechRig.materials.energy) {
          this.currentMechRig.materials.energy.emissiveIntensity = 2.0 + Math.sin(this.animTime * 3.0) * 0.6;
        }
      }

      // Gentle weapon pedestal float & spin
      if (this.currentWeaponRig) {
        this.currentWeaponRig.root.position.y = 2.2 + Math.sin(this.animTime * 2.5) * 0.08;
        this.currentWeaponRig.root.rotation.y += dt * 0.8;
      }

      // ── Camera Orbit Positioning ──
      const cx = this.targetLookAt.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
      const cy = this.targetLookAt.y + Math.sin(this.pitch) * this.distance;
      const cz = this.targetLookAt.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(this.targetLookAt);
    }
  }

  IT.GarageScene = GarageScene;
})(window.IT);
