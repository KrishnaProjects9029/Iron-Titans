/**
 * physics.js -- Iron Titans
 * 2-D physics and collision system for the mech arena.
 * All methods are static -- no instance needed.
 * Exposed on window.IT.Physics
 */

'use strict';

const EPSILON = 1e-8;

// ---------------------------------------------------------------------------
//  Physics -- static methods only
// ---------------------------------------------------------------------------

class Physics {

    // -----------------------------------------------------------------------
    //  AABB slide resolution
    // -----------------------------------------------------------------------

    /**
     * Resolves collisions between a circular mech entity and axis-aligned
     * rectangular obstacles using separate-axis slide resolution.
     *
     * Mech must have: { x, y, radius, vx?, vy? }
     * Mutates mech.x, mech.y (and zeroes mech.vx/vy on collision axis).
     *
     * @param {{ x:number, y:number, radius:number, vx?:number, vy?:number }} mech
     * @param {{ x:number, y:number, w:number, h:number }[]} obstacles
     * @returns {boolean} true if any collision occurred
     */
    static resolveAABB(arg1, arg2, arg3, arg4) {
        const isObj = typeof arg1 === 'object' && arg1 !== null;
        let x = isObj ? arg1.x : arg1;
        let y = isObj ? arg1.y : arg2;
        const r = isObj ? (arg1.radius || 0) : (arg3 || 0);
        const obstacles = isObj ? arg2 : arg4;

        if (!obstacles || !Array.isArray(obstacles)) {
            if (isObj) return false;
            return { x, y, hit: false };
        }

        let hit = false;
        let vx = isObj ? arg1.vx : 0;
        let vy = isObj ? arg1.vy : 0;

        for (const obs of obstacles) {
            const ex = obs.x - r;
            const ey = obs.y - r;
            const ew = obs.w + 2 * r;
            const eh = obs.h + 2 * r;

            if (x >= ex && x <= ex + ew && y >= ey && y <= ey + eh) {
                hit = true;
                const overlapLeft   = (ex + ew) - x;
                const overlapRight  = x - ex;
                const overlapTop    = (ey + eh) - y;
                const overlapBottom = y - ey;

                const minX = Math.min(overlapLeft, overlapRight);
                const minY = Math.min(overlapTop, overlapBottom);

                if (minX < minY) {
                    if (overlapLeft < overlapRight) {
                        x = ex + ew;
                    } else {
                        x = ex;
                    }
                    vx = 0;
                } else {
                    if (overlapTop < overlapBottom) {
                        y = ey + eh;
                    } else {
                        y = ey;
                    }
                    vy = 0;
                }
            }
        }

        if (isObj) {
            arg1.x = x;
            arg1.y = y;
            if (arg1.vx != null) arg1.vx = vx;
            if (arg1.vy != null) arg1.vy = vy;
            return hit;
        }

        return { x, y, hit, vx, vy };
    }

    // -----------------------------------------------------------------------
    //  Raycast -- slab (DDA) method against axis-aligned rectangles
    // -----------------------------------------------------------------------

    /**
     * Casts a ray from (x, y) in direction (dx, dy) up to maxDist units.
     * Returns info about the nearest obstacle hit.
     *
     * @param {number} x        Ray origin X
     * @param {number} y        Ray origin Y
     * @param {number} dx       Direction X (need not be normalised)
     * @param {number} dy       Direction Y
     * @param {number} maxDist  Maximum travel distance
     * @param {{ x:number, y:number, w:number, h:number }[]} obstacles
     * @returns {{ hit:boolean, x:number, y:number, dist:number, normal:{x:number,y:number} }}
     */
    static raycast(x, y, dx, dy, maxDist, obstacles) {
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < EPSILON) {
            return { hit: false, x, y, dist: 0, normal: { x: 0, y: 0 } };
        }
        const rdx = dx / len;
        const rdy = dy / len;

        let nearestT  = maxDist;
        let hitNormal = { x: 0, y: 0 };
        let didHit    = false;

        for (const obs of obstacles) {
            const invDx = Math.abs(rdx) < EPSILON ? Infinity : 1 / rdx;
            const invDy = Math.abs(rdy) < EPSILON ? Infinity : 1 / rdy;

            let txMin = (obs.x - x) * invDx;
            let txMax = (obs.x + obs.w - x) * invDx;
            if (txMin > txMax) { const tmp = txMin; txMin = txMax; txMax = tmp; }

            let tyMin = (obs.y - y) * invDy;
            let tyMax = (obs.y + obs.h - y) * invDy;
            if (tyMin > tyMax) { const tmp = tyMin; tyMin = tyMax; tyMax = tmp; }

            const tEnter = Math.max(txMin, tyMin);
            const tExit  = Math.min(txMax, tyMax);

            if (tEnter > tExit)      continue; // miss
            if (tExit  < 0)          continue; // behind ray
            if (tEnter > nearestT)   continue; // farther than current best

            const t = tEnter >= 0 ? tEnter : tExit;
            if (t < 0 || t > nearestT) continue;

            nearestT = t;
            didHit   = true;

            // Normal: from the axis entered last
            if (txMin > tyMin) {
                hitNormal = { x: rdx < 0 ? 1 : -1, y: 0 };
            } else {
                hitNormal = { x: 0, y: rdy < 0 ? 1 : -1 };
            }
        }

