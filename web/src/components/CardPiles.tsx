import React from 'react';
import { UnoCard, isPlayable } from '../lib/uno';
import { Card } from './Card';

interface DragHandlers {
  startDrag: (e: React.PointerEvent<HTMLElement>, action: () => void, rot?: number, override?: boolean, invertY?: boolean) => void;
  moveDrag: (e: React.PointerEvent<HTMLElement>) => void;
  endDrag: (e: React.PointerEvent<HTMLElement>) => void;
  didDragActionRef: { current: boolean };
  didDragMoveRef: { current: boolean };
  deckHintRef: React.RefObject<HTMLDivElement | null>;
}

interface Props {
  top: UnoCard;
  visualTopCard: UnoCard;
  isMyTurn: boolean;
  meHand: UnoCard[];
  drawnCard: UnoCard | null | undefined;
  initCardRevealed: boolean;
  drag: DragHandlers;
  onDraw: () => void;
}

export function CardPiles({ top, visualTopCard, isMyTurn, meHand, drawnCard, initCardRevealed, drag, onDraw }: Props) {
  const hasPlayable = meHand.some(c => isPlayable(c, top));

  return (
    <div id="piles-row" className="flex gap-5 items-center relative">
      {/* Draw pile */}
      <div
        className="relative shrink-0"
        style={{
          width: 'var(--card-md-w)', aspectRatio: '1 / 1.45',
          animation: isMyTurn && !hasPlayable ? 'draw-pile-pulse 1.4s ease-in-out infinite' : undefined,
          filter: drawnCard ? 'brightness(0.45)' : undefined,
        }}
      >
        {Array.from({ length: 4 }).map((_, i, arr) => {
          const isTop = i === arr.length - 1;
          return (
            <button
              key={i}
              onPointerDown={isTop && isMyTurn ? e => { e.stopPropagation(); drag.startDrag(e, onDraw, 0, false, true); } : undefined}
              onPointerMove={isTop && isMyTurn ? drag.moveDrag : undefined}
              onPointerUp={isTop && isMyTurn ? drag.endDrag : undefined}
              onClick={isTop && isMyTurn ? e => {
                e.stopPropagation();
                if (drag.didDragActionRef.current) { drag.didDragActionRef.current = false; drag.didDragMoveRef.current = false; return; }
                if (drag.didDragMoveRef.current) { drag.didDragMoveRef.current = false; return; }
                onDraw();
              } : undefined}
              disabled={!isTop || !isMyTurn}
              className={`absolute inset-0 bg-transparent border-none p-0 outline-none ${isTop && isMyTurn ? 'cursor-pointer' : 'cursor-default'} ${!isTop ? 'pointer-events-none' : ''}`}
              style={{ zIndex: i, transform: `translateY(-${i * 2.5}px)` }}
            >
              <Card card={{ id: `draw-${i}`, color: 'wild', value: 'wild' }} faceDown />
            </button>
          );
        })}
      </div>

      {/* Discard pile */}
      <div className="relative shrink-0" style={{ width: 'var(--card-md-w)', aspectRatio: '1 / 1.45' }}>
        {initCardRevealed ? (
          <div className="absolute inset-0 pointer-events-none"><Card card={visualTopCard} /></div>
        ) : (
          <div className="absolute inset-0 rounded-lg border-[3px]" style={{ borderColor: 'rgba(255,255,255,0.15)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)' }} />
        )}
      </div>

      {/* Deck-drag hint — must live inside desk stacking context */}
      <div
        ref={drag.deckHintRef}
        className="absolute pointer-events-none font-sans font-semibold"
        style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)', zIndex: 88, color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 100ms ease' }}
      />
    </div>
  );
}
