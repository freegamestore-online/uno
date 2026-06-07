import { useState, useEffect } from 'react';
import type { Player } from '../lib/uno';
import { Z } from '../lib/zIndex';

interface Props {
  desk: { w: number; h: number };
  attackerSeat: number | null;
  targetSeat: number;
  players: Player[];
  direction: 1 | -1;
}

const PL = 3000;
const SEG = 200;

function posOffset(pos: string | undefined): number {
  if (pos === 'top')    return 0;
  if (pos === 'right')  return 250;
  if (pos === 'bottom') return 500;
  if (pos === 'left')   return 750;
  return 0;
}

export function Wild4LightningSVG({ desk, attackerSeat, targetSeat, players, direction }: Props) {
  const { w, h } = desk;
  const target = players[targetSeat];
  if (!target) return null;

  const ix = 24, iy = 24, ir = 8;
  const loop = `H ${w-ix-ir} A ${ir},${ir} 0 0,1 ${w-ix},${iy+ir} V ${h-iy-ir} A ${ir},${ir} 0 0,1 ${w-ix-ir},${h-iy} H ${ix+ir} A ${ir},${ir} 0 0,1 ${ix},${h-iy-ir} V ${iy+ir} A ${ir},${ir} 0 0,1 ${ix+ir},${iy} H ${w/2}`;
  const innerD = `M ${w/2},${iy} ${loop} ${loop} ${loop} Z`;

  const P = 1000;
  const fromOff = posOffset(attackerSeat !== null ? players[attackerSeat]?.position : undefined) + P;
  let toOff = posOffset(target.position) + P;
  if (direction === 1  && toOff <= fromOff) toOff += 1000;
  if (direction === -1 && toOff >= fromOff) toOff -= 1000;

  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t0 = setTimeout(() => setPhase(1), 30);
    const t1 = setTimeout(() => setPhase(2), 600);
    return () => { clearTimeout(t0); clearTimeout(t1); };
  }, []);

  // Segment trailing edge sits at `offset`; segment occupies [offset-SEG, offset] mod PL
  const offset = phase === 0 ? fromOff : toOff;
  const length = phase === 2 ? 0 : SEG;
  const dashArray = `0 ${PL - length} ${length} 0`;
  const dashOffset = -offset;

  const transition =
    phase === 1 ? `stroke-dashoffset 560ms linear, stroke-dasharray 560ms linear` :
    phase === 2 ? `stroke-dasharray 110ms linear` :
    'none';

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ overflow: 'visible', zIndex: Z.MODAL - 1 }}
    >
      <defs>
        <filter id="wild4-strike-noise" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" seed="13" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="displaced" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={innerD}
        pathLength={PL}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={dashArray}
        strokeDashoffset={dashOffset}
        style={{
          strokeWidth: 4,
          transition,
          filter: 'url(#wild4-strike-noise)',
          animation: 'wild4-color-cycle 0.5s steps(1) infinite, wild4-flicker 0.15s linear infinite',
        }}
      />
    </svg>
  );
}
