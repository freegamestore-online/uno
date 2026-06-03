import { useState, useEffect, useRef, useCallback } from 'react';
import { GameShell, GameTopbar, GameButton } from '@freegamestore/games';
import { GameBoard } from './components/GameBoard';
import { OpponentConfig, Difficulty, SeatPosition } from './lib/uno';

type Screen = 'menu' | 'setup' | 'about' | 'playing';

type SeatType = 'Alpha' | 'Beta' | 'Gamma';
type SeatChoice = SeatType | 'None';

const SEAT_DIFFICULTY: Record<SeatType, Difficulty> = {
  Alpha: 'hard',
  Beta: 'medium',
  Gamma: 'easy',
};

const SEAT_COLORS: Record<SeatType, string> = {
  Alpha: '#dc2626',
  Beta: '#2563eb',
  Gamma: '#16a34a',
};

const SEAT_ORDER: SeatChoice[] = ['None', 'Alpha', 'Beta', 'Gamma'];
const SEAT_TOP_ORDER: SeatType[] = ['Alpha', 'Beta', 'Gamma'];

function resolveOpponents(top: SeatType, left: SeatChoice, right: SeatChoice): OpponentConfig[] {
  // Sorted clockwise: Left → Top → Right so game turn order matches physical seating
  const seating = [
    { t: left, pos: 'left' as SeatPosition },
    { t: top,  pos: 'top'  as SeatPosition },
    { t: right, pos: 'right' as SeatPosition },
  ].filter(s => s.t !== 'None') as { t: SeatType; pos: SeatPosition }[];

  const counts: Record<string, number> = {};
  for (const { t } of seating) counts[t] = (counts[t] ?? 0) + 1;
  const seen: Record<string, number> = {};
  const suffixes = ['X', 'Y', 'Z'];

  return seating.map(({ t, pos }) => {
    seen[t] = (seen[t] ?? 0) + 1;
    const name = counts[t]! > 1 ? `${t} ${suffixes[seen[t]! - 1] ?? ''}` : t;
    return { name, difficulty: SEAT_DIFFICULTY[t], position: pos };
  });
}

const MODES = [
  {
    id: 'computer',
    label: 'vs Computer',
    sub: 'Play against CPU',
    bg: 'linear-gradient(160deg, #dc2626 0%, #7f1d1d 100%)',
    symbol: '🤖',
    locked: false,
  },
  {
    id: 'multiplayer',
    label: 'Multiplayer',
    sub: 'Coming soon',
    bg: 'linear-gradient(160deg, #2563eb 0%, #1e3a8a 100%)',
    symbol: '👥',
    locked: true,
  },
  {
    id: 'ai',
    label: 'AI Opponent',
    sub: 'Coming soon',
    bg: 'linear-gradient(160deg, #7c3aed 0%, #3b0764 100%)',
    symbol: '✨',
    locked: true,
  },
];

const LS_KEY = 'uno_seat_config';

function loadSeatConfig(): { top: SeatType; left: SeatChoice; right: SeatChoice } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { top: unknown; left: unknown; right: unknown };
      const isType = (v: unknown): v is SeatType => v === 'Alpha' || v === 'Beta' || v === 'Gamma';
      const isChoice = (v: unknown): v is SeatChoice => v === 'None' || isType(v);
      if (isType(p.top) && isChoice(p.left) && isChoice(p.right)) return { top: p.top, left: p.left, right: p.right };
    }
  } catch {}
  return { top: 'Gamma', left: 'None', right: 'None' };
}

function saveSeatConfig(top: SeatType, left: SeatChoice, right: SeatChoice) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ top, left, right })); } catch {}
}

const SHAPES = [
  { color: '#dc2626', op: 0.13, w: 56, h: 80,  top: '8%',  left: '6%',  rot: '-22deg', dur: '6s',  delay: '0s' },
  { color: '#2563eb', op: 0.10, w: 44, h: 64,  top: '15%', left: '82%', rot: '18deg',  dur: '7.5s',delay: '1s' },
  { color: '#d97706', op: 0.12, w: 64, h: 92,  top: '62%', left: '78%', rot: '-12deg', dur: '5.5s',delay: '0.5s' },
  { color: '#16a34a', op: 0.09, w: 40, h: 58,  top: '72%', left: '8%',  rot: '28deg',  dur: '8s',  delay: '2s' },
  { color: '#facc15', op: 0.07, w: 50, h: 72,  top: '40%', left: '88%', rot: '-6deg',  dur: '6.5s',delay: '1.5s' },
];

