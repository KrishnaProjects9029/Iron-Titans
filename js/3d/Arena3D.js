/**
 * Iron Titans 3D — Arena3D.js
 * Neon Forge 3D Arena: a massive futuristic industrial weapons facility
 * featuring elevated platforms, access ramps, sky-bridges, hexagonal reactor pillars,
 * shipping containers, molten lava hazards, and tactical cover barricades.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class Arena3D {
    constructor(scene) {
      this.scene = scene;
      this.arenaGroup = new THREE.Group();
      this.arenaGroup.name = 'NeonForgeArena';
      this.scene.add(this.arenaGroup);

      // Colliders for physics & projectile raycasting
      this.colliders = []; // [{minX, maxX, minZ, maxZ, minY, maxY, mesh}]
      this.raycastMeshes = [];
      this.animatedProps = [];

      this._buildMaterials();
      this._buildFloor();
      this._buildPerimeterWalls();
      this._buildCentralPlatformAndRamps();
      this._buildTacticalCover();
      this._buildReactorPillars();
      this._buildLavaHazards();
    }

    _buildMaterials() {
      this.matFloor = new THREE.MeshStandardMaterial({
        color: 0x141824,
        roughness: 0.6,
        metalness: 0.4
      });

      this.matWall = new THREE.MeshStandardMaterial({
        color: 0x222838,
        roughness: 0.5,
        metalness: 0.7
      });

      this.matTrim = new THREE.MeshStandardMaterial({
        color: 0x3d4760,
        roughness: 0.3,
        metalness: 0.85
      });

      this.matCrate = new THREE.MeshStandardMaterial({
        color: 0x7c3a21,
        roughness: 0.5,
        metalness: 0.3
      });

      this.matCrateBlue = new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        roughness: 0.5,
        metalness: 0.4
      });

      this.matPillar = new THREE.MeshStandardMaterial({
        color: 0x2b3345,
        roughness: 0.4,
        metalness: 0.8
      });

      this.matNeonCyan = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0x00e1ff,
        emissiveIntensity: 1.5
      });

      this.matNeonOrange = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xff6600,
        emissiveIntensity: 1.6
      });

      this.matLava = new THREE.MeshStandardMaterial({
        color: 0x330000,
        emissive: 0xff3300,
        emissiveIntensity: 2.0,
        roughness: 0.2
      });
    }

    _addCollider(mesh, w, h, d, x, y, z) {
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.arenaGroup.add(mesh);
      this.raycastMeshes.push(mesh);

      this.colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minZ: z - d / 2,
        maxZ: z + d / 2,
        minY: y - h / 2,
        maxY: y + h / 2,
        mesh
      });
    }

    _buildFloor() {
      // Main arena ground plane (160 x 160 units)
      const floorGeo = new THREE.PlaneGeometry(160, 160, 32, 32);
      const floorMesh = new THREE.Mesh(floorGeo, this.matFloor);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = true;
      this.arenaGroup.add(floorMesh);
      this.raycastMeshes.push(floorMesh);

      // Floor grid marker stripes
      const stripeGeo = new THREE.PlaneGeometry(150, 0.4);
      for (let z = -60; z <= 60; z += 20) {
        const stripe = new THREE.Mesh(stripeGeo, this.matTrim);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.02, z);
        this.arenaGroup.add(stripe);
      }
    }

    _buildPerimeterWalls() {
      const halfSize = 75;
      const wallH = 10;
      const wallThick = 4;
      const wallLen = 150;

      // 4 outer perimeter blast walls
      const configs = [
        { w: wallLen, h: wallH, d: wallThick, x: 0, y: wallH / 2, z: halfSize },
        { w: wallLen, h: wallH, d: wallThick, x: 0, y: wallH / 2, z: -halfSize },
        { w: wallThick, h: wallH, d: wallLen, x: halfSize, y: wallH / 2, z: 0 },
        { w: wallThick, h: wallH, d: wallLen, x: -halfSize, y: wallH / 2, z: 0 }
      ];

      configs.forEach(c => {
        const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
        const mesh = new THREE.Mesh(geo, this.matWall);
        this._addCollider(mesh, c.w, c.h, c.d, c.x, c.y, c.z);

        // Neon warning border along top
        const neonGeo = new THREE.BoxGeometry(c.w > c.d ? c.w : 0.4, 0.3, c.d > c.w ? c.d : 0.4);
        const neon = new THREE.Mesh(neonGeo, this.matNeonOrange);
        neon.position.set(c.x, c.h - 0.2, c.z);
        this.arenaGroup.add(neon);
      });
    }

    _buildCentralPlatformAndRamps() {
      // Elevated central combat deck (28 x 28 x 4 units high)
      const deckW = 28;
      const deckH = 4;
      const deckD = 28;
      const deckGeo = new THREE.BoxGeometry(deckW, deckH, deckD);
      const deckMesh = new THREE.Mesh(deckGeo, this.matTrim);
      this._addCollider(deckMesh, deckW, deckH, deckD, 0, deckH / 2, 0);

      // Access Ramps leading onto the platform
      const rampLen = 14;
      const rampW = 8;
      const rampH = 4;
      const rampAngle = Math.atan2(rampH, rampLen);

      [-1, 1].forEach(dir => {
        const rampGeo = new THREE.BoxGeometry(rampW, 0.8, rampLen + 2);
        const ramp = new THREE.Mesh(rampGeo, this.matFloor);
        ramp.rotation.x = dir * rampAngle;
        const rz = dir * (deckD / 2 + rampLen / 2 - 1);
        this._addCollider(ramp, rampW, rampH, rampLen, 0, rampH / 2, rz);
      });

      // Sky Bridge connecting from platform to side sniper tower
      const bridgeGeo = new THREE.BoxGeometry(32, 0.8, 6);
      const bridge = new THREE.Mesh(bridgeGeo, this.matTrim);
      this._addCollider(bridge, 32, 0.8, 6, 30, deckH, 0);
    }

    _buildTacticalCover() {
      // Heavy shipping cargo containers
      const crateCoords = [
        { x: -25, z: -20, rot: 0.2, mat: this.matCrate },
        { x: -28, z: 25, rot: -0.4, mat: this.matCrateBlue },
        { x: 25, z: -35, rot: 0.1, mat: this.matCrateBlue },
        { x: 30, z: 22, rot: 0.5, mat: this.matCrate },
        { x: -45, z: -5, rot: 0.0, mat: this.matCrate },
        { x: 45, z: -5, rot: 0.0, mat: this.matCrateBlue },
        { x: 0, z: -45, rot: 0.3, mat: this.matCrate },
        { x: 0, z: 45, rot: -0.2, mat: this.matCrateBlue }
      ];

      crateCoords.forEach(c => {
        const w = 7.0, h = 4.2, d = 3.6;
        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, c.mat);
        mesh.rotation.y = c.rot;
        this._addCollider(mesh, w, h, d, c.x, h / 2, c.z);
      });

      // Low concrete barricades (duck behind cover)
      const barricades = [
        { x: -14, z: -16, w: 9, h: 2.2, d: 1.4 },
        { x: 14, z: -16, w: 9, h: 2.2, d: 1.4 },
        { x: -14, z: 16, w: 9, h: 2.2, d: 1.4 },
        { x: 14, z: 16, w: 9, h: 2.2, d: 1.4 }
      ];

      barricades.forEach(b => {
        const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const mesh = new THREE.Mesh(geo, this.matWall);
        this._addCollider(mesh, b.w, b.h, b.d, b.x, b.h / 2, b.z);
      });
    }

    _buildReactorPillars() {
      // 4 Giant Hexagonal Industrial Reactor Pillars
      const pillarCoords = [
        { x: -35, z: -35 },
        { x: 35, z: -35 },
        { x: -35, z: 35 },
        { x: 35, z: 35 }
      ];

      pillarCoords.forEach(p => {
        const r = 3.8;
        const h = 24;
        const geo = new THREE.CylinderGeometry(r, r * 1.15, h, 6);
        const mesh = new THREE.Mesh(geo, this.matPillar);
        this._addCollider(mesh, r * 2, h, r * 2, p.x, h / 2, p.z);

        // Neon power ring bands on pillars
        [-4, 4].forEach(offsetY => {
          const ringGeo = new THREE.TorusGeometry(r + 0.1, 0.2, 8, 24);
          const ring = new THREE.Mesh(ringGeo, this.matNeonCyan);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(p.x, h / 2 + offsetY, p.z);
          this.arenaGroup.add(ring);
        });

        // Top cooling turbine fan rotor
        const fanGroup = new THREE.Group();
        fanGroup.position.set(p.x, h + 0.2, p.z);
        const bladeGeo = new THREE.BoxGeometry(0.3, 0.1, r * 1.6);
        const blade1 = new THREE.Mesh(bladeGeo, this.matTrim);
        const blade2 = new THREE.Mesh(bladeGeo, this.matTrim);
        blade2.rotation.y = Math.PI / 2;
        fanGroup.add(blade1);
        fanGroup.add(blade2);
        this.arenaGroup.add(fanGroup);
        this.animatedProps.push({ mesh: fanGroup, type: 'ROTATE_Y', speed: 2.2 });
      });
    }

    _buildLavaHazards() {
      // Molten energy conduits on the left and right flanks
      [-52, 52].forEach(lx => {
        const lavaW = 8;
        const lavaL = 80;
        const lavaGeo = new THREE.PlaneGeometry(lavaW, lavaL);
        const lavaMesh = new THREE.Mesh(lavaGeo, this.matLava);
        lavaMesh.rotation.x = -Math.PI / 2;
        lavaMesh.position.set(lx, 0.05, 0);
        this.arenaGroup.add(lavaMesh);

        // Point lights casting warm orange glow
        const lavaLight = new THREE.PointLight(0xff4400, 1.2, 35);
        lavaLight.position.set(lx, 3, 0);
        this.arenaGroup.add(lavaLight);
      });
    }

    /**
     * Resolves circle collision against all static obstacles in the arena.
     * Returns slid/clamped { x, z } position.
     */
    resolveCollision(x, z, radius) {
      let resolvedX = x;
      let resolvedZ = z;

      // Arena world outer boundary clamp
      const bounds = 71;
      resolvedX = Math.max(-bounds, Math.min(bounds, resolvedX));
      resolvedZ = Math.max(-bounds, Math.min(bounds, resolvedZ));

      // Check AABB obstacle collision
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        const exMin = c.minX - radius;
        const exMax = c.maxX + radius;
        const ezMin = c.minZ - radius;
        const ezMax = c.maxZ + radius;

        if (resolvedX >= exMin && resolvedX <= exMax && resolvedZ >= ezMin && resolvedZ <= ezMax) {
          const overLeft = resolvedX - exMin;
          const overRight = exMax - resolvedX;
          const overTop = resolvedZ - ezMin;
          const overBottom = ezMax - resolvedZ;

          const minOverX = Math.min(overLeft, overRight);
          const minOverZ = Math.min(overTop, overBottom);

          if (minOverX < minOverZ) {
            resolvedX = overLeft < overRight ? exMin : exMax;
          } else {
            resolvedZ = overTop < overBottom ? ezMin : ezMax;
          }
        }
      }

      return { x: resolvedX, z: resolvedZ };
    }

    update(dt) {
      if (this.animatedProps) {
        this.animatedProps.forEach(p => {
          if (p.type === 'ROTATE_Y') {
            p.mesh.rotation.y += p.speed * dt;
          }
        });
      }
    }

    getRaycastTargets() {
      return this.raycastMeshes;
    }

    getConfig() {
      return IT.ArenaRegistry ? IT.ArenaRegistry.get('NEON_FORGE') : null;
    }

    destroy() {
      if (this.arenaGroup) {
        if (this.arenaGroup.parent) {
          this.arenaGroup.parent.remove(this.arenaGroup);
        }
        if (IT.Engine3D && IT.Engine3D.disposeHierarchy) {
          IT.Engine3D.disposeHierarchy(this.arenaGroup);
        }
      }
      this.colliders = [];
      this.raycastMeshes = [];
      this.animatedProps = [];
    }
  }

  IT.Arena3D = Arena3D;
})(window.IT);