        return {
            hit:    didHit,
            x:      x + rdx * nearestT,
            y:      y + rdy * nearestT,
            dist:   nearestT,
            normal: hitNormal,
        };
    }

    // -----------------------------------------------------------------------
    //  Primitive overlap tests
    // -----------------------------------------------------------------------

    /**
     * Circle vs axis-aligned rectangle overlap (nearest-point method).
     * @param {number} cx  Circle centre X
     * @param {number} cy  Circle centre Y
     * @param {number} cr  Circle radius
     * @param {number} rx  Rect left X
     * @param {number} ry  Rect top Y
     * @param {number} rw  Rect width
     * @param {number} rh  Rect height
     * @returns {boolean}
     */
    static circleRect(cx, cy, cr, rx, ry, rw, rh) {
        const nearX = Math.max(rx, Math.min(cx, rx + rw));
        const nearY = Math.max(ry, Math.min(cy, ry + rh));
        const dx = cx - nearX;
        const dy = cy - nearY;
        return dx * dx + dy * dy < cr * cr;
    }

    /**
     * Axis-aligned rectangle vs rectangle overlap.
     * @param {number} ax @param {number} ay @param {number} aw @param {number} ah
     * @param {number} bx @param {number} by @param {number} bw @param {number} bh
     * @returns {boolean}
     */
    static rectRect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw &&
               ax + aw > bx &&
               ay < by + bh &&
               ay + ah > by;
    }

    /**
     * Circle vs circle overlap.
     * @param {number} ax @param {number} ay @param {number} ar
     * @param {number} bx @param {number} by @param {number} br
     * @returns {boolean}
     */
    static circleCircle(ax, ay, ar, bx, by, br) {
        const combined = ar + br;
        const dx = bx - ax;
        const dy = by - ay;
        return dx * dx + dy * dy < combined * combined;
    }

    // -----------------------------------------------------------------------
    //  Circle separation
    // -----------------------------------------------------------------------

    /**
     * Separates two overlapping circular entities by pushing them apart evenly.
     * Mutates a.x, a.y, b.x, b.y.
     *
     * @param {{ x:number, y:number, radius:number }} a
     * @param {{ x:number, y:number, radius:number }} b
     */
    static pushOutCircles(a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const sqDist  = dx * dx + dy * dy;
        const minDist = (a.radius || 0) + (b.radius || 0);

        if (sqDist >= minDist * minDist) return; // already separated

        const d = Math.sqrt(sqDist);
        const overlap = minDist - d;

        let nx, ny;
        if (d < EPSILON) {
            nx = 1; ny = 0; // identical positions -- arbitrary push
        } else {
            nx = dx / d;
            ny = dy / d;
        }

        const half = overlap * 0.5;
        a.x -= nx * half;
        a.y -= ny * half;
        b.x += nx * half;
        b.y += ny * half;
    }

    // -----------------------------------------------------------------------
    //  Line-of-sight
    // -----------------------------------------------------------------------

    /**
     * Returns true if there is an unobstructed line between two points.
     * Uses raycast internally.
     *
     * @param {number} x1 @param {number} y1
     * @param {number} x2 @param {number} y2
     * @param {{ x:number, y:number, w:number, h:number }[]} obstacles
     * @returns {boolean}
     */
    static lineOfSight(x1, y1, x2, y2, obstacles) {
        const dx   = x2 - x1;
        const dy   = y2 - y1;
        const d    = Math.sqrt(dx * dx + dy * dy);
        if (d < EPSILON) return true;

        const result = Physics.raycast(x1, y1, dx, dy, d - EPSILON, obstacles);
        return !result.hit;
    }

    // -----------------------------------------------------------------------
    //  Projectile vs entities
    // -----------------------------------------------------------------------

    /**
     * Returns the first entity whose circle the projectile circle overlaps.
     * Skips same-team entities and dead entities (hp <= 0).
     *
     * Projectile: { x, y, radius, team }
     * Entities:   [{ x, y, radius, team, hp }]
     *
     * @param {{ x:number, y:number, radius:number, team:number }} proj
     * @param {{ x:number, y:number, radius:number, team:number, hp:number }[]} entities
     * @returns {object|null} The first hit entity, or null.
     */
    static projectileVsEntities(proj, entities) {
        for (const ent of entities) {
            if (ent.team === proj.team) continue;
            if (ent.hp  <= 0)           continue;
            if (Physics.circleCircle(proj.x, proj.y, proj.radius, ent.x, ent.y, ent.radius)) {
                return ent;
            }
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
//  Expose on global namespace
// ---------------------------------------------------------------------------

window.IT = window.IT || {};
window.IT.Physics = Physics;
