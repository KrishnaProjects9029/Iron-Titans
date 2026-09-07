/**
 * Iron Titans 3D — TitanDocksArena.js
 * 3D Arena 2: Titan Docks — Futuristic Cargo Shipping Terminal:
 * - Giant overhead gantry cranes, rail tracks, multi-tier cargo container stacks
 * - Open shipping lanes for long-range engagements & tight container alleys for mid-range skirmishes
 * - Dynamic collision system and raycasting meshes
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class TitanDocksArena {
    constructor(scene) {
      this.scene = scene;
      this.arenaGroup = new THREE.Group();
      this.arenaGroup.name = 'TitanDocksArena';
      this.scene.add(this.arenaGroup);

      this.colliders = [];
      this.raycastMeshes = [];
      this.animatedProps = [];

      this._buildMaterials();
      this._buildDockFloor();
      this._buildPerimeterSeawall();
      this._buildCentralGantryCranes();
      this._buildContainerStacks();
      this._buildElevatedWalkways();
      this._buildNavigationalBeacons();
    }

    _buildMaterials() {
      // Dark tarmac wet dock floor
      this.matFloor = new THREE.MeshStandardMaterial({
        color: 0x121720,
        roughness: 0.55,
        metalness: 0.45
      });

      // Seawall concrete
      this.matConcrete = new THREE.MeshStandardMaterial({
        color: 0x222a38,
        roughness: 0.6,
        metalness: 0.3
      });

      // Crane steel
      this.matCraneSteel = new THREE.MeshStandardMaterial({
        color: 0xd97706, // High-visibility industrial yellow
        roughness: 0.4,
        metalness: 0.65
      });

      this.matDarkSteel = new THREE.MeshStandardMaterial({
        color: 0x1c2430,
        roughness: 0.45,
        metalness: 0.8
      });

      // Containers (4 color variants)
      this.matContainerOrange = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.5, metalness: 0.35 });
      this.matContainerBlue = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.5, metalness: 0.35 });
      this.matContainerTeal = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5, metalness: 0.35 });
      this.matContainerCharcoal = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.4 });

      // Neon warning and beacon lights
      this.matBeaconOrange = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff6600, emissiveIntensity: 2.2 });
      this.matBeaconCyan = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x00c8ff, emissiveIntensity: 2.0 });
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

    _buildDockFloor() {
      const floorGeo = new THREE.PlaneGeometry(170, 170);
      const floor = new THREE.Mesh(floorGeo, this.matFloor);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.arenaGroup.add(floor);

      // Yellow crane rail tracks across the floor
      const railGeo = new THREE.PlaneGeometry(0.8, 150);
      const railMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.3 });
      [-22, 22].forEach(rx => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.rotation.x = -Math.PI / 2;
        rail.position.set(rx, 0.02, 0);
        this.arenaGroup.add(rail);
      });
    }

    _buildPerimeterSeawall() {
      const wallH = 9.0;
      const wallThick = 4.0;
      const span = 160.0;

      // North & South seawalls
      const hWallGeo = new THREE.BoxGeometry(span, wallH, wallThick);
      this._addCollider(new THREE.Mesh(hWallGeo, this.matConcrete), span, wallH, wallThick, 0, wallH / 2, -80);
      this._addCollider(new THREE.Mesh(hWallGeo, this.matConcrete), span, wallH, wallThick, 0, wallH / 2, 80);

      // East & West seawalls
      const vWallGeo = new THREE.BoxGeometry(wallThick, wallH, span);
      this._addCollider(new THREE.Mesh(vWallGeo, this.matConcrete), wallThick, wallH, span, -80, wallH / 2, 0);
      this._addCollider(new THREE.Mesh(vWallGeo, this.matConcrete), wallThick, wallH, span, 80, wallH / 2, 0);
    }

    _buildCentralGantryCranes() {
      // 2 Giant Gantry Cranes straddling the center shipping plaza
      [-35, 35].forEach(cz => {
        // Vertical legs
        [-22, 22].forEach(lx => {
          const legGeo = new THREE.BoxGeometry(2.5, 18, 2.5);
          this._addCollider(new THREE.Mesh(legGeo, this.matCraneSteel), 2.5, 18, 2.5, lx, 9, cz);
        });

        // Top horizontal truss beam
        const trussGeo = new THREE.BoxGeometry(48, 3.2, 4.0);
        const truss = new THREE.Mesh(trussGeo, this.matCraneSteel);
        truss.position.set(0, 18, cz);
        truss.castShadow = true;
        this.arenaGroup.add(truss);

        // Crane trolley & hoist
        const trolleyGeo = new THREE.BoxGeometry(6.0, 2.5, 5.0);
        const trolley = new THREE.Mesh(trolleyGeo, this.matDarkSteel);
        trolley.position.set(0, 16.0, cz);
        this.arenaGroup.add(trolley);

        // Top rotating maritime radar scanner
        const radarMast = new THREE.Group();
        radarMast.position.set(0, 20.0, cz);
        const dishGeo = new THREE.BoxGeometry(3.6, 0.4, 0.4);
        const dish = new THREE.Mesh(dishGeo, this.matBeaconOrange);
        radarMast.add(dish);
        this.arenaGroup.add(radarMast);
        this.animatedProps.push({ mesh: radarMast, type: 'ROTATE_Y', speed: 1.8 });
      });
    }

    _buildContainerStacks() {
      // Dimensions of a standard cargo container in meters: width 5.5, height 4.2, depth 12.0
      const cw = 5.5, ch = 4.2, cd = 12.0;
      const cGeo = new THREE.BoxGeometry(cw, ch, cd);

      const stackPositions = [
        // SW Stacks (Blue side flank)
        { x: -32, y: ch / 2, z: -28, mat: this.matContainerBlue },
        { x: -32, y: ch + ch / 2, z: -28, mat: this.matContainerOrange },
        { x: -32, y: ch / 2, z: -14, mat: this.matContainerTeal },
        { x: -24, y: ch / 2, z: -30, mat: this.matContainerCharcoal },

        // SE Stacks (Blue side flank)
        { x: 32, y: ch / 2, z: -28, mat: this.matContainerOrange },
        { x: 32, y: ch + ch / 2, z: -28, mat: this.matContainerBlue },
        { x: 32, y: ch / 2, z: -14, mat: this.matContainerTeal },
        { x: 24, y: ch / 2, z: -30, mat: this.matContainerCharcoal },

        // NW Stacks (Red side flank)
        { x: -32, y: ch / 2, z: 28, mat: this.matContainerTeal },
        { x: -32, y: ch + ch / 2, z: 28, mat: this.matContainerOrange },
        { x: -32, y: ch / 2, z: 14, mat: this.matContainerBlue },
        { x: -24, y: ch / 2, z: 30, mat: this.matContainerCharcoal },

        // NE Stacks (Red side flank)
        { x: 32, y: ch / 2, z: 28, mat: this.matContainerCharcoal },
        { x: 32, y: ch + ch / 2, z: 28, mat: this.matContainerBlue },
        { x: 32, y: ch / 2, z: 14, mat: this.matContainerOrange },
        { x: 24, y: ch / 2, z: 30, mat: this.matContainerTeal },

        // Center Mid-Plaza barricade stacks (Tactical cover dividing lanes)
        { x: -14, y: ch / 2, z: 0, mat: this.matContainerOrange },
        { x: 14, y: ch / 2, z: 0, mat: this.matContainerBlue },
        { x: 0, y: ch / 2, z: -16, mat: this.matContainerTeal },
        { x: 0, y: ch / 2, z: 16, mat: this.matContainerCharcoal }
      ];

      stackPositions.forEach(p => {
        const cMesh = new THREE.Mesh(cGeo, p.mat);
        this._addCollider(cMesh, cw, ch, cd, p.x, p.y, p.z);
      });
    }

    _buildElevatedWalkways() {
      // Metal catwalk platforms connecting container rows
      const walkwayGeo = new THREE.BoxGeometry(16, 0.4, 4.0);
      [-28, 28].forEach(wx => {
        const walk = new THREE.Mesh(walkwayGeo, this.matDarkSteel);
        walk.position.set(wx, 4.4, 0);
        this.arenaGroup.add(walk);
      });
    }

    _buildNavigationalBeacons() {
      // Harbor navigation light poles at corners
      const poleGeo = new THREE.CylinderGeometry(0.3, 0.4, 12, 8);
      [
        { x: -74, z: -74 },
        { x: 74, z: -74 },
        { x: -74, z: 74 },
        { x: 74, z: 74 }
      ].forEach(bp => {
        const pole = new THREE.Mesh(poleGeo, this.matDarkSteel);
        pole.position.set(bp.x, 6, bp.z);
        this.arenaGroup.add(pole);

        const lightMesh = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), this.matBeaconOrange);
        lightMesh.position.set(bp.x, 12.2, bp.z);
        this.arenaGroup.add(lightMesh);

        const light = new THREE.PointLight(0xff6600, 1.2, 45);
        light.position.set(bp.x, 12.5, bp.z);
        this.arenaGroup.add(light);
      });
    }

    resolveCollision(x, z, radius) {
      let resolvedX = x;
      let resolvedZ = z;

      const bounds = 78;
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
      return IT.ArenaRegistry.get('TITAN_DOCKS');
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

  IT.TitanDocksArena = TitanDocksArena;
})(window.IT);
