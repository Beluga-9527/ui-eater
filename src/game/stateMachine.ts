import { center, contains, distance } from './collision';
import { BAIT_HEIGHT, BAIT_WIDTH } from './levels';
import type { GameSnapshot, Point, Target } from './types';

export const STATE_LABELS = {
  IDLE: '正在苏醒', SEARCH: '寻找零食', CHASE: '发现目标',
  EAT: '嚼嚼嚼', ESCAPE: '别碰我！', CAPTURED: '捕获成功',
} as const;

export function chooseTarget(snapshot: GameSnapshot, attractedId: string | null, baitScentUntil: number): Target | null {
  const { monster, bait, objects, time } = snapshot;
  const baitCenter = { x: bait.x + BAIT_WIDTH / 2, y: bait.y + BAIT_HEIGHT / 2 };
  if (bait.active && time < baitScentUntil) {
    return { ...baitCenter, id: 'bait', kind: 'bait' };
  }
  const candidates = objects.filter((object) => !object.eaten);
  const attracted = candidates.find((object) => object.id === attractedId);
  if (attracted) return { ...center(attracted), id: attracted.id, kind: attracted.kind };
  if (bait.active && distance(monster, baitCenter) < 280) {
    return { ...baitCenter, id: 'bait', kind: 'bait' };
  }
  const target = candidates.sort((a, b) => distance(monster, center(a)) - distance(monster, center(b)))[0];
  if (target) return { ...center(target), id: target.id, kind: target.kind };
  return bait.active ? { ...baitCenter, id: 'bait', kind: 'bait' } : null;
}

export function shouldEscape(snapshot: GameSnapshot, pointer: Point | null, target: Target | null): boolean {
  if (snapshot.level !== 3 || !pointer || distance(snapshot.monster, pointer) > 98) return false;
  // A tasty lure in the cage wins over fear, so cursor avoidance cannot make capture impossible.
  if (target?.kind === 'bait' && contains(snapshot.trap, target)) return false;
  return true;
}
