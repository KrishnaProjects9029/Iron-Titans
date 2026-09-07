/**
 * Iron Titans 3D — AudioManager.js
 * Centralized Web Audio API Procedural Audio & Music Engine.
 * Features:
 * - 100% Procedural synthesis (zero external audio files, zero copyright risks, zero HTTP 404s)
 * - Independent Volume Busses: Master, Music, SFX, UI (0.0 to 1.0)
 * - Mute All toggle
 * - Dynamic Voice Prioritization & Voice Pooling (max 12 concurrent SFX voices to ensure 60fps on mobile)
 * - 6 Distinct Weapon Sound Identities:
 *   - Pulse Cannon (coherent laser chirp)
 *   - Scatter Blaster (heavy shotgun spread transient)
 *   - Plasma Launcher (sub-bass charge + plasma detonation roar)
 *   - Arc Rifle (continuous buzzing electric arcs)
 *   - Missile Rack (pneumatic canister click + rocket motor hiss)
 *   - Rail Spear (high-voltage hum + supersonic rail crack)
 * - Mech Footsteps (weight-scaled: heavy tank vs light scout, throttled intervals)
 * - Dynamic Abilities (overdrive, phase dash, shield deploy, targeting lock)
 * - UI Feedback (hover, click, equip, upgrade chime, countdown beeps)
 * - Procedural Cyber Music Engine (Menu atmospheric synth pads + Battle dynamic arpeggiator)
 */

'use strict';

window.IT = window.IT || {};