function SeatSelector({ value, onChange, order }: {
  value: SeatChoice;
  onChange: (v: SeatChoice) => void;
  order: SeatChoice[];
}) {
  const isNone = value === 'None';
  const color = isNone ? 'rgba(255,255,255,0.12)' : SEAT_COLORS[value as SeatType];
  const next = () => {
    const idx = order.indexOf(value);
    onChange(order[(idx + 1) % order.length] as SeatChoice);
  };
  return (
    <button
      onClick={next}
      className="flex flex-col items-center justify-center shrink-0 cursor-pointer transition-all duration-[180ms] ease-in"
      style={{
        width: 'clamp(72px, 20vw, 120px)',
        height: 'clamp(52px, 13vw, 84px)',
        borderRadius: 'clamp(8px, 2vw, 15px)',
        background: isNone ? 'rgba(255,255,255,0.04)' : `${color}22`,
        border: `2px solid ${isNone ? 'rgba(255,255,255,0.12)' : color}`,
        gap: 4,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
    >
      <span
        className="font-serif font-extrabold leading-none"
        style={{
          fontSize: 'clamp(12px, 3.5vw, 17px)',
          color: isNone ? 'rgba(255,255,255,0.3)' : '#fff',
        }}
      >
        {isNone ? '＋' : value}
      </span>
      {!isNone && (
        <span
          className="font-sans text-white/60"
          style={{ fontSize: 'clamp(10px, 2.8vw, 13px)' }}
        >
          {value === 'Alpha' ? 'Hard' : value === 'Beta' ? 'Med' : 'Easy'}
        </span>
      )}
    </button>
  );
}

function CounterSlot() {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setCount(c => c + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const digits = String(count).split('');
  return (
    <>
      {digits.map((d, i) => (
        <span key={`pos-${i}`} className="inline-block [clip-path:inset(0_0_0.2em_0)]">
          <span
            key={`${i}-${d}`}
            className="inline-block [animation:num-slide-up_0.28s_cubic-bezier(0.22,1,0.36,1)_both]"
          >
            {d}
          </span>
        </span>
      ))}
      {' '}{count === 1 ? 'game' : 'games'}
    </>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [topSeat, setTopSeat] = useState<SeatType>(() => loadSeatConfig().top);
  const [leftSeat, setLeftSeat] = useState<SeatChoice>(() => loadSeatConfig().left);
  const [rightSeat, setRightSeat] = useState<SeatChoice>(() => loadSeatConfig().right);
  const opponentsRef = useRef<OpponentConfig[]>(resolveOpponents(loadSeatConfig().top, loadSeatConfig().left, loadSeatConfig().right));
  const [gameKey, setGameKey] = useState(0);
  const [logoHovered, setLogoHovered] = useState(false);
  const [glazeKey, setGlazeKey] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [gameInfo, setGameInfo] = useState({ cards: 0, turn: '', isMyTurn: false });
  const handleGameInfo = useCallback((info: { cards: number; turn: string; isMyTurn: boolean }) => {
    setGameInfo(info);
  }, []);

  function transitionTo(next: Screen) {
    setIsExiting(true);
    setTimeout(() => { setIsExiting(false); setScreen(next); }, 360);
  }

  function handleVsComputer() {
    transitionTo('setup');
  }

  const topbar = screen === 'playing' ? (
    <GameTopbar
      title="UNO"
      stats={[
        { label: 'Cards', value: gameInfo.cards },
        { label: 'Turn', value: gameInfo.turn, accent: gameInfo.isMyTurn },
      ]}
      actions={<GameButton size="sm" variant="ghost" onClick={() => setScreen('menu')}>✕</GameButton>}
    />
  ) : (
    <GameTopbar title="UNO" actions={
      screen === 'setup'
        ? <GameButton size="sm" variant="ghost" onClick={() => transitionTo('menu')}>← Back</GameButton>
        : undefined
    } />
  );

  return (
    <GameShell topbar={topbar}>
      {/* Persistent background — inside GameShell so it's never unmounted */}
      <div className="absolute inset-0 bg-[#0d0520] overflow-hidden pointer-events-none">
        {[
          { c: 'rgba(220,38,38,0.35)',  top: '-10%', left: '-10%', dur: '9s',  delay: '0s'   },
          { c: 'rgba(124,58,237,0.3)',  top: '60%',  left: '60%',  dur: '11s', delay: '2s'   },
          { c: 'rgba(37,99,235,0.25)',  top: '40%',  left: '-15%', dur: '8s',  delay: '1s'   },
          { c: 'rgba(250,204,21,0.12)', top: '-5%',  left: '65%',  dur: '13s', delay: '0.5s' },
        ].map((b, i) => (
          <div key={i} className="absolute w-[260px] h-[260px] rounded-full" style={{
            background: `radial-gradient(circle, ${b.c} 0%, transparent 70%)`,
            top: b.top, left: b.left,
            filter: 'blur(48px)',
            animation: `blob-drift ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay,
          }} />
        ))}
        {SHAPES.map((s, i) => (
          <div key={i} className="absolute rounded-lg" style={{
            width: s.w, height: s.h,
            border: `2px solid ${s.color}`,
            background: `${s.color}22`,
            top: s.top, left: s.left,
            '--rot': s.rot,
            transform: `rotate(${s.rot})`,
            animation: `float-shape ${s.dur} ease-in-out infinite`,
            animationDelay: s.delay,
          } as React.CSSProperties} />
        ))}
      </div>

      {screen === 'playing' ? (
        <GameBoard
          key={gameKey}
          opponents={opponentsRef.current}
          onExit={() => setScreen('menu')}
          onRestart={() => setGameKey(k => k + 1)}
          onGameInfoChange={handleGameInfo}
        />
      ) : (
      <>{/* Content — lifts & fades on exit */}
      <div
        className="relative h-full flex flex-col items-center justify-center overflow-hidden"
        style={{
          ...(screen === 'menu' ? { gap: 28, padding: 24 } : { gap: 'clamp(12px, 3vh, 40px)', padding: '12px 16px' }),
          animation: isExiting ? 'screen-exit 0.35s ease forwards' : undefined,
        }}
      >
        {screen === 'about' ? (
          <>
            <h2 className="font-serif font-extrabold text-white m-0 text-[clamp(26px,6vw,34px)] [animation:fade-up_0.4s_ease_both] [animation-delay:0.05s]">About</h2>

            <p className="font-sans text-white/55 text-center m-0 leading-relaxed max-w-[300px] text-[clamp(13px,3.5vw,15px)] [animation:fade-up_0.4s_ease_both] [animation-delay:0.1s]">
              "Just one more round."<br />(Said <CounterSlot /> ago.)
            </p>

            <a href="https://www.linkedin.com/in/dawson-huang/" className="flex items-center gap-2 no-underline group [animation:fade-up_0.4s_ease_both] [animation-delay:0.15s]">
              <span className="text-white/40 font-sans text-[13px]">Connect with me:</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-50">
                <rect width="16" height="16" rx="3" fill="white" fillOpacity="0.2" />
                <text x="8" y="12" textAnchor="middle" className="font-sans font-extrabold text-[9px]" fill="white">in</text>
              </svg>
              <span className="text-white/65 font-sans text-[13px] group-hover:text-white transition-colors">Dawson Huang</span>
            </a>

            <a href="https://freegamestore.online" className="text-white/30 font-sans text-[12px] no-underline text-center hover:text-white/55 transition-colors [animation:fade-up_0.4s_ease_both] [animation-delay:0.2s]">
              Proudly a member of FreeGameStore
            </a>

            <button
              onClick={() => transitionTo('menu')}
              className="flex items-center justify-center cursor-pointer transition-opacity duration-150 hover:opacity-60 bg-transparent border-0 p-1 [animation:fade-up_0.4s_ease_both] [animation-delay:0.25s]"
              aria-label="Close"
            >
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <circle cx="13" cy="13" r="12" stroke="white" strokeWidth="1.5" />
                <line x1="9" y1="9" x2="17" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="17" y1="9" x2="9" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </>
        ) : screen === 'setup' ? (
          <>
            {/* Title */}
            <div className="text-center relative [animation:fade-up_0.5s_ease_both] [animation-delay:0.05s]">
              <p className="text-white/40 text-[12px] font-sans uppercase tracking-[0.12em] m-0 mb-[6px]">vs Computer</p>
              <h2 className="font-serif font-extrabold m-0 text-white text-[clamp(20px,5vw,28px)]">
                Choose your opponents
              </h2>
            </div>

            {/* Desk layout */}
            <div className="flex flex-col items-center relative gap-[clamp(6px,1.5vw,15px)] [animation:fade-up_0.5s_ease_both] [animation-delay:0.1s]">
              <SeatSelector value={topSeat} onChange={v => { const t = v as SeatType; setTopSeat(t); saveSeatConfig(t, leftSeat, rightSeat); }} order={SEAT_TOP_ORDER} />
              <div className="flex items-center gap-[clamp(6px,1.5vw,15px)]">
                <SeatSelector value={leftSeat} onChange={v => { setLeftSeat(v); saveSeatConfig(topSeat, v, rightSeat); }} order={SEAT_ORDER} />
                <div className="flex items-center justify-center w-[clamp(130px,34vw,222px)] h-[clamp(86px,20vw,144px)] rounded-[clamp(14px,4vw,30px)] border-2 border-white/[0.08] bg-[radial-gradient(ellipse_at_50%_40%,#1a5c32_0%,#0f3d20_100%)] shadow-[inset_0_2px_12px_rgba(0,0,0,0.5),0_4px_20px_rgba(0,0,0,0.4)]">
                  <div className="bg-white/3 border border-white/7 w-[65%] h-[62%] rounded-[clamp(8px,2vw,18px)]" />
                </div>
                <SeatSelector value={rightSeat} onChange={v => { setRightSeat(v); saveSeatConfig(topSeat, leftSeat, v); }} order={SEAT_ORDER} />
              </div>
              <div className="flex items-center justify-center text-white font-bold font-sans border-2 border-white/20 bg-white/8 w-[clamp(72px,20vw,120px)] h-[clamp(36px,8vw,54px)] rounded-[clamp(6px,1.5vw,12px)] text-[clamp(12px,3.5vw,16px)]">You</div>
            </div>

            {/* Difficulty legend */}
            <div className="flex gap-[14px] relative [animation:fade-up_0.5s_ease_both] [animation-delay:0.15s]">
              {(['Alpha', 'Beta', 'Gamma'] as SeatType[]).map(t => (
                <div key={t} className="flex items-center gap-[5px]">
                  <div className="w-2 h-2 rounded-full" style={{ background: SEAT_COLORS[t] }} />
                  <span className="text-white/50 text-[11px] font-sans">{t} · {t === 'Alpha' ? 'Hard' : t === 'Beta' ? 'Medium' : 'Easy'}</span>
                </div>
              ))}
            </div>

            {/* Play button */}
            <div className="relative [animation:fade-up_0.5s_ease_both] [animation-delay:0.2s]">
              <button
                onClick={() => { opponentsRef.current = resolveOpponents(topSeat, leftSeat, rightSeat); transitionTo('playing'); }}
                className="text-white font-serif font-extrabold text-base cursor-pointer rounded-[14px] py-3 px-[40px] bg-[linear-gradient(160deg,#dc2626_0%,#991b1b_100%)] border-2 border-white/20 shadow-[0_4px_20px_rgba(220,38,38,0.4)] transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.04)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(220,38,38,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(220,38,38,0.4)'; }}
              >Play</button>
            </div>

          </>
        ) : (
          <>
            {/* Logo */}
            <div className="text-center [animation:menu-card-in_0.5s_ease_both]">
              <div
                onMouseEnter={() => { setLogoHovered(true); setGlazeKey(k => k + 1); }}
                onMouseLeave={() => setLogoHovered(false)}
                className="inline-flex items-center justify-center rounded-[50%] overflow-hidden relative cursor-default"
                style={{ background: 'linear-gradient(160deg, #ef4444 0%, #b91c1c 100%)', width: 148, height: 100, boxShadow: '0 8px 32px rgba(185,28,28,0.5), inset 0 2px 0 rgba(255,255,255,0.15)', transform: logoHovered ? 'rotate(-10deg) scale(1.12)' : 'rotate(-10deg)', transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
              >
                {glazeKey > 0 && (
                  <div key={glazeKey} className="absolute pointer-events-none top-[-20%] left-0 w-[72px] h-[140%] bg-[linear-gradient(to_right,transparent_0%,rgba(255,255,255,0.55)_50%,transparent_100%)] [transform:skewX(-18deg)] [animation:logo-glaze_0.55s_ease_forwards]" />
                )}
                <svg viewBox="0 0 120 56" width="120" height="56" className="block overflow-visible">
                  <text x="62" y="47" textAnchor="middle" className="font-serif font-extrabold text-[54px]" fill="#000" letterSpacing="-1">UNO</text>
                  <text x="61" y="46" textAnchor="middle" className="font-serif font-extrabold text-[54px]" fill="#000" letterSpacing="-1">UNO</text>
                  <text x="59" y="44" textAnchor="middle" className="font-serif font-extrabold text-[54px]" fill="#facc15" stroke="#000" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke fill" letterSpacing="-1">UNO</text>
                </svg>
              </div>
              <p className="text-white/45 text-[13px] font-sans mt-[10px] mb-0">Classic card game</p>
            </div>

            {/* 3 mode cards */}
            <div className="flex gap-[14px] items-stretch w-full max-w-[380px]">
              {MODES.map((mode, i) => (
                <button
                  key={mode.id}
                  onClick={mode.locked ? undefined : handleVsComputer}
                  disabled={mode.locked}
                  className="flex-1 flex flex-col items-center justify-between relative overflow-hidden"
                  style={{ minHeight: 200, borderRadius: 16, background: mode.bg, border: 'none', cursor: mode.locked ? 'default' : 'pointer', padding: '24px 12px 20px', filter: mode.locked ? 'grayscale(1) brightness(0.5)' : 'none', boxShadow: mode.locked ? 'none' : '0 6px 24px rgba(0,0,0,0.3)', transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.18s ease', animation: `${mode.locked ? 'menu-card-in-locked' : 'menu-card-in'} 0.55s cubic-bezier(0.34,1.56,0.64,1) both`, animationDelay: `${0.1 + i * 0.07}s` }}
                  onMouseEnter={e => { if (!mode.locked) { e.currentTarget.style.transform = 'translateY(-6px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 14px 36px rgba(0,0,0,0.4)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = mode.locked ? 'none' : '0 6px 24px rgba(0,0,0,0.3)'; }}
                  onAnimationEnd={e => { e.currentTarget.style.animation = 'none'; }}
                  onMouseDown={e => { if (!mode.locked) e.currentTarget.style.transform = 'scale(0.96)'; }}
                  onMouseUp={e => { if (!mode.locked) e.currentTarget.style.transform = 'translateY(-6px) scale(1.03)'; }}
                >
                  <div className="absolute pointer-events-none w-[130%] h-[55%] rounded-full bg-white/[0.09] top-[18%] left-[-15%] [transform:rotate(-15deg)]" />
                  <span className="text-[36px] leading-none relative">{mode.symbol}</span>
                  <div className="text-center relative">
                    <p className="text-white font-serif font-bold text-[15px] m-0 mb-[5px] leading-snug">{mode.label}</p>
                    <p className="text-white/60 font-sans text-[11px] m-0">{mode.sub}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Info button */}
            <button
              onClick={() => transitionTo('about')}
              className="flex items-center justify-center cursor-pointer transition-opacity duration-150 hover:opacity-60 bg-transparent border-0 p-1 [animation:menu-card-in_0.5s_ease_both] [animation-delay:0.35s]"
              aria-label="About"
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="10" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
                <text x="11" y="15.5" textAnchor="middle" className="font-sans font-bold text-[12px]" fill="rgba(255,255,255,0.7)">i</text>
              </svg>
            </button>

          </>
        )}
      </div>
      </>
      )}
    </GameShell>
  );
}
