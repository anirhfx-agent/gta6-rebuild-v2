// Canvas rendering: the sun-soaked city, the cars and people in it, and the
// effects (skid, muzzle, tracers, damage). Top-down, warm palette, soft
// shadows. The minimap is drawn by hud.js; this file draws the world.
import { WORLD, BEACH_H, ROAD, PITCH, GRID, roadCenter } from './city.js';

const SKY_TINT = 'rgba(255, 214, 130, 0.10)';

export function drawWorld(ctx, game, view) {
  const { city, player, traffic, police, missions, combat } = game;
  const { cam, vw, vh } = view;
  ctx.save();
  ctx.clearRect(0, 0, vw, vh);
  // Warm sunlight over everything.
  ctx.fillStyle = '#f7e8c8';
  ctx.fillRect(0, 0, vw, vh);

  const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
  ctx.translate(-x0, -y0);

  drawGround(ctx, city);
  drawBeach(ctx);
  drawRoads(ctx);
  drawBuildings(ctx, city);
  drawParks(ctx, city);
  drawPickups(ctx, game);
  drawMissionMarker(ctx, game);
  drawPeds(ctx, traffic.peds);
  drawCars(ctx, [...traffic.cars, ...police.cars]);
  // The player's own car is not in traffic/police, so draw it explicitly.
  if (!player.onFoot && player.car) drawCarShape(ctx, player.car);
  drawOfficers(ctx, police.officers);
  drawPlayer(ctx, player, combat);
  drawTracers(ctx, combat);
  drawSkids(ctx, game);

  ctx.restore();
  // Sun tint + vignette for the postcard look.
  ctx.fillStyle = SKY_TINT;
  ctx.fillRect(0, 0, vw, vh);
}

function drawGround(ctx, city) {
  // Sidewalk / block base.
  ctx.fillStyle = '#d9c9a8';
  ctx.fillRect(0, 0, WORLD, WORLD - BEACH_H);
  ctx.fillStyle = '#e8dcc0';
  for (let by = 0; by < GRID; by++) {
    for (let bx = 0; bx < GRID; bx++) {
      ctx.fillRect(ROAD + bx * PITCH + 4, ROAD + by * PITCH + 4, 240 - 8, 240 - 8);
    }
  }
}

function drawBeach(ctx) {
  const y = WORLD - BEACH_H;
  ctx.fillStyle = '#f2d8a0';
  ctx.fillRect(0, y, WORLD, BEACH_H - 44);
  ctx.fillStyle = '#3fa7c9';
  ctx.fillRect(0, y + BEACH_H - 44, WORLD, 44);
  ctx.fillStyle = '#7fd0e8';
  ctx.fillRect(0, y + BEACH_H - 44, WORLD, 6);
  // Pier.
  ctx.fillStyle = '#8b5e3c';
  ctx.fillRect(WORLD * 0.5 - 14, y + 6, 28, BEACH_H - 40);
  ctx.fillStyle = '#a9744f';
  ctx.fillRect(WORLD * 0.5 - 22, y + 6, 44, 10);
}

function drawRoads(ctx) {
  ctx.fillStyle = '#3a3f4a';
  for (let i = 0; i <= GRID; i++) {
    const c = roadCenter(i);
    ctx.fillRect(0, c - ROAD / 2, WORLD, ROAD);
    ctx.fillRect(c - ROAD / 2, 0, ROAD, WORLD - BEACH_H);
  }
  // Centre dashes.
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (let i = 0; i <= GRID; i++) {
    const c = roadCenter(i);
    ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(WORLD, c); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, WORLD - BEACH_H); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const cx = roadCenter(i), cy = roadCenter(j);
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(cx + k * 14 - 5, cy - ROAD / 2 + 6, 10, 12);
        ctx.fillRect(cx + k * 14 - 5, cy + ROAD / 2 - 18, 10, 12);
      }
    }
  }
}

function drawBuildings(ctx, city) {
  for (const b of city.buildings) {
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Rooftop detail: AC box / skylight.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(b.x + b.w * 0.25, b.y + b.h * 0.3, b.w * 0.2, b.h * 0.16);
    // Windows along the edges.
    ctx.fillStyle = 'rgba(20,40,70,0.55)';
    const n = Math.min(b.windows, 14);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      ctx.fillRect(b.x + 6 + t * (b.w - 14), b.y + b.h - 12, 5, 6);
    }
  }
}

