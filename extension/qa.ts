import type { Action, ExtensionResponse } from './protocol';

// Development-only page: simulates the extension message boundary, without installing a browser extension.
type Listener = (message: unknown,sender: chrome.runtime.MessageSender,sendResponse: (response: ExtensionResponse) => void) => unknown;
const listeners: Listener[] = [];
const qaRuntimeId = 'ui-eater-local-qa';
Object.defineProperty(window,'chrome',{configurable:true,value:{runtime:{id:qaRuntimeId,onMessage:{addListener:(listener:Listener)=>listeners.push(listener)}}}});
const statusElement = document.querySelector<HTMLElement>('#qa-status')!;
function send(action: Action): ExtensionResponse | undefined {
  let response: ExtensionResponse | undefined;
  listeners.forEach(listener=>listener({channel:'UI_EATER',action},{id:qaRuntimeId},result=>{response=result;}));
  return response;
}
await import('./content');
document.querySelector('#qa-start')!.addEventListener('click',()=>send('START'));
document.querySelector('#qa-pause')!.addEventListener('click',()=>{const state=send('STATUS')?.snapshot?.status;send(state==='paused'?'RESUME':'PAUSE');});
document.querySelector('#qa-stop')!.addEventListener('click',()=>send('STOP'));
let clicks=0;
document.querySelector('#sample-button')!.addEventListener('click',()=>{document.querySelector('#click-count')!.textContent=String(++clicks);});
window.setInterval(()=>{const snapshot=send('STATUS')?.snapshot;statusElement.textContent=snapshot?`${snapshot.status} · 已吞噬 ${snapshot.eaten}`:'未连接';},300);
