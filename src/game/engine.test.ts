import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from './engine';
import { contains, inflate } from './collision';
import { BAIT_HEIGHT, BAIT_WIDTH, HEIGHT, MONSTER_RADIUS, WIDTH } from './levels';
import type { LevelId, MonsterState } from './types';

const advance = (engine: GameEngine, seconds: number) => {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) engine.step(1 / 60);
};

test('autonomous state machine searches, chases, eats and removes a functioning button', () => {
  const engine = new GameEngine(1);
  const states = new Set<MonsterState>();
  for (let frame = 0; frame < 60 * 24; frame++) {
    states.add(engine.getSnapshot().monster.state);
    engine.step(1 / 60);
  }
  for (const state of ['IDLE', 'SEARCH', 'CHASE', 'EAT'] as const) assert.ok(states.has(state), state);
  const snapshot = engine.getSnapshot();
  assert.ok(snapshot.eaten > 0);
  const eaten = snapshot.objects.find((object) => object.eaten)!;
  engine.attract(eaten.id);
  assert.notEqual(engine.getSnapshot().targetId, eaten.id, 'an eaten button cannot attract the monster');
});

test('pause freezes time and input; old published frames remain unchanged', () => {
  const engine = new GameEngine(2);
  const before = engine.getSnapshot();
  advance(engine, 2);
  assert.equal(before.time, 0);
  assert.equal(before.monster.state, 'IDLE');
  engine.togglePause();
  const paused = engine.getSnapshot();
  advance(engine, 10);
  engine.moveBait(40, 40);
  engine.moveWindow('console', 20, 40);
  engine.closeTrap();
  assert.deepEqual(engine.getSnapshot(), paused);
  engine.togglePause();
  advance(engine, 1);
  assert.ok(engine.getSnapshot().time > paused.time);
});

test('coordinates are clamped and invalid input does not poison the simulation', () => {
  const engine = new GameEngine(2);
  engine.moveBait(-1000, 10000);
  assert.equal(engine.getSnapshot().bait.x, 12);
  assert.equal(engine.getSnapshot().bait.y, HEIGHT - BAIT_HEIGHT - 12);
  engine.moveBait(10000, -1000);
  assert.equal(engine.getSnapshot().bait.x, WIDTH - BAIT_WIDTH - 12);
  assert.equal(engine.getSnapshot().bait.y, 34);
  const before = engine.getSnapshot();
  engine.moveBait(NaN, Infinity);
  engine.step(NaN);
  assert.deepEqual(engine.getSnapshot(), before);
  engine.step(1000);
  assert.equal(engine.getSnapshot().time, 0.05, 'large frame gaps are capped');
});

test('moving a console carries all its buttons; moving a shield ejects the monster safely', () => {
  const engine = new GameEngine(2);
  const before = engine.getSnapshot();
  engine.moveWindow('console', 110, 60);
  const moved = engine.getSnapshot();
  assert.equal(moved.objects[0]!.x, before.objects[0]!.x - 280);
  assert.equal(moved.objects[0]!.y, before.objects[0]!.y - 28);
  engine.moveWindow('shield-a', moved.monster.x - 60, moved.monster.y - 60);
  const after = engine.getSnapshot();
  const shield = after.windows.find((window) => window.kind === 'shield')!;
  assert.equal(contains(inflate(shield, MONSTER_RADIUS), after.monster), false);
});

test('continuous bait dragging keeps the monster moving instead of resetting chase each frame', () => {
  const engine = new GameEngine(1);
  const before = engine.getSnapshot().monster.x;
  for (let frame = 0; frame < 120; frame++) {
    engine.moveBait(720 + frame * 0.1, 430);
    engine.step(1 / 60);
  }
  assert.ok(engine.getSnapshot().monster.x > before + 100);
  assert.equal(engine.getSnapshot().monster.state, 'CHASE');
});

for (const level of [1, 2, 3] as LevelId[]) {
  test(`level ${level} is winnable through actual lure movement and capture`, () => {
    const engine = new GameEngine(level);
    const { trap } = engine.getSnapshot();
    engine.moveBait(trap.x + trap.w / 2 - BAIT_WIDTH / 2, trap.y + trap.h / 2 - BAIT_HEIGHT / 2);
    let reachedTrap = false;
    for (let frame = 0; frame < 60 * 20; frame++) {
      engine.step(1 / 60);
      const snapshot = engine.getSnapshot();
      for (const shield of snapshot.windows.filter((window) => window.kind === 'shield')) {
        assert.equal(contains(inflate(shield, MONSTER_RADIUS - 1), snapshot.monster), false, 'monster must route around windows');
      }
      if (snapshot.trap.occupied) { reachedTrap = true; engine.closeTrap(); break; }
    }
    assert.ok(reachedTrap, 'the monster must actually walk into the trap');
    assert.equal(engine.getSnapshot().status, 'won');
    assert.equal(engine.getSnapshot().monster.state, 'CAPTURED');
    assert.equal(engine.getSnapshot().trap.closed, true);
  });
}

test('mouse avoidance appears in level 3; bait inside trap still makes it capturable', () => {
  const engine = new GameEngine(3);
  const initial = engine.getSnapshot().monster;
  engine.setPointer({ x: initial.x + 10, y: initial.y });
  advance(engine, 3.7);
  assert.equal(engine.getSnapshot().monster.state, 'ESCAPE');
  const { trap } = engine.getSnapshot();
  engine.moveBait(trap.x + 45, trap.y + 50);
  advance(engine, 0.1);
  assert.equal(engine.getSnapshot().monster.state, 'CHASE');
});

test('premature capture costs the final level one attempt, has a cooldown, and can be restarted', () => {
  const engine = new GameEngine(3);
  engine.closeTrap();
  assert.equal(engine.getSnapshot().attempts, 2);
  engine.closeTrap();
  assert.equal(engine.getSnapshot().attempts, 2, 'double clicks do not spend extra attempts');
  advance(engine, 1.3);
  engine.closeTrap();
  advance(engine, 1.3);
  engine.closeTrap();
  assert.equal(engine.getSnapshot().status, 'lost');
  assert.equal(engine.getSnapshot().attempts, 0);
  engine.restart();
  assert.equal(engine.getSnapshot().attempts, 3);
  assert.equal(engine.getSnapshot().status, 'playing');
  engine.setLevel(1);
  for (let count = 0; count < 4; count++) { engine.closeTrap(); advance(engine, 1.3); }
  assert.equal(engine.getSnapshot().status, 'playing', 'tutorial capture attempts are unlimited');
});

test('eating the critical power button causes a recoverable loss', () => {
  const engine = new GameEngine(2);
  engine.attract('power');
  advance(engine, 12);
  assert.equal(engine.getSnapshot().status, 'lost');
  assert.equal(engine.getSnapshot().objects.find((object) => object.id === 'power')!.eaten, true);
  engine.restart();
  assert.equal(engine.getSnapshot().status, 'playing');
  assert.equal(engine.getSnapshot().objects.some((object) => object.eaten), false);
});
