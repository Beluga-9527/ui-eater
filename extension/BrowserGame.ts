import { collectTargets, eligibleTarget, randomTarget } from './targets';
import { PageRestorer } from './restoration';
import { getEvolution } from './evolution';
import type { Action, ExtensionSnapshot, InteractionMode } from './protocol';

interface Point { x: number; y: number }
interface TargetRect extends Point { w: number; h: number }
export interface Crumb extends Point { id: number; age: number }
export interface BrowserSnapshot extends ExtensionSnapshot {
  position: Point;
  facing: 1 | -1;
  targetRect: TargetRect | null;
  message: string;
  crumbs: Crumb[];
  bait: (Point & { active: boolean }) | null;
  baitCooldown: number;
  reaction: 'happy' | 'evolving' | null;
  reactionId: number;
  time: number;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Viewport-local simulation; only the restorer alters host-page elements. */
export class BrowserGame {
  private status: ExtensionSnapshot['status'] = 'idle';
  private state: ExtensionSnapshot['state'] = 'IDLE';
  private position: Point = { x: 85, y: 180 };
  private facing: 1 | -1 = 1;
  private target: HTMLElement | null = null;
  private designatedTarget: HTMLElement | null = null;
  private previousTarget: HTMLElement | null = null;
  private chasingBait = false;
  private stateTime = 0;
  private eaten = 0;
  private baitEaten = 0;
  private bait: BrowserSnapshot['bait'] = null;
  private baitCooldown = 0;
  private interaction: InteractionMode = 'none';
  private dragging = false;
  private reaction: BrowserSnapshot['reaction'] = null;
  private reactionId = 0;
  private reactionTime = 0;
  private time = 0;
  private crumbs: Crumb[] = [];
  private crumbId = 0;
  private message = '点击开始，才会打扰这个网页。';
  private startedUrl = '';
  private frame = 0;
  private lastTime = 0;
  private lastPublish = 0;
  private restorer = new PageRestorer();
  private view: Window;
  private random: () => number;
  private autoFrame: boolean;

  constructor(private doc: Document, private host: HTMLElement, private onChange: (snapshot: BrowserSnapshot) => void,
    options: { autoFrame?: boolean; random?: () => number } = {}) {
    if (!doc.defaultView) throw new Error('A live document is required.');
    this.view = doc.defaultView;
    this.random = options.random ?? Math.random;
    this.autoFrame = options.autoFrame ?? true;
    this.view.addEventListener('pagehide', this.onPageHide);
  }

  getSnapshot(): BrowserSnapshot {
    let targetRect: TargetRect | null = null;
    let targetLabel: string | null = null;
    if (this.chasingBait && this.bait?.active) {
      targetRect = { x: this.bait.x - 15, y: this.bait.y - 15, w: 30, h: 30 };
      targetLabel = '营养诱饵';
    } else if (this.target?.isConnected) {
      const rect = this.target.getBoundingClientRect();
      targetRect = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      targetLabel = this.label(this.target);
    }
    return {
      status: this.status, eaten: this.eaten, state: this.state, target: targetLabel,
      evolution: getEvolution(this.eaten, this.baitEaten), baitEaten: this.baitEaten,
      interaction: this.interaction, dragging: this.dragging,
      position: { ...this.position }, facing: this.facing, targetRect, message: this.message,
      crumbs: this.crumbs.map(crumb => ({ ...crumb })), bait: this.bait ? { ...this.bait } : null,
      baitCooldown: this.baitCooldown, reaction: this.reaction, reactionId: this.reactionId, time: this.time,
    };
  }

  dispatch(action: Action): ExtensionSnapshot {
    switch (action) {
      case 'START': this.start(); break;
      case 'PAUSE': this.pause(); break;
      case 'RESUME': this.resume(); break;
      case 'STOP': this.stop(); break;
      case 'STATUS': break;
    }
    const { status, eaten, state, target, evolution, baitEaten, interaction, dragging } = this.getSnapshot();
    return { status, eaten, state, target, evolution, baitEaten, interaction, dragging };
  }

  start(): void {
    if (this.status === 'running') return;
    if (this.status === 'paused') { this.resume(); return; }
    this.status = 'running'; this.state = 'IDLE'; this.stateTime = 0;
    this.eaten = 0; this.baitEaten = 0; this.time = 0; this.crumbs = [];
    this.target = null; this.designatedTarget = null; this.previousTarget = null;
    this.chasingBait = false; this.bait = null; this.baitCooldown = 0;
    this.interaction = 'none'; this.dragging = false; this.reaction = null; this.reactionTime = 0;
    this.position = this.boundPosition({ x: 85, y: Math.max(100, this.view.innerHeight - 125) });
    this.startedUrl = this.view.location.href;
    this.message = '小家伙苏醒了，正在寻找第一口。';
    this.publish(); this.schedule();
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.clearGesture();
    this.status = 'paused'; this.message = '先歇一会儿，网页不会继续被吞噬。'; this.publish();
  }

