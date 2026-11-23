// Solmar city generation. A fixed-seed grid city: blocks of buildings, parks
// and parking lots joined by roads, a beach and water along the south edge,
// palm-lined Ocean Drive. Everything is derived from CITY_SEED, so the map
// is identical on every load and every machine.
import { mulberry32, pick, range, rangeInt } from './rng.js';

export const CITY_SEED = 20261124;
export const BLOCK = 240; // building block side, px
export const ROAD = 84;   // road width, px
export const GRID = 11;   // blocks per side
export const PITCH = BLOCK + ROAD;
// World size, including the outer road ring.
export const WORLD = GRID * PITCH + ROAD;
// Beach strip height at the south edge (inside the world).
export const BEACH_H = 150;

const PALETTES = [
  ['#f2b879', '#e8a35c', '#d98a4b'], // terracotta
  ['#8ecae6', '#6fb3d8', '#4f9ec7'], // ocean blue
  ['#f7ede2', '#ead9c2', '#dcc3a1'], // sand white
  ['#ffafcc', '#f48fb1', '#e87ea1'], // pastel pink
  ['#b7e4c7', '#95d5b2', '#74c69d'], // mint
  ['#ffd166', '#f4b942', '#e5a92e'], // marigold
];

export function roadCenter(i) {
  // Centre of the i-th road (i = 0..GRID). Roads sit between blocks.
  return ROAD / 2 + i * PITCH;
}

export function isRoad(x, y) {
  // True when the point is on a road (not inside a block or the beach).
  if (y > WORLD - BEACH_H) return false; // beach, not a road
  const mx = ((x % PITCH) + PITCH) % PITCH;
  const my = ((y % PITCH) + PITCH) % PITCH;
  return mx < ROAD || my < ROAD || x < ROAD || y < ROAD || x > WORLD - ROAD || y > WORLD - ROAD;
}

export function nearestRoadPoint(x, y) {
  // Snap a point to the centre of the nearest road.
  const ix = Math.round((x - ROAD / 2) / PITCH);
  const iy = Math.round((y - ROAD / 2) / PITCH);
  const cx = roadCenter(Math.max(0, Math.min(GRID, ix)));
  const cy = roadCenter(Math.max(0, Math.min(GRID, iy)));
  // Pick the closer axis: keep the point on a road, not in a block.
  if (Math.abs(x - cx) < Math.abs(y - cy)) return { x: cx, y, horizontal: true };
  return { x, y: cy, horizontal: false };
}

export function buildCity() {
  const rng = mulberry32(CITY_SEED);
  const buildings = [];
  const parks = [];
  const lots = [];
  const palms = [];
  const landmarks = [];

  for (let by = 0; by < GRID; by++) {
    for (let bx = 0; bx < GRID; bx++) {
      const x0 = ROAD + bx * PITCH;
      const y0 = ROAD + by * PITCH;
      // The southernmost row is the beachfront: hotels + palms, no park.
      const beachfront = by === GRID - 1;
      const roll = rng();
      if (!beachfront && roll < 0.14) {
        // Park block: green with a few trees and a pond.
        const trees = [];
        for (let i = 0; i < 7; i++) {
          trees.push({ x: x0 + range(rng, 30, BLOCK - 30), y: y0 + range(rng, 30, BLOCK - 30) });
        }
        parks.push({ x: x0, y: y0, w: BLOCK, h: BLOCK, trees });
        continue;
      }
      if (!beachfront && roll < 0.22) {
        // Parking lot: open asphalt with painted bays.
        lots.push({ x: x0, y: y0, w: BLOCK, h: BLOCK, bays: rangeInt(rng, 6, 10) });
        continue;
      }
      // Building block: 1-4 buildings with a courtyard gap.
      const palette = pick(rng, PALETTES);
      const n = beachfront ? 2 : rangeInt(rng, 1, 3);
      const taken = [];
      for (let i = 0; i < n; i++) {
        const w = range(rng, 70, 130);
        const h = range(rng, 70, 130);
        const x = x0 + range(rng, 8, BLOCK - w - 8);
        const y = y0 + range(rng, 8, BLOCK - h - 8);
        // Avoid heavy overlap with siblings in the same block.
        if (taken.some((t) => x < t.x + t.w + 14 && x + w + 14 > t.x && y < t.y + t.h + 14 && y + h + 14 > t.y)) continue;
        taken.push({ x, y, w, h });
        buildings.push({
          x, y, w, h,
          color: pick(rng, palette),
          roof: rng() < 0.5 ? '#5b4a68' : '#3d5a80',
          height: rangeInt(rng, 1, 3),
          windows: rangeInt(rng, 6, 18),
        });
      }
      if (beachfront) {
        for (let i = 0; i < 5; i++) {
          palms.push({ x: x0 + 20 + i * 46 + range(rng, -8, 8), y: WORLD - BEACH_H + 26 });
        }
      }
    }
  }

  // Landmarks: named places the missions and the HUD can point at.
  landmarks.push({ name: 'Solmar Pier', x: WORLD * 0.5, y: WORLD - BEACH_H + 70, kind: 'pier' });
  landmarks.push({ name: 'Ocean Drive', x: WORLD * 0.5, y: roadCenter(GRID - 1), kind: 'road' });
  landmarks.push({ name: 'Marina Plaza', x: roadCenter(2), y: roadCenter(2), kind: 'plaza' });
  landmarks.push({ name: 'Calle Verde Park', x: roadCenter(5) + PITCH / 2, y: roadCenter(5) + PITCH / 2, kind: 'park' });
  landmarks.push({ name: 'Solmar Airport', x: roadCenter(9), y: roadCenter(1), kind: 'airport' });

  // Car spawn points: on roads, spread across the map.
  const carSpawns = [];
  for (let i = 0; i < 26; i++) {
    const horizontal = rng() < 0.5;
    const lane = rangeInt(rng, 0, GRID);
    if (horizontal) {
      carSpawns.push({ x: range(rng, ROAD, WORLD - ROAD), y: roadCenter(lane), angle: rng() < 0.5 ? 0 : Math.PI });
    } else {
      carSpawns.push({ x: roadCenter(lane), y: range(rng, ROAD, WORLD - ROAD - BEACH_H), angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 });
    }
  }

  // Pedestrian spawn points: on sidewalks next to roads.
  const pedSpawns = [];
  for (let i = 0; i < 40; i++) {
    pedSpawns.push({
      x: range(rng, ROAD, WORLD - ROAD),
      y: range(rng, ROAD, WORLD - ROAD - BEACH_H),
    });
  }

  return { buildings, parks, lots, palms, landmarks, carSpawns, pedSpawns, seed: CITY_SEED };
}

// Player start: outside the fixer Cassie's garage, mid-city.
export const PLAYER_START = { x: roadCenter(5), y: roadCenter(5) + 60, angle: -Math.PI / 2 };
