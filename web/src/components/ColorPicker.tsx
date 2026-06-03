import { useRef, useState } from 'react';
import { CardColor, UnoCard } from '../lib/uno';
import { Card } from './Card';
import { Z } from '../lib/zIndex';

const SECTORS = [
  { color: 'blue'   as CardColor, fill: '#2563eb', points: '0,0 74.92,-185.44 200,-200 200,0' },
  { color: 'green'  as CardColor, fill: '#16a34a', points: '0,0 200,0 200,200 -74.92,185.44' },
  { color: 'yellow' as CardColor, fill: '#eab308', points: '0,0 -74.92,185.44 -200,200 -200,0' },
  { color: 'red'    as CardColor, fill: '#dc2626', points: '0,0 -200,0 -200,-200 74.92,-185.44' },
];

interface Props {
  onPick: (color: CardColor) => void;
  tx: string;
  ty: string;
  trot: string;
  card: UnoCard;
  isDrag?: boolean;
  startScale?: number;
}

export function ColorPicker({ onPick, tx, ty, trot, card, isDrag, startScale }: Props) {
  const [hovered, setHovered] = useState<CardColor | null>(null);
  const startPos = useRef({ tx, ty, trot, isDrag, startScale });

  return (
    <div className="absolute inset-0 pointer-events-auto overflow-hidden" style={{ zIndex: Z.MODAL }}>
      <div
        className="absolute"
        style={{
          left: 'calc(50% - (var(--card-md-w) / 2) - 10px)',
          top: '50%',
          '--tx': startPos.current.tx,
          '--ty': startPos.current.ty,
          '--trot': startPos.current.trot,
          '--fly-lift': startPos.current.isDrag ? '0px' : undefined,
          '--fly-lift-sm': startPos.current.isDrag ? '0px' : undefined,
          '--fly-start-scale': startPos.current.startScale != null ? String(startPos.current.startScale) : undefined,
          animation: 'fly-to-center 700ms linear forwards',
          transformOrigin: 'center center',
          perspective: '600px',
        } as React.CSSProperties}
      >
        <div
          style={{
            position: 'relative',
            width: 'var(--card-md-w)',
            aspectRatio: '1 / 1.45',
            transformStyle: 'preserve-3d',
            animation: 'card-flip 700ms ease-in-out forwards',
          }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <Card card={card} size="md" />
          </div>

          <div
            className="absolute inset-0 rounded-lg border-[3px] border-white overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.6)] pointer-events-auto bg-[#0a0a0a]"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <svg viewBox="0 0 100 145" className="absolute inset-0 w-full h-full">
              <defs>
                <clipPath id="picker-oval-clip">
                  <ellipse cx="0" cy="0" rx="40" ry="66.7" transform="rotate(22)" />
                </clipPath>
                <path id="arc-top" d="M -46,0 A 46 72.7 0 0 1 46 0" transform="rotate(22)" />
                <path id="arc-bot" d="M -46,0 A 46 72.7 0 0 0 46 0" transform="rotate(22)" />
              </defs>

              <g clipPath="url(#picker-oval-clip)" transform="translate(50, 72.5)">
                {SECTORS.map(({ color, fill, points }) => (
                  <polygon
                    key={color}
                    points={points}
                    fill={fill}
                    stroke={fill}
                    strokeWidth={0.5}
                    strokeLinejoin="round"
                    className="cursor-pointer"
                    style={{
                      opacity: hovered && hovered !== color ? 0.55 : 1,
                      transition: 'opacity 150ms ease-out',
                    }}
                    onClick={() => onPick(color)}
                    onMouseEnter={() => setHovered(color)}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </g>

              <g transform="translate(50, 72.5)">
                <text fill="#ffffff" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: '7.5px' }} letterSpacing="0.8" dominantBaseline="middle">
                  <textPath href="#arc-top" startOffset="24%" textAnchor="middle">CHOOSE</textPath>
                </text>
                <text fill="#ffffff" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 900, fontSize: '7.5px' }} letterSpacing="0.8" dominantBaseline="middle">
                  <textPath href="#arc-bot" startOffset="76%" textAnchor="middle">COLOR</textPath>
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
