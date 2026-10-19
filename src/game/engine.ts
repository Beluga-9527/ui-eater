import { center, clamp, contains, distance, nextWaypoint, resolveObstacles } from './collision';
import { BAIT_HEIGHT, BAIT_WIDTH, getLevel, HEIGHT, MONSTER_RADIUS, TRAP, WIDTH } from './levels';
import { moveUIWindow, obstaclesFor } from './objects';
import { chooseTarget, shouldEscape } from './stateMachine';
import type { GameSnapshot, LevelId, MonsterState, Point, Target } from './types';

/** Pure simulation: React and requestAnimationFrame only supply input and elapsed time. */
export class GameEngine {
  private game!: GameSnapshot;
  private snapshot!: GameSnapshot;
  private stateTime = 0;
  private target: Target | null = null;
  private pointer: Point | null = null;
  private attractedId: string | null = null;
  private attractedUntil = 0;
  private baitScentUntil = 0;
  private baitReturnsAt = 0;
  private effectId = 0;

  constructor(level: LevelId = 1) { this.setLevel(level); }

  getSnapshot(): GameSnapshot { return this.snapshot; }

  setLevel(level: LevelId): void {
    const config = getLevel(level);
    this.game = {
      level, status: 'playing', paused: false, time: 0, eaten: 0, attempts: 3,
      monster: { ...config.spawn, state: 'IDLE', facing: 1 },
      bait: { x: 530, y: 432, active: true },
      windows: config.windows.map((window) => ({ ...window })),
      objects: config.objects.map((object) => ({ ...object })),
      trap: { ...TRAP, occupied: false, closed: false, cooldown: 0 },
      message: config.hint, targetId: null, effects: [],
    };
    this.stateTime = 0;
    this.target = null;
    this.pointer = null;
    this.attractedId = null;
    this.attractedUntil = 0;
    this.baitScentUntil = 0;
    this.baitReturnsAt = 0;
    this.publish();
  }

  restart(): void { this.setLevel(this.game.level); }

  togglePause(): void {
    if (this.game.status !== 'playing') return;
    this.game.paused = !this.game.paused;
    this.publish();
  }

