export type EvolutionStage = 0 | 1 | 2 | 3 | 4;

export interface EvolutionProgress {
  stage: EvolutionStage;
  name: string;
  threshold: number;
  nextThreshold: number | null;
  progress: number;
  xp: number;
  scale: number;
  hue: number;
  body: 'seed' | 'sprout' | 'horned' | 'winged' | 'crowned';
}

const STAGES = [
  { name: '饥饿幼崽', threshold: 0, scale: 1, hue: 0, body: 'seed' },
  { name: '萌芽小兽', threshold: 3, scale: 1.13, hue: 45, body: 'sprout' },
  { name: '角角大胃王', threshold: 7, scale: 1.28, hue: 130, body: 'horned' },
  { name: '飞翼吞吞', threshold: 12, scale: 1.45, hue: 200, body: 'winged' },
  { name: '桌面吞噬王', threshold: 18, scale: 1.65, hue: 270, body: 'crowned' },
] as const;

const count = (value: number) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** Food from the page and renewable bait have equal nutritional value. */
export function getEvolution(eaten: number, baitEaten = 0): EvolutionProgress {
  const xp = count(eaten) + count(baitEaten);
  let stage: EvolutionStage = 0;
  for (let index = 1; index < STAGES.length; index++) {
    if (xp >= STAGES[index]!.threshold) stage = index as EvolutionStage;
  }
  const current = STAGES[stage];
  const nextThreshold = STAGES[stage + 1]?.threshold ?? null;
  return {
    ...current, stage, xp, nextThreshold,
    progress: nextThreshold === null ? 1 : (xp - current.threshold) / (nextThreshold - current.threshold),
  };
}
