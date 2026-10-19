const CANDIDATES = 'button,a[href],img,p,h1,h2,h3,h4,h5,h6,li,span,label,small';
const PROTECTED = [
  'script', 'style', 'template', 'noscript', 'form', 'input', 'textarea', 'select', 'option', 'optgroup',
  'iframe', 'video', 'audio', 'canvas', 'object', 'embed',
  '[data-ui-eater-protect]', '[contenteditable]:not([contenteditable="false" i])',
  '[role="textbox"]', '[role="combobox"]', '[role="spinbutton"]', '[role="slider"]',
  '[hidden]', '[aria-hidden="true" i]', '[inert]',
].join(',');
const INTERACTIVE = 'button,a[href]';
const MAX_VISITED = 1800;
const scanCursors = new WeakMap<Document, Element>();

/** Only small visible content and controls can be eaten; the page structure stays intact. */
export function eligibleTarget(element: HTMLElement, excludedHost: Element): boolean {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view || !element.isConnected || !element.matches(CANDIDATES)) return false;
  if (element === excludedHost || excludedHost.contains(element) || element.contains(excludedHost)) return false;
  if (element.closest(PROTECTED) || element.querySelector(PROTECTED)) return false;

  // Eat a complete button/link rather than its caption, which would leave an invisible hit area.
  const control = element.closest(INTERACTIVE);
  if (control && control !== element) return false;
  if (!element.matches(INTERACTIVE) && element.querySelector(CANDIDATES)) return false;

  const viewportWidth = view.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = view.innerHeight || document.documentElement.clientHeight;
  const rect = element.getBoundingClientRect();
  const areaLimit = Math.min(viewportWidth * viewportHeight * 0.28, 250000);
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
    || rect.width < 12 || rect.height < 12 || rect.width > 700 || rect.height > 320
    || rect.width * rect.height >= areaLimit) return false;
  const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
  const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
  if (visibleWidth < 12 || visibleHeight < 12) return false;

  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = view.getComputedStyle(ancestor);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
      || style.opacity === '0') return false;
  }
  return true;
}

/** Bounded, rotating scans avoid creating an unbounded list on large documents. */
export function collectTargets(root: Document, excludedHost: Element): HTMLElement[] {
  const scope = root.body ?? root.documentElement;
  const view = root.defaultView;
  if (!scope || !view) return [];
  const walker = root.createTreeWalker(scope, 1, {
    acceptNode(node) {
      const element = node as Element;
      return element === excludedHost || excludedHost.contains(element) || element.matches(PROTECTED) ? 2 : 1;
    },
  });
  const previous = scanCursors.get(root);
  if (previous?.isConnected && scope.contains(previous) && !previous.closest(PROTECTED)
    && !excludedHost.contains(previous)) walker.currentNode = previous;

  const result: HTMLElement[] = [];
  const visited = new Set<Element>();
  let wrapped = false;
  for (let count = 0; count < MAX_VISITED; count++) {
    let node = walker.nextNode() as Element | null;
    if (!node && !wrapped) {
      walker.currentNode = scope;
      wrapped = true;
      node = walker.nextNode() as Element | null;
    }
    if (!node || visited.has(node)) break;
    visited.add(node);
    scanCursors.set(root, node);
    if (node instanceof view.HTMLElement && eligibleTarget(node, excludedHost)) result.push(node);
  }
  return result;
}

export function randomTarget(candidates: HTMLElement[], previous: HTMLElement | null, random = Math.random): HTMLElement | null {
  const connected = candidates.filter((element) => element.isConnected);
  const alternatives = connected.length > 1 ? connected.filter((element) => element !== previous) : connected;
  if (!alternatives.length) return null;
  const choice = random();
  const index = Number.isFinite(choice) ? Math.min(alternatives.length - 1, Math.max(0, Math.floor(choice * alternatives.length))) : 0;
  return alternatives[index]!;
}
