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
      // 1. Glossy High-Tech Industrial Floor
      const floorGeo = new THREE.PlaneGeometry(100, 100);
      const floorMat = new THREE.MeshStandardMaterial({
        color: 0x0a0e18,
        roughness: 0.35,
        metalness: 0.65
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.hangarGroup.add(floor);

      // Floor grid neon seams & guidance vectors
      const seamMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.35 });
      [-12, -6, 0, 6, 12].forEach(x => {
        const stripGeo = new THREE.PlaneGeometry(0.08, 40);
        const strip = new THREE.Mesh(stripGeo, seamMat);
        strip.rotation.x = -Math.PI / 2;
        strip.position.set(x, 0.02, -5);
        this.hangarGroup.add(strip);
      });

      // 2. Heavy Hydraulic Turntable Platform (Center)
      const tableGeo = new THREE.CylinderGeometry(5.4, 5.8, 0.5, 48);
      const tableMat = new THREE.MeshStandardMaterial({
        color: 0x141b29,
        metalness: 0.85,
        roughness: 0.28
      });
      this.turntable = new THREE.Mesh(tableGeo, tableMat);
      this.turntable.position.set(0, 0.25, 0);
      this.turntable.receiveShadow = true;
      this.hangarGroup.add(this.turntable);

      // Dual Concentric Neon Rings on Turntable
      const outerRingGeo = new THREE.TorusGeometry(5.0, 0.08, 12, 48);
      const outerRingMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
      outerRing.rotation.x = Math.PI / 2;
      outerRing.position.set(0, 0.51, 0);
      this.turntable.add(outerRing);

      const innerRingGeo = new THREE.TorusGeometry(3.6, 0.05, 8, 36);
      const innerRingMat = new THREE.MeshBasicMaterial({ color: 0x0088ff });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.rotation.x = Math.PI / 2;
      innerRing.position.set(0, 0.51, 0);
      this.turntable.add(innerRing);

      // 3. Flanking Squad Staging Pedestals (Left & Right Squad Mechs)
      [-9.5, 9.5].forEach(px => {
        const squadPadGeo = new THREE.CylinderGeometry(3.2, 3.5, 0.35, 32);
        const squadPad = new THREE.Mesh(squadPadGeo, tableMat);
        squadPad.position.set(px, 0.17, -2.5);
        squadPad.receiveShadow = true;
        this.hangarGroup.add(squadPad);

        const padRingGeo = new THREE.TorusGeometry(2.9, 0.06, 8, 32);
        const padRing = new THREE.Mesh(padRingGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.6 }));
        padRing.rotation.x = Math.PI / 2;
        padRing.position.set(px, 0.36, -2.5);
        this.hangarGroup.add(padRing);

        // Holographic vertical guide pillar
        const holoBeamGeo = new THREE.CylinderGeometry(2.8, 2.8, 6.0, 24, 1, true);
        const holoBeamMat = new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.06,
          side: THREE.DoubleSide
        });
        const holoBeam = new THREE.Mesh(holoBeamGeo, holoBeamMat);
        holoBeam.position.set(px, 3.3, -2.5);
        this.hangarGroup.add(holoBeam);
      });

      // 4. Panoramic Space Bay Window & Station Architecture (Backdrop)
      // Space Starfield
      const starGeo = new THREE.BufferGeometry();
      const starCount = 1000;
      const starCoords = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i += 3) {
        starCoords[i] = (Math.random() - 0.5) * 160;
        starCoords[i + 1] = Math.random() * 60 + 5;
        starCoords[i + 2] = -40 - Math.random() * 50;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starCoords, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xddeeff, size: 0.7, transparent: true, opacity: 0.85 });
      const stars = new THREE.Points(starGeo, starMat);
      this.hangarGroup.add(stars);

      // Distant Gas Giant Planet / Celestial Horizon
      const planetGeo = new THREE.SphereGeometry(22, 32, 32);
      const planetMat = new THREE.MeshStandardMaterial({
        color: 0x0c2540,
        emissive: 0x003366,
        emissiveIntensity: 0.4,
        roughness: 0.7
      });
      const planet = new THREE.Mesh(planetGeo, planetMat);
      planet.position.set(32, 14, -60);
      this.hangarGroup.add(planet);

      // Planet Atmospheric Rim Ring
      const atmoRingGeo = new THREE.RingGeometry(22.2, 23.5, 48);
      const atmoRingMat = new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65
      });
      const atmoRing = new THREE.Mesh(atmoRingGeo, atmoRingMat);
      atmoRing.position.set(32, 14, -59.5);
      this.hangarGroup.add(atmoRing);

      // Panoramic Hangar Window Arch & Struts
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x111624, metalness: 0.9, roughness: 0.3 });
      const windowArch = new THREE.BoxGeometry(70, 1.8, 1.8);
      const topBeam = new THREE.Mesh(windowArch, frameMat);
      topBeam.position.set(0, 18, -22);
      this.hangarGroup.add(topBeam);

      const bottomBeam = new THREE.Mesh(windowArch, frameMat);
      bottomBeam.position.set(0, 1.0, -22);
      this.hangarGroup.add(bottomBeam);

      [-28, -14, 0, 14, 28].forEach(sx => {
        const strutGeo = new THREE.BoxGeometry(1.4, 18, 1.4);
        const strut = new THREE.Mesh(strutGeo, frameMat);
        strut.position.set(sx, 9.5, -22);
        this.hangarGroup.add(strut);

        // Vertical Cyan LED Pillar Trim
        const ledGeo = new THREE.PlaneGeometry(0.12, 17);
        const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.7 }));
        led.position.set(sx, 9.5, -21.2);
        this.hangarGroup.add(led);
      });

      // Translucent Observation Glass
      const glassGeo = new THREE.PlaneGeometry(68, 17);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x002244,
        metalness: 0.95,
        roughness: 0.1,
        transparent: true,
        opacity: 0.28
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(0, 9.5, -21.8);
      this.hangarGroup.add(glass);

      // 5. Overhead Industrial Girders & High Rafters
      [-12, 0, 12].forEach(gx => {
        const girderGeo = new THREE.BoxGeometry(1.2, 1.2, 40);
        const girder = new THREE.Mesh(girderGeo, frameMat);
        girder.position.set(gx, 18, -2);
        this.hangarGroup.add(girder);
      });

      // 6. Dramatic AAA Studio Lighting Rig
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
      keyLight.position.set(8, 20, 14);
      keyLight.castShadow = true;
      this.hangarGroup.add(keyLight);

      // Electric Cyan Rim Light (Left)
      const rimLightCyan = new THREE.DirectionalLight(0x00f0ff, 1.6);
      rimLightCyan.position.set(-15, 12, -8);
      this.hangarGroup.add(rimLightCyan);

      // Warm Amber Accent Rim Light (Right)
      const rimLightAmber = new THREE.DirectionalLight(0xff6622, 1.0);
      rimLightAmber.position.set(16, 10, -8);
      this.hangarGroup.add(rimLightAmber);

      // Ground Turntable Uplight
      const platformUplight = new THREE.PointLight(0x00c8ff, 2.2, 12);
      platformUplight.position.set(0, 0.8, 0);
      this.hangarGroup.add(platformUplight);

      // Ambient Floor Fill Light
      const ambientFloor = new THREE.HemisphereLight(0x1a2b4c, 0x050810, 1.1);
      this.hangarGroup.add(ambientFloor);
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
