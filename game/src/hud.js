// HUD: the DOM readouts (health, cash, wanted stars, mission, speed, clock)
// and the canvas minimap. The minimap draws the whole city small, with the
// player, police, mission target and traffic as dots.
import { WORLD, BEACH_H } from './city.js';
import { WANTED_NAMES } from './police.js';

export class Hud {
  constructor(doc) {
    this.el = {
      health: doc.getElementById('hud-health'),
      healthBar: doc.getElementById('hud-health-bar'),
      cash: doc.getElementById('hud-cash'),
      stars: doc.getElementById('hud-stars'),
      wantedLabel: doc.getElementById('hud-wanted'),
      mission: doc.getElementById('hud-mission'),
      missionText: doc.getElementById('hud-mission-text'),
      speed: doc.getElementById('hud-speed'),
      clock: doc.getElementById('hud-clock'),
      toast: doc.getElementById('hud-toast'),
      ammo: doc.getElementById('hud-ammo'),
    };
    this.map = doc.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
  }

  update(game) {
    const { player, police, missions } = game;
    const hp = Math.max(0, Math.round(player.hp));
    this.el.health.textContent = hp;
    this.el.healthBar.style.width = `${hp}%`;
    this.el.healthBar.style.background = hp > 50 ? '#22c55e' : hp > 25 ? '#f59e0b' : '#ef4444';
    this.el.cash.textContent = `$${player.money.toLocaleString('en-US')}`;
    const stars = '★'.repeat(police.wanted) + '☆'.repeat(5 - police.wanted);
    this.el.stars.textContent = stars;
    this.el.stars.style.color = police.wanted > 0 ? '#facc15' : 'rgba(255,255,255,0.55)';
    this.el.wantedLabel.textContent = police.wanted > 0 ? WANTED_NAMES[police.wanted] : '';
    const m = missions.current;
    if (m) {
      this.el.mission.textContent = `JOB: ${m.title}`;
      const a = missions.active;
      let extra = '';
      if (a?.timeLeft !== null && a?.timeLeft !== undefined) extra = ` — ${Math.ceil(a.timeLeft)}s left`;
      if (m.kind === 'checkpoints' && a) extra = ` — ${a.step}/${m.targets().length} drops`;
      if (m.kind === 'collect' && a) extra = ` — ${a.collected}/${m.count}`;
      this.el.missionText.textContent = m.objective + extra;
    } else if (missions.storyDone) {
      this.el.mission.textContent = 'FREE ROAM';
      this.el.missionText.textContent = missions.sideWork
        ? `Fare to ${missions.sideWork.dest.name} (+$${missions.sideWork.paid})`
        : 'Press T for a fare run, or just enjoy Solmar.';
    } else {
      this.el.mission.textContent = '';
      this.el.missionText.textContent = '';
    }
    const kmh = player.car ? Math.round(Math.abs(player.car.speed) * 0.32) : 0;
    this.el.speed.textContent = player.car ? `${kmh} km/h` : '';
    const mins = Math.floor(game.clock / 60) % 24;
    const hh = String(mins).padStart(2, '0');
    const mm = String(Math.floor(game.clock % 60)).padStart(2, '0');
    this.el.clock.textContent = `${hh}:${mm}`;
    this.el.ammo.textContent = player.onFoot ? `Ammo ${player.ammo}` : '';
    if (missions.messageT > 0) {
      this.el.toast.textContent = missions.message;
      this.el.toast.style.opacity = '1';
    } else {
      this.el.toast.style.opacity = '0';
    }
    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const S = this.map.width;
    const scale = S / WORLD;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(0, 0, S, S);
    // Water + beach.
    ctx.fillStyle = '#2e7ea6';
    ctx.fillRect(0, (WORLD - BEACH_H) * scale, S, BEACH_H * scale);
    ctx.fillStyle = '#e8c87a';
    ctx.fillRect(0, (WORLD - BEACH_H) * scale, S, 6);
    // Roads.
    ctx.fillStyle = '#565b66';
    const { city } = game;
    for (let i = 0; i <= 10; i++) {
      const c = (42 + i * 324) * scale;
      ctx.fillRect(0, c - 3, S, 6);
      ctx.fillRect(c - 3, 0, 6, S);
    }
    // Buildings.
    ctx.fillStyle = '#3a3f4a';
    for (const b of city.buildings) {
      ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    }
    // Mission target.
    const target = game.missionTarget?.();
    if (target) {
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.arc(target.x * scale, target.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#3b82f6';
    for (const c of game.police.cars) {
      ctx.beginPath(); ctx.arc(c.x * scale, c.y * scale, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player.
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(game.player.x * scale, game.player.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(game.player.x * scale, game.player.y * scale, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    // Viewport box.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(
      (game.cam.x - 640) * scale, (game.cam.y - 360) * scale,
      1280 * scale, 720 * scale,
    );
  }
}
