// Staged scenes for screenshots. A URL like ?scene=chase starts the game
// immediately in a set piece (a chase, a mission, a foot pursuit) so a
// screenshot shows the game at its most complete. The scenes only arrange
// entities the game already spawns; nothing here is a cheat in normal play.
import { roadCenter, WORLD, BEACH_H } from './city.js';
import { Car, CAR_COLORS } from './player.js';
import { pick } from './rng.js';

export const SCENES = ['drive', 'chase', 'foot', 'mission'];

export function applyScene(game, name) {
  const { player, traffic, police, missions, city } = game;
  game.state = 'playing';
  game.sceneMode = name;

  const putCarNear = (dx, dy, angle, color) => {
    const c = new Car(player.x + dx, player.y + dy, angle, color, { isTraffic: true, driver: 'npc' });
    c.speed = 160;
    traffic.cars.push(c);
    return c;
  };

  if (name === 'drive') {
    // Cruising Ocean Drive in a red coupe, traffic around, beach in view.
    // Starts well west so the cruise has open road ahead for the shot.
    const car = new Car(roadCenter(3), roadCenter(10), 0, '#e63946', { isPlayer: true });
    player.enterCar(car);
    game.cam.x = car.x; game.cam.y = car.y;
    putCarNear(-260, -40, 0, '#2a9d8f');
    putCarNear(320, 40, Math.PI, '#f4a261');
    putCarNear(140, -46, 0, '#4361ee');
    missions.start(missions.current);
  } else if (name === 'chase') {
    // Three-star chase: two PD units on the player's tail, sirens on.
    const car = new Car(roadCenter(5), roadCenter(5), 0, '#f4a261', { isPlayer: true });
    car.speed = 320;
    car.hp = 200; // a tough getaway car, so the chase lasts for the shot
    player.enterCar(car);
    police.wanted = 3;
    police.heat = 70;
    for (let i = 0; i < 3; i++) {
      const p = new Car(car.x - 160 - i * 90, car.y + (i % 2 === 0 ? 50 : -50), 0, '#1b2a4a', { isPolice: true, driver: 'police' });
      p.speed = 330;
      police.cars.push(p);
    }
    putCarNear(300, 42, 0, '#2a9d8f');
    putCarNear(-420, -42, Math.PI, '#7209b7');
    missions.say('Lose the PD — get out of sight and stay hidden until the stars clear.');
    game.cam.x = car.x; game.cam.y = car.y;
  } else if (name === 'foot') {
    // On foot at Marina Plaza, an officer closing in, two stars.
    player.x = roadCenter(2) + 30;
    player.y = roadCenter(2) + 40;
    player.onFoot = true;
    police.wanted = 2;
    police.heat = 40;
    // Officer and cruiser start far enough out that the chase is still
    // running (not already a bust) when the screenshot is taken.
    const p = new Car(player.x - 520, player.y - 180, 0, '#1b2a4a', { isPolice: true, driver: 'police' });
    police.cars.push(p);
    police.officers.push({ x: player.x - 560, y: player.y + 120, speed: 175, car: p });
    for (let i = 0; i < 4; i++) {
      const ped = traffic.peds[i];
      ped.x = player.x + (Math.random() - 0.5) * 300;
      ped.y = player.y + (Math.random() - 0.5) * 240;
      ped.flee = 2;
    }
    missions.say('On foot and wanted — break line of sight or find a car.');
    game.cam.x = player.x; game.cam.y = player.y;
  } else if (name === 'mission') {
    // Mid-mission: driving to the next checkpoint with the objective on screen.
    missions.start(missions.current);
    const car = new Car(roadCenter(4), roadCenter(4), Math.PI / 2, '#2a9d8f', { isPlayer: true });
    car.speed = 260;
    player.enterCar(car);
    putCarNear(-300, 44, Math.PI / 2, '#e63946');
    putCarNear(260, -44, -Math.PI / 2, '#ffb703');
    game.cam.x = car.x; game.cam.y = car.y;
  }

  // Make sure the camera starts exactly on the player for a clean shot.
  game.cam.x = player.x;
  game.cam.y = player.y;
}