function drawParks(ctx, city) {
  for (const p of city.parks) {
    ctx.fillStyle = '#7ec850';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#6ab84a';
    ctx.beginPath();
    ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w * 0.32, p.h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const t of p.trees) {
      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath(); ctx.arc(t.x, t.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#40916c';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const l of city.lots) {
    ctx.fillStyle = '#4a4f59';
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < l.bays; i++) {
      const bx = l.x + 16 + (i % 5) * 42;
      const by = l.y + 16 + Math.floor(i / 5) * 70;
      ctx.strokeRect(bx, by, 34, 52);
    }
  }
  for (const p of city.palms) {
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y + 8); ctx.lineTo(p.x, p.y - 10); ctx.stroke();
    ctx.fillStyle = '#2d9d5f';
    ctx.beginPath(); ctx.arc(p.x, p.y - 14, 11, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPickups(ctx, game) {
  const a = game.missions.active;
  if (a?.pickups) {
    for (const p of a.pickups) {
      if (p.taken) continue;
      const bob = Math.sin(game.time * 4 + p.x) * 3;
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a7d2c';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + bob + 5);
    }
  }
  if (a?.hasGoods === false && game.missions.current?.kind === 'fetch-deliver') {
    const t = game.missions.current.pickup();
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath(); ctx.arc(t.x, t.y + Math.sin(game.time * 4) * 3, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', t.x, t.y + 5);
  }
}

function drawMissionMarker(ctx, game) {
  const target = game.missionTarget?.();
  if (!target) return;
  const pulse = 1 + Math.sin(game.time * 5) * 0.15;
  ctx.save();
  ctx.translate(target.x, target.y - 34);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd60a';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-13, -26); ctx.lineTo(13, -26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(0, -26, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Ground ring.
  ctx.strokeStyle = 'rgba(255,214,10,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(target.x, target.y, 34 * pulse, 16 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
}

function drawPeds(ctx, peds) {
  for (const p of peds) {
    const bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3 + bob * 0.3, 5, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCarShape(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-c.len / 2 + 3, -c.wid / 2 + 4, c.len, c.wid);
  ctx.fillStyle = c.color;
  roundRect(ctx, -c.len / 2, -c.wid / 2, c.len, c.wid, 7);
  ctx.fill();
  // Windows + roof.
  ctx.fillStyle = 'rgba(20,40,70,0.75)';
  roundRect(ctx, -6, -c.wid / 2 + 3, 16, c.wid - 6, 4);
  ctx.fill();
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(c.len / 2 - 2, -c.wid / 2 + 3, 3, 5);
  ctx.fillRect(c.len / 2 - 2, c.wid / 2 - 8, 3, 5);
  // Police light bar.
  if (c.isPolice) {
    const on = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -c.wid / 2 + 2, 8, 6);
    ctx.fillStyle = on ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-4, c.wid / 2 - 8, 8, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  ctx.restore();
}

function drawCars(ctx, cars) {
  for (const c of cars) drawCarShape(ctx, c);
}

function drawOfficers(ctx, officers) {
  for (const o of officers) {
    ctx.fillStyle = '#1b2a4a';
    ctx.beginPath(); ctx.arc(o.x, o.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', o.x, o.y + 3);
  }
}

function drawPlayer(ctx, player, combat) {
  if (!player.onFoot) return;
  const bob = player.moving ? Math.sin(performance.now() / 90) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(player.x, player.y + 10, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  // Body: teal jacket, the protagonist's signature look.
  ctx.fillStyle = '#0f766e';
  ctx.beginPath(); ctx.arc(player.x, player.y + bob * 0.3, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(player.x + Math.cos(player.angle) * 4, player.y + Math.sin(player.angle) * 4 + bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
  // Direction tick.
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.angle) * 10, player.y + Math.sin(player.angle) * 10);
  ctx.lineTo(player.x + Math.cos(player.angle) * 20, player.y + Math.sin(player.angle) * 20);
  ctx.stroke();
  // Muzzle flash.
  if (combat.muzzle > 0) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    ctx.arc(player.x + Math.cos(player.angle) * 26, player.y + Math.sin(player.angle) * 26, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player ring so the eye finds Leo instantly.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(player.x, player.y, 17, 0, Math.PI * 2); ctx.stroke();
}

function drawTracers(ctx, combat) {
  for (const t of combat.tracers) {
    ctx.strokeStyle = `rgba(255,230,109,${Math.max(0, t.life / 0.09)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
}

function drawSkids(ctx, game) {
  // Fading skid marks left by hard driving.
  for (const s of game.skids) {
    ctx.strokeStyle = `rgba(20,20,20,${s.life * 0.5})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
