import { createRoot } from 'react-dom/client';
import Monster from '../src/components/Monster';
import { getEvolution } from './evolution';

const galleryStyle = document.createElement('style');
galleryStyle.textContent = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f8f8ef; color: #282a36; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }
  main { max-width: 1230px; margin: auto; padding: 64px 42px; }
  .eyebrow { color: #8a9176; font: 11px monospace; letter-spacing: 2px; }
  h1 { margin: 16px 0; font-size: 36px; letter-spacing: -1px; }
  .intro { margin: 0; font-size: 13px; color: #8b917d; }
  .forms { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-top: 54px; }
  article { position: relative; padding: 22px 12px; text-align: center; border: 1px solid #dedfd2; border-radius: 12px; background: #fefef7; }
  .stage { position: absolute; top: 14px; left: 14px; font: 10px monospace; color: #a4ac91; }
  .sprite { display: flex; align-items: flex-end; justify-content: center; height: 158px; padding-bottom: 6px; }
  .sprite .monster-svg { flex: none; }
  h2 { margin: 22px 0 8px; font-size: 15px; }
  .xp { color: #79875a; font: 11px monospace; }
  .detail { margin: 12px 0 0; color: #a0a58f; font-size: 10px; }
  footer { margin-top: 30px; color: #929983; font-size: 11px; }
  @media (max-width: 850px) { .forms { grid-template-columns: repeat(3, 1fr); } }
`;
document.head.append(galleryStyle);

const descriptions = ['柔软小团子', '嫩芽 · 青绿色', '双角 · 蓝色', '翅膀 · 淡紫色', '王冠 · 珊瑚色'];
const forms = [0, 3, 7, 12, 18].map(xp => getEvolution(xp));
createRoot(document.getElementById('root')!).render(
  <main>
    <div className="eyebrow">UI EATER · THE EVOLUTION COLLECTION</div>
    <h1>每吃一口，都在长大。</h1>
    <p className="intro">投喂诱饵，或让它吞掉网页里的小零食。从饥饿幼崽，养成你的桌面吞噬王。</p>
    <section className="forms" aria-label="五阶段怪物进化">
      {forms.map((form, index) => (
        <article key={form.stage}>
          <span className="stage">0{form.stage + 1}</span>
          <div className="sprite"><div style={{ width: 76 * form.scale, height: 76 * form.scale }}><Monster state="IDLE" evolutionStage={form.stage} /></div></div>
          <h2>{form.name}</h2>
          <div className="xp">{form.threshold} XP · {form.scale.toFixed(2)}×</div>
          <p className="detail">{descriptions[index]}</p>
        </article>
      ))}
    </section>
    <footer>每吃掉一个网页元素或一份诱饵 +1 XP · 暂停保留成长 · 停止或刷新重新开始</footer>
  </main>,
);
