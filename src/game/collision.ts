import type { Point, Rect } from './types';

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const center = (rect: Rect): Point => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

export function contains(rect: Rect, point: Point, inset = 0): boolean {
  return point.x >= rect.x + inset && point.x <= rect.x + rect.w - inset
    && point.y >= rect.y + inset && point.y <= rect.y + rect.h - inset;
}

export function inflate(rect: Rect, padding: number): Rect {
  return { x: rect.x - padding, y: rect.y - padding, w: rect.w + padding * 2, h: rect.h + padding * 2 };
}

/** Segment intersection with the rectangle interior; grazing an edge is allowed. */
function segmentBlocked(a: Point, b: Point, rect: Rect): boolean {
  let start = 0;
  let end = 1;
  const bounds = [
    { origin: a.x, delta: b.x - a.x, min: rect.x + 0.01, max: rect.x + rect.w - 0.01 },
    { origin: a.y, delta: b.y - a.y, min: rect.y + 0.01, max: rect.y + rect.h - 0.01 },
  ];
  for (const axis of bounds) {
    if (Math.abs(axis.delta) < 0.0001) {
      if (axis.origin < axis.min || axis.origin > axis.max) return false;
    } else {
      const t1 = (axis.min - axis.origin) / axis.delta;
      const t2 = (axis.max - axis.origin) / axis.delta;
      start = Math.max(start, Math.min(t1, t2));
      end = Math.min(end, Math.max(t1, t2));
      if (start > end) return false;
    }
  }
  return end >= 0 && start <= 1;
}

/** Find a short path around the small set of movable rectangular windows. */
export function nextWaypoint(from: Point, to: Point, obstacles: Rect[], width: number, height: number, radius: number): Point {
  const blocked = obstacles.map((rect) => inflate(rect, radius + 2));
  const visible = (a: Point, b: Point) => !blocked.some((rect) => segmentBlocked(a, b, rect));
  if (visible(from, to)) return to;
  const nodes: Point[] = [from, to];
  for (const rect of blocked) {
    for (const point of [
      { x: rect.x - 1, y: rect.y - 1 }, { x: rect.x + rect.w + 1, y: rect.y - 1 },
      { x: rect.x - 1, y: rect.y + rect.h + 1 }, { x: rect.x + rect.w + 1, y: rect.y + rect.h + 1 },
    ]) {
      if (point.x >= radius && point.x <= width - radius && point.y >= radius && point.y <= height - radius
        && !blocked.some((other) => contains(other, point))) nodes.push(point);
    }
  }
  const costs = nodes.map(() => Infinity);
  const parents = nodes.map(() => -1);
  const visited = new Set<number>();
  costs[0] = 0;
  for (let count = 0; count < nodes.length; count++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && (current < 0 || costs[i]! < costs[current]!)) current = i;
    }
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) {
      let next = 1;
      while (parents[next] !== 0 && parents[next] !== -1) next = parents[next]!;
      return nodes[next]!;
    }
    visited.add(current);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i) || !visible(nodes[current]!, nodes[i]!)) continue;
      const cost = costs[current]! + distance(nodes[current]!, nodes[i]!);
      if (cost < costs[i]!) { costs[i] = cost; parents[i] = current; }
    }
  }
  // A target covered by an obstacle cannot be reached until that window is moved.
  return from;
}

/** Moving a window must never imprison the monster inside its collision body. */
export function resolveObstacles(point: Point, obstacles: Rect[], radius: number, width: number, height: number): Point {
  let result = { ...point };
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const obstacle of obstacles) {
      const rect = inflate(obstacle, radius + 3);
      if (!contains(rect, result)) continue;
      const candidates = [
        { x: rect.x - 1, y: result.y }, { x: rect.x + rect.w + 1, y: result.y },
        { x: result.x, y: rect.y - 1 }, { x: result.x, y: rect.y + rect.h + 1 },
      ].filter((candidate) => candidate.x >= radius && candidate.x <= width - radius
        && candidate.y >= radius && candidate.y <= height - radius);
      candidates.sort((a, b) => distance(a, result) - distance(b, result));
      if (candidates[0]) { result = candidates[0]; moved = true; }
    }
    if (!moved) break;
  }
  return { x: clamp(result.x, radius, width - radius), y: clamp(result.y, radius, height - radius) };
}
