type SavedProperty = { value: string; priority: string };
type SavedElement = {
  visibility: SavedProperty;
  pointerEvents: SavedProperty;
  hadStyle: boolean;
  inert: string | null;
};

const OWNED = {
  visibility: 'hidden',
  'pointer-events': 'none',
} as const;

function readProperty(element: HTMLElement, name: string): SavedProperty {
  return { value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) };
}

function restoreProperty(element: HTMLElement, name: keyof typeof OWNED, saved: SavedProperty): void {
  // A page may update its own styles while the game is running. Keep those edits.
  if (element.style.getPropertyValue(name) !== OWNED[name] || element.style.getPropertyPriority(name) !== 'important') return;
  if (saved.value) element.style.setProperty(name, saved.value, saved.priority);
  else element.style.removeProperty(name);
}

/** Keeps the real DOM nodes and their layout, event listeners and application state. */
export class PageRestorer {
  private eaten = new Map<HTMLElement, SavedElement>();

  get count(): number { return this.eaten.size; }

  has(element: HTMLElement): boolean { return this.eaten.has(element); }

  eat(element: HTMLElement): boolean {
    if (!element.isConnected || this.eaten.has(element)) return false;
    const saved: SavedElement = {
      visibility: readProperty(element, 'visibility'),
      pointerEvents: readProperty(element, 'pointer-events'),
      hadStyle: element.hasAttribute('style'),
      inert: element.getAttribute('inert'),
    };
    this.eaten.set(element, saved);
    element.style.setProperty('visibility', OWNED.visibility, 'important');
    element.style.setProperty('pointer-events', OWNED['pointer-events'], 'important');
    element.setAttribute('inert', '');
    return true;
  }

  restoreAll(): { restored: number; skipped: number } {
    let restored = 0;
    let skipped = 0;
    for (const [element, saved] of this.eaten) {
      if (!element.isConnected) { skipped++; continue; }
      restoreProperty(element, 'visibility', saved.visibility);
      restoreProperty(element, 'pointer-events', saved.pointerEvents);
      if (element.getAttribute('inert') === '') {
        if (saved.inert === null) element.removeAttribute('inert');
        else element.setAttribute('inert', saved.inert);
      }
      if (!saved.hadStyle && element.style.length === 0) element.removeAttribute('style');
      restored++;
    }
    this.eaten.clear();
    return { restored, skipped };
  }
}
