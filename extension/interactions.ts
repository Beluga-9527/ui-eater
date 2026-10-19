import { eligibleTarget } from './targets';

/** Hit testing never clicks the page. Skip the overlay and use the visible topmost surface. */
export function foodAtPoint(document: Document, host: HTMLElement, x: number, y: number): HTMLElement | null {
  const view = document.defaultView;
  if (!view || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  for (const hit of document.elementsFromPoint(x,y)) {
    if (hit === host || host.contains(hit)) continue;
    let candidate: Element | null = hit;
    while (candidate && candidate !== document.body && candidate !== document.documentElement) {
      if (candidate instanceof view.HTMLElement && eligibleTarget(candidate,host)) return candidate;
      candidate = candidate.parentElement;
    }
    break;
  }
  return null;
}
