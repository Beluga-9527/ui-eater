import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { PageRestorer } from './restoration';

function fixture(markup = '<button id="target">Keep my listener</button>') {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, { pretendToBeVisual: true });
  return { dom, element: dom.window.document.getElementById('target')! };
}

test('construction and empty restoration leave the document untouched', () => {
  const { dom, element } = fixture();
  const original = dom.window.document.documentElement.outerHTML;
  const restorer = new PageRestorer();
  assert.equal(restorer.count, 0);
  assert.equal(restorer.has(element), false);
  assert.deepEqual(restorer.restoreAll(), { restored: 0, skipped: 0 });
  assert.equal(dom.window.document.documentElement.outerHTML, original);
});

test('eating prevents pointer/focus interaction without removing or replacing the node', () => {
  const { element } = fixture();
  const parent = element.parentElement;
  const restorer = new PageRestorer();
  assert.equal(restorer.eat(element), true);
  assert.equal(restorer.eat(element), false);
  assert.equal(restorer.count, 1);
  assert.equal(restorer.has(element), true);
  assert.equal(element.style.getPropertyValue('visibility'), 'hidden');
  assert.equal(element.style.getPropertyPriority('visibility'), 'important');
  assert.equal(element.style.getPropertyValue('pointer-events'), 'none');
  assert.equal(element.style.getPropertyPriority('pointer-events'), 'important');
  assert.equal(element.hasAttribute('inert'), true);
  assert.equal(element.parentElement, parent);
  assert.equal(element.isConnected, true);
  assert.deepEqual(restorer.restoreAll(), { restored: 1, skipped: 0 });
  assert.equal(element.hasAttribute('style'), false);
  assert.equal(element.hasAttribute('inert'), false);
  assert.equal(restorer.count, 0);
});

test('restores exact previous inline property values, priorities and inert attribute text', () => {
  const { element } = fixture('<button id="target" inert="inert" style="color: red; visibility: visible !important; pointer-events: auto">Original</button>');
  const restorer = new PageRestorer();
  restorer.eat(element);
  restorer.restoreAll();
  assert.equal(element.style.getPropertyValue('visibility'), 'visible');
  assert.equal(element.style.getPropertyPriority('visibility'), 'important');
  assert.equal(element.style.getPropertyValue('pointer-events'), 'auto');
  assert.equal(element.style.getPropertyPriority('pointer-events'), '');
  assert.equal(element.style.color, 'red');
  assert.equal(element.getAttribute('inert'), 'inert');
});

test('preserves application style and inert changes made while an element is eaten', () => {
  const { element } = fixture();
  const restorer = new PageRestorer();
  restorer.eat(element);
  element.style.setProperty('visibility', 'collapse', 'important');
  element.style.setProperty('pointer-events', 'auto');
  element.style.color = 'blue';
  element.setAttribute('inert', 'page-owned');
  restorer.restoreAll();
  assert.equal(element.style.visibility, 'collapse');
  assert.equal(element.style.pointerEvents, 'auto');
  assert.equal(element.style.color, 'blue');
  assert.equal(element.getAttribute('inert'), 'page-owned');
});

test('preserves original node listeners and form values, and does not click or fetch', () => {
  const { dom, element } = fixture('<div id="target"><button id="button">Action</button><input id="value" value="initial"></div>');
  const input = dom.window.document.getElementById('value') as HTMLInputElement;
  const button = dom.window.document.getElementById('button')!;
  input.value = 'unsaved application state';
  let clicks = 0;
  let fetches = 0;
  button.addEventListener('click', () => clicks++);
  dom.window.fetch = (() => { fetches++; return Promise.resolve(new Response()); }) as typeof fetch;
  const restorer = new PageRestorer();
  restorer.eat(element);
  restorer.restoreAll();
  assert.equal(clicks, 0);
  assert.equal(fetches, 0);
  assert.equal(input.value, 'unsaved application state');
  button.click();
  assert.equal(clicks, 1);
  assert.equal(dom.window.document.getElementById('button'), button);
});

test('skips nodes removed by the website and discards stale records', () => {
  const { element } = fixture();
  const restorer = new PageRestorer();
  restorer.eat(element);
  element.remove();
  assert.deepEqual(restorer.restoreAll(), { restored: 0, skipped: 1 });
  assert.equal(restorer.count, 0);
  assert.equal(restorer.eat(element), false);
});
