import { createRoot } from 'react-dom/client';
import { BrowserGame } from './BrowserGame';
import Overlay from './Overlay';
import overlayStyles from './overlay.css?inline';
import monsterStyles from '../src/components/Monster.css?inline';
import type { Action, ExtensionResponse } from './protocol';

type ExtensionWindow = Window & { __uiEaterExtensionV1__?: boolean };
const context = window as ExtensionWindow;
if (!context.__uiEaterExtensionV1__ && typeof chrome !== 'undefined' && chrome.runtime?.id) {
  const host = document.createElement('div');
  host.setAttribute('data-ui-eater-protect','true');
  host.setAttribute('data-ui-eater-root','true');
  host.style.cssText = 'position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important;padding:0!important;border:0!important;z-index:2147483647!important;pointer-events:none!important;display:block!important;visibility:visible!important;opacity:1!important;isolation:isolate!important;';
  const shadow = host.attachShadow({ mode:'open' });
  const style = document.createElement('style'); style.textContent = overlayStyles + '\n' + monsterStyles;
  const container = document.createElement('div');
  shadow.append(style,container); document.documentElement.append(host);
  const root = createRoot(container);
  const game = new BrowserGame(document,host,snapshot => {
    if (snapshot.status !== 'idle' && !host.isConnected) document.documentElement.append(host);
    root.render(<Overlay game={snapshot} controller={game} host={host}/>);
  });
  const actions: Action[] = ['STATUS','START','PAUSE','RESUME','STOP'];
  chrome.runtime.onMessage.addListener((message: unknown,sender,sendResponse) => {
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object') return;
    const request = message as { channel?: unknown; action?: unknown };
    if (request.channel !== 'UI_EATER' || !actions.includes(request.action as Action)) return;
    try { sendResponse({ok:true,snapshot:game.dispatch(request.action as Action)} satisfies ExtensionResponse); }
    catch { game.stop(); sendResponse({ok:false,error:'网页结构发生变化，已停止并尝试恢复。请刷新后重试。'} satisfies ExtensionResponse); }
    return false;
  });
  context.__uiEaterExtensionV1__ = true;
  document.addEventListener('keydown',event=>{
    const snapshot=game.getSnapshot();
    if(event.key==='Escape' && snapshot.interaction!=='none'){
      event.preventDefault();event.stopImmediatePropagation();game.setInteraction('none');
    }
  },true);
  // Injection itself never starts a game. Only the explicit START message can do so.
}
