// Solmar — an open-world crime game. Boot, game loop, state machine (menu,
// playing, paused, busted, wasted), driving/walking input, collisions,
// camera, clock, autosave, and the mission-objective helper the HUD and
// minimap read.
import { buildCity, PLAYER_START, WORLD, BEACH_H, roadCenter } from './city.js';
import { Player, Car, CAR_COLORS, collideCar } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { Sound } from './audio.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { drawWorld } from './render.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { applyScene, SCENES } from './shots.js';
import { clamp, pick } from './rng.js';

const SAVE_EVERY = 15; // seconds between autosaves

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.city = buildCity();
    this.solids = this.city.buildings.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
    this.player = new Player(PLAYER_START.x, PLAYER_START.y);
    this.traffic = new Traffic(this.city);
    this.police = new Police();
    this.combat = new Combat();
    this.missions = new MissionManager();
    this.sound = new Sound();
    this.input = new Input(canvas);
    this.hud = new Hud(document);
    this.cam = { x: this.player.x, y: this.player.y };
    this.time = 0;
    this.clock = 9 * 60 + 15; // 09:15 in the morning
    this.state = 'menu';
    this.sceneMode = null;
    this.skids = [];
    this.saveTimer = SAVE_EVERY;
    this.endTimer = 0; // busted / wasted overlay timer
    this.endKind = null;
    this.last = performance.now();
    this.paused = false;
    this._bindMenu();
    const params = new URLSearchParams(location.search);
    const scene = params.get('scene');
    if (scene && SCENES.includes(scene)) {
      this._startNew(false);
      applyScene(this, scene);
      this._showGame();
    }
  }

  // The current objective point for the world marker and the minimap.
  missionTarget() {
    const m = this.missions.current;
    const a = this.missions.active;
    if (!m || !a) {
      if (this.missions.sideWork) return this.missions.sideWork.dest;
      return null;
    }
    switch (m.kind) {
      case 'deliver-car': return m.target();
      case 'checkpoints': {
        const t = m.targets();
        return a.step < t.length ? t[a.step] : null;
      }
      case 'lose-heat': return null;
      case 'collect': {
        const next = a.pickups.find((p) => !p.taken);
        return next ?? null;
      }
      case 'fetch-deliver': return a.hasGoods ? m.target() : m.pickup();
      default: return null;
    }
  }

  _bindMenu() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').addEventListener('click', () => { this.sound.ensure(); this._startNew(true); });
    $('btn-continue').addEventListener('click', () => { this.sound.ensure(); this._startContinue(); });
    $('btn-sound').addEventListener('click', (e) => {
      this.sound.ensure();
      this.sound.enabled = !this.sound.enabled;
      e.target.textContent = this.sound.enabled ? 'Sound: ON' : 'Sound: OFF';
    });
    $('btn-resume').addEventListener('click', () => this._showGame());
    $('btn-quit-menu').addEventListener('click', () => this._showMenu());
    $('btn-restart').addEventListener('click', () => { clearSave(); this._startNew(true); });
    const save = loadSave();
    $('btn-continue').style.display = save ? 'inline-block' : 'none';
    if (save) $('save-info').textContent = `Save found — $${save.money}, job ${save.missionIndex + 1} of 5.`;
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.state === 'playing') this._showPause();
      else if (e.code === 'Escape' && this.state === 'paused') this._showGame();
    });
  }

  _startNew(fresh) {
    if (fresh) {
      this.player = new Player(PLAYER_START.x, PLAYER_START.y);
      this.missions = new MissionManager();
      this.police = new Police();
      this.traffic = new Traffic(this.city);
      this.clock = 9 * 60 + 15;
    }
    this.missions.start(this.missions.current);
    this._showGame();
  }

  _startContinue() {
    const s = loadSave();
    if (!s) { this._startNew(true); return; }
    this.player.money = s.money ?? 120;
    this.player.hp = s.hp ?? 100;
    this.player.x = s.x ?? PLAYER_START.x;
    this.player.y = s.y ?? PLAYER_START.y;
    this.missions.index = Math.min(s.missionIndex ?? 0, 5);
    this.missions.done = s.done ?? [];
    this.clock = s.clock ?? 9 * 60 + 15;
    if (this.missions.current) this.missions.start(this.missions.current);
    this._showGame();
  }

  _showMenu() {
    this.state = 'menu';
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('pause').style.display = 'none';
    document.getElementById('end').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
  }

  _showGame() {
    this.state = 'playing';
    document.getElementById('menu').style.display = 'none';
    document.getElementById('pause').style.display = 'none';
    document.getElementById('end').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
  }

  _showPause() {
    this.state = 'paused';
    document.getElementById('pause').style.display = 'flex';
  }

  _showEnd(kind, title, text) {
    this.state = 'end';
    this.endKind = kind;
    this.endTimer = 2.6;
    const el = document.getElementById('end');
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-text').textContent = text;
    el.style.display = 'flex';
  }

  _respawn(kind) {
    if (kind === 'busted') {
      this.player.money = Math.max(0, this.player.money - Math.min(200, Math.floor(this.player.money * 0.1)));
      this.player.x = roadCenter(5);
      this.player.y = roadCenter(5);
      this.player.hp = 100;
      this.police.clearAfterBusted();
      this.missions.say('You spent the night in the precinct. Cassie bailed you out — the job is still open.');
    } else {
      // Wasted: the hospital patches Leo up and takes half his cash.
      this.player.money = Math.floor(this.player.money / 2);
      this.player.x = roadCenter(3);
      this.player.y = roadCenter(3);
      this.player.hp = 100;
      this.police.clearAfterBusted();
      this.missions.say('You woke up at Solmar General, $' + this.player.money + ' left. Get back to work.');
    }
    if (this.player.car) { this.player.exitCar(); }
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this._showGame();
  }

  // ---- per-frame update ----
  update(dt) {
    this.time += dt;
    this.clock = (this.clock + dt * 0.35) % (24 * 60);
    this.missions.tick(dt);
    this.combat.update(dt);
    this.player.tick(dt);

    if (this.state === 'end') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this._respawn(this.endKind);
      return;
    }
    if (this.state !== 'playing') return;

    const input = this.input;
    const p = this.player;
    const ox = p.x, oy = p.y; // for velocity tracking (police interception)

    // --- input: driving vs on foot ---
    if (!p.onFoot && p.car) {
      const up = input.down('KeyW', 'ArrowUp') || !!this.sceneMode; // scenes cruise for the shot
      const down = input.down('KeyS', 'ArrowDown');
      const left = input.down('KeyA', 'ArrowLeft');
      const right = input.down('KeyD', 'ArrowRight');
      const throttle = up ? 1 : down ? -1 : 0;
      const steer = (left ? -1 : 0) + (right ? 1 : 0);
      const before = { x: p.car.x, y: p.car.y, a: p.car.angle };
      const { nx, ny } = p.car.drive(throttle, steer, dt);
      const crashed = collideCar(p.car, nx, ny, this.solids);
      if (crashed && Math.abs(p.car.speed) > 120) {
        this.sound.crash();
        p.car.hp = Math.max(0, p.car.hp - 8);
        this.traffic.scareNear(p.car.x, p.car.y, 200);
      }
      // Skid marks on hard cornering at speed.
      if (Math.abs(steer) > 0.6 && Math.abs(p.car.speed) > 240) {
        this.skids.push({ x1: before.x, y1: before.y, x2: p.car.x, y2: p.car.y, life: 1 });
      }
      p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
      if (p.car.hp <= 0) {
        // Wrecked: the car dies and Leo bails out on foot.
        this.sound.crash();
        const wreck = p.car;
        p.exitCar();
        wreck.driver = null;
        this.traffic.cars = this.traffic.cars.filter((c) => c !== wreck);
        this.missions.say('Your ride is totalled. Find another one.');
      }
      if (input.pressed('KeyE')) p.exitCar();
      if (input.pressed('KeyH')) this.sound.horn();
    } else {
      const ix = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      const iy = (input.down('KeyS', 'ArrowDown') ? 1 : 0) - (input.down('KeyW', 'ArrowUp') ? 1 : 0);
      const run = input.down('ShiftLeft', 'ShiftRight');
      const len = Math.hypot(ix, iy) || 1;
      p.walk(ix / len, iy / len, run, dt, this.solids);
      if (input.pressed('KeyE')) {
        const parked = p.tryEnterCar([...this.traffic.cars, ...this.police.cars]);
        if (parked) {
          this.sound.click();
          p.enterCar(parked);
        } else {
          const jack = p.tryCarjack(this.traffic.cars);
          if (jack) {
            // Carjack: the driver bails, the car is yours, the law notices.
            const d = jack.driver;
            jack.driver = null;
            this.traffic.peds.push({ x: jack.x + 40, y: jack.y + 30, angle: 0, speed: 90, color: '#ef476f', target: null, flee: 3, walkPhase: 0 });
            p.enterCar(jack);
            this.police.addHeat(16, 'carjacking');
            this.missions.say('That is your car now. Drive.');
          }
        }
      }
      if (input.pressed('Space')) {
        this.combat.punch(p, this.traffic.peds, this.police.officers, this.police, this.sound);
      }
      if (input.mouse.clicked) {
        const w = input.worldMouse(this.cam, this.canvas);
        this.combat.shoot(p, w.x, w.y, this.traffic.peds, this.police.officers, this.police.cars, this.sound);
      }
    }

    if (input.pressed('KeyT') && this.missions.storyDone && !this.missions.sideWork) {
      this.missions.startFare(this);
    }
    if (input.pressed('KeyM')) {
      this.sound.enabled = !this.sound.enabled;
    }
    if (input.pressed('KeyR') && p.onFoot) {
      // Buy ammo at any corner store: $30 for 12 rounds.
      if (p.money >= 30 && p.ammo < 48) {
        p.money -= 30;
        p.ammo = Math.min(48, p.ammo + 12);
        this.sound.cash();
        this.missions.say('Ammo restocked (+12).');
      }
    }

    // Player velocity (px/s) for police interception.
    p.vx = (p.x - ox) / Math.max(dt, 0.001);
    p.vy = (p.y - oy) / Math.max(dt, 0.001);

    // --- world systems ---
    this.traffic.update(dt, this.solids, p, this.police.wanted);
    const busted = this.police.update(dt, p, this.solids, this.sound);
    this._collidePlayer(dt);
    const res = this.missions.update(dt, this);
    if (res === 'complete') this.missions.complete(this);
    else if (res === 'fail') this.missions.fail(this);
    this.missions.updateFare(this);

    if (busted) {
      this.sound.busted();
      this._showEnd('busted', 'BUSTED', 'The Solmar PD took you in. Cassie bailed you out — minus a fine.');
      return;
    }
    if (p.hp <= 0) {
      this._showEnd('wasted', 'WASTED', 'Solmar General patched you up. Half your cash went to the bill.');
      return;
    }

    // --- camera, skids, save ---
    const tx = p.x, ty = p.y;
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);
    this.cam.x = clamp(this.cam.x, 640, WORLD - 640);
    this.cam.y = clamp(this.cam.y, 360, WORLD - BEACH_H - 360 + 120);
    for (const s of this.skids) s.life -= dt * 0.25;
    this.skids = this.skids.filter((s) => s.life > 0);
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = SAVE_EVERY;
      writeSave(this);
    }
  }

  _collidePlayer(dt) {
    const p = this.player;
    // Player car vs traffic cars: bump, damage, slow down.
    if (!p.onFoot && p.car) {
      for (const c of this.traffic.cars) {
        if (c === p.car || c.driver === 'player') continue;
        const dx = c.x - p.car.x, dy = c.y - p.car.y;
        const d = Math.hypot(dx, dy);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const ux = dx / d, uy = dy / d;
          p.car.x -= ux * push; p.car.y -= uy * push;
          c.x += ux * push; c.y += uy * push;
          const impact = Math.abs(p.car.speed - c.speed);
          if (impact > 90) {
            this.sound.crash();
            p.car.hp = Math.max(0, p.car.hp - 5);
            c.hp = Math.max(0, c.hp - 5);
            p.car.speed *= 0.7;
            c.speed *= 0.7;
            this.police.addHeat(2, 'crash');
          }
        }
      }
      // Running over a pedestrian: they are knocked down, the law notices.
      for (const ped of this.traffic.peds) {
        const d = Math.hypot(ped.x - p.car.x, ped.y - p.car.y);
        if (d < 30 && Math.abs(p.car.speed) > 60) {
          ped.flee = 4;
          ped.x += (ped.x - p.car.x) * 1.5;
          ped.y += (ped.y - p.car.y) * 1.5;
          this.police.addHeat(10, 'hit pedestrian');
          this.sound.crash();
          p.car.speed *= 0.8;
        }
      }
      // Player car vs police car: a ram hurts both.
      for (const c of this.police.cars) {
        const d = Math.hypot(c.x - p.car.x, c.y - p.car.y);
        if (d < 46 && d > 0.01) {
          const ux = (c.x - p.car.x) / d, uy = (c.y - p.car.y) / d;
          p.car.x -= ux * 6; p.car.y -= uy * 6;
          c.x += ux * 6; c.y += uy * 6;
        }
      }
    }
    // On foot, walking into a traffic car hurts.
    if (p.onFoot) {
      for (const c of this.traffic.cars) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < 26 && Math.abs(c.speed) > 80) {
          p.hurt(12);
          p.x += (p.x - c.x) * 0.8;
          p.y += (p.y - c.y) * 0.8;
          this.sound.crash();
        }
      }
    }
  }

  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (this.state === 'playing' || this.state === 'end') this.update(dt);
    else this.time += dt; // menu backdrop keeps panning
    if (this.state !== 'menu') {
      drawWorld(this.ctx, this, { cam: this.cam, vw: this.canvas.width, vh: this.canvas.height });
      this.hud.update(this);
    } else {
      // Menu backdrop: a slow pan over the city.
      this.cam.x = WORLD * 0.5 + Math.sin(this.time * 0.05) * 500;
      this.cam.y = (WORLD - BEACH_H) * 0.5;
      drawWorld(this.ctx, this, { cam: this.cam, vw: this.canvas.width, vh: this.canvas.height });
    }
    this.input.endFrame();
  }

  run() {
    const loop = (now) => {
      this.time += 0; // time advances in update(); menu pan uses it too
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// Boot.
const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__solmar = game; // for debugging and for the screenshot scenes
game.run();
