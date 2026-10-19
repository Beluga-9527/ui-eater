import { clamp } from './collision';
import { HEIGHT, WIDTH } from './levels';
import type { GameWindow, UIObject } from './types';

export function moveUIWindow(windows: GameWindow[], objects: UIObject[], id: string, x: number, y: number): boolean {
  const window = windows.find((entry) => entry.id === id);
  if (!window?.movable || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const nextX = clamp(x, 12, WIDTH - window.w - 12);
  const nextY = clamp(y, 34, HEIGHT - window.h - 12);
  const dx = nextX - window.x;
  const dy = nextY - window.y;
  window.x = nextX;
  window.y = nextY;
  for (const object of objects) {
    if (object.windowId === id) { object.x += dx; object.y += dy; }
  }
  return true;
}

export const obstaclesFor = (windows: GameWindow[]) => windows.filter((window) => window.kind === 'shield');
