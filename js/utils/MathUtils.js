/**
 * MathUtils.js -- Iron Titans
 * Vector2 math library and general game math utilities.
 * Exposed on window.IT.MathUtils
 */

'use strict';

// ---------------------------------------------------------------------------
//  Vec2 -- 2-D vector class
// ---------------------------------------------------------------------------

class Vec2 {
    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    // ---- instance methods --------------------------------------------------

    /** Returns a new Vec2 that is the sum of this and v. */
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }

    /** Returns a new Vec2 that is this minus v. */
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }

    /** Returns a new Vec2 scaled by scalar s. */
    scale(s) { return new Vec2(this.x * s, this.y * s); }

    /** Dot product of this and v. */
    dot(v) { return this.x * v.x + this.y * v.y; }

    /** 2-D cross product (scalar z-component) of this and v. */
    cross(v) { return this.x * v.y - this.y * v.x; }

    /** Euclidean length of this vector. */
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }

    /**
     * Returns a unit-length copy of this vector.
     * Returns Vec2.zero() if the vector has zero length.
     */
    normalize() {
        const len = this.length();
        if (len === 0) return Vec2.zero();
        return new Vec2(this.x / len, this.y / len);
    }

    /** Euclidean distance from this point to point v. */
    dist(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Angle (radians) of this vector from the positive X axis.
     * Range: (-PI, PI].
     */
    angle() { return Math.atan2(this.y, this.x); }

    /**
     * Returns a new Vec2 rotated by angle `a` (radians) counter-clockwise.
     * @param {number} a
     */
    rotate(a) {
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        return new Vec2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    /** Returns a deep copy of this vector. */
    clone() { return new Vec2(this.x, this.y); }

    /**
     * Returns a new Vec2 linearly interpolated toward v by t in [0, 1].
     * @param {Vec2} v
     * @param {number} t
     */
    lerp(v, t) {
        return new Vec2(
            this.x + (v.x - this.x) * t,
            this.y + (v.y - this.y) * t
        );
    }

    toString() { return `Vec2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`; }

    // ---- static factory methods -------------------------------------------

    /**
     * Creates a unit vector from an angle in radians.
     * @param {number} a
     * @returns {Vec2}
     */
    static fromAngle(a) { return new Vec2(Math.cos(a), Math.sin(a)); }

    /** @returns {Vec2} (0, 0) */
    static zero() { return new Vec2(0, 0); }

    /** @returns {Vec2} (0, -1) -- up in screen-space. */
    static up() { return new Vec2(0, -1); }
}

// ---------------------------------------------------------------------------
//  Free math utility functions
// ---------------------------------------------------------------------------

/** Clamps v to [min, max]. */
function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

/** Linear interpolation between a and b by t in [0, 1]. */
function lerp(a, b, t) { return a + (b - a) * t; }

/** Wraps angle a into (-PI, PI]. */
function normalizeAngle(a) {
    while (a > Math.PI)   a -= 2 * Math.PI;
    while (a <= -Math.PI) a += 2 * Math.PI;
    return a;
}

/** Signed shortest angular delta from `from` to `to` (radians), result in (-PI, PI]. */
function shortestAngleDelta(from, to) { return normalizeAngle(to - from); }

/** Shortest-path angular lerp between angles a and b by t. */
function lerpAngle(a, b, t) { return normalizeAngle(a + shortestAngleDelta(a, b) * t); }

/** Random float in [min, max). */
function randomFloat(min, max) { return min + Math.random() * (max - min); }

/** Random integer in [min, max] inclusive. */
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/** Random element from array. */
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Angle in radians from (x1,y1) to (x2,y2). */
function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

/** Squared distance between two points. */
function distSq(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    return dx * dx + dy * dy;
}

/** Euclidean distance between two points. */
function dist(x1, y1, x2, y2) { return Math.sqrt(distSq(x1, y1, x2, y2)); }

/** True if point (px,py) is inside axis-aligned rectangle. */
function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/** True if two circles overlap. */
function circlesOverlap(ax, ay, ar, bx, by, br) {
    const r = ar + br;
    return distSq(ax, ay, bx, by) < r * r;
}

/** True if two axis-aligned rectangles overlap. */
function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ---------------------------------------------------------------------------
//  Expose on global namespace
// ---------------------------------------------------------------------------

window.IT = window.IT || {};
window.IT.Vec2 = Vec2;
window.IT.MathUtils = {
    Vec2,
    clamp,
    lerp,
    lerpAngle,
    randomFloat,
    randomInt,
    randomChoice,
    angleTo,
    distSq,
    dist,
    normalizeAngle,
    shortestAngleDelta,
    pointInRect,
    circlesOverlap,
    rectOverlap,
};
