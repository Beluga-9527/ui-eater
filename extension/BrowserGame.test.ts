import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { BrowserGame } from './BrowserGame';
import type { BrowserSnapshot } from './BrowserGame';

function setBox(element: HTMLElement, x: number, y = 620, width = 80, height = 40) {
  element.getBoundingClientRect = () => ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) });
}

function fixture(markup = '<button id="one">First button</button>', random = () => 0) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}<div id="ui-eater"><button>Stop</button></div></body></html>`, {
    url: 'https://example.test/article', pretendToBeVisual: true,
  });
  const document = dom.window.document;
  const host = document.getElementById('ui-eater')!;
  for (const [index, element] of [...document.querySelectorAll<HTMLElement>('button,p,img')].entries()) setBox(element, 120 + index * 90);
  const updates: BrowserSnapshot[] = [];
  const game = new BrowserGame(document, host, (snapshot) => updates.push(snapshot), { autoFrame: false, random });
  const get = (id: string) => document.getElementById(id)!;
  return { dom, document, host, game, updates, get };
}

function advance(game: BrowserGame, seconds: number) {
  for (let frame = 0; frame < Math.ceil(seconds / 0.05); frame++) game.step(0.05);
}

function until(game: BrowserGame, predicate: (snapshot: BrowserSnapshot) => boolean, seconds = 10) {
  for (let frame = 0; frame < Math.ceil(seconds / 0.05); frame++) {
    if (predicate(game.getSnapshot())) return;
    game.step(0.05);
  }
  assert.ok(predicate(game.getSnapshot()), 'expected game condition was not reached');
}

test('construction, STATUS and arbitrary steps never start eating without manual START', () => {
  const { game, get, updates } = fixture();
  const original = get('one').outerHTML;
  const initial = game.getSnapshot();
  for (let count = 0; count < 10; count++) { game.dispatch('STATUS'); advance(game, 30); }
  assert.deepEqual(game.getSnapshot(), initial);
  assert.equal(game.getSnapshot().status, 'idle');
  assert.equal(game.getSnapshot().eaten, 0);
  assert.equal(get('one').outerHTML, original);
  assert.equal(updates.length, 0);
  game.dispatch('PAUSE');
  game.dispatch('RESUME');
  advance(game, 5);
  assert.equal(game.getSnapshot().status, 'idle');
});

test('manual START randomly selects, chases and eats a real webpage control', () => {
  const { game, get } = fixture('<button id="one">First button</button><button id="two">Second button</button>', () => 0.99);
  game.dispatch('START');
  until(game, (snapshot) => snapshot.state === 'CHASE');
  assert.equal(game.getSnapshot().target, 'Second button');
  assert.equal(game.getSnapshot().eaten, 0);
  const states = new Set<string>();
  until(game, (snapshot) => { states.add(snapshot.state); return snapshot.eaten === 1; });
  assert.ok(states.has('CHASE'));
  assert.ok(states.has('EAT'));
  assert.equal(get('two').style.visibility, 'hidden');
  assert.equal(get('two').hasAttribute('inert'), true);
  assert.equal(get('one').hasAttribute('style'), false);
  assert.equal(game.getSnapshot().crumbs.length, 1);
});

test('PAUSE freezes position, state, count and particles; RESUME continues the same session', () => {
  const { game } = fixture('<button id="one">First button</button><button id="two">Second button</button>');
  game.start();
  until(game, (snapshot) => snapshot.state === 'CHASE');
  game.step(0.05);
  game.dispatch('PAUSE');
  const paused = game.getSnapshot();
  advance(game, 15);
  assert.deepEqual(game.getSnapshot(), paused);
  game.dispatch('RESUME');
  assert.equal(game.getSnapshot().status, 'running');
  until(game, (snapshot) => snapshot.eaten === 1);
  game.pause();
  const withCrumb = game.getSnapshot();
  advance(game, 4);
  assert.deepEqual(game.getSnapshot(), withCrumb);
});

test('STOP restores the original nodes and event listeners, then stays stopped', () => {
  const { game, get } = fixture();
  const button = get('one');
  let clicks = 0;
  button.addEventListener('click', () => clicks++);
  game.start();
  until(game, (snapshot) => snapshot.eaten === 1);
  assert.equal(clicks, 0, 'chasing and eating must never invoke page actions');
  assert.equal(button.style.pointerEvents, 'none');
  game.dispatch('STOP');
  assert.equal(game.getSnapshot().status, 'idle');
  assert.equal(game.getSnapshot().eaten, 0);
  assert.equal(button.hasAttribute('style'), false);
  assert.equal(button.hasAttribute('inert'), false);
  assert.equal(get('one'), button);
  button.click();
  assert.equal(clicks, 1);
  const stopped = game.getSnapshot();
  advance(game, 30);
  assert.deepEqual(game.getSnapshot(), stopped);
});

test('SPA navigation automatically stops and restores a running or paused session', () => {
  for (const paused of [false, true]) {
    const { dom, game, get } = fixture();
    game.start();
    until(game, (snapshot) => snapshot.eaten === 1);
    if (paused) game.pause();
    dom.window.history.pushState({}, '', '/different-page');
    game.step(0.05);
    assert.equal(game.getSnapshot().status, 'idle');
    assert.equal(get('one').hasAttribute('style'), false);
    assert.equal(get('one').hasAttribute('inert'), false);
    advance(game, 10);
    assert.equal(game.getSnapshot().eaten, 0);
  }
});

test('resuming after navigation restores the page and does not silently start a new session', () => {
  const { dom, game, get } = fixture();
  game.start();
  until(game, (snapshot) => snapshot.eaten === 1);
  game.pause();
  dom.window.history.replaceState({}, '', '/replaced');
  game.resume();
  assert.equal(game.getSnapshot().status, 'idle');
  assert.equal(get('one').hasAttribute('inert'), false);
});

test('a hidden tab advances neither motion nor eating, then resumes normally', () => {
  const { document, game, get } = fixture();
  let hidden = true;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  game.start();
  const initial = game.getSnapshot();
  advance(game, 20);
  assert.deepEqual(game.getSnapshot(), initial);
  assert.equal(get('one').hasAttribute('inert'), false);
  hidden = false;
  until(game, (snapshot) => snapshot.eaten === 1);
});

test('moving a target during the bite returns to chase and does not eat at a distance', () => {
  const { game, get } = fixture();
  game.start();
  until(game, (snapshot) => snapshot.state === 'EAT');
  setBox(get('one'), 720, 100);
  game.step(0.05);
  assert.equal(game.getSnapshot().state, 'CHASE');
  assert.equal(game.getSnapshot().eaten, 0);
  assert.equal(get('one').hasAttribute('style'), false);
  until(game, (snapshot) => snapshot.eaten === 1);
});

for (const mutation of ['offscreen', 'deleted', 'protected', 'hidden'] as const) {
  test(`a target that becomes ${mutation} immediately before the bite is skipped and reselected`, () => {
    const { game, get } = fixture('<button id="one">First button</button><button id="two">Second button</button>');
    const first = get('one');
    game.start();
    until(game, (snapshot) => snapshot.state === 'EAT');
    // Most of the chewing has elapsed, so the next frame could otherwise consume it.
    advance(game, 0.7);
    if (mutation === 'offscreen') setBox(first, 3000);
    if (mutation === 'deleted') first.remove();
    if (mutation === 'protected') first.setAttribute('data-ui-eater-protect', '');
    if (mutation === 'hidden') first.hidden = true;
    game.step(0.05);
    assert.equal(game.getSnapshot().eaten, 0);
    assert.equal(first.hasAttribute('inert'), false);
    until(game, (snapshot) => snapshot.eaten === 1);
    assert.equal(get('two').hasAttribute('inert'), true);
    assert.equal(first.style.visibility, '');
  });
}

test('START while running is idempotent and START while paused resumes without resetting', () => {
  const { game, updates } = fixture();
  game.start();
  until(game, (snapshot) => snapshot.state === 'CHASE');
  game.step(0.05);
  const before = game.getSnapshot();
  const count = updates.length;
  game.dispatch('START');
  assert.deepEqual(game.getSnapshot(), before);
  assert.equal(updates.length, count);
  until(game, (snapshot) => snapshot.eaten === 1);
  game.pause();
  const paused = game.getSnapshot();
  game.start();
  assert.equal(game.getSnapshot().status, 'running');
  assert.equal(game.getSnapshot().eaten, paused.eaten);
  assert.deepEqual(game.getSnapshot().position, paused.position);
});

test('repeated start/stop sessions can eat the same original node without accumulating changes', () => {
  const { game, get } = fixture('<button id="one" style="color:red;visibility:visible !important">First button</button>');
  const original = get('one');
  for (let session = 0; session < 3; session++) {
    game.start();
    until(game, (snapshot) => snapshot.eaten === 1);
    game.stop();
    assert.equal(get('one'), original);
    assert.equal(original.style.visibility, 'visible');
    assert.equal(original.style.getPropertyPriority('visibility'), 'important');
    assert.equal(original.style.color, 'red');
    assert.equal(original.style.pointerEvents, '');
    assert.equal(original.hasAttribute('inert'), false);
  }
});

test('pagehide and destroy restore eaten nodes', () => {
  const { dom, game, get } = fixture();
  game.start();
  until(game, (snapshot) => snapshot.eaten === 1);
  dom.window.dispatchEvent(new dom.window.Event('pagehide'));
  assert.equal(game.getSnapshot().status, 'idle');
  assert.equal(get('one').hasAttribute('inert'), false);
  game.start();
  until(game, (snapshot) => snapshot.eaten === 1);
  game.destroy();
  assert.equal(game.getSnapshot().status, 'idle');
  assert.equal(get('one').hasAttribute('inert'), false);
});

test('interactions cannot start a session or alter a paused session', () => {
  const { game, get } = fixture();
  const interact = () => {
    game.beginDrag(); game.dragTo(500, 300); game.endDrag(); game.pet();
    game.setInteraction('bait'); game.placeBait(100, 100);
    assert.equal(game.directTarget(get('one')), false);
  };
  const idle = game.getSnapshot();
  interact();
  assert.deepEqual(game.getSnapshot(), idle);
  game.start(); game.pause();
  const paused = game.getSnapshot();
  interact(); advance(game, 10);
  assert.deepEqual(game.getSnapshot(), paused);
});

test('holding the monster interrupts its bite and clamps dragging to the viewport', () => {
  const { game, get, dom } = fixture();
  game.start();
  until(game, (snapshot) => snapshot.state === 'EAT');
  advance(game, 0.7);
  game.beginDrag();
  advance(game, 3);
  assert.equal(game.getSnapshot().eaten, 0);
  assert.equal(get('one').hasAttribute('inert'), false);
  assert.equal(game.getSnapshot().dragging, true);
  game.dragTo(-10000, -10000);
  assert.deepEqual(game.getSnapshot().position, { x: 56, y: 67 });
  game.dragTo(10000, 10000);
  assert.deepEqual(game.getSnapshot().position, { x: dom.window.innerWidth - 56, y: dom.window.innerHeight - 50 });
  const position = game.getSnapshot().position;
  game.dragTo(NaN, Infinity);
  assert.deepEqual(game.getSnapshot().position, position);
  game.endDrag();
  assert.equal(game.getSnapshot().dragging, false);
  until(game, (snapshot) => snapshot.eaten === 1);
});

test('placement mode holds AI, keeps failed target picking armed, and clears an active drag', () => {
  const { game, host, get } = fixture();
  game.start();
  until(game, (snapshot) => snapshot.state === 'EAT');
  game.setInteraction('target');
  const position = game.getSnapshot().position;
  advance(game, 4);
  assert.deepEqual(game.getSnapshot().position, position);
  assert.equal(game.getSnapshot().eaten, 0);
  assert.equal(game.directTarget(host.querySelector('button')!), false);
  assert.equal(game.getSnapshot().interaction, 'target');
  assert.equal(game.directTarget(get('one')), true);
  assert.equal(game.getSnapshot().interaction, 'none');
  game.beginDrag();
  game.setInteraction('bait');
  assert.equal(game.getSnapshot().dragging, false);
  assert.equal(game.getSnapshot().interaction, 'bait');
  advance(game, 4);
  assert.equal(game.getSnapshot().eaten, 0);
});

test('renewable bait grants nutrition without mutating the webpage and waits for manual replacement', () => {
  const { game, document, host } = fixture('');
  const original = document.body.innerHTML;
  game.start();
  game.setInteraction('bait');
  game.placeBait(game.getSnapshot().position.x, game.getSnapshot().position.y);
  assert.equal(game.getSnapshot().interaction, 'none');
  assert.equal(game.getSnapshot().bait?.active, true);
  until(game, (snapshot) => snapshot.baitEaten === 1);
  assert.equal(game.getSnapshot().eaten, 0);
  assert.equal(game.getSnapshot().evolution.xp, 1);
  assert.equal(game.getSnapshot().bait?.active, false);
  assert.equal(game.getSnapshot().baitCooldown, 3);
  assert.equal(document.body.innerHTML, original);
  assert.equal(host.querySelector('button')!.hasAttribute('inert'), false);
  game.placeBait(400, 300);
  assert.equal(game.getSnapshot().bait?.active, false);
  advance(game, 5);
  assert.equal(game.getSnapshot().baitEaten, 1, 'bait does not respawn automatically');
  assert.equal(game.getSnapshot().baitCooldown, 0);
  game.placeBait(game.getSnapshot().position.x, game.getSnapshot().position.y);
  until(game, (snapshot) => snapshot.baitEaten === 2);
  assert.equal(document.body.innerHTML, original);
});

test('manual targeting chooses the requested food rather than the random candidate', () => {
  const { game, get } = fixture('<button id="one">First button</button><button id="two">Second button</button>', () => 0);
  game.start();
  game.setInteraction('target');
  assert.equal(game.directTarget(get('two')), true);
  assert.equal(game.getSnapshot().interaction, 'none');
  assert.equal(game.getSnapshot().target, 'Second button');
  until(game, (snapshot) => snapshot.eaten === 1);
  assert.equal(get('two').hasAttribute('inert'), true);
  assert.equal(get('one').hasAttribute('inert'), false);
  game.setInteraction('target');
  assert.equal(game.directTarget(get('two')), false);
  assert.equal(game.getSnapshot().interaction, 'target');
});

test('bait takes priority without forgetting the specifically designated webpage target', () => {
  const { game, get } = fixture('<button id="one">First button</button><button id="two">Second button</button>');
  game.start();
  game.placeBait(game.getSnapshot().position.x, game.getSnapshot().position.y);
  assert.equal(game.directTarget(get('two')), true);
  until(game, (snapshot) => snapshot.baitEaten === 1);
  assert.equal(game.getSnapshot().eaten, 0);
  until(game, (snapshot) => snapshot.eaten === 1);
  assert.equal(get('two').hasAttribute('inert'), true);
  assert.equal(get('one').hasAttribute('inert'), false);
  assert.equal(game.getSnapshot().evolution.xp, 2);
});

test('feeding causes evolution, growth-aware bounds and an evolution reaction that petting cannot interrupt', () => {
  const { game, dom } = fixture('');
  game.start();
  for (let meal = 1; meal <= 3; meal++) {
    if (meal > 1) advance(game, 3.1);
    game.placeBait(game.getSnapshot().position.x, game.getSnapshot().position.y);
    until(game, (snapshot) => snapshot.baitEaten === meal);
  }
  assert.equal(game.getSnapshot().evolution.stage, 1);
  assert.equal(game.getSnapshot().reaction, 'evolving');
  const reactionId = game.getSnapshot().reactionId;
  game.pet();
  assert.equal(game.getSnapshot().reaction, 'evolving');
  assert.equal(game.getSnapshot().reactionId, reactionId);
  assert.equal(game.getSnapshot().evolution.xp, 3);
  game.beginDrag();
  game.dragTo(-10000, 10000);
  assert.deepEqual(game.getSnapshot().position, { x: 56 * 1.13, y: dom.window.innerHeight - 50 * 1.13 });
  game.pause();
  assert.equal(game.getSnapshot().dragging, false);
  advance(game, 10);
  assert.equal(game.getSnapshot().reaction, 'evolving');
  game.resume(); advance(game, 2);
  assert.equal(game.getSnapshot().reaction, null);
  game.pet();
  assert.equal(game.getSnapshot().reaction, 'happy');
  assert.equal(game.getSnapshot().evolution.xp, 3);
  advance(game, 1.3);
  assert.equal(game.getSnapshot().reaction, null);
  const dispatched = game.dispatch('STATUS');
  assert.equal(dispatched.evolution.stage, 1);
  assert.equal(dispatched.baitEaten, 3);
  assert.equal(dispatched.interaction, 'none');
  assert.equal(dispatched.dragging, false);
  game.stop();
  assert.equal(game.getSnapshot().evolution.stage, 0);
  assert.equal(game.getSnapshot().evolution.xp, 0);
  assert.equal(game.getSnapshot().baitEaten, 0);
  assert.equal(game.getSnapshot().bait, null);
  game.start();
  assert.equal(game.getSnapshot().evolution.xp, 0);
});

test('pause, mode changes, stop and navigation clean up gestures without restoring a stale drag', () => {
  const { game, dom } = fixture('');
  game.start(); game.beginDrag(); game.pause();
  assert.equal(game.getSnapshot().dragging, false);
  assert.equal(game.getSnapshot().interaction, 'none');
  game.resume(); game.setInteraction('target'); game.pause();
  assert.equal(game.getSnapshot().interaction, 'none');
  game.resume(); game.beginDrag(); game.setInteraction('bait');
  assert.equal(game.getSnapshot().dragging, false);
  assert.equal(game.getSnapshot().interaction, 'bait');
  game.stop();
  assert.equal(game.getSnapshot().interaction, 'none');
  assert.equal(game.getSnapshot().dragging, false);
  game.start(); game.beginDrag();
  dom.window.history.pushState({}, '', '/changed'); game.step(0.05);
  assert.equal(game.getSnapshot().status, 'idle');
  assert.equal(game.getSnapshot().dragging, false);
  assert.equal(game.getSnapshot().interaction, 'none');
});
