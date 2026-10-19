import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { collectTargets, eligibleTarget, randomTarget } from './targets';

function fixture(markup: string) {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}<div id="extension-host"><button>停止</button></div></body></html>`, { pretendToBeVisual: true });
  const document = dom.window.document;
  const host = document.getElementById('extension-host')!;
  for (const element of document.querySelectorAll<HTMLElement>('body *')) setBox(element);
  return { dom, document, host, get: (id: string) => document.getElementById(id)! };
}

function setBox(element: HTMLElement, x = 40, y = 40, width = 140, height = 32) {
  element.getBoundingClientRect = () => ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) });
}

test('collects visible leaf content and complete controls while excluding the extension', () => {
  const { document, host } = fixture('<main><h1 id="title">Welcome</h1><button id="button"><span id="caption">Run</span></button><a id="link" href="/go">Open</a><p id="paragraph"><span id="leaf">Words</span></p><img id="image" src="data:," alt="picture"><a id="no-href">No link</a></main>');
  assert.deepEqual(collectTargets(document, host).map((element) => element.id), ['title', 'button', 'link', 'leaf', 'image']);
});

test('excludes fields, their containing candidates, form regions and protected/editor content', () => {
  const { document, host } = fixture('<label id="field-parent">Name<input></label><form><button id="submit">Submit</button><p>Form caption</p></form><div contenteditable="true"><span id="editable">Edit me</span></div><p id="protected-parent">Safe <span data-ui-eater-protect>Keep me</span></p><div data-ui-eater-protect><button id="protected-child">Keep</button></div><p id="plain">Fine</p>');
  assert.deepEqual(collectTargets(document, host).map((element) => element.id), ['plain']);
});

test('excludes hidden or inert ancestors and offscreen, tiny or oversized targets', () => {
  const { document, host, get } = fixture('<div hidden><p>Hidden</p></div><div aria-hidden="true"><p>Screen-reader hidden</p></div><div style="opacity:0"><p>Transparent parent</p></div><div style="display:none"><p>Display none</p></div><div inert><button>Inert</button></div><span id="offscreen">Outside</span><p id="tiny">Tiny</p><p id="huge">Huge</p><p id="valid">Visible</p>');
  setBox(get('offscreen'), 2000, 20);
  setBox(get('tiny'), 10, 10, 9, 9);
  setBox(get('huge'), 10, 10, 701, 250);
  assert.deepEqual(collectTargets(document, host).map((element) => element.id), ['valid']);
});

test('never targets an ancestor that contains the extension host', () => {
  const { host, get } = fixture('<span id="container">A wrapper</span>');
  get('container').append(host);
  assert.equal(eligibleTarget(get('container'), host), false);
});

test('bounded scans rotate so later visible elements on a large page can be discovered', () => {
  const { document, host } = fixture(`${'<div></div>'.repeat(1900)}<p id="late">Later</p>`);
  assert.equal(collectTargets(document, host).length, 0);
  assert.deepEqual(collectTargets(document, host).map((element) => element.id), ['late']);
});

test('random target avoids the previous choice when possible, handles empty and detached lists', () => {
  const { get } = fixture('<p id="one">One</p><p id="two">Two</p><p id="three">Three</p>');
  const candidates = [get('one'), get('two'), get('three')];
  assert.equal(randomTarget(candidates, get('one'), () => 0), get('two'));
  assert.equal(randomTarget(candidates, get('one'), () => 0.99), get('three'));
  assert.equal(randomTarget([get('one')], get('one')), get('one'));
  assert.equal(randomTarget([], null), null);
  const detached = get('one');
  detached.remove();
  assert.equal(randomTarget([detached], null), null);
  assert.equal(randomTarget(candidates, null, () => NaN), get('two'));
});
