/**
 * Iron Titans 3D — InputManager.js
 * Unified input abstraction merging desktop keyboard/mouse and mobile multi-touch inputs.
 * Ensures seamless controls across PC, phones, and tablets with zero input cancellation.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class InputManager {
    constructor() {
      // 1. Detect platform capability
      this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      this.forceTouchUI = false;

      // 2. Desktop Keyboard & Mouse state
      this.keys = {};
      this.mouseButtons = { left: false, right: false, middle: false };
      this.mouseDelta = { x: 0, y: 0 };
      this.isMouseDown = false;
      this.abilityKeyTriggered = false;
      this.reloadKeyTriggered = false;
      this.targetLockKeyTriggered = false;

      // 3. Initialize Touch subsystem
      this.touch = new IT.TouchInput();

      // 4. Setup Desktop Listeners
      this._setupKeyboardMouse();
    }

    _setupKeyboardMouse() {
      window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true;
        if (e.code === 'Space' || e.code === 'KeyQ') {
          this.abilityKeyTriggered = true;
        }
        if (e.code === 'KeyR') {
          this.reloadKeyTriggered = true;
        }
        if (e.code === 'KeyL' || e.code === 'Tab') {
          e.preventDefault();
          this.targetLockKeyTriggered = true;
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });

      window.addEventListener('mousedown', (e) => {
        if (e.button === 0) this.mouseButtons.left = true;
        if (e.button === 2) this.mouseButtons.right = true;
        this.isMouseDown = true;
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) this.mouseButtons.left = false;
        if (e.button === 2) this.mouseButtons.right = false;
        this.isMouseDown = false;
      });

      window.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement || this.isMouseDown) {
          this.mouseDelta.x += e.movementX;
          this.mouseDelta.y += e.movementY;
        }
      });

      window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setForceTouchUI(val) {
      this.forceTouchUI = !!val;
    }

    /**
     * Returns combined normalized 2D movement vector:
     * x: strafe (-1 left, +1 right)
     * y: forward/backward (+1 fwd, -1 back)
     */
    getMoveVector() {
      let x = 0;
      let y = 0;

      // Desktop WASD
      if (this.keys['KeyW'] || this.keys['ArrowUp']) y += 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) y -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;

      // Mobile Touch Joystick
      const touchVec = this.touch.getMoveVector();
      x += touchVec.x;
      y += touchVec.y;

      // Clamp magnitude to 1.0
      const len = Math.hypot(x, y);
      if (len > 1.0) {
        x /= len;
        y /= len;
      }

      return { x, y };
    }

    /**
     * Consumes and returns camera rotation delta { x, y } in pixels.
     */
    consumeCameraDelta() {
      const touchDelta = this.touch.consumeCameraDelta();
      const combined = {
        x: this.mouseDelta.x + touchDelta.x,
        y: this.mouseDelta.y + touchDelta.y
      };

      this.mouseDelta.x = 0;
      this.mouseDelta.y = 0;

      return combined;
    }

    isFirePressed() {
      return this.mouseButtons.left || this.touch.isFirePressed();
    }

    isSecondaryPressed() {
      return this.mouseButtons.right || this.touch.isSecondaryPressed();
    }

    consumeAbility() {
      const desktop = this.abilityKeyTriggered;
      this.abilityKeyTriggered = false;
      const mobile = this.touch.consumeAbility();
      return desktop || mobile;
    }

    consumeReload() {
      const desktop = this.reloadKeyTriggered;
      this.reloadKeyTriggered = false;
      const mobile = this.touch.consumeReload();
      return desktop || mobile;
    }

    consumeTargetLock() {
      const desktop = this.targetLockKeyTriggered;
      this.targetLockKeyTriggered = false;
      const mobile = this.touch.consumeTargetLock();
      return desktop || mobile;
    }
  }

  IT.InputManager = InputManager;
})(window.IT);
