import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import Monster from '../src/components/Monster';
import Icon from '../src/components/Icon';
import type { BrowserSnapshot } from './BrowserGame';
import { BrowserGame } from './BrowserGame';
import { foodAtPoint } from './interactions';

interface Hover { x: number; y: number; w: number; h: number; valid: boolean }
interface Drag { offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean }

export default function Overlay({ game, controller, host }: { game: BrowserSnapshot; controller: BrowserGame; host: HTMLElement }) {
  const [hover,setHover] = useState<Hover | null>(null);
  const drag = useRef<Drag | null>(null);
  const running = game.status === 'running';
  const evolution = game.evolution;
  const size = evolution.scale;
  useEffect(()=>{ setHover(null); },[game.interaction]);
  useEffect(()=>{ if (!running || !game.dragging) drag.current=null; },[running,game.dragging]);
  if (game.status === 'idle') return null;

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!running || game.interaction !== 'none' || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    drag.current={offsetX:event.clientX-game.position.x,offsetY:event.clientY-game.position.y,startX:event.clientX,startY:event.clientY,moved:false};
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.beginDrag();
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    event.preventDefault(); event.stopPropagation();
    const record=drag.current;
    if (Math.hypot(event.clientX-record.startX,event.clientY-record.startY)>4) record.moved=true;
    controller.dragTo(event.clientX-record.offsetX,event.clientY-record.offsetY);
  };
  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>,cancelled=false) => {
    const record=drag.current;
    if (!record) return;
    drag.current=null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    controller.endDrag();
    if (!record.moved && !cancelled) controller.pet();
  };
  const preview = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (game.interaction === 'bait') { setHover({x:event.clientX,y:event.clientY,w:0,h:0,valid:true}); return; }
    const target=foodAtPoint(host.ownerDocument,host,event.clientX,event.clientY);
    if (!target) { setHover({x:event.clientX,y:event.clientY,w:0,h:0,valid:false}); return; }
    const rect=target.getBoundingClientRect();
    setHover({x:rect.x,y:rect.y,w:rect.width,h:rect.height,valid:true});
  };
  const selectAt = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation();
    if (!running || event.button !== 0) return;
    if (game.interaction === 'bait') controller.placeBait(event.clientX,event.clientY);
    else {
      const target=foodAtPoint(host.ownerDocument,host,event.clientX,event.clientY);
      if (target) controller.directTarget(target);
    }
  };
  const toggleMode = (mode: 'bait'|'target') => controller.setInteraction(game.interaction===mode?'none':mode);

  return <div className={`eater-world ${!running?'paused':''} ${game.interaction!=='none'?'choosing':''}`} onClick={event=>event.stopPropagation()}>
    <section className="control-dock" aria-label="UI EATER 游戏控制台" data-ui-eater-protect="true">
      <div className="dock-title"><span className="dock-brand">UI EATER<span>®</span></span><span className="dock-live"><i/>{!running?'PAUSED':game.dragging?'HELD':game.interaction!=='none'?'AIMING':'PLAYING'}</span><button className="dock-pause" onClick={()=>controller.dispatch(running?'PAUSE':'RESUME')} aria-label={running?'暂停吞噬':'继续吞噬'} title={running?'暂停吞噬':'继续吞噬'}><Icon name={running?'pause':'play'} size={15}/></button></div>
      <div className="evolution-panel"><div className={`stage-icon stage-${evolution.stage}`}><Icon name={evolution.stage===4?'spark':'bolt'} size={17}/></div><div className="evolution-copy"><div><strong>{evolution.name}</strong><span>LV.{evolution.stage+1}</span></div><div className="evolution-track" role="progressbar" aria-label="进化进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(evolution.progress*100)}><i style={{width:`${evolution.progress*100}%`}}/></div><small>{evolution.nextThreshold===null?'已达最终形态 · 继续享受网页自助餐':`再吃 ${evolution.nextThreshold-evolution.xp} 口，解锁下一种形态`}<b>{evolution.xp}{evolution.nextThreshold===null?' XP':` / ${evolution.nextThreshold}`}</b></small></div></div>
      <div className="interaction-tools"><button className={game.interaction==='bait'?'selected':''} disabled={!running || game.baitCooldown>0} aria-pressed={game.interaction==='bait'} onClick={()=>toggleMode('bait')}><span className="food-symbol">✦</span>{game.baitCooldown>0?`补充中 ${Math.ceil(game.baitCooldown)}s`:'投喂诱饵'}</button><button className={game.interaction==='target'?'selected':''} disabled={!running} aria-pressed={game.interaction==='target'} onClick={()=>toggleMode('target')}><Icon name="crosshair" size={14}/>指定下一口</button></div>
      <div className="dock-message" role="status">{game.message}</div>
      <div className="dock-content"><span className="dock-count"><b>{String(game.eaten).padStart(2,'0')}</b> 网页元素 <span className="food-count">+ {game.baitEaten} 份诱饵</span></span><button className="dock-restore" onClick={()=>controller.dispatch('STOP')}><Icon name="restart" size={12}/>停止并恢复</button></div>
      <div className="dock-tip"><Icon name="mouse" size={12}/>拖动小怪物换位置 · 轻点摸摸它</div>
    </section>
    {game.interaction!=='none' && running && <><div className={`interaction-catcher mode-${game.interaction}`} aria-label={game.interaction==='bait'?'点击网页放置诱饵':'点击选择下一口网页元素'} onPointerMove={preview} onPointerLeave={()=>setHover(null)} onPointerDown={event=>{if(event.button===0){event.preventDefault();event.stopPropagation();}}} onClick={selectAt}/><div className="mode-instruction"><Icon name={game.interaction==='bait'?'spark':'crosshair'} size={16}/>{game.interaction==='bait'?'在网页空白处点一下，放下这份诱饵。':'点击高亮的网页元素，让它成为下一口。'}<button onClick={()=>controller.setInteraction('none')} aria-label="取消选择">取消<kbd>Esc</kbd></button></div></>}
    {hover && game.interaction==='target' && hover.valid && <div className="target-mark pick-preview" style={{left:hover.x-4,top:hover.y-4,width:hover.w+8,height:hover.h+8}}><span>就吃这个！</span><i/><i/><i/><i/></div>}
    {hover && game.interaction==='bait' && <div className="food-ghost" style={{left:hover.x,top:hover.y}}>✦</div>}
    {game.targetRect && running && game.interaction==='none' && !game.dragging && <div className={`target-mark ${game.state==='EAT'?'biting':''}`} style={{left:game.targetRect.x-4,top:game.targetRect.y-4,width:game.targetRect.w+8,height:game.targetRect.h+8}}><i/><i/><i/><i/></div>}
    {game.bait?.active && <div className="page-food" role="img" aria-label="已投放的诱饵" style={{left:game.bait.x,top:game.bait.y}}><span>✦</span><small>美味小点心</small></div>}
    <button className={`page-monster state-${game.state.toLowerCase()} ${game.dragging?'held':''} ${game.reaction==='evolving'?'is-evolving':''}`} style={{left:game.position.x-43*size,top:game.position.y-51*size,width:86*size,height:96*size,'--creature-scale':size} as CSSProperties} disabled={!running} aria-label="拖动小怪物，轻点摸摸" title="拖动换位置 · 轻点摸摸 · 方向键移动" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={event=>finishDrag(event)} onPointerCancel={event=>finishDrag(event,true)} onLostPointerCapture={()=>{if(drag.current){drag.current=null;controller.endDrag();}}} onClick={event=>{event.preventDefault();event.stopPropagation();if(event.detail===0)controller.pet();}} onKeyDown={event=>{
      const movement:Record<string,[number,number]>={ArrowLeft:[-25,0],ArrowRight:[25,0],ArrowUp:[0,-25],ArrowDown:[0,25]};
      const offset=movement[event.key];if(offset){event.preventDefault();event.stopPropagation();controller.beginDrag();controller.dragTo(game.position.x+offset[0],game.position.y+offset[1]);controller.endDrag();}
    }}>
      <span className="page-bubble">{!running?'等会儿再吃。':game.dragging?'带我去哪儿？':game.reaction==='evolving'?'我进化啦！':game.reaction==='happy'?'嘿嘿，好舒服 ♡':game.state==='EAT'?'NOM NOM!':game.state==='CHASE'?'这口看起来不错…':'下一个吃什么？'}</span><Monster state={game.state} facing={game.facing} evolutionStage={evolution.stage} mood={game.reaction}/>
      {game.reaction==='happy' && <span key={game.reactionId} className="pet-hearts" aria-hidden="true"><i>♥</i><i>♡</i><i>♥</i></span>}
      {game.reaction==='evolving' && <span key={game.reactionId} className="evolution-ring" aria-hidden="true"/>}
    </button>
    {game.reaction==='evolving' && <div className="evolution-toast" role="status" key={`evolve-${game.reactionId}`}><Icon name="spark" size={18}/><span>进化成功！<b>{evolution.name}</b></span><small>形态、颜色、体型都升级了</small></div>}
    {game.crumbs.map(crumb=><div className="page-crumbs" key={crumb.id} style={{left:crumb.x,top:crumb.y}}><span>CRUNCH!</span>{Array.from({length:8},(_,i)=><i key={i} style={{'--dx':`${Math.cos(i*Math.PI/4)*50}px`,'--dy':`${Math.sin(i*Math.PI/4)*45}px`,'--r':`${i*45}deg`} as CSSProperties}/>)}</div>)}
  </div>;
}
