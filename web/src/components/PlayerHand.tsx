import React from 'react';
import { UnoCard, isPlayable } from '../lib/uno';
import { Card } from './Card';

interface DragHandlers {
  startDrag: (e: React.PointerEvent<HTMLElement>, action: () => void, rot?: number, override?: boolean) => void;
  moveDrag: (e: React.PointerEvent<HTMLElement>) => void;
  endDrag: (e: React.PointerEvent<HTMLElement>) => void;
  didDragActionRef: { current: boolean };
  didDragMoveRef: { current: boolean };
}

interface Props {
  hand: UnoCard[];
  isMyTurn: boolean;
  top: UnoCard;
  selected: string | null;
  phase: string;
  pendingCardId: string | null | undefined;
  drawnCard: UnoCard | null | undefined;
  hiddenCardIds: Map<string, number>;
  hasDealLightning: boolean;
  drag: DragHandlers;
  onCardClick: (card: UnoCard) => void;
  onDragPlay: (cardId: string) => void;
  onDeselect: () => void;
}

export function PlayerHand({ hand, isMyTurn, top, selected, phase, pendingCardId, drawnCard, hiddenCardIds, hasDealLightning, drag, onCardClick, onDragPlay, onDeselect }: Props) {
  const anyPlayable = isMyTurn && hand.some(c => isPlayable(c, top));
  const total = hand.length;
  const center = (total - 1) / 2;
  const degsEach = total <= 1 ? 0 : Math.min(6, 40 / (total - 1));
  const maxStep = Math.min(40, window.innerWidth * 0.085);
  const xStep = Math.min(maxStep, Math.max(16, (window.innerWidth * 0.65) / Math.max(total - 1, 1)));
  const handH = Math.min(148, Math.max(110, window.innerHeight * 0.19));
  const yArcMult = total <= 1 ? 0 : Math.max(0.4, 3.0 / Math.max(1, total * 0.2));
  const maxYArc = center * center * yArcMult;
  const anchorBottom = Math.min(12 + maxYArc, handH * 0.82);

  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: handH }}>
      <div
        className="absolute left-1/2 h-0"
        style={{ bottom: anchorBottom, transition: 'bottom 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        {hand.map((card, i) => {
          const offset = i - center;
          const rotation = offset * degsEach;
          const x = offset * xStep;
          const yArc = offset * offset * yArcMult;
          const playable = isMyTurn && isPlayable(card, top);
          const isSelected = selected === card.id;
          const isColorPicking = phase === 'color-pick' && pendingCardId === card.id;
          const lift = isSelected ? -11 : 0;
          const snapDelay = hiddenCardIds.get(card.id);
          const isHidden = snapDelay !== undefined;

          return (
            <div
              key={card.id}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 'calc(var(--card-md-w) * -0.5)',
                transform: `translateX(${x}px) translateY(${yArc + lift}px) rotate(${rotation}deg)`,
                transformOrigin: 'bottom center',
                zIndex: isSelected ? total + 10 : i,
                transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), filter 0.2s ease, z-index 0s',
                animation: isHidden ? `snap-visible 700ms ${snapDelay}ms both` : undefined,
                opacity: isColorPicking ? 0 : 1,
                filter: isColorPicking ? undefined : (drawnCard || (!hasDealLightning && isMyTurn && !isSelected && (!anyPlayable || !playable))) ? 'brightness(0.45)' : undefined,
                pointerEvents: isColorPicking ? 'none' : 'auto',
              }}
              onPointerDown={e => {
                e.stopPropagation();
                if (playable) drag.startDrag(e, () => onDragPlay(card.id), rotation, true);
                else onDeselect();
              }}
              onPointerMove={playable ? drag.moveDrag : undefined}
              onPointerUp={playable ? drag.endDrag : undefined}
              onClick={e => {
                e.stopPropagation();
                if (drag.didDragActionRef.current) { drag.didDragActionRef.current = false; drag.didDragMoveRef.current = false; return; }
                if (drag.didDragMoveRef.current) { drag.didDragMoveRef.current = false; return; }
                if (playable) onCardClick(card);
              }}
            >
              <Card card={card} playable={playable} selected={isSelected} onClick={playable ? () => {} : undefined} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
