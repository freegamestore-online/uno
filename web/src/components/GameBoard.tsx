import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameButton } from '@freegamestore/games';
import { useUnoGame } from '../hooks/useUnoGame';
import { useDrag } from '../hooks/useDrag';
import { useTurnLine } from '../hooks/useTurnLine';
import { useCardFlight } from '../hooks/useCardFlight';
import { useDealLightning } from '../hooks/useDealLightning';
import { ColorPicker } from './ColorPicker';
import { OpponentFan } from './OpponentFan';
import { TurnLineSVG } from './TurnLineSVG';
import { DealLightningSVG } from './DealLightningSVG';
import { PlayerHand } from './PlayerHand';
import { DecisionZoneUI } from './DecisionZoneUI';
import { NameTag } from './NameTag';
import { CardPiles } from './CardPiles';
import { PlayingCardAnim, InitCardReveal, FlyingCardAnim } from './CardAnimations';
import { sortHand, getHumanCardTarget, getDecisionZonePos } from '../lib/boardGeometry';
import { UnoCard, OpponentConfig, topCard, isPlayable, effectiveColor, CardColor } from '../lib/uno';
import { Z } from '../lib/zIndex';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626', green: '#16a34a', blue: '#2563eb', yellow: '#eab308', wild: '#7c3aed',
};

interface Props {
  opponents: OpponentConfig[];
  onExit: () => void;
  onRestart?: () => void;
  onGameInfoChange?: (info: { cards: number; turn: string; isMyTurn: boolean }) => void;
}

