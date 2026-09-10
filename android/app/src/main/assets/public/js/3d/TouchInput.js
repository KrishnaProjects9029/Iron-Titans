/**
 * Iron Titans 3D — TouchInput.js
 * Multi-touch mobile input handler with strict touch ID isolation:
 * - Left thumb 360° virtual joystick (movement)
 * - Right thumb camera look-zone (independent orbital yaw & pitch)
 * - Dedicated action buttons (Fire, Ability, Secondary, Reload, Target Lock)
 * - Guarantees simultaneous MOVE + AIM + FIRE without input cancellation.
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class TouchInput {
    constructor() {
      // Movement state
      this.moveVector = { x: 0, y: 0 };
      this.joystickRadius = 55;
      this.joystickTouchId = null;
      this.joystickCenter = { x: 0, y: 0 };

      // Camera look state
      this.lookTouchId = null;
      this.lookLastPos = { x: 0, y: 0 };
      this.cameraDelta = { x: 0, y: 0 };

      // Action button states
      this.fireActive = false;
      this.secondaryActive = false;
      this.abilityJustPressed = false;
      this.reloadJustPressed = false;
      this.targetLockJustPressed = false;

      // DOM element caches
      this.knobEl = null;
      this.baseEl = null;

      // Sensitivity tuning
      this.lookSensitivity = 1.6;

      this.init();
    }

    init() {
      this.knobEl = document.getElementById('joystick-knob');
      this.baseEl = document.getElementById('joystick-base');

      // Bind global touch listeners to document/window with passive: false to prevent scrolling
      const touchOpts = { passive: false };
      window.addEventListener('touchstart', (e) => this._onTouchStart(e), touchOpts);
      window.addEventListener('touchmove', (e) => this._onTouchMove(e), touchOpts);
      window.addEventListener('touchend', (e) => this._onTouchEnd(e), touchOpts);
      window.addEventListener('touchcancel', (e) => this._onTouchEnd(e), touchOpts);

      // Setup action button touch & pointer listeners
      this._bindActionButtons();
    }

    _bindActionButtons() {
      const bindBtn = (id, onDown, onUp) => {
        const el = document.getElementById(id);
        if (!el) return;

        const handleStart = (e) => {
          e.preventDefault();
          e.stopPropagation();
          el.classList.add('active');
          if (onDown) onDown();
        };

        const handleEnd = (e) => {
          e.preventDefault();
          e.stopPropagation();
          el.classList.remove('active');
          if (onUp) onUp();
        };

        // Touch events
        el.addEventListener('touchstart', handleStart, { passive: false });
        el.addEventListener('touchend', handleEnd, { passive: false });
        el.addEventListener('touchcancel', handleEnd, { passive: false });

        // Mouse/Pointer events for desktop emulation
        el.addEventListener('mousedown', handleStart);
        el.addEventListener('mouseup', handleEnd);
        el.addEventListener('mouseleave', handleEnd);
      };

      // 1. Fire Button (Supports tap and continuous hold)
      bindBtn('btn-fire-touch',
        () => { this.fireActive = true; },
        () => { this.fireActive = false; }
      );

      // 2. Secondary Weapon Button
      bindBtn('btn-secondary-touch',
        () => { this.secondaryActive = true; },
        () => { this.secondaryActive = false; }
      );

      // 3. Ability Button
      bindBtn('btn-ability-touch',
        () => { this.abilityJustPressed = true; },
        () => {}
      );

      // 4. Reload Button
      bindBtn('btn-reload-touch',
        () => { this.reloadJustPressed = true; },
        () => {}
      );

      // 5. Target Lock Button
      bindBtn('btn-lock-touch',
        () => { this.targetLockJustPressed = true; },
        () => {}
      );
    }

    _isTouchOverActionButton(touch) {
      const x = touch.clientX;
      const y = touch.clientY;
      const btnIds = [
        'btn-fire-touch',
        'btn-ability-touch',
        'btn-secondary-touch',
        'btn-reload-touch',
        'btn-lock-touch'
      ];

      for (let id of btnIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Slightly expanded touch margin for comfortable finger targeting
          if (x >= rect.left - 10 && x <= rect.right + 10 && y >= rect.top - 10 && y <= rect.bottom + 10) {
            return true;
          }
        }
      }
      return false;
    }

    _onTouchStart(e) {
      const battleScreen = document.getElementById('screen-battle');
      if (!battleScreen || battleScreen.style.display === 'none') {
        return;
      }
      const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
      if (activeModal) return;

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const tx = touch.clientX;
        const ty = touch.clientY;

        // Skip if finger touches action buttons
        if (this._isTouchOverActionButton(touch)) {
          continue;
        }

        // Left Zone: Virtual Joystick (Left 42% of screen)
        if (tx < screenW * 0.42 && ty > screenH * 0.25) {
          if (this.joystickTouchId === null) {
            this.joystickTouchId = touch.identifier;

            // Anchor center directly to touchdown point (true dynamic floating joystick)
            this.joystickCenter.x = tx;
            this.joystickCenter.y = ty;

            if (this.baseEl) {
              this.baseEl.style.position = 'fixed';
              this.baseEl.style.left = `${tx - 55}px`;
              this.baseEl.style.top = `${ty - 55}px`;
              this.baseEl.style.bottom = 'auto';
              this.baseEl.style.right = 'auto';
              this.baseEl.style.opacity = '1.0';
              this.baseEl.style.transition = 'none';
            }

            if (this.knobEl) {
              this.knobEl.style.transform = 'translate(0px, 0px)';
              this.knobEl.style.transition = 'none';
            }

            this.moveVector.x = 0;
            this.moveVector.y = 0;
            e.preventDefault();
          }
        }
        // Right Zone: Camera Aiming Look-Zone (Right 58% of screen)
        else if (tx >= screenW * 0.42) {
          if (this.lookTouchId === null) {
            this.lookTouchId = touch.identifier;
            this.lookLastPos.x = tx;
            this.lookLastPos.y = ty;
            e.preventDefault();
          }
        }
      }
    }

    _onTouchMove(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // 1. Update Joystick
        if (touch.identifier === this.joystickTouchId) {
          this._updateJoystickFromPoint(touch.clientX, touch.clientY);
          e.preventDefault();
        }
        // 2. Update Camera Look Delta
        else if (touch.identifier === this.lookTouchId) {
          const dx = (touch.clientX - this.lookLastPos.x) * this.lookSensitivity;
          const dy = (touch.clientY - this.lookLastPos.y) * this.lookSensitivity;

          this.cameraDelta.x += dx;
          this.cameraDelta.y += dy;

          this.lookLastPos.x = touch.clientX;
          this.lookLastPos.y = touch.clientY;
          e.preventDefault();
        }
      }
    }

    _onTouchEnd(e) {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        // Release Joystick
        if (touch.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.moveVector.x = 0;
          this.moveVector.y = 0;
          if (this.knobEl) {
            this.knobEl.style.transform = 'translate(0px, 0px)';
          }
          if (this.baseEl) {
            this.baseEl.style.position = '';
            this.baseEl.style.left = '';
            this.baseEl.style.top = '';
            this.baseEl.style.bottom = '';
            this.baseEl.style.right = '';
            this.baseEl.style.opacity = '';
          }
          e.preventDefault();
        }
        // Release Camera Look
        else if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
          e.preventDefault();
        }
      }
    }

    _updateJoystickFromPoint(clientX, clientY) {
      const dx = clientX - this.joystickCenter.x;
      const dy = clientY - this.joystickCenter.y;
      const dist = Math.hypot(dx, dy);

      if (dist === 0) {
        this.moveVector.x = 0;
        this.moveVector.y = 0;
        if (this.knobEl) this.knobEl.style.transform = 'translate(0px, 0px)';
        return;
      }

      const clampedDist = Math.min(dist, this.joystickRadius);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      // Update visual knob position
      if (this.knobEl) {
        this.knobEl.style.transform = `translate(${knobX}px, ${knobY}px)`;
      }

      // Output normalized vector (x: -1 to 1 [strafe], y: -1 to 1 [forward/back])
      this.moveVector.x = knobX / this.joystickRadius;
      // Invert Y so up on screen is positive forward
      this.moveVector.y = -knobY / this.joystickRadius;
    }

    // ── Public API ──
    getMoveVector() {
      return this.moveVector;
    }

    consumeCameraDelta() {
      const delta = { x: this.cameraDelta.x, y: this.cameraDelta.y };
      this.cameraDelta.x = 0;
      this.cameraDelta.y = 0;
      return delta;
    }

    isFirePressed() {
      return this.fireActive;
    }

    isSecondaryPressed() {
      return this.secondaryActive;
    }

    consumeAbility() {
      const val = this.abilityJustPressed;
      this.abilityJustPressed = false;
      return val;
    }

    consumeReload() {
      const val = this.reloadJustPressed;
      this.reloadJustPressed = false;
      return val;
    }

    consumeTargetLock() {
      const val = this.targetLockJustPressed;
      this.targetLockJustPressed = false;
      return val;
    }
  }

  IT.TouchInput = TouchInput;
})(window.IT);
