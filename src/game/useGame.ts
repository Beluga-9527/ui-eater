import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from './engine';

export function useGame() {
  const engine = useRef<GameEngine>(new GameEngine(1)).current;
  const [game, setGame] = useState(engine.getSnapshot());
  const sync = useCallback(() => setGame(engine.getSnapshot()), [engine]);
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let rendered = previous;
    const tick = (now: number) => {
      engine.step(document.hidden ? 0 : Math.min((now - previous) / 1000, 0.05));
      previous = now;
      if (now - rendered >= 1000 / 30) { sync(); rendered = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [engine, sync]);
  return { game, engine, sync };
}