export function GameBoard({ opponents, onExit, onRestart, onGameInfoChange }: Props) {
  const [activeSeat, setActiveSeat] = useState<number | null>(0);
  const [initCardRevealed, setInitCardRevealed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerBg, setPickerBg] = useState<'in' | 'out' | null>(null);
  const [drawnCardLanded, setDrawnCardLanded] = useState(false);
  const [drawnFlyAnimId, setDrawnFlyAnimId] = useState<string | null>(null);
  const drawnCardFlyAnimIdRef = useRef<string | null>(null);

  const { state, isLocked, actionTag, humanPlay, humanPickColor, humanDraw, humanPlayDrawn, humanKeepDrawn } = useUnoGame(opponents, initCardRevealed ? activeSeat : null);

  const deskRef = useRef<HTMLDivElement>(null);
  const { startDrag, moveDrag, endDrag, dragPlayOverrideRef, dragDrawOverrideRef, didDragActionRef, didDragMoveRef, dragHintRef, deckHintRef } = useDrag(deskRef);
  const [desk, setDesk] = useState({ w: 700, h: 340 });
  useLayoutEffect(() => {
    if (!deskRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setDesk({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(deskRef.current);
    return () => obs.disconnect();
  }, []);

  const { flyingCards, setFlyingCards, hiddenCardIds, setHiddenCardIds, playingCards, setPlayingCards, hiddenDiscardId, setHiddenDiscardId, removeFlyAnim, drawnCardKeptRef, drawnCardPlayedRef } = useCardFlight({
    players: state.players,
    discard: state.discard,
    drawnCard: state.drawnCard,
    dragDrawOverrideRef,
    dragPlayOverrideRef,
  });

  const { dealLightningOffset, showInitAnim, setShowInitAnim } = useDealLightning(state.players, state.currentPlayer);

  const top = topCard(state);
  const isTopFlying = hiddenDiscardId === top.id && state.discard.length > 1;
  const visualTopCard = isTopFlying ? state.discard[state.discard.length - 2]! : top;
  const topColor = effectiveColor(visualTopCard);
  const visualDirection = (isTopFlying && top.value === 'reverse') ? (state.direction * -1) : state.direction;

  const { turnLine, wildTravelColor, displayedDir, dirOpacity, revealDir } = useTurnLine({
    currentPlayer: state.currentPlayer,
    direction: state.direction,
    visualDirection,
    players: state.players,
    pendingAction: state.pendingAction,
    setActiveSeat,
  });

  const me = state.players[0]!;
  const isMyTurn = state.phase === 'playing' && me.id === 0 && !isLocked && activeSeat === 0 &&
                   !state.pendingAction && !dealLightningOffset && !state.drawnCard && initCardRevealed;

  useEffect(() => {
    if (state.phase === 'color-pick') { setPickerBg('in'); dragPlayOverrideRef.current = null; }
  }, [state.phase]);

  useEffect(() => {
    setDrawnCardLanded(false);
    setDrawnFlyAnimId(null);
    if (!state.drawnCard && drawnCardFlyAnimIdRef.current) {
      removeFlyAnim(drawnCardFlyAnimIdRef.current);
      drawnCardFlyAnimIdRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.drawnCard]);

  useEffect(() => {
    onGameInfoChange?.({ cards: me.hand.length, turn: state.players[state.currentPlayer]?.name ?? '', isMyTurn });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.hand.length, state.currentPlayer, isMyTurn]);

  function handleCardClick(card: UnoCard) {
    if (!isMyTurn) return;
    if (!isPlayable(card, top)) return;
    if (selected === card.id) { humanPlay(card.id); setSelected(null); }
    else setSelected(card.id);
  }

  function handlePickColor(color: CardColor) {
    setPickerBg('out');
    setTimeout(() => setPickerBg(null), 600);
    if (selected) { humanPlay(selected, color); setSelected(null); }
    else humanPickColor(color);
  }

  function handlePlayDrawn(dragOffsetX = 0, dragOffsetY = 0) {
    if (!state.drawnCard) return;
    const card = state.drawnCard;
    setDrawnCardLanded(false);
    if (drawnCardFlyAnimIdRef.current) { removeFlyAnim(drawnCardFlyAnimIdRef.current); drawnCardFlyAnimIdRef.current = null; }
    const dz = getDecisionZonePos();
    const tx = `${parseFloat(dz.tx) + dragOffsetX}px`;
    const ty = `${parseFloat(dz.ty) + dragOffsetY}px`;
    const fromDrag = dragOffsetX !== 0 || dragOffsetY !== 0;
    if (card.value === 'wild' || card.value === 'wild4') {
      drawnCardPlayedRef.current = card.id;
      dragPlayOverrideRef.current = { tx, ty, trot: dz.trot, startScale: dz.startScale };
    } else {
      setPlayingCards(prev => [...prev, { id: `play-${Date.now()}`, tx, ty, trot: dz.trot, startScale: dz.startScale, card, isCPU: false, isFromPicker: false, isDrag: fromDrag, isDecisionZone: !fromDrag }]);
      setHiddenDiscardId(card.id);
    }
    humanPlayDrawn();
  }

  function handleKeepDrawn(dragOffsetX = 0, dragOffsetY = 0) {
    if (!state.drawnCard) return;
    const card = state.drawnCard;
    const dz = getDecisionZonePos();
    const { tx: fanTx, ty: fanTy, trot: fanTrot, tzIndex: fanTz } = getHumanCardTarget([...me.hand, card], card.id);
    drawnCardKeptRef.current = card.id;
    setDrawnCardLanded(false);
    if (drawnCardFlyAnimIdRef.current) { removeFlyAnim(drawnCardFlyAnimIdRef.current); drawnCardFlyAnimIdRef.current = null; }
    setHiddenCardIds(prev => new Map([...prev, [card.id, 0]]));
    setFlyingCards(prev => [...prev, {
      id: `keep-${Date.now()}`, cardId: card.id, playerId: 0, delay: 0,
      tx: fanTx, ty: fanTy, trot: fanTrot, tzIndex: fanTz, size: 'md' as const, card,
      isKeepDraw: dragOffsetX === 0 && dragOffsetY === 0,
      isDragKeep: dragOffsetX !== 0 || dragOffsetY !== 0,
      drawStartX: `${parseFloat(dz.tx) + dragOffsetX}px`,
      drawStartY: `${parseFloat(dz.ty) + dragOffsetY}px`,
    }]);
    humanKeepDrawn();
  }

  const drag = { startDrag, moveDrag, endDrag, didDragActionRef, didDragMoveRef, deckHintRef };

  return (
    <div
      id="board-container"
      className="relative isolate w-full h-full overflow-hidden"
      onClick={() => setSelected(null)}
      style={{ '--card-sm-w': 'clamp(28px, 7vw, 36px)', '--card-md-w': 'clamp(40px, 10vw, 52px)' } as React.CSSProperties}
    >
      {state.players.slice(1).map(opp => (
        <OpponentFan key={opp.id} opp={opp} hiddenCardIds={hiddenCardIds} />
      ))}

      <div
        ref={deskRef}
        className="absolute flex items-center justify-center"
        style={{
          inset: 0, margin: 'auto', width: 'min(88vw, 700px)', height: 'clamp(200px, 44vh, 420px)',
          borderRadius: 32, background: 'radial-gradient(ellipse at 50% 40%, #1a5c32 0%, #0f3d20 100%)',
          border: '2px solid rgba(255,255,255,0.07)',
          boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.6)',
          animation: 'fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <TurnLineSVG desk={desk} displayedDir={displayedDir} dirOpacity={dirOpacity} color={COLOR_BG[topColor] ?? '#ffffff'} turnLine={turnLine} wildTravelColor={wildTravelColor} direction={state.direction} pendingAction={state.pendingAction} />
        {dealLightningOffset && <DealLightningSVG deskW={desk.w} deskH={desk.h} dealLightningOffset={dealLightningOffset} />}
        {state.players.map((p, idx) => (
          <NameTag key={p.id} player={p} idx={idx} activeSeat={activeSeat} initCardRevealed={initCardRevealed} actionTag={actionTag} />
        ))}
        <CardPiles top={top} visualTopCard={visualTopCard} isMyTurn={isMyTurn} meHand={me.hand} drawnCard={state.drawnCard} initCardRevealed={initCardRevealed} drag={drag} onDraw={() => { setSelected(null); humanDraw(); }} />
      </div>

      <PlayerHand
        hand={sortHand(me.hand)} isMyTurn={isMyTurn} top={top} selected={selected}
        phase={state.phase} pendingCardId={state.pendingCardId} drawnCard={state.drawnCard}
        hiddenCardIds={hiddenCardIds} hasDealLightning={!!dealLightningOffset}
        drag={{ startDrag, moveDrag, endDrag, didDragActionRef, didDragMoveRef }}
        onCardClick={handleCardClick}
        onDragPlay={cardId => { setSelected(null); humanPlay(cardId); }}
        onDeselect={() => setSelected(null)}
      />

      {flyingCards.map(fc => (
        <div key={fc.id} style={drawnFlyAnimId === fc.id ? { visibility: 'hidden' } : undefined}>
          <FlyingCardAnim
            playerId={fc.playerId} delay={fc.delay} tx={fc.tx} ty={fc.ty} trot={fc.trot}
            tzIndex={fc.tzIndex} size={fc.size} card={fc.card}
            isDragDraw={fc.isDragDraw} isKeepDraw={fc.isKeepDraw} isDragKeep={fc.isDragKeep}
            drawStartX={fc.drawStartX} drawStartY={fc.drawStartY}
            onDone={() => {
              if (state.drawnCard?.id === fc.cardId) {
                drawnCardFlyAnimIdRef.current = fc.id;
                setDrawnFlyAnimId(fc.id);
                setDrawnCardLanded(true);
              } else {
                removeFlyAnim(fc.id);
                setHiddenCardIds(prev => {
                  if (!prev.has(fc.cardId)) return prev;
                  const next = new Map(prev); next.delete(fc.cardId); return next;
                });
              }
            }}
          />
        </div>
      ))}

      {showInitAnim && (
        <InitCardReveal card={state.discard[0]!} onDone={() => { setShowInitAnim(false); setInitCardRevealed(true); revealDir(); }} />
      )}

      {playingCards.map(pc => (
        <PlayingCardAnim key={pc.id} startX={pc.tx} startY={pc.ty} startRot={pc.trot} startScale={pc.startScale} card={pc.card} isCPU={pc.isCPU} isFromPicker={pc.isFromPicker} isDrag={pc.isDrag} isDecisionZone={pc.isDecisionZone}
          onDone={() => { setPlayingCards(prev => prev.filter(c => c.id !== pc.id)); setHiddenDiscardId(null); }}
        />
      ))}

      <div ref={dragHintRef} className="absolute pointer-events-none font-sans font-semibold" style={{ left: 0, top: 0, transform: 'translate(-50%, -50%)', zIndex: Z.DRAG_HINT, color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 100ms ease' }} />

      {state.drawnCard && drawnCardLanded && (
        <DecisionZoneUI drawnCard={state.drawnCard} onPlay={handlePlayDrawn} onKeep={handleKeepDrawn} />
      )}

      {pickerBg && (
        <div className="absolute inset-0 bg-black/60 pointer-events-none" style={{ zIndex: Z.COLOR_DIM, animation: pickerBg === 'in' ? 'fade-in 700ms ease-out forwards' : 'fade-out 600ms ease-out forwards' }} />
      )}

      {state.phase === 'color-pick' && state.pendingCardId && (() => {
        const card = me.hand.find(c => c.id === state.pendingCardId)!;
        const dragPos = dragPlayOverrideRef.current;
        const { tx, ty, trot } = dragPos ?? getHumanCardTarget(me.hand, card.id, true);
        return <ColorPicker onPick={handlePickColor} tx={tx} ty={ty} trot={trot} card={card} isDrag={!!dragPos} startScale={dragPos?.startScale} />;
      })()}

      {state.phase === 'game-over' && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-5" style={{ zIndex: Z.MODAL }}>
          <p className="text-white text-[32px] font-serif font-extrabold m-0">
            {state.winner === 0 ? 'You Win!' : `${state.players[state.winner ?? 0]?.name ?? 'CPU'} Wins!`}
          </p>
          <div className="flex gap-3">
            <GameButton variant="primary" size="lg" onClick={() => onRestart?.()}>Play Again</GameButton>
            <GameButton variant="secondary" size="lg" onClick={onExit}>Menu</GameButton>
          </div>
        </div>
      )}
    </div>
  );
}
