/**
 * Iron Titans 3D — ObjectPool.js
 * High-performance, zero-garbage object pooling architecture for:
 * - Projectiles & Velocity Ribbon Trails (Pulse, Scatter, Plasma Orb, Arc, Missile, Rail Spear)
 * - Visual Effects Particles (Sparks, Smoke, Debris, Muzzle Flashes)
 * - Scene Dynamic Point Lights (pre-instantiated scene lights with zero add/remove overhead)
 * - Damage Numbers & Screen HUD Elements
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class ObjectPool {
    constructor(createFn, resetFn, disposeFn, initialSize = 10, maxSize = 120) {
      this.createFn = createFn;
      this.resetFn = resetFn || ((item) => item);
      this.disposeFn = disposeFn || ((item) => {});
      this.initialSize = initialSize;
      this.maxSize = maxSize;

      this.freeList = [];
      this.activeList = new Set();

      // Pre-warm the pool
      for (let i = 0; i < this.initialSize; i++) {
        const item = this.createFn();
        this.freeList.push(item);
      }
    }

    acquire(...args) {
      let item;
      if (this.freeList.length > 0) {
        item = this.freeList.pop();
      } else if (this.activeList.size < this.maxSize) {
        item = this.createFn();
      } else {
        // Pool exhausted: recycle the oldest active item
        const oldest = this.activeList.values().next().value;
        this.release(oldest);
        item = this.freeList.pop();
      }

      this.activeList.add(item);
      this.resetFn(item, ...args);
      return item;
    }

    release(item) {
      if (!item || !this.activeList.has(item)) return false;
      this.activeList.delete(item);
      if (this.freeList.length < this.maxSize) {
        this.freeList.push(item);
      } else {
        this.disposeFn(item);
      }
      return true;
    }

    releaseAll() {
      for (const item of this.activeList) {
        if (this.freeList.length < this.maxSize) {
          this.freeList.push(item);
        } else {
          this.disposeFn(item);
        }
      }
      this.activeList.clear();
    }

    clear() {
      for (const item of this.activeList) this.disposeFn(item);
      for (const item of this.freeList) this.disposeFn(item);
      this.activeList.clear();
      this.freeList.length = 0;
    }

    get activeCount() {
      return this.activeList.size;
    }

    get totalCount() {
      return this.activeList.size + this.freeList.length;
    }
  }

  // ── Specialized Pool Manager ──
  class PoolManager {
    constructor() {
      this.pools = new Map();
      this.sceneLightPool = null;
    }

    registerPool(name, createFn, resetFn, disposeFn, initialSize = 10, maxSize = 120) {
      const pool = new ObjectPool(createFn, resetFn, disposeFn, initialSize, maxSize);
      this.pools.set(name, pool);
      return pool;
    }

    getPool(name) {
      return this.pools.get(name);
    }

    acquire(name, ...args) {
      const pool = this.pools.get(name);
      return pool ? pool.acquire(...args) : null;
    }

    release(name, item) {
      const pool = this.pools.get(name);
      return pool ? pool.release(item) : false;
    }

    /**
     * Pre-instantiates 4 PointLights in the Three.js scene graph.
     * Lights are NEVER added or removed at runtime; their intensity is simply dialed to 0 when inactive.
     */
    initSceneLights(scene, maxLights = 4) {
      if (this.sceneLightPool) {
        this.sceneLightPool.clear();
      }

      const lights = [];
      for (let i = 0; i < maxLights; i++) {
        const light = new THREE.PointLight(0xffffff, 0, 15);
        light.name = `PooledPointLight_${i}`;
        scene.add(light);
        lights.push(light);
      }

      this.sceneLightPool = {
        lights,
        active: new Map(), // light -> { timer, maxTime, startIntensity }

        acquire(color, intensity, distance, duration) {
          for (let i = 0; i < lights.length; i++) {
            const l = lights[i];
            if (!this.active.has(l)) {
              l.color.setHex(color);
              l.distance = distance;
              l.intensity = intensity;
              this.active.set(l, { timer: duration, maxTime: duration, startIntensity: intensity });
              return l;
            }
          }
          return null; // All pooled lights in use
        },

        update(dt) {
          for (const [light, data] of this.active.entries()) {
            data.timer -= dt;
            if (data.timer <= 0) {
              light.intensity = 0;
              this.active.delete(light);
            } else {
              const frac = Math.max(0, data.timer / data.maxTime);
              light.intensity = data.startIntensity * frac;
            }
          }
        },

        clear() {
          for (const l of lights) {
            l.intensity = 0;
            if (l.parent) l.parent.remove(l);
          }
          lights.length = 0;
          this.active.clear();
        },

        getActiveCount() {
          return this.active.size;
        }
      };

      return this.sceneLightPool;
    }

    getStats() {
      const stats = {
        totalActive: 0,
        totalPooled: 0,
        activeLights: this.sceneLightPool ? this.sceneLightPool.getActiveCount() : 0,
        details: {}
      };

      for (const [name, pool] of this.pools.entries()) {
        stats.details[name] = { active: pool.activeCount, total: pool.totalCount };
        stats.totalActive += pool.activeCount;
        stats.totalPooled += pool.totalCount;
      }

      return stats;
    }

    clearAll() {
      for (const pool of this.pools.values()) {
        pool.clear();
      }
      this.pools.clear();
      if (this.sceneLightPool) {
        this.sceneLightPool.clear();
        this.sceneLightPool = null;
      }
    }
  }

  IT.ObjectPool = ObjectPool;
  IT.PoolManager = new PoolManager();
})(window.IT);