  setPointer(pointer: Point | null): void {
    this.pointer = pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y) ? { ...pointer } : null;
  }

  moveBait(x: number, y: number): void {
    if (!this.canInteract() || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.game.bait.x = clamp(x, 12, WIDTH - BAIT_WIDTH - 12);
    this.game.bait.y = clamp(y, 34, HEIGHT - BAIT_HEIGHT - 12);
    this.game.bait.active = true;
    this.baitScentUntil = this.game.time + 14;
    this.attractedId = null;
    this.baitReturnsAt = 0;
    // Dragging continuously must not reset CHASE each frame and freeze the monster.
    if (this.game.monster.state === 'EAT' || this.game.monster.state === 'IDLE') {
      this.target = null;
      this.transition('SEARCH');
    }
    this.game.message = '诱饵散发出香味……把光标移开，等它跟上来。';
    this.publish();
  }

  moveWindow(id: string, x: number, y: number): void {
    if (!this.canInteract() || !moveUIWindow(this.game.windows, this.game.objects, id, x, y)) return;
    const position = resolveObstacles(this.game.monster, obstaclesFor(this.game.windows), MONSTER_RADIUS, WIDTH, HEIGHT);
    Object.assign(this.game.monster, position);
    // Objects and routes may have moved during CHASE or EAT.
    if (this.game.monster.state === 'EAT') {
      this.target = null;
      this.transition('SEARCH');
    }
    this.refreshTrap();
    this.publish();
  }

  attract(id: string): void {
    if (!this.canInteract() || !this.game.objects.some((object) => object.id === id && !object.eaten)) return;
    this.attractedId = id;
    this.attractedUntil = this.game.time + 5;
    this.baitScentUntil = 0;
    this.target = null;
    this.transition('SEARCH');
    this.game.message = '咔哒！按钮的声音引起了它的注意。';
    this.publish();
  }

  closeTrap(): void {
    if (!this.canInteract() || this.game.trap.cooldown > 0) return;
    this.refreshTrap();
    this.game.trap.closed = true;
    if (this.game.trap.occupied) {
      this.game.status = 'won';
      this.transition('CAPTURED');
      this.target = null;
      this.game.targetId = null;
      this.game.message = '捕获成功！你的桌面暂时安全了。';
    } else {
      this.game.trap.cooldown = 1.25;
      if (this.game.level === 3) this.game.attempts--;
      this.game.message = this.game.level === 3
        ? `笼子里还是空的！剩余 ${this.game.attempts} 次关门机会。`
        : '还差一点！等怪物整个进入绿色捕获区域，再关闭笼门。';
      if (this.game.attempts === 0) {
        this.game.status = 'lost';
        this.game.message = '捕获装置的能量耗尽了。重启关卡，再试一次。';
      }
    }
    this.publish();
  }

  step(elapsed: number): void {
    if (!this.canInteract() || !Number.isFinite(elapsed) || elapsed <= 0) return;
    // A backgrounded tab must not teleport the monster when it resumes.
    const dt = Math.min(elapsed, 0.05);
    this.game.time += dt;
    this.stateTime += dt;
    this.game.effects = this.game.effects.filter((effect) => this.game.time - effect.time < 1.4);
    if (this.attractedId && this.game.time > this.attractedUntil) this.attractedId = null;
    if (!this.game.bait.active && this.game.time >= this.baitReturnsAt) this.game.bait.active = true;
    if (this.game.trap.cooldown > 0) {
      this.game.trap.cooldown = Math.max(0, this.game.trap.cooldown - dt);
      if (this.game.trap.cooldown === 0) this.game.trap.closed = false;
    }

    switch (this.game.monster.state) {
      case 'IDLE': {
        if (this.stateTime > 0.8) {
          const spawn = getLevel(this.game.level).spawn;
          this.moveToward({ x: spawn.x + Math.sin(this.game.time * 0.9) * 25, y: spawn.y + Math.cos(this.game.time * 0.9) * 12 }, dt, 0.28);
        }
        if (this.stateTime >= 3.6) this.transition('SEARCH');
        break;
      }
      case 'SEARCH': {
        this.target = chooseTarget(this.game, this.attractedId, this.baitScentUntil);
        if (this.target) this.transition(shouldEscape(this.game, this.pointer, this.target) ? 'ESCAPE' : 'CHASE');
        else if (this.stateTime > 0.5) this.transition('IDLE');
        break;
      }
      case 'CHASE': {
        this.target = chooseTarget(this.game, this.attractedId, this.baitScentUntil);
        if (!this.target) { this.transition('SEARCH'); break; }
        if (shouldEscape(this.game, this.pointer, this.target)) { this.transition('ESCAPE'); break; }
        this.moveToward(this.target, dt);
        if (distance(this.game.monster, this.target) < 22) this.transition('EAT');
        break;
      }
      case 'EAT': {
        if (this.target && distance(this.game.monster, this.target) > 38) this.transition('SEARCH');
        else if (this.stateTime >= 0.72) this.eatTarget();
        break;
      }
      case 'ESCAPE': {
        this.target = chooseTarget(this.game, this.attractedId, this.baitScentUntil);
        if (!shouldEscape(this.game, this.pointer, this.target) || this.stateTime > 0.85) {
          this.transition('CHASE');
          break;
        }
        if (this.pointer) {
          const direction = Math.atan2(this.game.monster.y - this.pointer.y, this.game.monster.x - this.pointer.x);
          this.moveToward({
            x: clamp(this.game.monster.x + Math.cos(direction) * 130, MONSTER_RADIUS, WIDTH - MONSTER_RADIUS),
            y: clamp(this.game.monster.y + Math.sin(direction) * 130, MONSTER_RADIUS, HEIGHT - MONSTER_RADIUS),
          }, dt, 1.3);
        }
        break;
      }
      case 'CAPTURED': break;
    }
    this.game.targetId = this.target?.id ?? null;
    this.refreshTrap();
    this.publish();
  }

  private canInteract(): boolean { return this.game.status === 'playing' && !this.game.paused; }

  private transition(state: MonsterState): void {
    this.game.monster.state = state;
    this.stateTime = 0;
  }

  private moveToward(target: Point, dt: number, multiplier = 1): void {
    const waypoint = nextWaypoint(this.game.monster, target, obstaclesFor(this.game.windows), WIDTH, HEIGHT, MONSTER_RADIUS);
    const remaining = distance(this.game.monster, waypoint);
    if (remaining < 0.01) return;
    const step = Math.min(getLevel(this.game.level).speed * multiplier * dt, remaining);
    const dx = (waypoint.x - this.game.monster.x) / remaining * step;
    const dy = (waypoint.y - this.game.monster.y) / remaining * step;
    this.game.monster.x = clamp(this.game.monster.x + dx, MONSTER_RADIUS, WIDTH - MONSTER_RADIUS);
    this.game.monster.y = clamp(this.game.monster.y + dy, MONSTER_RADIUS, HEIGHT - MONSTER_RADIUS);
    if (Math.abs(dx) > 0.01) this.game.monster.facing = dx < 0 ? -1 : 1;
  }

  private eatTarget(): void {
    if (!this.target) { this.transition('SEARCH'); return; }
    if (this.target.kind === 'bait') {
      this.game.bait.active = false;
      this.baitReturnsAt = this.game.time + 3.2;
      this.game.message = '诱饵被吃掉了！稍等片刻会自动补充，也可以立即拖动补充。';
    } else {
      const object = this.game.objects.find((entry) => entry.id === this.target!.id && !entry.eaten);
      if (object) {
        object.eaten = true;
        this.game.eaten++;
        this.game.effects.push({ ...center(object), id: ++this.effectId, label: object.label, time: this.game.time });
        this.game.message = `「${object.label}」被吃掉了。它现在真的不能用了。`;
        if (object.kind === 'critical') {
          this.game.status = 'lost';
          this.game.message = '捕获电源被吞掉了！重启关卡，试着把控制台移远一点。';
        }
      }
    }
    this.target = null;
    this.transition('SEARCH');
  }

  private refreshTrap(): void {
    this.game.trap.occupied = contains(this.game.trap, this.game.monster, MONSTER_RADIUS);
  }

  private publish(): void {
    // Consumers may retain a frame for transitions; simulation never mutates old frames.
    this.snapshot = {
      ...this.game,
      monster: { ...this.game.monster }, bait: { ...this.game.bait }, trap: { ...this.game.trap },
      windows: this.game.windows.map((window) => ({ ...window })),
      objects: this.game.objects.map((object) => ({ ...object })),
      effects: this.game.effects.map((effect) => ({ ...effect })),
    };
  }
}
