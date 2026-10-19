import './Monster.css';

export type MonsterState = 'IDLE' | 'SEARCH' | 'CHASE' | 'EAT' | 'ESCAPE' | 'CAPTURED';
export type EvolutionStage = 0 | 1 | 2 | 3 | 4;

export interface MonsterProps {
  state: MonsterState;
  facing?: 1 | -1;
  className?: string;
  evolutionStage?: EvolutionStage;
  mood?: 'happy' | 'evolving' | null;
}

const stateLabels: Record<MonsterState, string> = {
  IDLE: '正在发呆的小怪物',
  SEARCH: '正在寻找食物的小怪物',
  CHASE: '追逐食物的小怪物',
  EAT: '正在吞噬界面的小怪物',
  ESCAPE: '被鼠标惊吓的小怪物',
  CAPTURED: '被成功捕获的小怪物',
};

/** A hand-drawn pixel creature. All animation remains inside its movement wrapper. */
export default function Monster({
  state, facing = 1, className = '', evolutionStage = 0, mood = null,
}: MonsterProps) {
  const hungry = state === 'CHASE' || state === 'EAT';
  const startled = state === 'ESCAPE';
  const captured = state === 'CAPTURED';
  const pupilOffset = hungry ? 3 : state === 'SEARCH' ? 1 : 0;
  const grown = evolutionStage >= 2;
  const winged = evolutionStage >= 3;
  const royal = evolutionStage === 4;

  return (
    <svg
      className={`monster-svg monster--${state.toLowerCase()} monster--stage-${evolutionStage}${mood ? ` monster--${mood}` : ''} ${className}`}
      data-evolution-stage={evolutionStage}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${stateLabels[state]}${evolutionStage ? `，进化阶段 ${evolutionStage + 1}` : ''}${mood === 'evolving' ? '，正在进化' : ''}`}
      shapeRendering="crispEdges"
    >
      <ellipse className="monster__shadow" cx="48" cy="91" rx={winged ? 38 : grown ? 33 : 29} ry="4" fill="#171a2a" opacity=".13" />
      <g transform={facing === -1 ? 'translate(96 0) scale(-1 1)' : undefined}>
        {mood === 'evolving' && (
          <g className="monster__evolution-aura" aria-hidden="true">
            <ellipse className="monster__evolution-ring" cx="48" cy="43" rx="51" ry="52" fill="none" stroke="var(--monster-accent)" strokeWidth="3" strokeDasharray="5 7" />
            <g className="monster__evolution-sparks" fill="var(--monster-accent)">
              <path d="M-2 10h4V4h4v6h4v4H6v6H2v-6h-4ZM89 3h4v-6h4v6h4v4h-4v6h-4V7h-4Z" />
              <path d="M-7 73h4v-4h4v4h4v4H1v4h-4v-4h-4Zm104 7h4v-4h4v4h4v4h-4v4h-4v-4h-4Z" />
            </g>
          </g>
        )}
        <g className="monster__body">
          {winged && (
            <g className="monster__wings" aria-hidden="true">
              <g className="monster__wing monster__wing--left">
                <path fill="#24263b" d="M20 36H12V28H4V20H-8V28H-12V60h8v-6h8v8h8v10h12Z" />
                <path fill="var(--monster-wing)" d="M16 40H8V32H0V24h-4v8h-4v20h4v-6H8v8h8v10h4V44h-4Z" />
                <path fill="none" stroke="var(--monster-deep)" strokeWidth="3" d="M-3 31v8h8v8h9v10" />
                <path fill="var(--monster-shine)" d="M-4 28h4v8h-4Z" />
              </g>
              <g transform="translate(96 0) scale(-1 1)">
                <g className="monster__wing monster__wing--right">
                  <path fill="#24263b" d="M20 36H12V28H4V20H-8V28H-12V60h8v-6h8v8h8v10h12Z" />
                  <path fill="var(--monster-wing)" d="M16 40H8V32H0V24h-4v8h-4v20h4v-6H8v8h8v10h4V44h-4Z" />
                  <path fill="none" stroke="var(--monster-deep)" strokeWidth="3" d="M-3 31v8h8v8h9v10" />
                  <path fill="var(--monster-shine)" d="M-4 28h4v8h-4Z" />
                </g>
              </g>
            </g>
          )}
          {royal && (
            <g className="monster__tail" aria-hidden="true">
              <path d="M78 76h12v8h12V60" fill="none" stroke="#24263b" strokeWidth="12" />
              <path d="M78 76h12v8h12V60" fill="none" stroke="var(--monster-body)" strokeWidth="4" />
              <path fill="#24263b" d="M96 58v-8h4v-4h4v4h4v8h-4v4h-4v-4Z" />
              <path fill="var(--monster-accent)" d="M100 50h4v8h-4Z" />
            </g>
          )}
          {grown && (
            <g className="monster__grown-body" aria-hidden="true">
              <path fill="#24263b" d="M12 28h10v42H12v6H4v-8H-2V40h6v-8h8Zm72 0H74v42h10v6h8v-8h6V40h-6v-8h-8ZM18 72h24v20H18Zm36 0h24v20H54Z" />
              <path fill="var(--monster-body)" d="M12 33h6v33H8v-4H2V44h6v-7h4Zm72 0h-6v33h10v-4h6V44h-6v-7h-4Z" />
              <path fill="var(--monster-shade)" d="M22 76h16v12H22Zm36 0h16v12H58Z" />
              <path fill="var(--monster-shine)" d="M2 44h4v12H2Zm88 0h4v12h-4ZM22 84h4v4h-4Zm48 0h4v4h-4Z" />
            </g>
          )}
          {evolutionStage === 1 && (
            <g className="monster__sprouts" aria-hidden="true">
              <path fill="#24263b" d="M27 23V11h-9V7h-5V-5h12v4h6v8h4v16Zm42 0V11h9V7h5V-5H71v4h-6v8h-4v16Z" />
              <path fill="var(--monster-accent)" d="M17-1h5v4h5v8h4v8h-4v-8h-5V7h-5Zm62 0h-5v4h-5v8h-4v8h4v-8h5V7h5Z" />
              <path fill="var(--monster-shine)" d="M17-1h5v4h-5Zm57 0h5v4h-5Z" />
            </g>
          )}
          {grown && (
            <g className="monster__horns" aria-hidden="true">
              <path fill="#24263b" d="M24 27H14V19H7V7h4V-3h12V9h7v5h8v13Zm48 0h10v-8h7V7h-4V-3H73V9h-7v5h-8v13Z" />
              <path fill="var(--monster-horn)" d="M18 23v-8h-7V7h4V1h4v12h7v5h8v5Zm60 0v-8h7V7h-4V1h-4v12h-7v5h-8v5Z" />
              <path fill="var(--monster-accent)" d="M15 7h4v6h-4Zm62 0h4v6h-4Z" />
            </g>
          )}
          {/* The silhouette is built in chunky stair steps, including two little antennae. */}
          <path
            fill="#24263b"
            d="M24 8h12v12h24V8h12v12h8v8h8v12h5v24h-5v12h-8v8h-8v8H56V80H40v12H24V80h-8v-8H8V60H3V40h5V28h8v-8h8Z"
          />
          <path
            fill="var(--monster-body)"
            d="M28 12h4v16H20v8h-8v12H7v8h5v12h8v8h8v12h8V76h24v12h8V76h8v-8h8V56h5v-8h-5V36h-8v-8H64V12h4v12h-8v4H36v-4h-8Z"
          />
          <path fill="var(--monster-highlight)" d="M20 32h16v-4h24v4h16v8H20Z" />
          <path fill="var(--monster-shade)" d="M12 56h8v12h8v4h40v-4h8V56h8v12h-8v8h-8v12h-8V76H36v12h-8V76h-8v-8h-8Z" />
          <path fill="var(--monster-shine)" d="M28 12h4v8h-4Zm36 0h4v8h-4ZM16 36h4v12h-4Z" />
          <path fill="var(--monster-deep)" d="M32 80h4v8h-8v-4h4Zm28 0h4v4h4v4h-8Z" />

          {royal && (
            <g className="monster__royal-details" aria-hidden="true">
              <path fill="var(--monster-accent)" d="M44 23h8v4h-8ZM15 46h5v6h-5Zm61 0h5v6h-5ZM16 62h8v4h-8Zm56 0h8v4h-8ZM24 72h5v4h-5Zm43 0h5v4h-5Z" />
              <g className="monster__crown">
                <path fill="#24263b" d="M29 16V-8L41 2l7-18 7 18L67-8v24Z" />
                <path fill="var(--monster-accent)" d="M33 12V1l10 8 5-13 5 13 10-8v11Z" />
                <path fill="#fff9dc" d="M46-3h4v5h-4ZM34 8h4v4h-4Z" />
                <path fill="var(--monster-deep)" d="M38 9h4v4h-4Zm16 0h4v4h-4Z" />
              </g>
            </g>
          )}

          {/* Cheek pixels give the tiny sprite a little personality. */}
          <path fill="var(--monster-cheek)" d="M18 55h8v4h-8Zm52 0h8v4h-8Z" />

          {captured ? (
            <g className="monster__dizzy" fill="#24263b">
              <path d="M27 37h4v4h4v-4h4v4h-4v4h4v4h-4v-4h-4v4h-4v-4h4v-4h-4Z" />
              <path d="M55 37h4v4h4v-4h4v4h-4v4h4v4h-4v-4h-4v4h-4v-4h4v-4h-4Z" />
              <path d="M36 60h24v4h-4v4h-4v-4H36Z" />
              <path fill="#f794ad" d="M48 64h8v8h-8Z" />
            </g>
          ) : (
            <>
              {startled && <path fill="#24263b" d="M24 27h12v4H24Zm32 0h12v4H56Z" />}
              <g className="monster__eyes">
                <path fill="#24263b" d="M27 31h14v4h4v18h-4v4H27v-4h-4V35h4Zm28 0h14v4h4v18h-4v4H55v-4h-4V35h4Z" />
                <path fill="#fffef1" d="M27 35h14v18H27Zm28 0h14v18H55Z" />
                <g className="monster__pupils" transform={`translate(${startled ? -1 : pupilOffset} 0)`}>
                  <path fill="#24263b" d={startled ? 'M31 39h6v10h-6Zm28 0h6v10h-6Z' : 'M32 41h7v11h-7Zm28 0h7v11h-7Z'} />
                  <path fill="#fffef1" d={startled ? 'M31 39h2v3h-2Zm28 0h2v3h-2Z' : 'M32 41h3v3h-3Zm28 0h3v3h-3Z'} />
                </g>
              </g>
              {state === 'EAT' ? (
                <g className="monster__mouth monster__mouth--eating">
                  <path fill="#24263b" d="M30 57h36v4h4v14h-4v5H30v-5h-4V61h4Z" />
                  <path fill="#fffef1" d="M32 57h9v8h-9Zm22 0h9v8h-9Z" />
                  <path fill="#ee879f" d="M40 72h16v4H40Z" />
                  <path fill="#ffb0bf" d="M44 70h8v3h-8Z" />
                </g>
              ) : startled ? (
                <g className="monster__mouth">
                  <path fill="#24263b" d="M40 61h16v4h4v10h-4v4H40v-4h-4V65h4Z" />
                  <path fill="#f794ad" d="M44 73h8v3h-8Z" />
                </g>
              ) : hungry ? (
                <g className="monster__mouth">
                  <path fill="#24263b" d="M32 60h32v8h-4v5H36v-5h-4Z" />
                  <path fill="#fffef1" d="M36 60h8v6h-8Zm17 0h8v6h-8Z" />
                  <path fill="#f794ad" d="M44 68h12v4H44Z" />
                </g>
              ) : (
                <g className="monster__mouth">
                  <path fill="#24263b" d="M32 60h4v4h24v-4h4v8H32Z" />
                  <path fill="#fffef1" d="M40 64h7v5h-7Z" />
                </g>
              )}
            </>
          )}
        </g>
        {mood === 'happy' && (
          <g className="monster__happy-marks" fill="#f794ad" aria-hidden="true">
            <path d="M1 6h4v4h4V6h4v8H9v4H5v-4H1Zm82-8h4v4h4v-4h4v8h-4v4h-4V6h-4Z" />
          </g>
        )}
        {startled && (
          <g className="monster__alarm" fill="#8cb9e7">
            <path d="M83 12h4v8h-4v4h-4v-8h4Z" />
            <path d="M91 28h4v8h-4Z" />
          </g>
        )}
        {captured && (
          <g className="monster__stars" fill="#b4cd4b">
            <path d="M12 11h4V7h4v4h4v4h-4v4h-4v-4h-4Z" />
            <path d="M77 5h4v4h4v4h-4v4h-4v-4h-4V9h4Z" />
          </g>
        )}
      </g>
    </svg>
  );
}
