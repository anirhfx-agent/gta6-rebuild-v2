// Combat: fists on foot, a pistol with limited ammo, and the damage the
// world deals back. Bullets are hitscan with a tracer effect; the game loop
// owns the tracers list.
export class Combat {
  constructor() {
    this.tracers = []; // {x1,y1,x2,y2,life}
    this.muzzle = 0;
  }

  punch(player, peds, officers, police, sound) {
    if (player.punchCd > 0 || !player.onFoot) return false;
    player.punchCd = 0.38;
    sound.punch();
    const range = 52;
    const fx = Math.cos(player.angle), fy = Math.sin(player.angle);
    let hit = false;
    const inArc = (x, y) => {
      const dx = x - player.x, dy = y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > range) return false;
      return (dx * fx + dy * fy) / (d || 1) > 0.25;
    };
    for (const p of peds) {
      if (inArc(p.x, p.y)) {
        p.flee = 3;
        p.x += fx * 26; p.y += fy * 26;
        hit = true;
        police.addHeat(6, 'assault');
      }
    }
    for (const o of officers) {
      if (inArc(o.x, o.y)) {
        o.x += fx * 30; o.y += fy * 30;
        hit = true;
        police.addHeat(10, 'assault officer');
      }
    }
    return hit;
  }

  shoot(player, wx, wy, peds, officers, policeCars, sound) {
    if (player.shootCd > 0 || !player.onFoot || player.ammo <= 0) return false;
    player.shootCd = 0.28;
    player.ammo -= 1;
    this.muzzle = 0.07;
    sound.gunshot();
    const ax = player.x, ay = player.y;
    const ang = Math.atan2(wy - ay, wx - ax);
    player.angle = ang;
    const range = 560;
    const tx = ax + Math.cos(ang) * range;
    const ty = ay + Math.sin(ang) * range;
    // Nearest thing the shot crosses.
    let best = null, bestT = 1;
    const test = (x, y, r, ref) => {
      const dx = x - ax, dy = y - ay;
      const t = (dx * Math.cos(ang) + dy * Math.sin(ang)) / range;
      if (t < 0 || t > 1 || t > bestT) return;
      const px = ax + Math.cos(ang) * t * range, py = ay + Math.sin(ang) * t * range;
      if (Math.hypot(x - px, y - py) < r + 6) { best = ref; bestT = t; }
    };
    for (const p of peds) test(p.x, p.y, 12, { kind: 'ped', ref: p });
    for (const o of officers) test(o.x, o.y, 13, { kind: 'officer', ref: o });
    for (const c of policeCars) test(c.x, c.y, 24, { kind: 'car', ref: c });
    const ex = ax + Math.cos(ang) * bestT * range;
    const ey = ay + Math.sin(ang) * bestT * range;
    this.tracers.push({ x1: ax, y1: ay, x2: ex, y2: ey, life: 0.09 });
    if (best) {
      if (best.kind === 'ped') { best.ref.flee = 4; best.ref.x += Math.cos(ang) * 20; best.ref.y += Math.sin(ang) * 20; police.addHeat(14, 'shooting'); }
      if (best.kind === 'officer') { best.ref.x += Math.cos(ang) * 24; best.ref.y += Math.sin(ang) * 24; police.addHeat(22, 'shooting officer'); }
      if (best.kind === 'car') { best.ref.hp = Math.max(0, best.ref.hp - 18); police.addHeat(12, 'shooting'); }
    }
    return true;
  }

  update(dt) {
    this.muzzle = Math.max(0, this.muzzle - dt);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
  }
}
