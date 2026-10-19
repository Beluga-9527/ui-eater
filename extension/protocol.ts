/** Messages stay inside the extension and the active tab. */
import { getEvolution } from './evolution';
import type { EvolutionProgress } from './evolution';
export type { EvolutionProgress } from './evolution';

export const CHANNEL = 'UI_EATER' as const;

export type Action = 'STATUS' | 'START' | 'PAUSE' | 'RESUME' | 'STOP';
export type InteractionMode = 'none' | 'bait' | 'target';

export interface ExtensionMessage {
  channel: typeof CHANNEL;
  action: Action;
}

export interface ExtensionSnapshot {
  status: 'idle' | 'running' | 'paused';
  eaten: number;
  state: 'IDLE' | 'SEARCH' | 'CHASE' | 'EAT';
  target: string | null;
  evolution: EvolutionProgress;
  baitEaten: number;
  interaction: InteractionMode;
  dragging: boolean;
}

export interface ExtensionResponse {
  ok: boolean;
  snapshot?: ExtensionSnapshot;
  error?: string;
}

export const IDLE_SNAPSHOT: ExtensionSnapshot = {
  status: 'idle',
  eaten: 0,
  state: 'IDLE',
  target: null,
  evolution: getEvolution(0),
  baitEaten: 0,
  interaction: 'none',
  dragging: false,
};
