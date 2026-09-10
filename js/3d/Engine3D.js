/**
 * Iron Titans 3D — Engine3D.js
 * Core Three.js WebGL rendering engine with PBR lighting, soft shadows,
 * sci-fi atmospheric fog, and responsive full-screen viewport.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class Engine3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x080a12);
      this.scene.fog = new THREE.FogExp2(0x0a0e1a, 0.007);

      // WebGL Renderer with graceful fallback
      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
      } catch (glErr) {
        console.warn('[Engine3D] WebGL unavailable or software mode active. Using fallback renderer for UI.', glErr);
        this.renderer = {
          setSize: () => {},
          setPixelRatio: () => {},
          render: () => {},
          shadowMap: {},
          info: { render: { calls: 0, triangles: 0 } },
          domElement: this.canvas
        };
      }

      // Perspective Camera (Third-Person)
      this.camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.2,
        600
      );
      this.camera.position.set(0, 10, -15);

      // Lighting Rig
      this._setupLighting();

      // Window resize
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);

      // Delta time tracking
      this.clock = new THREE.Clock();
    }

    _setupLighting() {
      // 1. Hemisphere ambient light (cool cyan sky, warm metallic ground)
      const hemiLight = new THREE.HemisphereLight(0x7bc6ff, 0x1a2030, 0.65);
      hemiLight.position.set(0, 50, 0);
      this.scene.add(hemiLight);

      // 2. Primary Key Sunlight with dynamic shadow casting
      const dirLight = new THREE.DirectionalLight(0xffeedd, 1.25);
      dirLight.position.set(60, 90, 45);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 10;
      dirLight.shadow.camera.far = 250;

      const d = 80;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.bias = -0.0005;

      this.scene.add(dirLight);
      this.dirLight = dirLight;

      // 3. Cyberpunk blue rim fill light
      const rimLight = new THREE.DirectionalLight(0x00c8ff, 0.45);
      rimLight.position.set(-50, 30, -50);
      this.scene.add(rimLight);
    }

    resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }

    render() {
      if (this.renderer && typeof this.renderer.render === 'function') {
        this.renderer.render(this.scene, this.camera);
      }
    }

    getDelta() {
      return Math.min(this.clock.getDelta(), 0.05);
    }

    setGraphicsPreset(preset) {
      this.graphicsPreset = preset || 'HIGH';
      if (!this.renderer) return;

      if (preset === 'LOW') {
        this.renderer.shadowMap.enabled = false;
        this.renderer.setPixelRatio(1.0);
        if (this.dirLight) this.dirLight.castShadow = false;
      } else if (preset === 'MEDIUM') {
        this.renderer.shadowMap.enabled = true;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
        if (this.dirLight) {
          this.dirLight.castShadow = true;
          this.dirLight.shadow.mapSize.set(1024, 1024);
        }
      } else { // HIGH or AUTO default
        this.renderer.shadowMap.enabled = true;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
        if (this.dirLight) {
          this.dirLight.castShadow = true;
          this.dirLight.shadow.mapSize.set(2048, 2048);
        }
      }
      this.resize();
    }

    getPerformanceMetrics() {
      if (!this.renderer || !this.renderer.info) {
        return { drawCalls: 0, triangles: 0, geometries: 0, textures: 0 };
      }
      return {
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures
      };
    }

    static disposeHierarchy(rootObj) {
      if (!rootObj) return;
      rootObj.traverse(child => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
    }

    destroy() {
      window.removeEventListener('resize', this._onResize);
      Engine3D.disposeHierarchy(this.scene);
      this.renderer.dispose();
    }
  }

  IT.Engine3D = Engine3D;
})(window.IT);
