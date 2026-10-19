export type LevelId = 1 | 2 | 3;
export type MonsterState = 'IDLE' | 'SEARCH' | 'CHASE' | 'EAT' | 'ESCAPE' | 'CAPTURED';
export type GameStatus = 'playing' | 'won' | 'lost';

export interface Point { x: number; y: number }
export interface Rect extends Point { w: number; h: number }

export interface GameWindow extends Rect {
  id: string;
  title: string;
  kind: 'welcome' | 'console' | 'shield';
  movable: boolean;
}

export interface UIObject extends Rect {
  id: string;
  windowId?: string;
  label: string;
  kind: 'button' | 'critical';
  eaten: boolean;
}

export interface Monster extends Point {
  state: MonsterState;
  facing: 1 | -1;
}

export interface EatEffect extends Point {
  id: number;
  label: string;
  /** Simulation time at which the object was eaten. */
  time: number;
}

export interface GameSnapshot {
  level: LevelId;
  status: GameStatus;
  paused: boolean;
  time: number;
  eaten: number;
  attempts: number;
  monster: Monster;
  bait: Point & { active: boolean };
  windows: GameWindow[];
  objects: UIObject[];
  trap: Rect & { occupied: boolean; closed: boolean; cooldown: number };
  message: string;
  targetId: string | null;
  effects: EatEffect[];
}

export interface LevelConfig {
  id: LevelId;
  name: string;
  subtitle: string;
  description: string;
  objectives: string[];
  hint: string;
  speed: number;
  spawn: Point;
  windows: GameWindow[];
  objects: UIObject[];
}

export interface Target extends Point {
  id: string;
  kind: 'bait' | 'button' | 'critical';
}
