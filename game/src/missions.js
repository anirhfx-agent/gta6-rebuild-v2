// Missions and the story. Leo Marín owes the fixer Cassie Vane, and she pays
// in jobs. Five story missions in order, each with a briefing, a waypoint
// and a payout; finishing the chain opens free-roam "side work" (fare runs).
// Mission progress is part of the save file.
import { roadCenter, WORLD, BEACH_H } from './city.js';

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'First Wheels',
    giver: 'Cassie Vane',
    briefing: 'You need wheels before anything else, Leo. Grab any car on the street — parked or otherwise — and bring it to my garage.',
    objective: 'Steal a car and drive it to the garage marker',
    reward: 250,
    kind: 'deliver-car',
    target: () => ({ x: roadCenter(5), y: roadCenter(5) + 60 }),
  },
  {
    id: 'courier',
    title: 'Courier Run',
    giver: 'Cassie Vane',
    briefing: 'Three drops, no questions, no stops. Marina Plaza, Calle Verde, then the airport. The clock is running — 150 seconds.',
    objective: 'Deliver the package to all 3 checkpoints before time runs out',
    reward: 400,
    kind: 'checkpoints',
    timeLimit: 150,
    targets: () => [
      { x: roadCenter(2), y: roadCenter(2), name: 'Marina Plaza' },
      { x: roadCenter(5) + 240, y: roadCenter(5) + 240, name: 'Calle Verde' },
      { x: roadCenter(9), y: roadCenter(1), name: 'Solmar Airport' },
    ],
  },
  {
    id: 'heat',
    title: 'Hot Wheels',
    giver: 'Cassie Vane',
    briefing: 'The PD is sniffing around my garage. Get their attention — two stars — then shake them. Lose the heat and come back clean.',
    objective: 'Reach 2 wanted stars, then lose the police completely',
    reward: 500,
    kind: 'lose-heat',
    needStars: 2,
  },
  {
    id: 'collection',
    title: 'The Collection',
    giver: 'Cassie Vane',
    briefing: 'Four of my runners left cash stashed around Solmar. Pick up all four drops. Watch the streets — the money is not the only thing out there.',
    objective: 'Collect all 4 cash drops',
    reward: 650,
    kind: 'collect',
    count: 4,
  },
  {
    id: 'score',
    title: 'The Big Score',
    giver: 'Cassie Vane',
    briefing: 'One last job and your debt is clear. Grab the goods at Solmar Pier, then bring them to the garage. The PD will be all over you — drive like it matters.',
    objective: 'Grab the goods at the pier, then deliver them to the garage',
    reward: 1500,
    kind: 'fetch-deliver',
    pickup: () => ({ x: WORLD * 0.5, y: WORLD - BEACH_H + 70 }),
    target: () => ({ x: roadCenter(5), y: roadCenter(5) + 60 }),
  },
];

export class MissionManager {
  constructor() {
    this.index = 0; // next mission to play
    this.active = null; // runtime state of the current mission
    this.done = [];
    this.message = '';
    this.messageT = 0;
    this.sideWork = null; // repeatable fare runs after the story
  }

  get current() {
    return MISSIONS[this.index] ?? null;
  }

  get storyDone() {
    return this.index >= MISSIONS.length;
  }

  start(mission) {
    this.active = {
      id: mission.id,
      step: 0, // checkpoint index / phase
      timeLeft: mission.timeLimit ?? null,
      hasGoods: false,
      collected: 0,
      reachedStars: false,
      pickups: null,
    };
    if (mission.kind === 'collect') {
      // Deterministic-ish stash spots, spread across the map.
      const spots = [
        { x: roadCenter(1), y: roadCenter(8) },
        { x: roadCenter(8), y: roadCenter(3) },
        { x: roadCenter(3), y: roadCenter(9) },
        { x: roadCenter(9), y: roadCenter(7) },
      ];
      this.active.pickups = spots.map((s) => ({ ...s, taken: false }));
    }
    this.say(`${mission.giver}: ${mission.briefing}`);
  }

  say(text, dur = 6) {
    this.message = text;
    this.messageT = dur;
  }

  tick(dt) {
    if (this.messageT > 0) this.messageT -= dt;
  }

  // Returns 'complete' | 'fail' | null. The game loop passes the world in.
  update(dt, world) {
    const m = this.current;
    if (!m || !this.active) return null;
    const a = this.active;
    if (a.timeLeft !== null) {
      a.timeLeft -= dt;
      if (a.timeLeft <= 0) return 'fail';
    }
    const near = (t, r = 70) => Math.hypot(world.player.x - t.x, world.player.y - t.y) < r;
    switch (m.kind) {
      case 'deliver-car': {
        if (!world.player.onFoot && near(m.target())) return 'complete';
        break;
      }
      case 'checkpoints': {
        const targets = m.targets();
        if (a.step < targets.length && near(targets[a.step], 80)) {
          a.step += 1;
          if (a.step < targets.length) this.say(`Drop ${a.step} of ${targets.length} done. Next: ${targets[a.step].name}.`);
          else return 'complete';
        }
        break;
      }
      case 'lose-heat': {
        if (world.police.wanted >= m.needStars) a.reachedStars = true;
        if (a.reachedStars && world.police.wanted === 0) return 'complete';
        break;
      }
      case 'collect': {
        for (const p of a.pickups) {
          if (!p.taken && near(p, 60)) {
            p.taken = true;
            a.collected += 1;
            world.player.money += 60;
            world.sound.cash();
            this.say(`Cash drop ${a.collected} of ${m.count} collected (+$60).`);
          }
        }
        if (a.collected >= m.count) return 'complete';
        break;
      }
      case 'fetch-deliver': {
        if (!a.hasGoods && near(m.pickup(), 70)) {
          a.hasGoods = true;
          world.police.addHeat(40, 'heist');
          this.say('Goods grabbed! The PD is on you — get to the garage!');
        } else if (a.hasGoods && near(m.target(), 80)) {
          return 'complete';
        }
        break;
      }
      default: break;
    }
    return null;
  }

  complete(world) {
    const m = this.current;
    world.player.money += m.reward;
    this.done.push(m.id);
    this.index += 1;
    this.active = null;
    world.sound.mission();
    if (this.storyDone) {
      this.say(`Cassie Vane: Debt clear, Leo. Solmar is yours now — take fare runs whenever you want the cash.`);
    } else {
      this.say(`${m.title} complete! +$${m.reward}. Next job: ${this.current.title}.`);
    }
  }

  fail(world) {
    this.active = null;
    this.say(`${this.current.title} failed. Talk to Cassie to try again — the job is still open.`);
  }

  // Repeatable side work after the story: drive a fare to a random landmark.
  startFare(world) {
    const spots = world.city.landmarks.filter((l) => l.kind !== 'pier');
    const dest = spots[Math.floor(Math.random() * spots.length)];
    this.sideWork = { dest, paid: 120 + Math.floor(Math.random() * 130) };
    this.say(`Fare: take the passenger to ${dest.name} (+$${this.sideWork.paid}).`);
  }

  updateFare(world) {
    if (!this.sideWork) return;
    if (Math.hypot(world.player.x - this.sideWork.dest.x, world.player.y - this.sideWork.dest.y) < 80) {
      world.player.money += this.sideWork.paid;
      world.sound.cash();
      this.say(`Fare complete! +$${this.sideWork.paid}.`);
      this.sideWork = null;
    }
  }
}
