/**
 * input.js — Iron Titans Mech Arena
 * Unified input handler: keyboard + mouse + touch with virtual joystick.
 *
 * Depends on: window.IT namespace (camera exposed as IT.camera)
 * Exposes:    window.IT.InputManager
 */

(function (IT) {
    'use strict';

    // ─── Key mapping ─────────────────────────────────────────────────────────

    const KEY_MAP = {
        KeyW     : 'up',    ArrowUp    : 'up',
        KeyS     : 'down',  ArrowDown  : 'down',
        KeyA     : 'left',  ArrowLeft  : 'left',
        KeyD     : 'right', ArrowRight : 'right',
        Space    : 'ability',
        KeyQ     : 'ability',
        KeyE     : 'fire2',
        KeyR     : 'reload',
        ShiftLeft: 'dodge', ShiftRight: 'dodge',
    };

    // ─── Virtual joystick layout ─────────────────────────────────────────────

    const JOY_RADIUS      = 55;   // px — outer ring radius
    const JOY_THUMB_R     = 22;   // px — thumb knob radius
    const JOY_DEAD_ZONE   = 0.12; // normalised dead-zone threshold
    const JOY_DRAG_FACTOR = 0.18; // momentum smoothing

    // ─── InputManager ────────────────────────────────────────────────────────

    class InputManager {
        /**
         * Create an InputManager. Call init(canvas) before using.
         */
        constructor() {
            /** @type {Object.<string,boolean>} current keyboard state */
            this.keys = {};

            /** Mouse state in world coordinates */
            this.mouse = {
                x       : 0,
                y       : 0,
                screenX : 0,
                screenY : 0,
                buttons : { left: false, middle: false, right: false },
            };

            /** Touch aggregate state */
            this.touch = { active: false };

            /** Virtual joystick (left-half of screen) */
            this.joystick = {
                active   : false,
                x        : 0,          // base centre X (screen px)
                y        : 0,          // base centre Y (screen px)
                dx       : 0,          // raw delta X from centre
                dy       : 0,          // raw delta Y from centre
                touchId  : null,       // touch identifier
                normX    : 0,          // normalised -1..1
                normY    : 0,
                _smoothX : 0,
                _smoothY : 0,
            };

            /** Current aim angle in radians */
            this.aimAngle = 0;

            /** One-shot action states */
            this.actions = {
                fire    : false,
                fire2   : false,
                ability : false,
                dodge   : false,
            };

            /** Right-half touch tracking for aiming */
            this._aimTouch = {
                active  : false,
                touchId : null,
                x       : 0,
                y       : 0,
            };

            /** Stored bound listeners for cleanup */
            this._listeners = [];

            /** Reference to the canvas element */
            this._canvas = null;

            // Virtual joystick DOM overlay
            this._joyEl      = null;
            this._joyThumbEl = null;
        }

        // ─── init ─────────────────────────────────────────────────────────────

        /**
         * Attach all event listeners and build virtual joystick overlay.
         * @param {HTMLCanvasElement} canvas
         */
        init(canvas) {
            this._canvas = canvas;
            this._buildJoystickDOM(canvas);

            // ── Keyboard ──
            this._on(window, 'keydown', (e) => this._onKeyDown(e));
            this._on(window, 'keyup',   (e) => this._onKeyUp(e));

            // ── Mouse ──
            this._on(canvas, 'mousemove',  (e) => this._onMouseMove(e));
            this._on(canvas, 'mousedown',  (e) => this._onMouseDown(e));
            this._on(canvas, 'mouseup',    (e) => this._onMouseUp(e));
            this._on(canvas, 'contextmenu',(e) => e.preventDefault());

            // ── Touch ──
            const opts = { passive: false };
            this._on(canvas, 'touchstart', (e) => this._onTouchStart(e), opts);
            this._on(canvas, 'touchmove',  (e) => this._onTouchMove(e),  opts);
            this._on(canvas, 'touchend',   (e) => this._onTouchEnd(e),   opts);
            this._on(canvas, 'touchcancel',(e) => this._onTouchEnd(e),   opts);

            // Prevent default scroll on canvas touch
            this._on(canvas, 'touchstart', (e) => e.preventDefault(), opts);

            // ── DOM touch action buttons ──
            const bindBtn = (id, action) => {
                const el = document.getElementById(id);
                if (el) {
                    const start = (e) => { if (e.preventDefault) e.preventDefault(); this.actions[action] = true; };
                    const end = (e) => { if (e.preventDefault) e.preventDefault(); this.actions[action] = false; };
                    this._on(el, 'pointerdown', start);
                    this._on(el, 'pointerup', end);
                    this._on(el, 'pointercancel', end);
                    this._on(el, 'touchstart', start, { passive: false });
                    this._on(el, 'touchend', end, { passive: false });
                }
            };
            bindBtn('btn-fire', 'fire');
            bindBtn('btn-fire2', 'fire2');
            bindBtn('btn-ability', 'ability');
        }

        // ─── update ───────────────────────────────────────────────────────────

        /**
         * Process joystick physics and update derived state. Call every frame.
         * @param {number} dt — delta time in seconds
         */
        update(dt) {
            const joy = this.joystick;

            if (joy.active) {
                const raw = this._clampJoystick(joy.dx, joy.dy);
                joy._smoothX += (raw.x - joy._smoothX) * Math.min(1, dt * 20);
                joy._smoothY += (raw.y - joy._smoothY) * Math.min(1, dt * 20);
                joy.normX = Math.abs(joy._smoothX) < JOY_DEAD_ZONE ? 0 : joy._smoothX;
                joy.normY = Math.abs(joy._smoothY) < JOY_DEAD_ZONE ? 0 : joy._smoothY;
            } else {
                // Decay smoothed values when released
                joy._smoothX *= Math.exp(-dt * 15);
                joy._smoothY *= Math.exp(-dt * 15);
                if (Math.abs(joy._smoothX) < 0.01) joy._smoothX = 0;
                if (Math.abs(joy._smoothY) < 0.01) joy._smoothY = 0;
                joy.normX = 0;
                joy.normY = 0;
            }

            // Update joystick thumb DOM position
            this._updateJoyThumb();

            // Derive aim angle from mouse when no right-touch active
            if (!this._aimTouch.active && this._canvas) {
                const mx = this.mouse.x;
                const my = this.mouse.y;
                const cx = this._toWorldX(this._canvas.width  / 2);
                const cy = this._toWorldY(this._canvas.height / 2);

                // Use player mech position for aim if available
                const player = IT.player;
                if (player) {
                    this.aimAngle = Math.atan2(my - player.y, mx - player.x);
                } else {
                    this.aimAngle = Math.atan2(my - cy, mx - cx);
                }
            }
        }

        // ─── Public query API ─────────────────────────────────────────────────

        /**
         * Returns normalised movement vector from WASD keys or joystick.
         * @returns {{x: number, y: number}}
         */
        getMoveVector() {
            const joy = this.joystick;

            let x = 0;
            let y = 0;

            if (joy.active || (Math.abs(joy._smoothX) > 0.01 || Math.abs(joy._smoothY) > 0.01)) {
                x = joy.normX;
                y = joy.normY;
            } else {
                if (this.keys['left']  || this.keys['KeyA'] || this.keys['ArrowLeft'])  x -= 1;
                if (this.keys['right'] || this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
                if (this.keys['up']    || this.keys['KeyW'] || this.keys['ArrowUp'])    y -= 1;
                if (this.keys['down']  || this.keys['KeyS'] || this.keys['ArrowDown'])  y += 1;
            }

            const len = Math.hypot(x, y);
            if (len > 1) { x /= len; y /= len; }

            return { x, y };
        }

        /**
         * Returns the current aim angle in radians.
        /**
         * Set current scale and canvas screen offset from window resize.
         */
        setScale(scale, left = 0, top = 0) {
            this.scale = scale;
            this.canvasLeft = left;
            this.canvasTop = top;
        }

        /**
         * Returns the current aim angle in radians. If screen coordinates are provided,
         * computes angle from that position to current mouse position.
         * @param {number} [screenX]
         * @param {number} [screenY]
         * @returns {number}
         */
        getAimAngle(screenX, screenY) {
            if (typeof screenX === 'number' && typeof screenY === 'number') {
                return Math.atan2(this.mouse.screenY - screenY, this.mouse.screenX - screenX);
            }
            return this.aimAngle;
        }

        /**
         * True if primary fire is pressed (LMB or touch fire button).
         * @returns {boolean}
         */
        isFirePressed() {
            return this.mouse.buttons.left || this.actions.fire;
        }

        /**
         * True if secondary fire is pressed (RMB or fire2 button).
         * @returns {boolean}
         */
        isSecondaryFirePressed() {
            return this.mouse.buttons.right || this.actions.fire2;
        }

        /**
         * True if ability key is pressed (Space/Q or touch ability button).
         * @returns {boolean}
         */
        isAbilityPressed() {
            return !!(this.keys['Space'] || this.keys['KeyQ'] || this.actions.ability);
        }

        isAbilityJustPressed() {
            return this.isAbilityPressed();
        }

        /**
         * True if dodge key is pressed (Shift or touch dodge button).
         * @returns {boolean}
         */
        isDodgePressed() {
            return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.actions.dodge);
        }

        // ─── Cleanup ──────────────────────────────────────────────────────────

        /**
         * Remove all event listeners and remove virtual joystick DOM.
         */
        destroy() {
            for (const [target, type, fn, opts] of this._listeners) {
                target.removeEventListener(type, fn, opts);
            }
            this._listeners = [];

            if (this._joyEl && this._joyEl.parentNode) {
                this._joyEl.parentNode.removeChild(this._joyEl);
            }
            this._joyEl      = null;
            this._joyThumbEl = null;
        }

        // ─── Keyboard handlers ────────────────────────────────────────────────

        _onKeyDown(e) {
            const mapped = KEY_MAP[e.code];
            this.keys[e.code] = true;
            if (mapped) this.keys[mapped] = true;

            // Prevent browser shortcuts
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        }

        _onKeyUp(e) {
            const mapped = KEY_MAP[e.code];
            this.keys[e.code] = false;
            if (mapped) this.keys[mapped] = false;
        }

        // ─── Mouse handlers ───────────────────────────────────────────────────

        _onMouseMove(e) {
            const rect = this._canvas.getBoundingClientRect();
            const sx   = e.clientX - rect.left;
            const sy   = e.clientY - rect.top;

            this.mouse.screenX = sx;
            this.mouse.screenY = sy;
            this.mouse.x       = this._toWorldX(sx);
            this.mouse.y       = this._toWorldY(sy);
        }

        _onMouseDown(e) {
            if (e.button === 0) this.mouse.buttons.left   = true;
            if (e.button === 1) this.mouse.buttons.middle = true;
            if (e.button === 2) this.mouse.buttons.right  = true;
        }

        _onMouseUp(e) {
            if (e.button === 0) this.mouse.buttons.left   = false;
            if (e.button === 1) this.mouse.buttons.middle = false;
            if (e.button === 2) this.mouse.buttons.right  = false;
        }

        // ─── Touch handlers ───────────────────────────────────────────────────

        _onTouchStart(e) {
            this.touch.active = true;

            for (const t of e.changedTouches) {
                const rect     = this._canvas.getBoundingClientRect();
                const sx       = t.clientX - rect.left;
                const sy       = t.clientY - rect.top;
                const halfW    = this._canvas.width  / 2;

                if (sx < halfW) {
                    // Left half — joystick
                    if (!this.joystick.active) {
                        this.joystick.active  = true;
                        this.joystick.x       = sx;
                        this.joystick.y       = sy;
                        this.joystick.dx      = 0;
                        this.joystick.dy      = 0;
                        this.joystick.touchId = t.identifier;

                        // Position the joystick base overlay
                        this._positionJoyBase(sx, sy);
                        if (this._joyEl) this._joyEl.style.display = 'block';
                    }
                } else {
                    // Right half — aim + fire
                    if (!this._aimTouch.active) {
                        this._aimTouch.active  = true;
                        this._aimTouch.touchId = t.identifier;
                        this._aimTouch.x       = sx;
                        this._aimTouch.y       = sy;
                        this.actions.fire      = true;

                        this._updateAimFromTouch(sx, sy);
                    }
                }
            }
        }

        _onTouchMove(e) {
            e.preventDefault();

            for (const t of e.changedTouches) {
                const rect = this._canvas.getBoundingClientRect();
                const sx   = t.clientX - rect.left;
                const sy   = t.clientY - rect.top;

                if (t.identifier === this.joystick.touchId) {
                    this.joystick.dx = sx - this.joystick.x;
                    this.joystick.dy = sy - this.joystick.y;
                } else if (t.identifier === this._aimTouch.touchId) {
                    this._aimTouch.x = sx;
                    this._aimTouch.y = sy;
                    this._updateAimFromTouch(sx, sy);
                }
            }
        }

        _onTouchEnd(e) {
            for (const t of e.changedTouches) {
                if (t.identifier === this.joystick.touchId) {
                    this.joystick.active  = false;
                    this.joystick.dx      = 0;
                    this.joystick.dy      = 0;
                    this.joystick.touchId = null;

                    if (this._joyEl) this._joyEl.style.display = 'none';
                } else if (t.identifier === this._aimTouch.touchId) {
                    this._aimTouch.active  = false;
                    this._aimTouch.touchId = null;
                    this.actions.fire      = false;
                }
            }

            if (e.touches.length === 0) {
                this.touch.active     = false;
                this.joystick.active  = false;
                this.joystick.touchId = null;
                this._aimTouch.active = false;
                this.actions.fire     = false;
                if (this._joyEl) this._joyEl.style.display = 'none';
            }
        }

        // ─── Aim from touch ───────────────────────────────────────────────────

        /**
         * Update aimAngle based on right-half touch position relative to screen center.
         * @param {number} sx screen X
         * @param {number} sy screen Y
         */
        _updateAimFromTouch(sx, sy) {
            if (!this._canvas) return;

            const player = IT.player;
            if (player) {
                // Aim at the world position the player sees
                const wx = this._toWorldX(sx);
                const wy = this._toWorldY(sy);
                this.aimAngle = Math.atan2(wy - player.y, wx - player.x);
            } else {
                const cx = this._canvas.width  / 2;
                const cy = this._canvas.height / 2;
                this.aimAngle = Math.atan2(sy - cy, sx - cx);
            }
        }

        // ─── Joystick helpers ─────────────────────────────────────────────────

        /**
         * Clamp raw joystick delta to unit circle, returning normalised x/y.
         * @param {number} dx
         * @param {number} dy
         * @returns {{x:number, y:number}}
         */
        _clampJoystick(dx, dy) {
            const len = Math.hypot(dx, dy);
            if (len === 0) return { x: 0, y: 0 };

            const clamped = Math.min(len, JOY_RADIUS);
            return { x: (dx / len) * (clamped / JOY_RADIUS), y: (dy / len) * (clamped / JOY_RADIUS) };
        }

        // ─── Coordinate conversion ────────────────────────────────────────────

        /**
         * Convert canvas screen X to world X, accounting for camera offset and scale.
         * @param {number} sx
         * @returns {number}
         */
        _toWorldX(sx) {
            const cam = IT.camera;
            if (!cam) return sx;
            const scale = cam.scale || 1;
            return sx / scale + (cam.x || 0);
        }

        /**
         * Convert canvas screen Y to world Y.
         * @param {number} sy
         * @returns {number}
         */
        _toWorldY(sy) {
            const cam = IT.camera;
            if (!cam) return sy;
            const scale = cam.scale || 1;
            return sy / scale + (cam.y || 0);
        }

        // ─── Virtual joystick DOM ─────────────────────────────────────────────

        /** Build the virtual joystick overlay elements. */
        _buildJoystickDOM(canvas) {
            const wrapper = canvas.parentElement || document.body;

            const base = document.createElement('div');
            base.id    = 'it-joystick-base';
            Object.assign(base.style, {
                position        : 'absolute',
                display         : 'none',
                width           : (JOY_RADIUS * 2) + 'px',
                height          : (JOY_RADIUS * 2) + 'px',
                borderRadius    : '50%',
                background      : 'rgba(255,255,255,0.10)',
                border          : '2px solid rgba(255,255,255,0.30)',
                boxSizing       : 'border-box',
                pointerEvents   : 'none',
                zIndex          : '1000',
                transform       : 'translate(-50%,-50%)',
                transition      : 'none',
            });

            const thumb = document.createElement('div');
            thumb.id    = 'it-joystick-thumb';
            Object.assign(thumb.style, {
                position        : 'absolute',
                width           : (JOY_THUMB_R * 2) + 'px',
                height          : (JOY_THUMB_R * 2) + 'px',
                borderRadius    : '50%',
                background      : 'rgba(100,200,255,0.55)',
                border          : '2px solid rgba(100,200,255,0.90)',
                boxSizing       : 'border-box',
                top             : '50%',
                left            : '50%',
                transform       : 'translate(-50%,-50%)',
                pointerEvents   : 'none',
            });

            base.appendChild(thumb);
            wrapper.style.position = wrapper.style.position || 'relative';
            wrapper.appendChild(base);

            this._joyEl      = base;
            this._joyThumbEl = thumb;
        }

        /** Reposition the joystick base overlay to where the touch landed. */
        _positionJoyBase(sx, sy) {
            if (!this._joyEl || !this._canvas) return;

            const rect     = this._canvas.getBoundingClientRect();
            const wrapRect = this._joyEl.parentElement.getBoundingClientRect();

            // Position relative to the wrapper element
            const lx = rect.left - wrapRect.left + sx;
            const ly = rect.top  - wrapRect.top  + sy;

            this._joyEl.style.left = lx + 'px';
            this._joyEl.style.top  = ly + 'px';
        }

        /** Move the thumb knob inside the base ring based on current dx/dy. */
        _updateJoyThumb() {
            if (!this._joyThumbEl) return;

            const joy     = this.joystick;
            const clamped = this._clampJoystick(joy.dx, joy.dy);

            const ox = clamped.x * JOY_RADIUS;
            const oy = clamped.y * JOY_RADIUS;

            this._joyThumbEl.style.transform =
                `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
        }

        // ─── Listener management ──────────────────────────────────────────────

        /**
         * Register an event listener and store it for later cleanup.
         * @param {EventTarget} target
         * @param {string}      type
         * @param {Function}    fn
         * @param {object}      [opts]
         */
        _on(target, type, fn, opts) {
            target.addEventListener(type, fn, opts);
            this._listeners.push([target, type, fn, opts]);
        }
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    IT.InputManager = InputManager;

}(window.IT = window.IT || {}));
