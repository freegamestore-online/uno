import { useId } from 'react';
import { UnoCard, effectiveColor } from '../lib/uno';

const COLOR_BG: Record<string, string> = {
  red: 'var(--uno-red)',
  green: 'var(--uno-green)',
  blue: 'var(--uno-blue)',
  yellow: 'var(--uno-yellow)',
  wild: 'var(--uno-ink)',
};

const LABEL: Record<string, string> = {
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild4: '+4',
};

const CORNER_SHADOWS = [[1,1],[1,2],[2,1],[2,2],[2,3],[3,2],[3,3]];
const CENTER_SHADOWS = [[1,1],[1,2],[2,1],[2,2],[2,3],[3,2],[3,3],[3,4],[4,3],[4,4],[4,5],[5,4],[5,5]];

function SkipIcon3D({ isCenter }: { isCenter?: boolean }) {
  const shadows = isCenter ? CENTER_SHADOWS : CORNER_SHADOWS;
  const scale = isCenter ? 1.15 : 0.45;
  const outW = isCenter ? 10 : 18;
  const inW = isCenter ? 5.5 : 8;
  return (
    <g transform={`scale(${scale})`}>
      {shadows.map(([dx = 0, dy = 0], i) => (
        <g key={`skip-shadow-${i}`} transform={`translate(${dx / scale}, ${dy / scale})`}>
          <circle cx="0" cy="0" r="22" fill="none" stroke="black" strokeWidth={outW} />
          <line x1="-16" y1="-16" x2="16" y2="16" stroke="black" strokeWidth={outW} />
        </g>
      ))}
      <circle cx="0" cy="0" r="22" fill="none" stroke="black" strokeWidth={outW} />
      <line x1="-16" y1="-16" x2="16" y2="16" stroke="black" strokeWidth={outW} />
      <circle cx="0" cy="0" r="22" fill="none" stroke="white" strokeWidth={inW} />
      <line x1="-16" y1="-16" x2="16" y2="16" stroke="white" strokeWidth={inW} />
    </g>
  );
}

function ReverseIcon3D({ isCenter }: { isCenter?: boolean }) {
  const shadows = isCenter ? CENTER_SHADOWS : CORNER_SHADOWS;
  const scale = isCenter ? 0.75 : 0.32;
  const outW = isCenter ? 14 : 26;
  const inW = isCenter ? 7.5 : 12;
  const path = "M 24 -23 L 0 -23 A 23 23 0 0 0 -23 0 L -7 0 A 7 7 0 0 1 0 -7 L 24 -7 L 24 5 L 48 -15 L 24 -35 Z";
  return (
    <g transform={`scale(${scale}) rotate(-45)`}>
      {shadows.map(([dx = 0, dy = 0], i) => (
        <g key={`rev-shadow-${i}`} transform={`translate(${dx / scale}, ${dy / scale})`}>
          <path d={path} fill="black" stroke="black" strokeWidth={outW} strokeLinejoin="round" />
          <path d={path} transform="rotate(180)" fill="black" stroke="black" strokeWidth={outW} strokeLinejoin="round" />
        </g>
      ))}
      <path d={path} fill="black" stroke="black" strokeWidth={outW} strokeLinejoin="round" />
      <path d={path} transform="rotate(180)" fill="black" stroke="black" strokeWidth={outW} strokeLinejoin="round" />
      <path d={path} fill="white" stroke="black" strokeWidth={inW} strokeLinejoin="round" paintOrder="stroke fill" />
      <path d={path} transform="rotate(180)" fill="white" stroke="black" strokeWidth={inW} strokeLinejoin="round" paintOrder="stroke fill" />
    </g>
  );
}

function WildIcon3D({ clipId }: { clipId: string }) {
  const scale = 0.65;
  const rx = 18;
  const ry = 24;

  return (
    <g transform={`scale(${scale})`}>
      <defs>
        <clipPath id={clipId}>
          <ellipse cx="0" cy="0" rx={rx} ry={ry} transform="rotate(22)" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <polygon points="0,0 14.98,-37.09 40,-40 40,0" fill="var(--uno-blue)" />
        <polygon points="0,0 40,0 40,40 -14.98,37.09" fill="var(--uno-green)" />
        <polygon points="0,0 -14.98,37.09 -40,40 -40,0" fill="var(--uno-yellow)" />
        <polygon points="0,0 -40,0 -40,-40 14.98,-37.09" fill="var(--uno-red)" />
      </g>
    </g>
  );
}