  resume(): void {
    if (this.status !== 'paused') return;
    if (this.startedUrl !== this.view.location.href) { this.stop(); return; }
    this.status = 'running'; this.message = '开饭继续。随时可以停止并恢复网页。';
    this.lastTime = this.view.performance.now(); this.publish();
  }

  stop(): void {
    this.view.cancelAnimationFrame(this.frame); this.frame = 0;
    this.restorer.restoreAll();
    this.status = 'idle'; this.state = 'IDLE'; this.eaten = 0; this.baitEaten = 0;
    this.target = null; this.designatedTarget = null; this.previousTarget = null; this.crumbs = [];
    this.chasingBait = false; this.bait = null; this.baitCooldown = 0;
    this.dragging = false; this.interaction = 'none'; this.reaction = null; this.reactionTime = 0;
    this.time = 0; this.stateTime = 0; this.position = this.boundPosition(this.position);
    this.message = '已停止，网页元素已恢复。'; this.publish();
  }

  destroy(): void { this.stop(); this.view.removeEventListener('pagehide', this.onPageHide); }

  beginDrag(): void {
    if (!this.canInteract()) return;
    this.interaction = 'none'; this.dragging = true;
    this.target = null; this.chasingBait = false; this.transition('SEARCH');
    this.message = '抓到小家伙了。拖到哪里，就从哪里继续探险。'; this.publish();
  }

  dragTo(x: number, y: number): void {
    if (!this.dragging || !this.canInteract() || !Number.isFinite(x) || !Number.isFinite(y)) return;
    this.position = this.boundPosition({ x, y }); this.publish();
  }

  endDrag(): void {
    if (!this.dragging || !this.canInteract()) return;
    this.dragging = false; this.transition('SEARCH'); this.publish();
  }

  pet(): void {
    if (!this.canInteract()) return;
    if (this.reaction !== 'evolving') this.setReaction('happy', 1.2);
    this.message = '呼噜呼噜……摸摸很开心，吃东西才会长大。'; this.publish();
  }

  setInteraction(mode: InteractionMode): void {
    if (!this.canInteract()) return;
    this.clearGesture();
    if (mode === 'bait' && this.baitCooldown > 0) {
      this.message = '营养诱饵正在补充，稍等一下。'; this.publish(); return;
    }
    this.interaction = mode;
    this.message = mode === 'bait' ? '点击网页空白处，投下一颗营养诱饵。'
      : mode === 'target' ? '点击想让它吃掉的控件或文字。' : '继续自由探索。';
    this.publish();
  }

