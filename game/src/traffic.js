// Traffic cars and pedestrians. Traffic follows the road grid (pick a lane,
// drive to the next intersection, turn), slows for the car ahead, and honks
// when blocked. Pedestrians stroll the sidewalks and flee from danger.
import { roadCenter, isRoad, WORLD, BEACH_H, PITCH, GRID } from './city.js';
import { clamp, angleDiff, pick } from './rng.js';
import { Car, CAR_COLORS, collideCar, steerToward } from './player.js';

const PED_COLORS = ['#ffbe0b', '#fb8500', '#8338ec', '#3a86ff', '#06d6a0', '#ef476f', '#118ab2', '#f15bb5'];

export class Traffic {
  constructor(city) {
    this.city = city;
    this.cars = [];
    this.peds = [];
    this._spawnCars(14);
    this._spawnParked(8);
    this._spawnPeds(26);
  }

  _spawnParked(n) {
    // Parked cars at the curb: the first mission needs a car the player can
    // actually walk up to and take, not only moving traffic.
    for (let i = 0; i < n; i++) {
      const horiz = Math.random() < 0.5;
      const lane = 1 + Math.floor(Math.random() * 9); // avoid the edge roads
      const along = 120 + Math.random() * (WORLD - 240);
      const side = Math.random() < 0.5 ? -30 : 30;
      const x = horiz ? along : roadCenter(lane) + side;
      const y = horiz ? roadCenter(lane) + side : along;
      const angle = horiz ? 0 : Math.PI / 2;
      this.cars.push(new Car(x, y, angle, pick(Math.random, CAR_COLORS), { isTraffic: true, driver: null }));
    }
  }

  _spawnCars(n) {
    for (let i = 0; i < n; i++) {
      const s = this.city.carSpawns[(Math.random() * this.city.carSpawns.length) | 0];
      const c = new Car(s.x + (Math.random() - 0.5) * 30, s.y + (Math.random() - 0.5) * 30, s.angle,
        pick(Math.random, CAR_COLORS), { isTraffic: true, driver: 'npc' });
      c.speed = 120 + Math.random() * 90;
      c.route = this._newRoute(c);
      this.cars.push(c);
    }
  }

  _spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const s = this.city.pedSpawns[(Math.random() * this.city.pedSpawns.length) | 0];
      this.peds.push(this._makePed(s.x, s.y));
    }
  }

  _makePed(x, y) {
    return {
      x, y, angle: Math.random() * Math.PI * 2,
      speed: 45 + Math.random() * 35,
      color: pick(Math.random, PED_COLORS),
      target: null, flee: 0, walkPhase: Math.random() * 6,
    };
  }

  _newRoute(car) {
    // A route is a list of intersection points to drive through.
    const pts = [];
    let x = car.x, y = car.y;
    for (let i = 0; i < 5; i++) {
      const horizontal = Math.random() < 0.5;
      const lane = Math.floor(Math.random() * (GRID + 1));
      if (horizontal) pts.push({ x: Math.random() * (WORLD - 2 * 84) + 84, y: roadCenter(lane) });
      else pts.push({ x: roadCenter(lane), y: Math.random() * (WORLD - BEACH_H - 2 * 84) + 84 });
    }
    return pts;
  }

  _carAhead(car, others) {
    // Is there a car close ahead in my lane? Slow down for it.
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    for (const o of others) {
      if (o === car) continue;
      const dx = o.x - car.x, dy = o.y - car.y;
      const along = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (along > 0 && along < 90 && side < 26) return true;
    }
    return false;
  }

  update(dt, solids, player, wanted) {
    // --- traffic cars ---
    for (const c of this.cars) {
      if (c.driver !== 'npc') continue;
      if (!c.route || c.route.length === 0) c.route = this._newRoute(c);
      const wp = c.route[0];
      const d = Math.hypot(wp.x - c.x, wp.y - c.y);
      if (d < 30) { c.route.shift(); continue; }
      const { throttle, steer } = steerToward(c, wp.x, wp.y, dt);
      const blocked = this._carAhead(c, [...this.cars, player.car].filter(Boolean));
      const { nx, ny } = c.drive(blocked ? -0.4 : throttle, steer, dt);
      const crashed = collideCar(c, nx, ny, solids);
      if (crashed) {
        c.speed *= 0.5;
        c.route = this._newRoute(c); // reroute after a bump
      }
      // Keep traffic on roads: if pushed off, steer back to the nearest road.
      if (!isRoad(c.x, c.y) && c.y < WORLD - BEACH_H) {
        const lane = Math.round((c.x - 42) / PITCH);
        c.route = [{ x: roadCenter(clamp(lane, 0, GRID)), y: c.y }, ...c.route];
      }
    }

    // --- pedestrians ---
    for (const p of this.peds) {
      p.walkPhase += dt * 6;
      if (p.flee > 0) {
        p.flee -= dt;
        // Run away from the player / danger.
        const dx = p.x - player.x, dy = p.y - player.y;
        const d = Math.hypot(dx, dy) || 1;
        p.angle = Math.atan2(dy, dx);
        p.x += (dx / d) * 170 * dt;
        p.y += (dy / d) * 170 * dt;
      } else {
        if (!p.target || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 24) {
          // Pick a nearby sidewalk point to stroll to.
          p.target = {
            x: clamp(p.x + (Math.random() - 0.5) * 500, 60, WORLD - 60),
            y: clamp(p.y + (Math.random() - 0.5) * 500, 60, WORLD - BEACH_H - 60),
          };
        }
        const a = Math.atan2(p.target.y - p.y, p.target.x - p.x);
        p.angle = a;
        const nx = p.x + Math.cos(a) * p.speed * dt;
        const ny = p.y + Math.sin(a) * p.speed * dt;
        const blocked = solids.some((s) => nx > s.x - 8 && nx < s.x + s.w + 8 && ny > s.y - 8 && ny < s.y + s.h + 8);
        if (!blocked) { p.x = nx; p.y = ny; }
      }
      p.x = clamp(p.x, 30, WORLD - 30);
      p.y = clamp(p.y, 30, WORLD - BEACH_H - 30);
    }

    // Respawn peds that wandered too far from the player so the streets
    // always feel alive near the action.
    for (const p of this.peds) {
      if (Math.hypot(p.x - player.x, p.y - player.y) > 1500) {
        const s = this.city.pedSpawns[(Math.random() * this.city.pedSpawns.length) | 0];
        p.x = s.x; p.y = s.y; p.flee = 0; p.target = null;
      }
    }
  }

  scareNear(x, y, radius) {
    for (const p of this.peds) {
      if (Math.hypot(p.x - x, p.y - y) < radius) p.flee = 2.5;
    }
  }
}