(function (IT) {
  class AudioManager {
    constructor() {
      this.ctx = null;
      this.isMuted = false;
      this.masterVol = 0.8;
      this.musicVol = 0.6;
      this.sfxVol = 0.85;
      this.uiVol = 0.75;

      this.activeVoices = 0;
      this.maxVoices = 12;

      // Audio Nodes
      this.masterGain = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.uiGain = null;

      // Noise buffers
      this.whiteNoiseBuffer = null;
      this.pinkNoiseBuffer = null;

      // Music Sequencer State
      this.currentMusicMode = null; // 'MENU', 'BATTLE', 'NONE'
      this.musicTimer = null;
      this.musicStep = 0;

      // Footstep throttle tracker: mechId -> lastTimestamp
      this.footstepThrottles = new Map();

      this._initContextOnUserGesture();
    }

    _initContextOnUserGesture() {
      const unlock = () => {
        if (!this.ctx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            this.ctx = new AudioContextClass();
            this._setupBusses();
            this._generateNoiseBuffers();
          }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        if (typeof window !== 'undefined' && window.removeEventListener) {
          ['click', 'touchstart', 'keydown'].forEach(evt => {
            window.removeEventListener(evt, unlock);
          });
        }
      };

      if (typeof window !== 'undefined' && window.addEventListener) {
        ['click', 'touchstart', 'keydown'].forEach(evt => {
          window.addEventListener(evt, unlock, { once: false, passive: true });
        });
      }
    }

    init() {
      this._ensureContext();
    }

    _ensureContext() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
          this._setupBusses();
          this._generateNoiseBuffers();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return !!this.ctx;
    }

    _setupBusses() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Master
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVol, now);
      this.masterGain.connect(this.ctx.destination);

      // Music
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVol, now);
      this.musicGain.connect(this.masterGain);

      // SFX
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVol, now);
      this.sfxGain.connect(this.masterGain);

      // UI
      this.uiGain = this.ctx.createGain();
      this.uiGain.gain.setValueAtTime(this.uiVol, now);
      this.uiGain.connect(this.masterGain);
    }

    _generateNoiseBuffers() {
      if (!this.ctx) return;
      const sampleRate = this.ctx.sampleRate;
      const len = sampleRate * 2.0; // 2 seconds buffer

      // White noise
      this.whiteNoiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
      const outW = this.whiteNoiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        outW[i] = Math.random() * 2 - 1;
      }

      // Pink / Brown noise for explosions and thrusters
      this.pinkNoiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
      const outP = this.pinkNoiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        outP[i] = (b0 + b1 + b2) * 0.22;
      }
    }

    // ── SETTINGS & VOLUME CONTROLS ──
    get masterVolume() { return this.masterVol; }
    get musicVolume() { return this.musicVol; }
    get sfxVolume() { return this.sfxVol; }
    get uiVolume() { return this.uiVol; }

    setMasterVolume(val) {
      this.masterVol = Math.max(0, Math.min(1, val));
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVol, this.ctx.currentTime);
      }
    }

    setMusicVolume(val) {
      this.musicVol = Math.max(0, Math.min(1, val));
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.setValueAtTime(this.musicVol, this.ctx.currentTime);
      }
    }

    setSFXVolume(val) {
      this.sfxVol = Math.max(0, Math.min(1, val));
      if (this.sfxGain && this.ctx) {
        this.sfxGain.gain.setValueAtTime(this.sfxVol, this.ctx.currentTime);
      }
    }

    setSfxVolume(val) {
      return this.setSFXVolume(val);
    }

    setUIVolume(val) {
      this.uiVol = Math.max(0, Math.min(1, val));
      if (this.uiGain && this.ctx) {
        this.uiGain.gain.setValueAtTime(this.uiVol, this.ctx.currentTime);
      }
    }

    setMute(mute) {
      this.isMuted = !!mute;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVol, this.ctx.currentTime);
      }
    }

    setMuted(mute) {
      return this.setMute(mute);
    }

    // ── WEAPON AUDIO DISPATCH ──
    playWeaponFire(weaponId, isPlayer = true) {
      if (!this._ensureContext()) return;
      if (this.activeVoices >= this.maxVoices && !isPlayer) return;

      const id = (weaponId || 'pulseCannon').toLowerCase();
      switch (id) {
        case 'scatterblaster':
          this._playScatterBlaster(isPlayer);
          break;
        case 'plasmalauncher':
          this._playPlasmaLauncher(isPlayer);
          break;
        case 'arcrifle':
          this._playArcRifle(isPlayer);
          break;
        case 'missilerack':
          this._playMissileRack(isPlayer);
          break;
        case 'railspear':
          this._playRailSpear(isPlayer);
          break;
        case 'pulsecannon':
        default:
          this._playPulseCannon(isPlayer);
          break;
      }
    }

    _playPulseCannon(isPlayer) {
      const now = this.ctx.currentTime;
      const vol = isPlayer ? 0.45 : 0.22;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(840, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);

      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      this.activeVoices++;
      osc.start(now);
      osc.stop(now + 0.14);
      osc.onended = () => this.activeVoices--;
    }

    _playScatterBlaster(isPlayer) {
      const now = this.ctx.currentTime;
      const vol = isPlayer ? 0.6 : 0.28;

      if (!this.whiteNoiseBuffer) return;

      const noise = this.ctx.createBufferSource();
      noise.buffer = this.whiteNoiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.18);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);

      // Low punch osc
      const sub = this.ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(180, now);
      sub.frequency.exponentialRampToValueAtTime(45, now + 0.15);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(vol * 0.8, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      sub.connect(subGain);
      subGain.connect(this.sfxGain);

      this.activeVoices += 2;
      noise.start(now);
      noise.stop(now + 0.21);
      sub.start(now);
      sub.stop(now + 0.17);
      noise.onended = () => { this.activeVoices = Math.max(0, this.activeVoices - 2); };
    }

    _playPlasmaLauncher(isPlayer) {
      const now = this.ctx.currentTime;
      const vol = isPlayer ? 0.65 : 0.32;

      // Heavy sub-bass charge
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.35);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      // Plasma sizzle noise
      if (this.pinkNoiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.pinkNoiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(950, now);
        filter.Q.setValueAtTime(3.0, now);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(vol * 0.5, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.sfxGain);
        noise.start(now);
        noise.stop(now + 0.36);
      }

      osc.connect(gain);
      gain.connect(this.sfxGain);

      this.activeVoices++;
      osc.start(now);
      osc.stop(now + 0.39);
      osc.onended = () => this.activeVoices--;
    }

    _playArcRifle(isPlayer) {
      const now = this.ctx.currentTime;
      const vol = isPlayer ? 0.38 : 0.18;

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480 + (Math.random() * 200 - 100), now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(600, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      this.activeVoices++;
      osc.start(now);
      osc.stop(now + 0.09);
      osc.onended = () => this.activeVoices--;
    }

    _playMissileRack(isPlayer) {
      const now = this.ctx.currentTime;
      const vol = isPlayer ? 0.55 : 0.25;

      // Mechanical canister latch click
      const click = this.ctx.createOscillator();
      click.type = 'triangle';
      click.frequency.setValueAtTime(900, now);
      click.frequency.exponentialRampToValueAtTime(200, now + 0.04);
      const cGain = this.ctx.createGain();
      cGain.gain.setValueAtTime(vol * 0.7, now);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      click.connect(cGain);
      cGain.connect(this.sfxGain);
      click.start(now);
      click.stop(now + 0.06);

      // Rocket whoosh hiss
      if (this.pinkNoiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.pinkNoiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 0.28);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.01, now);
        nGain.gain.linearRampToValueAtTime(vol, now + 0.06);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.sfxGain);
        noise.start(now);
        noise.stop(now + 0.34);
      }
    }

    _playRailSpear(isPlayer) {
      const now = this.ctx.currentTime;
      const vol = isPlayer ? 0.75 : 0.35;

      // High-voltage capacitor charging tone
      const charge = this.ctx.createOscillator();
      charge.type = 'sine';
      charge.frequency.setValueAtTime(1200, now);
      charge.frequency.exponentialRampToValueAtTime(2800, now + 0.06);
      const chGain = this.ctx.createGain();
      chGain.gain.setValueAtTime(vol * 0.4, now);
      chGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      charge.connect(chGain);
      chGain.connect(this.sfxGain);
      charge.start(now);
      charge.stop(now + 0.08);

      // Supersonic sonic boom crack
      const crack = this.ctx.createOscillator();
      crack.type = 'sawtooth';
      crack.frequency.setValueAtTime(180, now + 0.06);
      crack.frequency.exponentialRampToValueAtTime(30, now + 0.28);
      const crGain = this.ctx.createGain();
      crGain.gain.setValueAtTime(vol, now + 0.06);
      crGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      crack.connect(crGain);
      crGain.connect(this.sfxGain);
      crack.start(now + 0.06);
      crack.stop(now + 0.34);
    }

    // ── FOOTSTEPS (THROTTLED & WEIGHT-SCALED) ──
    playFootstep(mechId = 'default', role = 'Tank', surface = 'concrete') {
      if (!this._ensureContext()) return;

      if (mechId === 'HEAVY' || mechId === 'LIGHT' || mechId === 'Scout' || mechId === 'Tank') {
        role = mechId;
        mechId = 'generic';
      }

      const nowMs = performance.now();
      const last = this.footstepThrottles.get(mechId) || 0;
      const throttleInterval = (role === 'Scout' || role === 'LIGHT') ? 380 : (role === 'Tank' || role === 'Defender' || role === 'HEAVY' ? 560 : 460);

      if (nowMs - last < throttleInterval) return;
      this.footstepThrottles.set(mechId, nowMs);

      if (this.activeVoices >= this.maxVoices) return;

      const now = this.ctx.currentTime;
      const isHeavy = role === 'Tank' || role === 'Defender' || role === 'HEAVY';
      const vol = isHeavy ? 0.35 : 0.22;

      // Mechanical servo clunk
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isHeavy ? 110 : 190, now);
      osc.frequency.exponentialRampToValueAtTime(isHeavy ? 35 : 70, now + 0.12);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      this.activeVoices++;
      osc.start(now);
      osc.stop(now + 0.15);
      osc.onended = () => this.activeVoices--;
    }

    // ── COMBAT IMPACTS & DESTRUCTION ──
    playImpact(type = 'METAL') {
      if (!this._ensureContext()) return;
      if (this.activeVoices >= this.maxVoices) return;

      const now = this.ctx.currentTime;
      switch (type) {
        case 'SHIELD': {
          // Translucent energy ripple hum
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(650, now);
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.4, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.21);
          break;
        }

        case 'CRITICAL': {
          // Sharp resonant high-pitch ding for weak point strike
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1400, now);
          osc.frequency.exponentialRampToValueAtTime(900, now + 0.22);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.55, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.26);
          break;
        }

        case 'METAL':
        default: {
          // Kinetic ricochet ping
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(750, now);
          osc.frequency.exponentialRampToValueAtTime(160, now + 0.14);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.38, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(now);
          osc.stop(now + 0.16);
          break;
        }
      }
    }

    playHit(type = 'METAL') {
      return this.playImpact(type);
    }

    playDestructionExplosion() {
      if (!this._ensureContext()) return;
      const now = this.ctx.currentTime;

      // Heavy bass reactor breach
      const sub = this.ctx.createOscillator();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(120, now);
      sub.frequency.exponentialRampToValueAtTime(25, now + 0.65);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.85, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.70);
      sub.connect(subGain);
      subGain.connect(this.sfxGain);
      sub.start(now);
      sub.stop(now + 0.72);

      // Noise rumble
      if (this.pinkNoiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.pinkNoiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.85);

        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.9, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.90);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(this.sfxGain);
        noise.start(now);
        noise.stop(now + 0.92);
      }
    }

    // ── ABILITIES & ALERTS ──
    playAbility(abilityId) {
      if (!this._ensureContext()) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.25);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.34);
    }

    // ── UI AUDIO ──
    playUI(type = 'click') {
      if (!this._ensureContext()) return;
      const now = this.ctx.currentTime;

      switch (type) {
        case 'hover': {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(420, now);
          g.gain.setValueAtTime(0.06, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.connect(g);
          g.connect(this.uiGain);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
        }

        case 'upgrade': {
          // Dual harmonic celebratory chime
          [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.07);
            g.gain.setValueAtTime(0.28, now + idx * 0.07);
            g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.28);
            osc.connect(g);
            g.connect(this.uiGain);
            osc.start(now + idx * 0.07);
            osc.stop(now + idx * 0.07 + 0.30);
          });
          break;
        }

        case 'countdown_tick': {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(587.33, now); // D5
          g.gain.setValueAtTime(0.3, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.connect(g);
          g.connect(this.uiGain);
          osc.start(now);
          osc.stop(now + 0.09);
          break;
        }

        case 'countdown_go': {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880.0, now); // A5
          g.gain.setValueAtTime(0.5, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(g);
          g.connect(this.uiGain);
          osc.start(now);
          osc.stop(now + 0.38);
          break;
        }

        case 'click':
        default: {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(650, now);
          osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);
          g.gain.setValueAtTime(0.25, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.connect(g);
          g.connect(this.uiGain);
          osc.start(now);
          osc.stop(now + 0.07);
          break;
        }
      }
    }

    // ── PROCEDURAL CYBER MUSIC ENGINE ──
    startMusic(mode = 'MENU') {
      if (this.currentMusicMode === mode) return;
      this.stopMusic();
      this.currentMusicMode = mode;

      if (!this._ensureContext()) return;

      const tempo = mode === 'BATTLE' ? 132 : 88;
      const beatInterval = (60 / tempo) * 1000 * 0.5; // Eighth-notes

      // Cyber Bass & Harmony Notes
      const battleScale = [55, 55, 65.4, 73.4, 82.4, 98, 82.4, 73.4]; // A minor driving bass
      const menuChords = [110, 130.81, 164.81, 196.0]; // Am7 lush atmospheric pad

      this.musicStep = 0;
      this.musicTimer = setInterval(() => {
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        if (this.currentMusicMode === 'BATTLE') {
          // Driving synthesizer bass
          const freq = battleScale[this.musicStep % battleScale.length];
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const g = this.ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(550, now);
          filter.frequency.exponentialRampToValueAtTime(180, now + 0.22);

          g.gain.setValueAtTime(0.18, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

          osc.connect(filter);
          filter.connect(g);
          g.connect(this.musicGain);

          osc.start(now);
          osc.stop(now + 0.25);
        } else if (this.currentMusicMode === 'MENU') {
          // Atmospheric ambient chord pulses every 4 steps
          if (this.musicStep % 4 === 0) {
            menuChords.forEach(f => {
              const osc = this.ctx.createOscillator();
              const g = this.ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(f, now);
              g.gain.setValueAtTime(0.04, now);
              g.gain.linearRampToValueAtTime(0.08, now + 0.6);
              g.gain.exponentialRampToValueAtTime(0.001, now + 2.4);

              osc.connect(g);
              g.connect(this.musicGain);
              osc.start(now);
              osc.stop(now + 2.5);
            });
          }
        }

        this.musicStep++;
      }, beatInterval);
    }

    stopMusic() {
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      this.currentMusicMode = 'NONE';
    }
  }

  IT.AudioManager = new AudioManager();
})(window.IT);