  placeBait(x: number, y: number): void {
    if (!this.canInteract() || this.baitCooldown > 0 || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const point = this.boundPosition({ x, y });
    this.clearGesture(); this.bait = { ...point, active: true };
    this.target = null; this.chasingBait = true; this.transition('CHASE');
    this.message = '新鲜诱饵！这一口不会破坏网页。'; this.publish();
  }

  directTarget(element: HTMLElement): boolean {
    if (!this.canInteract() || element.ownerDocument !== this.doc || !eligibleTarget(element, this.host) || this.restorer.has(element)) return false;
    this.clearGesture(); this.designatedTarget = element;
    this.target = this.bait?.active ? null : element;
    this.chasingBait = Boolean(this.bait?.active); this.transition('CHASE');
    this.message = '记住了，下一口是「' + this.label(element) + '」。'; this.publish(); return true;
  }

  /** Explicit stepping verifies timing and the manual-start gate without extension host APIs. */
  step(elapsed: number): void {
    if (this.status === 'idle') return;
    if (this.startedUrl !== this.view.location.href) { this.stop(); return; }
    if (this.status !== 'running' || this.doc.hidden || !Number.isFinite(elapsed) || elapsed <= 0) return;
    const dt = Math.min(elapsed, 0.05);
    this.time += dt;
    this.baitCooldown = Math.max(0, this.baitCooldown - dt);
    this.reactionTime = Math.max(0, this.reactionTime - dt);
    if (this.reactionTime === 0) this.reaction = null;
    this.crumbs = this.crumbs.map(crumb => ({ ...crumb, age: crumb.age + dt })).filter(crumb => crumb.age < 0.9);
    this.position = this.boundPosition(this.position);
    if (this.bait?.active) Object.assign(this.bait, this.boundPosition(this.bait));
    if (this.dragging || this.interaction !== 'none') return;
    this.stateTime += dt;
    if (this.designatedTarget && !this.isTargetValid(this.designatedTarget)) this.designatedTarget = null;
    if (this.target && !this.isTargetValid(this.target)) { this.target = null; this.transition('SEARCH'); }
    if (this.chasingBait && !this.bait?.active) { this.chasingBait = false; this.transition('SEARCH'); }

    switch (this.state) {
      case 'IDLE':
        if (this.stateTime > 0.9) this.transition('SEARCH');
        break;
      case 'SEARCH': {
        if (this.stateTime < 0.2) break;
        this.chasingBait = Boolean(this.bait?.active);
        this.target = this.chasingBait ? null : this.designatedTarget
          ?? randomTarget(collectTargets(this.doc, this.host).filter(element => !this.restorer.has(element)), this.previousTarget, this.random);
        if (this.target || this.chasingBait) {
          this.message = this.chasingBait ? '闻到营养诱饵的香味了。' : '下一口：' + this.label(this.target!);
          this.transition('CHASE');
        } else { this.message = '附近暂时没有可吃的元素，试着滚动一下网页。'; this.transition('IDLE'); }
        break;
      }
      case 'CHASE': {
        const destination = this.destination();
        if (!destination) { this.transition('SEARCH'); break; }
        const dx = destination.x - this.position.x, dy = destination.y - this.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 12) { this.transition('EAT'); break; }
        const length = Math.min(distance, 175 * dt);
        this.position.x += dx / distance * length; this.position.y += dy / distance * length;
        if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1;
        if (this.stateTime > 12 && !this.designatedTarget && !this.chasingBait) {
          this.previousTarget = this.target; this.target = null; this.transition('SEARCH');
        }
        break;
      }
      case 'EAT': {
        const destination = this.destination();
        if (!destination) { this.transition('SEARCH'); break; }
        if (Math.hypot(destination.x - this.position.x, destination.y - this.position.y) > 38) { this.transition('CHASE'); break; }
        if (this.stateTime < 0.75) break;
        const stage = getEvolution(this.eaten, this.baitEaten).stage;
        let consumed = false;
        if (this.chasingBait && this.bait?.active) {
          this.bait.active = false; this.baitEaten++; this.baitCooldown = 3; consumed = true;
          this.message = '啊呜！营养诱饵 +1，不用担心网页。';
        } else if (this.target && this.restorer.eat(this.target)) {
          this.eaten++; consumed = true; this.message = '咔嚓！吃掉了「' + this.label(this.target) + '」。';
          if (this.target === this.designatedTarget) this.designatedTarget = null;
        }
        if (consumed) {
          this.crumbs.push({ ...this.position, id: ++this.crumbId, age: 0 });
          const evolution = getEvolution(this.eaten, this.baitEaten);
          if (evolution.stage > stage) { this.setReaction('evolving', 1.8); this.message = '进化了！现在是「' + evolution.name + '」。'; }
          this.position = this.boundPosition(this.position);
        }
        if (!this.chasingBait) this.previousTarget = this.target;
        this.target = null; this.chasingBait = false; this.transition('IDLE');
        break;
      }
    }
  }

  private canInteract(): boolean {
    if (this.status !== 'idle' && this.startedUrl !== this.view.location.href) { this.stop(); return false; }
    return this.status === 'running' && !this.doc.hidden;
  }
  private clearGesture(): void {
    if (this.dragging) this.transition('SEARCH');
    this.dragging = false; this.interaction = 'none';
  }
  private isTargetValid(element: HTMLElement): boolean {
    return element.ownerDocument === this.doc && eligibleTarget(element, this.host) && !this.restorer.has(element);
  }
  private boundPosition(point: Point): Point {
    const scale = getEvolution(this.eaten, this.baitEaten).scale;
    return {
      x: clamp(point.x, 56 * scale, Math.max(56 * scale, this.view.innerWidth - 56 * scale)),
      y: clamp(point.y, 67 * scale, Math.max(67 * scale, this.view.innerHeight - 50 * scale)),
    };
  }
  private destination(): Point | null {
    if (this.chasingBait && this.bait?.active) return this.boundPosition(this.bait);
    if (!this.target) return null;
    const rect = this.target.getBoundingClientRect();
    return this.boundPosition({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  }
  private setReaction(reaction: NonNullable<BrowserSnapshot['reaction']>, seconds: number): void {
    this.reaction = reaction; this.reactionTime = seconds; this.reactionId++;
  }
  private label(element: HTMLElement): string {
    return (element.getAttribute('aria-label') || element.getAttribute('alt') || element.textContent || element.tagName.toLowerCase()).trim().replace(/\s+/g,' ').slice(0,36) || element.tagName.toLowerCase();
  }
  private transition(state: ExtensionSnapshot['state']): void { this.state = state; this.stateTime = 0; }
  private publish(): void { this.onChange(this.getSnapshot()); }
  private onPageHide = (): void => { this.stop(); };
  private schedule(): void {
    if (!this.autoFrame || this.frame) return;
    this.lastTime = this.view.performance.now(); this.lastPublish = this.lastTime;
    const tick = (now: number) => {
      this.frame = 0;
      this.step((now - this.lastTime) / 1000); this.lastTime = now;
      if (this.status === 'idle') return;
      if (now - this.lastPublish >= 1000 / 30) { this.publish(); this.lastPublish = now; }
      this.frame = this.view.requestAnimationFrame(tick);
    };
    this.frame = this.view.requestAnimationFrame(tick);
  }
}
