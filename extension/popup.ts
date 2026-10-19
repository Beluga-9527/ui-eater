import { CHANNEL, IDLE_SNAPSHOT } from './protocol';
import type { Action, ExtensionMessage, ExtensionResponse, ExtensionSnapshot } from './protocol';

interface TabContext { id: number; url: string; domain: string }
type ErrorKind = 'restricted' | 'navigated' | 'missing' | 'connection';

const ERROR_MESSAGES: Record<ErrorKind, string> = {
  restricted: '这个页面不支持游戏，请打开普通的 http 或 https 网页。',
  navigated: '页面已经跳转，请重新打开扩展后再开始游戏。',
  missing: '没有找到当前标签页，请打开一个网页后重试。',
  connection: '暂时无法连接这个网页。请刷新页面，再试一次。',
};

class PopupError extends Error {
  constructor(readonly kind: ErrorKind) { super(ERROR_MESSAGES[kind]); }
}

function element<T extends HTMLElement | SVGElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing popup element: ${id}`);
  return found as unknown as T;
}

const domain = element('current-domain');
const count = element('eaten-count');
const statusLabel = element('status-label');
const description = element('activity-description');
const primary = element<HTMLButtonElement>('primary-button');
const primaryLabel = element('primary-label');
const primaryIcon = element<SVGUseElement>('primary-icon');
const stop = element<HTMLButtonElement>('stop-button');
const errorMessage = element('error-message');
const evolutionName = element('evolution-name');
const evolutionXp = element('evolution-xp');
const evolutionBar = element('evolution-progress');
const evolutionFill = element('evolution-fill');
const baitCount = element('bait-count');

let context: TabContext | null = null;
let snapshot: ExtensionSnapshot = { ...IDLE_SNAPSHOT };
let busy = false;
let disposed = false;
let blocked = false;
let statusRequest: Promise<void> | null = null;

function render(): void {
  if (disposed) return;
  document.body.dataset.status = snapshot.status;
  document.body.dataset.monsterState = snapshot.state;
  document.body.dataset.evolutionStage = String(snapshot.evolution.stage);
  document.body.dataset.busy = String(busy);
  count.textContent = String(snapshot.eaten).padStart(2, '0');
  const evolution = snapshot.evolution;
  document.body.style.setProperty('--monster-hue', `${evolution.hue}deg`);
  evolutionName.textContent = evolution.name;
  evolutionXp.textContent = evolution.nextThreshold === null
    ? `${evolution.xp} XP · 完全进化`
    : `${evolution.xp} / ${evolution.nextThreshold} XP`;
  evolutionBar.setAttribute('aria-valuenow', String(Math.round(evolution.progress * 100)));
  evolutionBar.setAttribute('aria-valuetext', `${evolution.name}，${evolutionXp.textContent}`);
  evolutionFill.style.width = `${evolution.progress * 100}%`;
  baitCount.textContent = String(snapshot.baitEaten);
  const isRunning = snapshot.status === 'running';
  const isPaused = snapshot.status === 'paused';
  statusLabel.textContent = blocked ? '暂时无法游玩' : isRunning ? '游玩中' : isPaused ? '已暂停' : '准备就绪';
  primaryLabel.textContent = busy ? '请稍等…' : isRunning ? '暂停一下' : isPaused ? '继续游戏' : '开始游戏';
  primaryIcon.setAttribute('href', isRunning ? '#icon-pause' : '#icon-play');
  primary.disabled = busy || blocked || !context;
  stop.disabled = busy || blocked || !context || snapshot.status === 'idle';

  const target = snapshot.target?.replace(/\s+/g, ' ').trim().slice(0, 28);
  description.textContent = blocked
    ? '换一个普通网页，再来找它玩。'
    : isPaused
      ? '小怪物休息中，网页暂时安全。'
      : !isRunning
        ? '点击开始，小怪物才会出现在网页。'
        : snapshot.dragging
          ? '松开鼠标，把小怪物放到新位置。'
        : snapshot.interaction === 'bait'
          ? '回到网页，点击任意位置放下诱饵。'
        : snapshot.interaction === 'target'
          ? '回到网页，点击要喂给它的元素。'
        : snapshot.state === 'EAT'
          ? target ? `正在咀嚼「${target}」。` : '咔嚓，这一口有点好吃。'
          : snapshot.state === 'CHASE'
            ? target ? `正在追着「${target}」跑。` : '发现了好吃的，正在靠近。'
            : snapshot.state === 'SEARCH'
              ? '在按钮和文字间寻找下一口。'
              : '正在闻一闻这个网页。';
}

function showError(error: unknown): void {
  if (disposed) return;
  if (error instanceof PopupError) {
    if (error.kind !== 'connection') blocked = true;
    errorMessage.textContent = error.message;
  } else {
    errorMessage.textContent = error instanceof Error ? error.message : ERROR_MESSAGES.connection;
  }
  errorMessage.hidden = false;
  render();
}

function clearError(): void { errorMessage.hidden = true; errorMessage.textContent = ''; }

async function activeTab(): Promise<TabContext> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== 'number') throw new PopupError('missing');
  let url: URL;
  try { url = new URL(tab.url ?? ''); } catch { throw new PopupError('restricted'); }
  const isStore = url.hostname === 'chromewebstore.google.com'
    || (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))
    || (url.hostname === 'microsoftedge.microsoft.com' && url.pathname.startsWith('/addons'));
  if (!['http:', 'https:'].includes(url.protocol) || isStore) throw new PopupError('restricted');
  if (context && (tab.id !== context.id || tab.url !== context.url)) throw new PopupError('navigated');
  return { id: tab.id, url: url.href, domain: url.hostname };
}

function hasNoReceiver(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /receiving end does not exist|could not establish connection|message port closed|message channel closed/i.test(message);
}

async function send(tab: TabContext, action: Action): Promise<ExtensionSnapshot> {
  const message: ExtensionMessage = { channel: CHANNEL, action };
  let response: ExtensionResponse | undefined;
  try {
    response = await chrome.tabs.sendMessage(tab.id, message) as ExtensionResponse | undefined;
  } catch (error) {
    // Check navigation before classifying a missing content script as an idle page.
    await activeTab();
    if (hasNoReceiver(error) && action !== 'START') return { ...IDLE_SNAPSHOT };
    throw new PopupError('connection');
  }
  if (!response?.ok) throw new Error(response?.error || ERROR_MESSAGES.connection);
  if (!response.snapshot) throw new PopupError('connection');
  return response.snapshot;
}

async function refreshStatus(): Promise<void> {
  try {
    const tab = await activeTab();
    if (disposed) return;
    context = tab;
    domain.textContent = tab.domain;
    domain.setAttribute('title', tab.domain);
    snapshot = await send(tab, 'STATUS');
    render();
  } catch (error) {
    showError(error instanceof PopupError ? error : new PopupError('connection'));
  }
}

function poll(): void {
  if (disposed || busy || blocked || statusRequest) return;
  statusRequest = refreshStatus().finally(() => { statusRequest = null; });
}

async function act(action: Exclude<Action, 'STATUS'>): Promise<void> {
  if (busy || blocked || disposed) return;
  busy = true;
  clearError();
  render();
  try {
    // A click waits for the short status query instead of racing it or being dropped.
    if (statusRequest) await statusRequest;
    if (disposed || blocked) return;
    const tab = await activeTab();
    if (disposed) return;
    if (action === 'START') {
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      } catch {
        await activeTab();
        throw new PopupError('restricted');
      }
      if (disposed) return;
      await activeTab();
    }
    snapshot = await send(tab, action);
  } catch (error) {
    showError(error instanceof PopupError || error instanceof Error ? error : new PopupError('connection'));
  } finally {
    busy = false;
    render();
  }
}

primary.addEventListener('click', () => {
  const action = snapshot.status === 'running' ? 'PAUSE' : snapshot.status === 'paused' ? 'RESUME' : 'START';
  void act(action);
});
stop.addEventListener('click', () => { void act('STOP'); });

// Opening the popup only reads state. Injection is exclusively inside the START click.
poll();
const interval = window.setInterval(poll, 700);
window.addEventListener('pagehide', () => {
  disposed = true;
  window.clearInterval(interval);
}, { once: true });
