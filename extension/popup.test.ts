import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { IDLE_SNAPSHOT } from './protocol';
import type { Action, ExtensionMessage, ExtensionSnapshot } from './protocol';

const html = await readFile(new URL('./popup.html', import.meta.url), 'utf8');
const bundled = await build({
  entryPoints: [fileURLToPath(new URL('./popup.ts', import.meta.url))],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
});
const popupCode = bundled.outputFiles[0]!.text;

interface HarnessOptions {
  url?: string;
  tabPresent?: boolean;
  initial?: ExtensionSnapshot;
  noReceiverOn?: Action[];
}

function openPopup({
  url = 'https://example.com/', tabPresent = true,
  initial = IDLE_SNAPSHOT, noReceiverOn = [],
}: HarnessOptions = {}) {
  const dom = new JSDOM(html, { url: 'chrome-extension://test/popup.html', runScripts: 'outside-only' });
  let currentUrl = url;
  let snapshot = { ...initial };
  const actions: Action[] = [];
  const order: string[] = [];
  const injections: unknown[] = [];
  Object.defineProperty(dom.window, 'chrome', { value: {
    tabs: {
      query: async () => tabPresent ? [{ id: 7, url: currentUrl }] : [],
      sendMessage: async (_id: number, message: ExtensionMessage) => {
        actions.push(message.action);
        order.push(message.action);
        assert.equal(message.channel, 'UI_EATER');
        if (noReceiverOn.includes(message.action)) {
          throw new Error('Could not establish connection. Receiving end does not exist.');
        }
        if (message.action === 'START') snapshot = { ...IDLE_SNAPSHOT, status: 'running', state: 'SEARCH' };
        if (message.action === 'PAUSE') snapshot.status = 'paused';
        if (message.action === 'RESUME') snapshot.status = 'running';
        if (message.action === 'STOP') snapshot = { ...IDLE_SNAPSHOT };
        return { ok: true, snapshot: { ...snapshot } };
      },
    },
    scripting: {
      executeScript: async (options: unknown) => {
        order.push('INJECT');
        // Normalize objects from the popup's separate JavaScript realm.
        injections.push(JSON.parse(JSON.stringify(options)));
      },
    },
  } });
  dom.window.eval(popupCode);
  const document = dom.window.document;
  return {
    dom, actions, order, injections,
    primary: document.getElementById('primary-button') as HTMLButtonElement,
    stop: document.getElementById('stop-button') as HTMLButtonElement,
    error: document.getElementById('error-message') as HTMLParagraphElement,
    updateSnapshot: (next: ExtensionSnapshot) => { snapshot = { ...next }; },
    navigate: (nextUrl: string) => { currentUrl = nextUrl; },
    close: () => {
      dom.window.dispatchEvent(new dom.window.Event('pagehide'));
      dom.window.close();
    },
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 1500;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  assert.ok(predicate(), 'popup did not reach the expected state');
}

test('opening the popup only requests status, including when there is no content script', async (t) => {
  const popup = openPopup({ noReceiverOn: ['STATUS'] });
  t.after(popup.close);
  await waitFor(() => !popup.primary.disabled);
  assert.deepEqual(popup.actions, ['STATUS']);
  assert.equal(popup.injections.length, 0);
  assert.equal(popup.dom.window.document.body.dataset.status, 'idle');
  assert.equal(popup.stop.disabled, true);
});

test('Start injects before START; pause, resume and stop never re-inject', async (t) => {
  const popup = openPopup();
  t.after(popup.close);
  await waitFor(() => !popup.primary.disabled);
  popup.primary.click();
  await waitFor(() => popup.dom.window.document.body.dataset.status === 'running' && !popup.primary.disabled);
  assert.deepEqual(popup.order.slice(0, 3), ['STATUS', 'INJECT', 'START']);
  assert.deepEqual(popup.injections, [{ target: { tabId: 7 }, files: ['content.js'] }]);
  popup.primary.click();
  await waitFor(() => popup.dom.window.document.body.dataset.status === 'paused' && !popup.primary.disabled);
  assert.equal(popup.actions.at(-1), 'PAUSE');
  popup.primary.click();
  await waitFor(() => popup.dom.window.document.body.dataset.status === 'running' && !popup.primary.disabled);
  assert.equal(popup.actions.at(-1), 'RESUME');
  popup.stop.click();
  await waitFor(() => popup.dom.window.document.body.dataset.status === 'idle' && !popup.primary.disabled);
  assert.equal(popup.actions.at(-1), 'STOP');
  assert.equal(popup.injections.length, 1);
  assert.equal(popup.stop.disabled, true);
});

for (const url of ['chrome://extensions/', 'https://chromewebstore.google.com/detail/example']) {
  test(`protected page ${url} disables start without messaging or injection`, async (t) => {
    const popup = openPopup({ url });
    t.after(popup.close);
    await waitFor(() => !popup.error.hidden);
    assert.equal(popup.primary.disabled, true);
    assert.equal(popup.stop.disabled, true);
    assert.deepEqual(popup.actions, []);
    assert.equal(popup.injections.length, 0);
    assert.match(popup.error.textContent!, /普通的 http 或 https/);
  });
}

test('a missing active tab shows an actionable message and cannot start', async (t) => {
  const popup = openPopup({ tabPresent: false });
  t.after(popup.close);
  await waitFor(() => !popup.error.hidden);
  assert.equal(popup.primary.disabled, true);
  assert.match(popup.error.textContent!, /没有找到当前标签页/);
  assert.equal(popup.injections.length, 0);
});

test('same-tab navigation is detected before injection and requires reopening the popup', async (t) => {
  const popup = openPopup();
  t.after(popup.close);
  await waitFor(() => !popup.primary.disabled);
  popup.navigate('https://example.com/another-page');
  popup.primary.click();
  await waitFor(() => !popup.error.hidden);
  assert.match(popup.error.textContent!, /页面已经跳转/);
  assert.equal(popup.primary.disabled, true);
  assert.equal(popup.injections.length, 0);
  assert.equal(popup.actions.includes('START'), false);
});

test('Stop with a disconnected content script returns the popup to idle', async (t) => {
  const popup = openPopup({
    initial: { ...IDLE_SNAPSHOT, status: 'running', eaten: 8, state: 'CHASE', target: 'Button' },
    noReceiverOn: ['STOP'],
  });
  t.after(popup.close);
  await waitFor(() => !popup.stop.disabled);
  popup.stop.click();
  await waitFor(() => popup.dom.window.document.body.dataset.status === 'idle' && !popup.primary.disabled);
  assert.equal(popup.stop.disabled, true);
  assert.equal(popup.injections.length, 0);
  assert.equal(popup.error.hidden, true);
});

test('the popup displays actual evolution progress and bait feeds without starting a game', async (t) => {
  const popup = openPopup({
    initial: {
      ...IDLE_SNAPSHOT, status: 'running', eaten: 7, baitEaten: 3,
      evolution: {
        stage: 2, name: '蓝角兽', threshold: 7, nextThreshold: 12, progress: .6,
        xp: 10, scale: 1.32, hue: 115, body: 'horned',
      },
    },
  });
  t.after(popup.close);
  const document = popup.dom.window.document;
  await waitFor(() => !popup.primary.disabled);
  assert.equal(document.body.dataset.evolutionStage, '2');
  assert.equal(document.getElementById('evolution-name')!.textContent, '蓝角兽');
  assert.equal(document.getElementById('evolution-xp')!.textContent, '10 / 12 XP');
  assert.equal(document.getElementById('evolution-progress')!.getAttribute('aria-valuenow'), '60');
  assert.equal(document.getElementById('evolution-fill')!.style.width, '60%');
  assert.equal(document.getElementById('bait-count')!.textContent, '3');
  assert.equal(document.getElementById('eaten-count')!.textContent, '07');
  assert.equal(popup.injections.length, 0);
  assert.deepEqual(popup.actions, ['STATUS']);
});

test('status polling updates the final form, interaction prompt and pause message', async (t) => {
  const popup = openPopup({
    initial: { ...IDLE_SNAPSHOT, status: 'running', interaction: 'bait' },
  });
  t.after(popup.close);
  const document = popup.dom.window.document;
  await waitFor(() => !popup.primary.disabled);
  assert.match(document.getElementById('activity-description')!.textContent!, /放下诱饵/);
  popup.updateSnapshot({
    ...IDLE_SNAPSHOT, status: 'running', interaction: 'target', baitEaten: 4,
    evolution: {
      stage: 4, name: '星冠王', threshold: 18, nextThreshold: null, progress: 1,
      xp: 19, scale: 1.65, hue: 270, body: 'crowned',
    },
  });
  await waitFor(() => document.body.dataset.evolutionStage === '4');
  assert.equal(document.getElementById('evolution-xp')!.textContent, '19 XP · 完全进化');
  assert.equal(document.getElementById('evolution-progress')!.getAttribute('aria-valuenow'), '100');
  assert.match(document.getElementById('activity-description')!.textContent!, /喂给它的元素/);
  popup.primary.click();
  await waitFor(() => document.body.dataset.status === 'paused');
  assert.match(document.getElementById('activity-description')!.textContent!, /休息中/);
  assert.equal(document.getElementById('evolution-name')!.textContent, '星冠王');
});

test('dragging is visible in the popup and Stop resets the growth display', async (t) => {
  const popup = openPopup({
    initial: {
      ...IDLE_SNAPSHOT, status: 'running', dragging: true, baitEaten: 2,
      evolution: { ...IDLE_SNAPSHOT.evolution, xp: 2, progress: 2 / 3 },
    },
  });
  t.after(popup.close);
  const document = popup.dom.window.document;
  await waitFor(() => !popup.stop.disabled);
  assert.match(document.getElementById('activity-description')!.textContent!, /松开鼠标/);
  popup.stop.click();
  await waitFor(() => document.body.dataset.status === 'idle');
  assert.equal(document.getElementById('bait-count')!.textContent, '0');
  assert.equal(document.getElementById('evolution-xp')!.textContent, '0 / 3 XP');
  assert.equal(document.getElementById('evolution-progress')!.getAttribute('aria-valuenow'), '0');
});
