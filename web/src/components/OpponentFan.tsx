import type { CSSProperties } from 'react';
import { Card } from './Card';
import type { Player } from '../lib/uno';

interface Props {
  opp: Player;
  hiddenCardIds: Map<string, number>;
  revealAll?: boolean;
}

export function OpponentFan({ opp, hiddenCardIds, revealAll }: Props) {
  const pos = opp.position ?? 'top';
  const total = opp.hand.length;
  const fanCenter = (total - 1) / 2;
  const degsEach = total <= 1 ? 0 : Math.min(10, 60 / (total - 1));
  const xStep = Math.min(24, 200 / Math.max(total - 1, 1));
  const isSidePlayer = pos === 'left' || pos === 'right';
  const baseCurve = isSidePlayer ? 4.5 : 3.5;
  const maxArcPx = isSidePlayer ? 36 : 28;
  const naturalMult = total <= 1 ? 0 : baseCurve / Math.max(1, total * 0.3);
  const yArcMult = total <= 1 ? 0 : Math.min(naturalMult, fanCenter > 0 ? maxArcPx / (fanCenter * fanCenter) : 1);
  const fanAngle = pos === 'left' ? 330 : pos === 'right' ? 30 : 0;

  let layoutStyle: CSSProperties = { top: 'clamp(32px, 8vh, 100px)', left: '50%', transform: 'translateX(-50%)' };
  if (isSidePlayer) {
    const baseInset = Math.max(52, Math.min(window.innerWidth * 0.14, 100));
    const inset = baseInset + Math.min(fanCenter * xStep * 0.55, 52);
    layoutStyle = {
      top: '38%',
      transform: 'translateY(-50%)',
      ...(pos === 'left' ? { left: inset } : { right: inset }),
    };
  }

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        gap: 6,
        ...layoutStyle,
        transition: isSidePlayer ? 'left 0.35s cubic-bezier(0.34,1.56,0.64,1), right 0.35s cubic-bezier(0.34,1.56,0.64,1)' : undefined,
      }}
    >
      <div className="relative w-0 h-0" style={{ transform: `rotate(${fanAngle}deg)` }}>
        {opp.hand.map((card, j) => {
          const offset = j - fanCenter;
          const rot = offset * degsEach;
          const x = offset * xStep;
          const yArc = offset * offset * yArcMult;
          const snapDelay = hiddenCardIds.get(card.id);
          const isHidden = snapDelay !== undefined;
          return (
            <div key={card.id} style={{
              position: 'absolute',
              bottom: 0,
              left: 'calc(var(--card-sm-w) * -0.5)',
              transform: `translateX(${x}px) translateY(${yArc}px) rotate(${rot}deg)`,
              transformOrigin: 'bottom center',
              zIndex: j,
              transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)',
              animation: isHidden ? `snap-visible 700ms ${snapDelay}ms both` : undefined,
            }}>
              <Card card={card} faceDown={!revealAll} size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
