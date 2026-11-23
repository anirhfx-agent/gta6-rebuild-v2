// The player: on foot (walk/run, punch, shoot) and driving (arcade car
// physics with steering, grip and drift). One object, two modes; the game
// switches with E near a car.
import { clamp, angleDiff } from './rng.js';
import { isRoad, WORLD, BEACH_H } from './city.js';

export const CAR_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#4361ee', '#f72585', '#ffb703', '#7209b7', '#e9ecef'];

export class Car {
  constructor(x, y, angle, color, opts = {}) {
    this.x = x; this.y = y; this.angle = angle;
    this.speed = 0;
    this.color = color;
    this.len = 46; this.wid = 22;
    this.hp = 100;
    this.isPlayer = !!opts.isPlayer;
    this.isPolice = !!opts.isPolice;
    this.isTraffic = !!opts.isTraffic;
    this.driver = opts.driver ?? null; // 'player' | 'npc' | 'police' | null (parked)
    this.stuck = 0;
    this.siren = 0;
  }

  // Arcade handling: throttle, brake/reverse, steering that bites more at
  // speed, lateral grip with a little drift, drag. dt in seconds.
  drive(throttle, steer, dt) {
    const maxSpeed = this.isPolice ? 430 : 400;
    const accel = 340;
    if (throttle > 0) this.speed += accel * throttle * dt;
    else if (throttle < 0) this.speed += (this.speed > 8 ? -520 : -190) * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 140 * dt);
    this.speed = clamp(this.speed, -140, maxSpeed);
    const grip = 1 - clamp(Math.abs(this.speed) / maxSpeed, 0, 1) * 0.35;
    const turnRate = 2.6 * grip * (this.speed >= 0 ? 1 : -1);
    this.angle += steer * turnRate * dt * clamp(Math.abs(this.speed) / 60, 0.25, 1);
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    return { nx, ny };
  }
}

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2; // facing
    this.speed = 0;
    this.hp = 100;
    this.money = 120;
    this.onFoot = true;
    this.car = null; // Car the player drives, when in one
    this.punchCd = 0;
    this.shootCd = 0;
    this.ammo = 24;
    this.hurtCd = 0;
    this.moving = false;
    this.vx = 0; // velocity px/s, for police interception
    this.vy = 0;
  }

  // On-foot movement with building collision (axis-separated, simple AABB).
  walk(ix, iy, running, dt, solids) {
    const sp = running ? 250 : 165;
    let nx = this.x + ix * sp * dt;
    let ny = this.y + iy * sp * dt;
    this.moving = ix !== 0 || iy !== 0;
    if (this.moving) this.angle = Math.atan2(iy, ix);
    const r = 13;
    const blocked = (x, y) => solids.some((s) => x > s.x - r && x < s.x + s.w + r && y > s.y - r && y < s.y + s.h + r)
      || x < 20 || y < 20 || x > WORLD - 20 || y > WORLD - 20;
    if (!blocked(nx, this.y)) this.x = nx;
    if (!blocked(this.x, ny)) this.y = ny;
    this.x = clamp(this.x, 20, WORLD - 20);
    this.y = clamp(this.y, 20, WORLD - 20);
  }

  // Try to enter the nearest car within reach. Returns the car or null.
  tryEnterCar(cars) {
    let best = null, bestD = 70 * 70;
    for (const c of cars) {
      if (c.driver) continue; // occupied
      const d = (c.x - this.x) ** 2 + (c.y - this.y) ** 2;
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  // Try to carjack the nearest driven car (traffic or police).
  tryCarjack(cars) {
    let best = null, bestD = 80 * 80;
    for (const c of cars) {
      if (!c.driver || c.driver === 'player' || c.isPolice) continue;
      const d = (c.x - this.x) ** 2 + (c.y - this.y) ** 2;
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  enterCar(car) {
    car.driver = 'player';
    car.isPlayer = true;
    this.car = car;
    this.onFoot = false;
    this.x = car.x; this.y = car.y;
  }

  exitCar() {
    if (!this.car) return;
    const c = this.car;
    c.driver = null;
    c.isPlayer = false;
    c.speed = 0;
    // Step out to the side of the car.
    const sx = Math.cos(c.angle + Math.PI / 2), sy = Math.sin(c.angle + Math.PI / 2);
    this.x = c.x + sx * 30;
    this.y = c.y + sy * 30;
    this.car = null;
    this.onFoot = true;
  }

  hurt(amount) {
    if (this.hurtCd > 0) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hurtCd = 0.6;
  }

  tick(dt) {
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.hurtCd = Math.max(0, this.hurtCd - dt);
  }
}

// Keep a car inside the world and off buildings: slide along walls, stop
// on a hard hit (returns true when a crash happened).
export function collideCar(car, nx, ny, solids) {
  const hw = car.len / 2, hh = car.wid / 2;
  const hit = solids.some((s) => nx > s.x - hw && nx < s.x + s.w + hw && ny > s.y - hh && ny < s.y + s.h + hh)
    || nx < 24 || ny < 24 || nx > WORLD - 24 || ny > WORLD - 24
    || (ny > WORLD - BEACH_H + 40 && !isRoad(nx, ny)); // do not drive into the sea
  if (hit) {
    // Try sliding on each axis alone.
    const canX = !solids.some((s) => nx > s.x - hw && nx < s.x + s.w + hw && car.y > s.y - hh && car.y < s.y + s.h + hh) && nx >= 24 && nx <= WORLD - 24;
    const canY = !solids.some((s) => car.x > s.x - hw && car.x < s.x + s.w + hw && ny > s.y - hh && ny < s.y + s.h + hh) && ny >= 24 && ny <= WORLD - 24;
    if (canX && !canY) { car.x = nx; car.speed *= 0.45; return true; }
    if (canY && !canX) { car.y = ny; car.speed *= 0.45; return true; }
    car.speed *= 0.3;
    return true;
  }
  car.x = nx; car.y = ny;
  return false;
}

export function steerToward(car, tx, ty, dt, speedTarget = 400) {
  // Pure-pursuit steering for AI cars: returns {throttle, steer}.
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  const steer = clamp(diff * 2.2, -1, 1);
  const dist = Math.hypot(tx - car.x, ty - car.y);
  const throttle = dist > 40 ? 1 : 0.3;
  return { throttle, steer };
}
