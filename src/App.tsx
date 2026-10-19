import { useEffect, useRef, useState } from 'react';
import { LEVELS } from './game/levels';
import type { LevelId } from './game/types';
import { useGame } from './game/useGame';
import { playSound } from './game/sound';
import { STATE_LABELS } from './game/stateMachine';
import Desktop from './components/Desktop';
import Monster from './components/Monster';
import Icon from './components/Icon';

function readCompleted(): number[] { try { const data: unknown = JSON.parse(localStorage.getItem('ui-eater-completed') || '[]'); return Array.isArray(data) ? data.filter(n => [1,2,3].includes(n)) : []; } catch { return []; } }
const formatTime = (seconds: number) => `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;

export default function App() {
  const { game, engine, sync } = useGame();
  const [completed, setCompleted] = useState<number[]>(readCompleted);
  const [sound, setSound] = useState(false);
  const [guide, setGuide] = useState(false);
  const [toast, setToast] = useState('');
  const [hint, setHint] = useState(false);
  const previous = useRef({ eaten: 0, status: 'playing', level: 1 });
  const pauseBeforeGuide = useRef(false);
  const config = LEVELS[game.level - 1]!;
  const act = (fn: () => void) => { fn(); sync(); playSound('click', sound); };
  const restart = () => { setHint(false); act(() => engine.restart()); };
  const selectLevel = (level: LevelId) => { setHint(false); act(() => engine.setLevel(level)); };
  const closeTrap = () => act(() => engine.closeTrap());
  const openGuide = () => { pauseBeforeGuide.current = engine.getSnapshot().paused; if (!pauseBeforeGuide.current && engine.getSnapshot().status === 'playing') engine.togglePause(); sync(); setGuide(true); };
  const closeGuide = () => { setGuide(false); if (!pauseBeforeGuide.current && engine.getSnapshot().paused) engine.togglePause(); sync(); };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input,textarea,select') || event.repeat) return;
      if (guide) { if (event.key === 'Escape') closeGuide(); return; }
      if (event.code === 'Space') { event.preventDefault(); closeTrap(); }
      if (event.code === 'KeyP' || event.key === 'Escape') { event.preventDefault(); act(() => engine.togglePause()); }
      if (event.code === 'KeyR') { event.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });
  useEffect(() => {
    if (game.eaten > previous.current.eaten) playSound('eat', sound);
    if (game.status === 'won' && previous.current.status !== 'won') {
      playSound('win', sound);
      setCompleted(old => { const next = [...new Set([...old, game.level])]; try { localStorage.setItem('ui-eater-completed', JSON.stringify(next)); } catch { /* Progress remains available in this session. */ } return next; });
    }
    previous.current = { eaten:game.eaten,status:game.status,level:game.level };
  }, [game.eaten,game.status,game.level,sound]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); },[toast]);
  const fullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setToast('当前预览暂不支持全屏，可在新标签页中打开游戏。'); }
  };
  return <div className="app-shell">
    <header className="site-header">
      <a className="brand" href="#" aria-label="UI EATER 首页" onClick={event => { event.preventDefault(); selectLevel(1); }}><div className="brand-monster"><Monster state="IDLE"/></div><span>UI EATER<span className="brand-dot">®</span><small>吞噬 UI 的怪物</small></span></a>
      <span className="header-tagline">你的桌面，它的自助餐。</span>
      <div className="header-actions"><span className="sandbox-tag"><span/>安全沙盒内运行</span><button className="icon-button" aria-label={sound ? '关闭声音' : '开启声音'} title={sound ? '关闭声音' : '开启声音'} onClick={() => { setSound(!sound); playSound('click',!sound); }}><Icon name={sound ? 'sound' : 'muted'} size={19}/></button><button className="icon-button" aria-label="切换全屏" title="切换全屏" onClick={() => void fullscreen()}><Icon name="expand" size={18}/></button><button className="guide-button" onClick={openGuide}><Icon name="help" size={17}/>怎么玩</button></div>
    </header>
    <main className="game-layout">
      <aside className="sidebar">
        <div className="session-label"><i/> 一场小小的桌面危机 <span>01—03</span></div>
        <h1>别让它，<br/>吃掉一切<span>。</span></h1><p className="sidebar-intro">动动按钮，挪挪窗口。<br/>用你的桌面，解决桌面里的麻烦。</p>
        <nav className="level-list" aria-label="选择关卡">{LEVELS.map(level => <button key={level.id} className={`level-card ${game.level === level.id ? 'active' : ''} ${completed.includes(level.id) ? 'completed' : ''}`} onClick={() => selectLevel(level.id)} aria-current={game.level === level.id ? 'step' : undefined}>
          <span className="level-number">{completed.includes(level.id) ? <Icon name="check" size={19}/> : `0${level.id}`}</span><span className="level-card-text"><strong>{level.name}</strong><small>{level.id === 1 ? '从一颗按钮开始' : level.id === 2 ? '现在，保护好你的窗口' : '这次可没那么容易'}</small></span>{game.level === level.id ? <Icon name="arrow-right" size={16}/> : <span className="level-small-dot"/>}
        </button>)}</nav>
        <div className="objective-card"><div className="objective-title"><Icon name="target" size={16}/><span>本关任务</span><span className="paper-pin">✳</span></div><ol>{config.objectives.map((objective,index)=><li key={objective}><span>{index+1}</span>{objective}</li>)}</ol><button className="hint-button" onClick={() => setHint(!hint)}><Icon name="spark" size={14}/>{hint ? '收起小提示' : '需要一点小提示？'}<Icon name="chevron" size={13}/></button>{hint && <p className="hint-text">{config.hint}</p>}</div>
        <div className="sidebar-bottom"><div className="keyboard-row"><kbd>拖动</kbd><span>移动诱饵 / 窗口</span></div><div className="keyboard-row"><kbd>Space</kbd><span>关闭笼门</span><kbd>P</kbd><span>暂停</span></div><span className="made-for-play">A VERY HUNGRY LITTLE PROBLEM. <Icon name="spark" size={12}/></span></div>
      </aside>
      <section className="play-column" aria-label="游戏区域">
        <div className="level-heading"><div><div className="eyebrow">LEVEL 0{game.level} <span>/ {config.subtitle}</span></div><h2>{config.name}<span className="level-badge">{game.level === 1 ? '初次见面' : game.level === 2 ? '保持警惕' : '最终挑战'}</span></h2><p>{config.description}</p></div><div className="heading-doodle"><Icon name="cursor" size={23}/><span>整个页面，<br/>都是你的游戏道具。</span></div></div>
        <div className="computer-frame">
          <div className="computer-toolbar"><div className="window-dots"><i/><i/><i/></div><span><Icon name="terminal" size={14}/> sandbox.exe <span className="toolbar-divider">/</span> 虚拟桌面</span><span className="live-tag"><i/>{game.paused ? 'PAUSED' : 'LIVE'}</span></div>
          <div className="screen-wrapper"><Desktop game={game} engine={engine} sync={sync} onHelp={openGuide} onToast={setToast}/>
            {game.paused && !guide && game.status === 'playing' && <div className="game-overlay"><div className="result-card pause-card"><div className="result-icon"><Icon name="pause" size={26}/></div><span className="eyebrow">TAKE A LITTLE BREAK</span><h3>先喘口气。</h3><p>怪物的胃，也按下了暂停键。</p><button className="button-dark" onClick={() => act(()=>engine.togglePause())}><Icon name="play" size={16}/>继续游戏</button></div></div>}
            {game.status !== 'playing' && <div className="game-overlay"><div className={`result-card ${game.status === 'won' ? 'won-card' : 'lost-card'}`} role="dialog" aria-modal="true" aria-label={game.status === 'won' ? '关卡完成' : '再试一次'}><div className="result-monster"><Monster state={game.status === 'won' ? 'CAPTURED' : 'EAT'}/></div><span className="eyebrow">{game.status === 'won' ? 'LITTLE MONSTER, BIG APPETITE.' : 'OOPS. A LITTLE TOO HUNGRY.'}</span><h3>{game.status === 'won' ? game.level === 3 ? '桌面，保住了！' : '抓到你啦！' : '它把计划也吃掉了。'}</h3><p>{game.status === 'won' ? game.level === 3 ? '三关全部完成。谢谢你，桌面守护者。' : '小家伙暂时安分了。下一张桌面呢？' : game.message}</p>{game.status === 'won' && <div className="result-stats"><span>用时 <b>{formatTime(game.time)}</b></span><span>损失控件 <b>{game.eaten}</b></span></div>}<div className="result-actions"><button className="button-light" onClick={restart}><Icon name="restart" size={16}/>再玩一次</button>{game.status === 'won' && game.level < 3 && <button className="button-dark" onClick={()=>selectLevel((game.level+1) as LevelId)}>下一关<Icon name="arrow-right" size={16}/></button>}{game.status === 'won' && game.level === 3 && <button className="button-dark" onClick={()=>selectLevel(1)}>重返桌面<Icon name="arrow-right" size={16}/></button>}</div></div></div>}
          </div>
          <div className="desktop-taskbar"><span className="taskbar-start"><Icon name="terminal" size={17}/>ui_eater</span><span className={`monster-state state-dot-${game.monster.state.toLowerCase()}`}><i/>{STATE_LABELS[game.monster.state]}</span><span className="taskbar-files"><Icon name="file" size={13}/>{3-game.objects.filter(object=>object.eaten).length} 个控件尚存</span><span className="taskbar-time">{formatTime(game.time)}</span></div>
        </div>
        <div className="game-control-bar"><div className="game-status"><div className="status-icon"><Icon name={game.trap.occupied ? 'target' : 'info'} size={18}/></div><div><strong>{game.trap.occupied ? '就是现在！快关闭笼门。' : game.status === 'won' ? '捕获完成。漂亮的一次操作。' : game.level === 3 ? '给它一点空间，再给它一点诱惑。' : '小家伙饿了，给它指条路吧。'}</strong><span>{game.level === 3 ? `捕获机会 ${game.attempts} / 3 · 记得把鼠标移开` : '拖动美味按钮，把怪物引入右下角的捕获区域。'}</span></div></div><div className="control-actions"><button className="text-control" onClick={restart} title="重启关卡 (R)"><Icon name="restart" size={17}/><span>重启关卡</span></button><button className="pause-button" onClick={()=>act(()=>engine.togglePause())} disabled={game.status !== 'playing'} aria-label={game.paused ? '继续游戏' : '暂停游戏'} title="暂停 / 继续 (P)"><Icon name={game.paused ? 'play' : 'pause'} size={16}/></button><button className={`capture-button ${game.trap.occupied ? 'ready' : ''}`} onClick={closeTrap} disabled={game.status !== 'playing' || game.paused || game.trap.cooldown > 0}><Icon name="lock" size={16}/>{game.trap.cooldown > 0 ? '装置冷却中' : '关闭笼门'}<kbd>␣</kbd></button></div></div>
        <div className="under-screen"><span><Icon name="shield" size={13}/> 放心，它只能吃掉这里的 UI。</span><span>小怪物没有恶意。它只是饿了。<span className="tiny-spark">✳</span></span></div>
      </section>
    </main>
    <footer className="site-footer"><span>UI EATER <span>© 2026</span></span><span>一个关于界面、食欲和一点点机智的小游戏。</span><span>DESIGNED TO BE DEVOURED <span>↗</span></span></footer>
    {toast && <div className="toast" role="status"><Icon name="info" size={16}/>{toast}</div>}
    {guide && <div className="guide-backdrop" onClick={closeGuide}><div className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={event=>event.stopPropagation()}><button className="modal-close icon-button" onClick={closeGuide} aria-label="关闭说明"><Icon name="x"/></button><span className="eyebrow">A FIELD GUIDE TO UI EATING</span><h2 id="guide-title">认识你的桌面住客。</h2><p>这只怪物喜欢按钮。利用它的胃口，把它带进笼子。</p><div className="guide-steps"><div><span>01</span><Icon name="mouse" size={26}/><h3>拖动，制造诱惑</h3><p>黄色「美味按钮」可以反复使用。点击普通按钮也会吸引怪物。</p></div><div><span>02</span><Icon name="folder" size={26}/><h3>移动，改变路线</h3><p>第二关起，拖动窗口标题栏。紫色防护窗口能挡住怪物，保护电源。</p></div><div><span>03</span><Icon name="target" size={26}/><h3>等待，然后关门</h3><p>把诱饵放进捕获区，看到绿色「已进入」后点击关门，或按空格。</p></div></div><div className="guide-warning"><Icon name="info" size={18}/><span>第三关请把光标移离怪物。关门只有 3 次机会，电源被吃掉也会失败。随时按 R 重新开始。</span></div><button className="button-dark guide-go" onClick={closeGuide}>知道了，开饭吧<Icon name="arrow-right" size={17}/></button></div></div>}
  </div>;
}
