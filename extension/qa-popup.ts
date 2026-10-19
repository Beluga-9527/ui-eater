import popupHtml from './popup.html?raw';
import './popup.css';
import { getEvolution } from './evolution';
import { IDLE_SNAPSHOT } from './protocol';
import type { ExtensionMessage, ExtensionSnapshot } from './protocol';

// Development-only preview: render the real popup without duplicating its layout.
const source = new DOMParser().parseFromString(popupHtml, 'text/html');
source.querySelectorAll('script').forEach(script => script.remove());
document.body.innerHTML = source.body.innerHTML;
for (const attribute of source.body.attributes) document.body.setAttribute(attribute.name, attribute.value);

const previewXp = new URLSearchParams(window.location.search).get('xp');
const xp = Math.max(0, Math.floor(Number(previewXp) || 0));
const baitEaten = Math.min(3, xp);
let snapshot: ExtensionSnapshot = previewXp === null ? { ...IDLE_SNAPSHOT } : {
  ...IDLE_SNAPSHOT,
  status: 'running', state: 'SEARCH', eaten: xp - baitEaten, baitEaten,
  evolution: getEvolution(xp - baitEaten, baitEaten),
};

Object.defineProperty(window, 'chrome', { configurable: true, value: {
  tabs: {
    query: async () => [{ id: 1, url: 'https://example.test/' }],
    sendMessage: async (_tabId: number, message: ExtensionMessage) => {
      if (message.action === 'START') snapshot = { ...IDLE_SNAPSHOT, status: 'running', state: 'SEARCH' };
      if (message.action === 'PAUSE') snapshot = { ...snapshot, status: 'paused' };
      if (message.action === 'RESUME') snapshot = { ...snapshot, status: 'running' };
      if (message.action === 'STOP') snapshot = { ...IDLE_SNAPSHOT };
      return { ok: true, snapshot: { ...snapshot } };
    },
  },
  scripting: { executeScript: async () => [] },
} });

await import('./popup');