function Text3D({ text, fontSize, isCenter }: { text: string; fontSize: number; isCenter?: boolean }) {
  const shadows = isCenter ? CENTER_SHADOWS : CORNER_SHADOWS;
  const strokeW = isCenter ? fontSize * 0.16 : fontSize * 0.26;
  const hasLine = text === '6' || text === '9';
  const rectW = fontSize * 0.48;
  const rectH = isCenter ? fontSize * 0.10 : fontSize * 0.16;
  const rectX = -rectW / 2;
  const rectY = isCenter ? fontSize * 0.50 : fontSize * 0.60;
  const rectStrokeW = isCenter ? strokeW : strokeW * 1.4;
  const yOffset = (hasLine && isCenter) ? -fontSize * 0.08 : 0;
  return (
    <g transform={`translate(0, ${yOffset})`}>
      {shadows.map(([dx, dy], i) => (
        <g key={`text-shadow-${i}`} transform={`translate(${dx}, ${dy})`}>
          {hasLine && <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH / 2} fill="black" stroke="black" strokeWidth={strokeW} strokeLinejoin="round" />}
          <text x="0" y="0" textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize }} fill="black" stroke="black" strokeWidth={strokeW} strokeLinejoin="round">{text}</text>
        </g>
      ))}
      {hasLine && <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH / 2} fill="white" stroke="black" strokeWidth={rectStrokeW} strokeLinejoin="round" paintOrder="stroke fill" />}
      <text x="0" y="0" textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize }} fill="white" stroke="black" strokeWidth={strokeW} strokeLinejoin="round" paintOrder="stroke fill">{text}</text>
    </g>
  );
}

interface Props {
  card: UnoCard;
  faceDown?: boolean;
  playable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
  thick?: boolean;
}

