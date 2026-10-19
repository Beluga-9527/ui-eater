import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { gsap } from 'gsap';
import type { GameEngine } from '../game/engine';
import type { GameSnapshot, Point } from '../game/types';
import { WIDTH, HEIGHT } from '../game/levels';
import { STATE_LABELS } from '../game/stateMachine';
import Monster from './Monster';
import Icon from './Icon';

interface Props { game: GameSnapshot; engine: GameEngine; sync: () => void; onHelp: () => void; onToast: (text: string) => void }
type Drag = { kind: 'bait' | 'window'; id: string; offset: Point };

export default function Desktop({ game, engine, sync, onHelp, onToast }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const drag = useRef<Drag | null>(null);
  const effectId = useRef(0);
  const [job, setJob] = useState('一切准备就绪。大概吧。');
  useEffect(() => {
    const resize = new ResizeObserver(([entry]) => setScale(entry!.contentRect.width / WIDTH));
    if (host.current) resize.observe(host.current);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    const latest = game.effects.at(-1);
    if (latest && latest.id !== effectId.current && world.current) {
      effectId.current = latest.id;
      const particles = world.current.querySelectorAll(`[data-effect="${latest.id}"] i`);
      gsap.fromTo(particles, { x: 0, y: 0, rotation: 0, opacity: 1 }, {
        x: (i: number) => Math.cos(i * Math.PI / 4) * 52,
        y: (i: number) => Math.sin(i * Math.PI / 4) * 46 + 16,
        rotation: (i: number) => i % 2 ? 130 : -120, opacity: 0,
        duration: 0.8, ease: 'power2.out', stagger: 0.015,
      });
      // Shake without rewriting the responsive scale transform.
      gsap.fromTo(world.current, { marginLeft: -2 }, { marginLeft: 0, duration: 0.1, repeat: 3, yoyo: true });
    }
  }, [game.effects]);
  useEffect(() => { if (game.time === 0) { setJob('一切准备就绪。大概吧。'); effectId.current = 0; } }, [game.level, game.time]);
  const point = (event: ReactPointerEvent): Point => {
    const rect = host.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  };
  const startDrag = (event: ReactPointerEvent, kind: Drag['kind'], id: string, position: Point) => {
    if (game.paused || game.status !== 'playing' || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const cursor = point(event);
    drag.current = { kind, id, offset: { x: cursor.x - position.x, y: cursor.y - position.y } };
    host.current!.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent) => {
    const cursor = point(event);
    engine.setPointer(cursor);
    if (!drag.current) return;
    const { kind, id, offset } = drag.current;
    if (kind === 'bait') engine.moveBait(cursor.x - offset.x, cursor.y - offset.y);
    else engine.moveWindow(id, cursor.x - offset.x, cursor.y - offset.y);
    sync();
  };
  const finish = (event: ReactPointerEvent) => {
    drag.current = null;
    if (host.current?.hasPointerCapture(event.pointerId)) host.current.releasePointerCapture(event.pointerId);
  };
  return <div ref={host} className={`desktop-host ${game.paused ? 'is-paused' : ''}`} style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}
    onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={() => { drag.current = null; }} onPointerLeave={() => engine.setPointer(null)}>
    <div className="desktop-world" ref={world} style={{ width: WIDTH, height: HEIGHT, transform: `scale(${scale})` }} data-level={game.level}>
      <div className="wallpaper-word" aria-hidden="true">a little hungry.</div>
      <div className="desktop-icons">
        <button className="desktop-shortcut" onClick={onHelp}><span className="shortcut-file"><Icon name="file" size={31}/><i>?</i></span><span>说明书.txt</span></button>
        <button className="desktop-shortcut" onClick={() => onToast(`回收站里已经有 ${game.eaten} 个被吃掉的控件。`)}><span className="shortcut-folder"><Icon name="folder" size={39}/><i>×</i></span><span>回收站</span></button>
      </div>
      <div className="desktop-coordinate">WORKSPACE / 00{game.level}<br/><span>请勿投喂，除非你有计划。</span></div>
      <div className="desktop-note"><span>NOT A BUG.</span><span>IT’S A FEATURE<span className="note-star">✳</span></span><svg viewBox="0 0 125 45"><path d="M5 7 Q65 2 110 32 M96 29l17 6-2-17"/></svg></div>

      {game.windows.map(window => <section key={window.id} className={`game-window window-${window.kind} ${window.movable ? 'movable' : ''}`} style={{ left: window.x, top: window.y, width: window.w, height: window.h }} aria-label={window.title}>
        <div className="window-titlebar" onPointerDown={event => window.movable && startDrag(event, 'window', window.id, window)}>
          <span><Icon name={window.kind === 'shield' ? 'shield' : 'terminal'} size={14}/>{window.title}</span>
          <span className="window-tools">{window.movable ? <Icon name="grip" size={15}/> : <><Icon name="minus" size={13}/><Icon name="x" size={13}/></>}</span>
        </div>
        {window.kind === 'welcome' ? <div className="welcome-content"><div className="mini-app-icon"><Icon name="spark" size={24}/></div><div><h3>又是平静的一天。</h3><p>{job}</p></div></div> : window.kind === 'console' ? <div className="console-content"><span className="tiny-status"><i/> SYSTEM ONLINE</span><h3>保持连接，保持冷静。</h3><p>电源一旦被吞噬，捕获装置就会失效。</p></div> : <div className="shield-content"><Icon name="shield" size={36}/><b>防护窗口</b><span>拖动我，改变路线</span><div className="shield-stripes"/></div>}
      </section>)}

      {game.objects.filter(object => !object.eaten).map(object => <button key={object.id} className={`edible-button ${object.kind === 'critical' ? 'critical-button' : ''} ${object.id === 'start' ? 'primary-edible' : ''} ${game.targetId === object.id ? 'targeted' : ''}`} style={{ left: object.x, top: object.y, width: object.w, height: object.h }}
        disabled={game.paused || game.status !== 'playing'} onClick={() => { engine.attract(object.id); sync(); setJob(object.id === 'start' ? '工作启动了，怪物也注意到了。' : object.id === 'settings' ? '偏好已更新：请保护好你的按钮。' : `${object.label}：信号已发出。`); }}>
        {object.kind === 'critical' ? <Icon name="bolt" size={16}/> : object.id === 'start' ? <Icon name="play" size={14}/> : object.id === 'settings' ? <Icon name="settings" size={15}/> : null}{object.label}{object.id === 'start' && <Icon name="arrow-right" size={15}/>}
      </button>)}
      {game.objects.filter(object => object.eaten).map(object => <div className="eaten-hole" key={`hole-${object.id}`} style={{ left: object.x, top: object.y, width: object.w, height: object.h }}><span>404 · 被吃掉了</span></div>)}

      <div className={`capture-zone ${game.trap.occupied ? 'occupied' : ''} ${game.trap.closed ? 'closed' : ''}`} style={{ left: game.trap.x, top: game.trap.y, width: game.trap.w, height: game.trap.h }}>
        <span className="capture-label"><Icon name="crosshair" size={14}/> CAPTURE ZONE</span>
        <div className="zone-corners"><i/><i/><i/><i/></div><div className="capture-symbol"><Icon name="crosshair" size={50}/></div>
        <span className="zone-status">{game.status === 'won' ? '捕获成功！' : game.trap.closed ? '空笼 · 重新开启中' : game.trap.occupied ? '目标已进入 · 可以关门' : '把小家伙引到这里'}</span>
        {game.trap.closed && <div className="cage-bars"><i/><i/><i/><i/></div>}
      </div>
      <button className={`bait-button ${!game.bait.active ? 'bait-recharging' : ''}`} style={{ left: game.bait.x, top: game.bait.y }}
        aria-label="拖动诱饵按钮" title="拖动，或使用方向键移动诱饵" onPointerDown={event => startDrag(event, 'bait', 'bait', game.bait)} onClick={() => { engine.moveBait(game.bait.x, game.bait.y); sync(); }} onKeyDown={event => {
          const delta: Record<string, Point> = { ArrowLeft: {x:-24,y:0},ArrowRight:{x:24,y:0},ArrowUp:{x:0,y:-24},ArrowDown:{x:0,y:24} };
          const offset = delta[event.key]; if (offset) { event.preventDefault(); engine.moveBait(game.bait.x + offset.x, game.bait.y + offset.y); sync(); }
        }}><Icon name="grip" size={14}/><span>{game.bait.active ? '美味按钮' : '补充诱饵…'}</span><span className="bait-spark">✦</span></button>
      {game.time < 6 && game.eaten === 0 && <div className="bait-instruction" style={{left: game.bait.x - 15, top: game.bait.y + 56}}><svg viewBox="0 0 36 32"><path d="M30 29Q8 28 13 4m-8 8 9-9 7 9"/></svg><span>拖动我，带它去兜兜风</span></div>}

      <div className={`monster-entity state-${game.monster.state.toLowerCase()}`} style={{ left: game.monster.x - 43, top: game.monster.y - 50 }} role="img" aria-label={`怪物：${STATE_LABELS[game.monster.state]}`}>
        <div className="monster-bubble">{game.monster.state === 'EAT' ? 'NOM NOM!' : game.monster.state === 'ESCAPE' ? '别过来！' : game.monster.state === 'CAPTURED' ? '好吧…你赢了' : game.monster.state === 'CHASE' ? '闻起来不错…' : '肚子有点饿。'}</div>
        <Monster state={game.monster.state} facing={game.monster.facing}/><div className="monster-shadow"/>
      </div>
      {game.effects.map(effect => <div key={effect.id} data-effect={effect.id} className="eat-particles" style={{left:effect.x,top:effect.y}}>{Array.from({length:8},(_,i)=><i key={i}/>)}<span>CRUNCH!</span></div>)}
      <span className="desktop-watermark">UI EATER OS <span>v.1.0</span></span>
    </div>
  </div>;
}
