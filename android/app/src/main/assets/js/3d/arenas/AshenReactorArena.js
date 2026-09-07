/**
 * Iron Titans 3D — AshenReactorArena.js
 * 3D Arena 3: Ashen Reactor — Subterranean Energy Core:
 * - Central glowing plasma reactor core with pulsating containment field
 * - Heavy industrial blast containment bulkheads, turbine chambers, and elevated catwalks
 * - Toxic cooling conduit trenches and magnetic choke points for intense close/mid-range combat
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class AshenReactorArena {
    constructor(scene) {
      this.scene = scene;
      this.arenaGroup = new THREE.Group();
      this.arenaGroup.name = 'AshenReactorArena';
      this.scene.add(this.arenaGroup);

      this.colliders = [];
      this.raycastMeshes = [];
      this.animatedProps = [];

      this._buildMaterials();
      this._buildBasaltFloor();
      this._buildContainmentWalls();
      this._buildCentralReactorCore();
      this._buildTurbineChambers();
      this._buildHazardConduits();
    }

    _buildMaterials() {
      this.matFloor = new THREE.MeshStandardMaterial({
        color: 0x0f1118,
        roughness: 0.65,
        metalness: 0.4
      });

      this.matBulkhead = new THREE.MeshStandardMaterial({
        color: 0x1e2430,
        roughness: 0.5,
        metalness: 0.75
      });

      this.matCoreHousing = new THREE.MeshStandardMaterial({
        color: 0x2d1b28,
        roughness: 0.35,
        metalness: 0.85
      });

      // Reactor plasma core
      this.matPlasma = new THREE.MeshStandardMaterial({
        color: 0x440022,
        emissive: 0xff0055,
        emissiveIntensity: 2.8,
        roughness: 0.2
      });

      // Conduit pipes
      this.matConduit = new THREE.MeshStandardMaterial({
        color: 0x3b4252,
        roughness: 0.3,
        metalness: 0.85
      });

      this.matConduitGlow = new THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: 0xff3300,
        emissiveIntensity: 2.2
      });

      this.matHazardGrate = new THREE.MeshStandardMaterial({
        color: 0x221100,
        emissive: 0xff6600,
        emissiveIntensity: 1.6,
        roughness: 0.3
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

    _buildBasaltFloor() {
      const floorGeo = new THREE.PlaneGeometry(150, 150);
      const floor = new THREE.Mesh(floorGeo, this.matFloor);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.arenaGroup.add(floor);
    }

    _buildContainmentWalls() {
      const wallH = 12.0;
      const wallThick = 4.0;
      const span = 140.0;

      // Reinforced blast containment perimeter
      const hWallGeo = new THREE.BoxGeometry(span, wallH, wallThick);
      this._addCollider(new THREE.Mesh(hWallGeo, this.matBulkhead), span, wallH, wallThick, 0, wallH / 2, -70);
      this._addCollider(new THREE.Mesh(hWallGeo, this.matBulkhead), span, wallH, wallThick, 0, wallH / 2, 70);

      const vWallGeo = new THREE.BoxGeometry(wallThick, wallH, span);
      this._addCollider(new THREE.Mesh(vWallGeo, this.matBulkhead), wallThick, wallH, span, -70, wallH / 2, 0);
      this._addCollider(new THREE.Mesh(vWallGeo, this.matBulkhead), wallThick, wallH, span, 70, wallH / 2, 0);
    }

    _buildCentralReactorCore() {
      // Elevated octagonal core foundation platform
      const baseGeo = new THREE.CylinderGeometry(11.0, 12.5, 2.4, 8);
      const baseMesh = new THREE.Mesh(baseGeo, this.matCoreHousing);
      this._addCollider(baseMesh, 22.0, 2.4, 22.0, 0, 1.2, 0);

      // Central cylindrical pulsating plasma chamber
      const coreGeo = new THREE.CylinderGeometry(4.0, 4.0, 14.0, 16);
      const coreMesh = new THREE.Mesh(coreGeo, this.matPlasma);
      coreMesh.position.set(0, 9.0, 0);
      this.arenaGroup.add(coreMesh);

      // Rotating magnetic containment rings
      [-3, 3].forEach((offsetY, idx) => {
        const ringGeo = new THREE.TorusGeometry(5.2, 0.25, 8, 24);
        const ring = new THREE.Mesh(ringGeo, this.matHazardGrate);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 9.0 + offsetY, 0);
        this.arenaGroup.add(ring);
        this.animatedProps.push({ mesh: ring, type: 'ROTATE_Y', speed: (idx === 0 ? 1 : -1) * 1.5 });
      });

      // Core point light
      const coreLight = new THREE.PointLight(0xff0055, 2.2, 50);
      coreLight.position.set(0, 10.0, 0);
      this.arenaGroup.add(coreLight);

      // 4 Heavy magnetic stabilization pillars surrounding core
      [
        { x: -9, z: -9 },
        { x: 9, z: -9 },
        { x: -9, z: 9 },
        { x: 9, z: 9 }
      ].forEach(p => {
        const pillarGeo = new THREE.BoxGeometry(2.8, 12.0, 2.8);
        this._addCollider(new THREE.Mesh(pillarGeo, this.matBulkhead), 2.8, 12.0, 2.8, p.x, 6.0, p.z);
      });
    }

    _buildTurbineChambers() {
      // 4 Large Generator/Turbine rooms at the corners
      const tW = 12.0, tH = 8.0, tD = 12.0;
      const tGeo = new THREE.BoxGeometry(tW, tH, tD);

      const turbineLocs = [
        { x: -32, z: -32 },
        { x: 32, z: -32 },
        { x: -32, z: 32 },
        { x: 32, z: 32 }
      ];

      turbineLocs.forEach(tl => {
        const tMesh = new THREE.Mesh(tGeo, this.matBulkhead);
        this._addCollider(tMesh, tW, tH, tD, tl.x, tH / 2, tl.z);
      });

      // Tactical blast barricades forming choke points
      const bGeo = new THREE.BoxGeometry(10.0, 3.2, 2.2);
      [
        { x: -22, z: 0, rotY: Math.PI / 2 },
        { x: 22, z: 0, rotY: Math.PI / 2 },
        { x: 0, z: -25, rotY: 0 },
        { x: 0, z: 25, rotY: 0 }
      ].forEach(bp => {
        const bMesh = new THREE.Mesh(bGeo, this.matCoreHousing);
        if (bp.rotY) bMesh.rotation.y = bp.rotY;
        const w = bp.rotY ? 2.2 : 10.0;
        const d = bp.rotY ? 10.0 : 2.2;
        this._addCollider(bMesh, w, 3.2, d, bp.x, 1.6, bp.z);
      });
    }

    _buildHazardConduits() {
      // Overhead magnetic energy conduits running from the core to the walls
      const pipeGeo = new THREE.CylinderGeometry(0.8, 0.8, 55, 12);
      [-1, 1].forEach(dir => {
        // X-axis pipes
        const pipeX = new THREE.Mesh(pipeGeo, this.matConduit);
        pipeX.rotation.z = Math.PI / 2;
        pipeX.position.set(dir * 30, 8.5, 0);
        this.arenaGroup.add(pipeX);

        // Z-axis pipes
        const pipeZ = new THREE.Mesh(pipeGeo, this.matConduit);
        pipeZ.rotation.x = Math.PI / 2;
        pipeZ.position.set(0, 8.5, dir * 30);
        this.arenaGroup.add(pipeZ);
      });
    }

    resolveCollision(x, z, radius) {
      let resolvedX = x;
      let resolvedZ = z;

      const bounds = 67;
      resolvedX = Math.max(-bounds, Math.min(bounds, resolvedX));
      resolvedZ = Math.max(-bounds, Math.min(bounds, resolvedZ));

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
      return IT.ArenaRegistry.get('ASHEN_REACTOR');
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

  IT.AshenReactorArena = AshenReactorArena;
})(window.IT);
