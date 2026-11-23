// The wanted system and the Solmar PD. Crimes raise stars (1-5); police cars
// spawn at the map edge and chase the player, on foot they close in to make
// the arrest. Stars decay when the player stays out of every cop's sight;
// at 0 the heat is off. Getting busted costs cash and drops the player at
// the precinct with the wanted level cleared.
import { Car, steerToward, collideCar } from './player.js';
import { clamp } from './rng.js';
import { WORLD, BEACH_H, roadCenter, GRID } from './city.js';

export const WANTED_NAMES = ['', 'A disturbance', 'A suspect', 'A fugitive', 'A menace', 'PUBLIC ENEMY'];

export class Police {
  constructor() {
    this.wanted = 0; // 0..5
    this.heat = 0;   // 0..100, drives star changes
    this.cars = [];
    this.officers = []; // on-foot cops
    this.decay = 0;
    this.bustedTimer = 0;
    this.spawnCd = 0;
  }

  addHeat(amount, reason) {
    if (this.wanted >= 5) { this.heat = 100; return; }
    this.heat = clamp(this.heat + amount, 0, 100);
    const stars = this.heat <= 0 ? 0 : this.heat < 25 ? 1 : this.heat < 45 ? 2 : this.heat < 65 ? 3 : this.heat < 85 ? 4 : 5;
    if (stars > this.wanted) this.wanted = stars;
  }

  // How many police units the current wanted level fields.
  targetUnits() {
    return [0, 1, 2, 3, 4, 6][this.wanted];
  }

  _spawnPoint(player) {
    // Just off-screen from the player, on a road.
    const edge = Math.floor(Math.random() * 4);
    const lane = Math.floor(Math.random() * (GRID + 1));
    if (edge === 0) return { x: clamp(player.x - 700, 100, WORLD - 100), y: roadCenter(lane) };
    if (edge === 1) return { x: clamp(player.x + 700, 100, WORLD - 100), y: roadCenter(lane) };
    if (edge === 2) return { x: roadCenter(lane), y: clamp(player.y - 700, 100, WORLD - BEACH_H - 100) };
    return { x: roadCenter(lane), y: clamp(player.y + 700, 100, WORLD - BEACH_H - 100) };
  }

  update(dt, player, solids, sound) {
    this.spawnCd -= dt;
    const want = this.targetUnits();

    // Spawn / despawn police cars to match the wanted level.
    if (this.cars.length < want && this.spawnCd <= 0 && this.wanted > 0) {
      const s = this._spawnPoint(player);
      const c = new Car(s.x, s.y, 0, '#1b2a4a', { isPolice: true, driver: 'police' });
      c.speed = 200;
      this.cars.push(c);
      this.spawnCd = 1.6;
    }
    if (this.wanted === 0) {
      for (const c of this.cars) c.driver = null;
      this.cars = [];
      this.officers = [];
    }

    // Police cars chase the player; they ram the player's car and, when the
    // player is on foot, stop nearby and send an officer out.
    for (const c of this.cars) {
      if (c.driver !== 'police') continue;
      c.ramCd = Math.max(0, (c.ramCd || 0) - dt);
      const d = Math.hypot(player.x - c.x, player.y - c.y);
      if (!player.onFoot && d < 60 && c.ramCd <= 0) {
        // Ram: shove the player's car and damage it (once per cooldown).
        if (player.car) {
          player.car.hp = Math.max(0, player.car.hp - 3);
          player.car.speed *= 0.85;
        }
        c.speed *= 0.7;
        c.ramCd = 0.9;
      }
      if (player.onFoot && d < 90 && this.officers.length < 2) {
        // An officer gets out to make the arrest.
        this.officers.push({ x: c.x, y: c.y, speed: 175, car: c });
        c.driver = null;
        c.speed = 0;
      }
      if (c.driver === 'police') {
        // Intercept, not pure pursuit: aim ahead of the player's velocity so
        // the PD cuts corners and is harder to shake by weaving.
        const lead = 0.55;
        const tx = player.x + (player.vx || 0) * lead;
        const ty = player.y + (player.vy || 0) * lead;
        const { throttle, steer } = steerToward(c, tx, ty, dt);
        const { nx, ny } = c.drive(throttle, steer, dt);
        collideCar(c, nx, ny, solids);
        c.siren = (c.siren || 0) + dt;
      }
    }

    // Officers on foot run the player down; touching the player busts them.
    for (const o of this.officers) {
      const a = Math.atan2(player.y - o.y, player.x - o.x);
      o.x += Math.cos(a) * o.speed * dt;
      o.y += Math.sin(a) * o.speed * dt;
      if (Math.hypot(player.x - o.x, player.y - o.y) < 26 && player.onFoot) {
        this.bustedTimer = 2.2; // busted!
      }
    }
    // Officers give up and return to their car when the heat dies.
    if (this.wanted === 0) this.officers = [];

    // Wanted decay: only when no police unit can see the player.
    const seen = this.cars.some((c) => Math.hypot(player.x - c.x, player.y - c.y) < 520)
      || this.officers.some((o) => Math.hypot(player.x - o.x, player.y - o.y) < 420);
    if (!seen && this.wanted > 0) {
      this.decay += dt;
      if (this.decay > 7) {
        this.decay = 0;
        this.heat = Math.max(0, this.heat - 22);
        this.wanted = this.heat <= 0 ? 0 : this.heat < 25 ? 1 : this.heat < 45 ? 2 : this.heat < 65 ? 3 : this.heat < 85 ? 4 : 5;
      }
    } else {
      this.decay = 0;
    }

    if (this.wanted > 0) sound.siren(dt);
    return this.bustedTimer > 0;
  }

  clearAfterBusted() {
    this.wanted = 0;
    this.heat = 0;
    this.decay = 0;
    this.bustedTimer = 0;
    this.cars = [];
    this.officers = [];
  }
}