export function Card({ card, faceDown, selected, onClick, size = 'md', thick }: Props) {
  const uid = useId();
  const color = effectiveColor(card);
  const bg = card.value === 'wild4' && card.chosenColor ? COLOR_BG[card.chosenColor] : card.color === 'wild' ? COLOR_BG['wild'] : (COLOR_BG[color] ?? 'var(--uno-wild)');
  const label = LABEL[card.value] ?? card.value;

  // Width via CSS variable (defined on the game board root); height via aspect-ratio
  const cardW = size === 'sm' ? 'var(--card-sm-w)' : 'var(--card-md-w)';

  const isSkip = card.value === 'skip';
  const isReverse = card.value === 'reverse';
  const isWild = card.value === 'wild';
  const isWide = !isSkip && !isReverse && !isWild && label.length > 1;
  const topLeftX = isWide ? 22 : isReverse ? 18 : isSkip ? 17 : isWild ? 17 : 16;
  const botRightX = isWide ? 78 : isReverse ? 82 : isSkip ? 83 : isWild ? 83 : 84;

  if (faceDown) {
    return (
      <div
        className={`rounded-lg ${thick ? 'border-[4px]' : 'border-[3px]'} border-white shrink-0 flex items-center justify-center overflow-hidden bg-[var(--uno-ink)]`}
        style={{ width: cardW, aspectRatio: '1 / 1.45', boxShadow: '0 0 0 1px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.2)' }}
      >
        <div
          className="rounded-[50%] flex items-center justify-center shrink-0 -rotate-[15deg]"
          style={{
            background: 'linear-gradient(160deg, var(--uno-red-a) 0%, var(--uno-red-b) 100%)',
            width: '92%',
            height: '38%',
            boxShadow: '0 2px 8px rgba(185,28,28,0.6)',
          }}
        >
          <svg viewBox="0 0 120 56" width="100%" height="100%" className="block overflow-visible">
            <text x="62" y="47" textAnchor="middle" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 54 }} fill="black" letterSpacing="-1">UNO</text>
            <text x="61" y="46" textAnchor="middle" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 54 }} fill="black" letterSpacing="-1">UNO</text>
            <text x="59" y="44" textAnchor="middle" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 54 }} fill="var(--uno-yellow)" stroke="black" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke fill" letterSpacing="-1">UNO</text>
          </svg>
        </div>
      </div>
    );
  }

  const shadow = selected
    ? '0 0 0 1px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.4)'
    : '0 0 0 1px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.2)';

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={[
        'flex items-center justify-center shrink-0 outline-none relative rounded-lg border-white overflow-hidden',
        'transition-[transform,box-shadow] duration-150',
        selected ? 'border-[4px] -translate-y-2' : thick ? 'border-[4px]' : 'border-[3px]',
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].filter(Boolean).join(' ')}
      style={{ width: cardW, aspectRatio: '1 / 1.45', background: bg, boxShadow: shadow }}
    >
      {/* Center Oval */}
      {card.value === 'wild4' ? (
        <div className="absolute w-[80%] h-[92%] rounded-[50%] bg-white rotate-[22deg]" />
      ) : card.color === 'wild' && card.chosenColor ? (
        <div className="absolute w-[80%] h-[92%] rounded-[50%] rotate-[22deg]" style={{ background: COLOR_BG[card.chosenColor] }} />

      ) : card.color === 'wild' ? (
        <div
          className="absolute w-[80%] h-[92%] rounded-[50%] rotate-[22deg]"
          style={{ background: 'conic-gradient(var(--uno-blue) 0deg 68deg, var(--uno-green) 68deg 180deg, var(--uno-yellow) 180deg 248deg, var(--uno-red) 248deg 360deg)' }}
        />
      ) : (
        <div className="absolute w-[80%] h-[92%] rounded-[50%] bg-white/20 rotate-[22deg]" />
      )}

      {/* Native SVG overlay for all text and icons */}
      <svg viewBox="0 0 100 145" className="absolute inset-0 w-full h-full z-10 pointer-events-none">
        {/* Top Left Corner */}
        <g transform={`translate(${topLeftX}, 20)`}>
          {card.value === 'skip' ? <SkipIcon3D /> : card.value === 'reverse' ? <ReverseIcon3D /> : card.value === 'wild' ? <WildIcon3D clipId={`${uid}-wc`} /> : <Text3D text={label} fontSize={32} />}
        </g>

        {/* Bottom Right Corner (Rotated 180deg) */}
        <g transform={`translate(${botRightX}, 125) rotate(180)`}>
          {card.value === 'skip' ? <SkipIcon3D /> : card.value === 'reverse' ? <ReverseIcon3D /> : card.value === 'wild' ? <WildIcon3D clipId={`${uid}-wc`} /> : <Text3D text={label} fontSize={32} />}
        </g>

        {/* Center Content */}
        {card.value === 'wild4' ? (
          <g transform="translate(50, 72.5)">
            {[
              [-1,-1], [1,-1], [-1,1], [1,1],
              [0,1], [1,0], [1,2], [2,1], [2,2], [2,3], [3,2], [3,3], [3,4], [4,3], [4,4],
              [4,5], [5,4], [5,5], [5,6], [6,5], [6,6]
            ].map(([dx, dy], i) => (
              <g key={`w4-shadow-${i}`} transform={`translate(${dx}, ${dy})`} fill="black" stroke="black" strokeWidth="2.5" strokeLinejoin="round">
                <rect x="-31" y="2"   width="20" height="29" rx="3" />
                <rect x="8"   y="-30" width="20" height="29" rx="3" />
                <rect x="-5"  y="-8"  width="20" height="29" rx="3" />
                <rect x="-18" y="-20" width="20" height="29" rx="3" />
              </g>
            ))}
            <rect x="-31" y="2"   width="20" height="29" rx="3" fill="var(--uno-yellow)" />
            <rect x="8"   y="-30" width="20" height="29" rx="3" fill="var(--uno-green)" />
            <rect x="-5"  y="-8"  width="20" height="29" rx="3" fill="var(--uno-blue)" />
            <rect x="-18" y="-20" width="20" height="29" rx="3" fill="var(--uno-red)" />
          </g>
        ) : card.value === 'draw2' ? (
          <g transform="translate(50, 72.5)">
            <g>
              {[
                [-1,-1], [1,-1], [-1,1], [1,1],
                [0,1], [1,0], [1,2], [2,1], [2,2], [2,3], [3,2], [3,3], [3,4], [4,3], [4,4],
                [4,5], [5,4], [5,5], [5,6], [6,5], [6,6]
              ].map(([dx, dy], i) => (
                <rect key={`c1-ext-${i}`} x="-23" y="-13" width="32" height="46" rx="4" fill="black" stroke="black" strokeWidth="2.5" strokeLinejoin="round" transform={`translate(${dx}, ${dy})`} />
              ))}
              <rect x="-23" y="-13" width="32" height="46" rx="4" fill="white" stroke="black" strokeWidth="2.5" strokeLinejoin="round" />
            </g>
            <g>
              {[
                [-1,-1], [1,-1], [-1,1], [1,1],
                [0,1], [1,0], [1,2], [2,1], [2,2], [2,3], [3,2], [3,3], [3,4], [4,3], [4,4],
                [4,5], [5,4], [5,5], [5,6], [6,5], [6,6]
              ].map(([dx, dy], i) => (
                <rect key={`c2-ext-${i}`} x="-9" y="-33" width="32" height="46" rx="4" fill="black" stroke="black" strokeWidth="2.5" strokeLinejoin="round" transform={`translate(${dx}, ${dy})`} />
              ))}
              <rect x="-9" y="-33" width="32" height="46" rx="4" fill="white" stroke="black" strokeWidth="2.5" strokeLinejoin="round" />
            </g>
          </g>
        ) : card.value === 'skip' ? (
          <g transform="translate(50, 72.5)">
            <SkipIcon3D isCenter />
          </g>
        ) : card.value === 'reverse' ? (
          <g transform="translate(50, 72.5)">
            <ReverseIcon3D isCenter />
          </g>
        ) : card.value === 'wild' ? null : (
          <g transform="translate(50, 72.5)">
            <Text3D text={label} fontSize={60} isCenter />
          </g>
        )}
      </svg>
    </button>
  );
}
