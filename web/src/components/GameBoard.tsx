import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameButton } from '@freegamestore/games';
import { useUnoGame, AnimWatchRef } from '../hooks/useUnoGame';
import { useDrag } from '../hooks/useDrag';
import { useTurnLine } from '../hooks/useTurnLine';
import { useCardFlight } from '../hooks/useCardFlight';
import { useDealLightning } from '../hooks/useDealLightning';
import { ColorPicker } from './ColorPicker';
import { OpponentFan } from './OpponentFan';
import { TurnLineSVG } from './TurnLineSVG';
import { DealLightningSVG } from './DealLightningSVG';
import { Wild4LightningSVG } from './Wild4LightningSVG';
import { PlayerHand } from './PlayerHand';
import { DecisionZoneUI } from './DecisionZoneUI';
import { ChallengeUI, ChallengeOopsText, CpuChallengePrompt, CpuChallengeOopsText } from './ChallengeUI';
import { NameTag } from './NameTag';
import { CardPiles } from './CardPiles';
import { PlayingCardAnim, InitCardReveal, FlyingCardAnim } from './CardAnimations';
import { sortHand, getHumanCardTarget, getDecisionZonePos } from '../lib/boardGeometry';
import { UnoCard, OpponentConfig, topCard, isPlayable, effectiveColor, CardColor } from '../lib/uno';
import { Z } from '../lib/zIndex';

const COLOR_BG: Record<string, string> = {
  red: 'var(--uno-red)', green: 'var(--uno-green)', blue: 'var(--uno-blue)', yellow: 'var(--uno-yellow)', wild: 'var(--uno-wild)',
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
  const [unoCalled, setUnoCalled] = useState(false);
  const [unoFlash, setUnoFlash] = useState(false);
  const [unoTagActive, setUnoTagActive] = useState(false);
  const [bustedSeats, setBustedSeats] = useState<Set<number>>(new Set());
  const [showWinScreen, setShowWinScreen] = useState(false);
const [challengeDismissed, setChallengeDismissed] = useState(false);
  const [challengeOops, setChallengeOops] = useState(false);
  const [cpuChallengeOops, setCpuChallengeOops] = useState(false);
  const prevCpuOopsKeyRef = useRef(0);
  const [cpuUnoSeats, setCpuUnoSeats] = useState<Set<number>>(new Set());
  const [cpuUnoCalledState, setCpuUnoCalledState] = useState<Set<number>>(new Set());
  const [bustPopSeats, setBustPopSeats] = useState<Set<number>>(new Set());
  const [gotchaSeat, setGotchaSeat] = useState<number | null>(null);
  const bustActiveRef = useRef(false);
  const caughtBustsRef = useRef(new Set<number>());
  const bustedSeatsRef = useRef(bustedSeats);
  bustedSeatsRef.current = bustedSeats;
  const prevAllHandsRef = useRef<number[]>([]);
  const unoCalledRef = useRef(false);
  unoCalledRef.current = unoCalled;
  const cpuUnoCalledRef = useRef(new Set<number>());
  const cpuUnoForgotRef = useRef(new Set<number>());
  const recentUnoCalledRef = useRef(false);
  const prevHandLengthRef = useRef(0);

  const animWatchRef = useRef<AnimWatchRef>({ watchDraw: () => Promise.resolve(), watchCardAnim: () => Promise.resolve(), waitAllAnims: () => Promise.resolve() });

  const { state, isLocked, actionTag, wild4Strike, cpuChallengeDecided, cpuChallengeOopsKey, humanPlay, humanPickColor, humanDraw, humanPlayDrawn, humanKeepDrawn, acceptDraw4, humanChallenge, bustDraw, debugAddCard } = useUnoGame(opponents, initCardRevealed ? activeSeat : null, animWatchRef, bustActiveRef);
  const [revealAll, setRevealAll] = useState(false);

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

  const { flyingCards, setFlyingCards, hiddenCardIds, setHiddenCardIds, playingCards, setPlayingCards, hiddenDiscardId, setHiddenDiscardId, removeFlyAnim, registerDrawWatch, watchCardAnim, waitAllAnims, drawnCardKeptRef, drawnCardPlayedRef } = useCardFlight({
    players: state.players,
    discard: state.discard,
    drawnCard: state.drawnCard,
    dragDrawOverrideRef,
    dragPlayOverrideRef,
  });
  animWatchRef.current = { watchDraw: registerDrawWatch, watchCardAnim, waitAllAnims };

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
    animWatchRef,
  });

  const me = state.players[0]!;
  // Block active-seat highlight while a bust is pending; action tags still show (NameTag handles per-seat priority)
  const bustBlocked = bustedSeats.size > 0 || bustPopSeats.size > 0;
  const effectiveActiveSeat = bustBlocked ? null : activeSeat;
  const effectiveActionTag = actionTag;

  const isMyTurn = state.phase === 'playing' && me.id === 0 && !isLocked && activeSeat === 0 &&
                   !state.pendingAction && !dealLightningOffset && !state.drawnCard && initCardRevealed;

  const pa = state.pendingAction;
  const pendingWild4ForHuman = pa?.type === 'wild4' && pa.target === 0 && pa.attacker != null && activeSeat === 0 && !hiddenDiscardId;
  const pendingWild4ForCPU = pa?.type === 'wild4' && pa.target !== 0 && !hiddenDiscardId;
  useEffect(() => {
    if (!pendingWild4ForHuman) { setChallengeDismissed(false); setChallengeOops(false); }
  }, [pendingWild4ForHuman]);
  useEffect(() => {
    if (cpuChallengeOopsKey === prevCpuOopsKeyRef.current) return;
    prevCpuOopsKeyRef.current = cpuChallengeOopsKey;
    setCpuChallengeOops(true);
    const t = setTimeout(() => setCpuChallengeOops(false), 1600);
    return () => clearTimeout(t);
  }, [cpuChallengeOopsKey]);

  useEffect(() => {
    if (state.phase === 'color-pick') { setPickerBg('in'); dragPlayOverrideRef.current = null; }
    if (state.phase !== 'game-over') { setShowWinScreen(false); return; }
    let cancelled = false;
    (async () => {
      await animWatchRef.current.waitAllAnims();
      if (!cancelled) setShowWinScreen(true);
    })();
    return () => { cancelled = true; };
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

  useEffect(() => {
    const prev = prevHandLengthRef.current;
    prevHandLengthRef.current = me.hand.length;
    if (me.hand.length > prev) setUnoCalled(false);
  }, [me.hand.length]);

  useEffect(() => {
    if (state.drawnCard && me.hand.length === 1) setUnoCalled(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.drawnCard]);

  // Bust detection: any player going 2→1 without calling UNO
  const handLengthsKey = state.players.map(p => p.hand.length).join(',');
  useEffect(() => {
    const hands = state.players.map(p => p.hand.length);
    const prev = prevAllHandsRef.current;
    if (prev.length > 0 && state.phase === 'playing') {
      state.players.forEach((player, idx) => {
        const prevLen = prev[idx] ?? player.hand.length;
        if (prevLen === 2 && player.hand.length === 1) {
          const wasCalled = player.isHuman ? unoCalledRef.current : cpuUnoCalledRef.current.has(idx);
          if (!wasCalled) setBustedSeats(s => new Set([...s, idx]));
        }
      });
    }
    prevAllHandsRef.current = hands;
    setCpuUnoCalledState(prev => {
      if (prev.size === 0) return prev;
      const n = new Set(prev);
      for (const seat of prev) { if (state.players[seat]?.hand.length !== 1) n.delete(seat); }
      return n.size === prev.size ? prev : n;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handLengthsKey]);

  // Clear UNO round-memory when nobody has UNO status anymore
  useEffect(() => {
    if (!unoCalled && cpuUnoCalledState.size === 0) recentUnoCalledRef.current = false;
  }, [unoCalled, cpuUnoCalledState]);

  // Close bust window once a real player's turn is active (skip null = mid-animation)
  useEffect(() => {
    if (activeSeat === null) return;
    setBustedSeats(s => {
      if (s.size === 0) return s;
      const n = new Set<number>();
      for (const seat of s) { if (activeSeat === seat) n.add(seat); }
      return n.size === s.size ? s : n;
    });
  }, [activeSeat]);

  async function handleBust(seatIdx: number, busterId?: number) {
    if (!bustedSeatsRef.current.has(seatIdx)) return; // window already closed
    if (caughtBustsRef.current.has(seatIdx)) return;
    caughtBustsRef.current.add(seatIdx);
    setTimeout(() => caughtBustsRef.current.delete(seatIdx), 2000);
    setBustedSeats(s => { const n = new Set(s); n.delete(seatIdx); return n; });
    setBustPopSeats(s => new Set([...s, seatIdx]));
    if (busterId !== undefined) { setGotchaSeat(busterId); bustActiveRef.current = true; }
    const unlock = bustDraw(seatIdx);
    await registerDrawWatch(seatIdx);
    setBustPopSeats(s => { const n = new Set(s); n.delete(seatIdx); return n; });
    bustActiveRef.current = false;
    setGotchaSeat(null);
    unlock();
  }

  // CPU auto-catching — one randomly chosen noticer per busted seat so multiple CPUs don't always produce an instant minimum
  const bustedSeatsStr = [...bustedSeats].sort().join(',');
  useEffect(() => {
    if (!bustedSeats.size) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const bustedSeat of bustedSeats) {
      const candidates = state.players
        .map((player, idx) => ({ player, idx }))
        .filter(({ player, idx }) => !player.isHuman && idx !== bustedSeat);
      // Shuffle so the "first noticer" is random, not always the same player
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
      }
      for (const { player, idx: cpuIdx } of candidates) {
        const diff = player.difficulty ?? 'hard';
        // Stage 1: does this player decide to call bust?
        const chance = diff === 'hard' ? 0.95 : diff === 'medium' ? 0.75 : 0.5;
        if (Math.random() >= chance) continue;
        // Stage 2: reaction latency — how fast do they click once they've decided
        const delay = diff === 'hard' ? 300 + Math.random() * 400 :   // alpha: 300–700ms
                      diff === 'medium' ? 500 + Math.random() * 700 :  // beta: 500–1200ms
                      1000 + Math.random() * 700;                      // gamma: slow, 1000–1700ms
        timers.push(setTimeout(() => handleBust(bustedSeat, cpuIdx), delay));
        break;
      }
    }
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bustedSeatsStr]);

  // Cancel UNO for human when their 1 remaining card is unplayable at turn start
  useEffect(() => {
    if (!unoCalled || activeSeat !== 0 || me.hand.length !== 1) return;
    if (me.hand.some(c => isPlayable(c, top))) return;
    setUnoCalled(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeat]);

  // CPU pre-play UNO call — fires when a CPU with 2 cards and a playable card becomes active
  useEffect(() => {
    if (activeSeat !== null) cpuUnoCalledRef.current.clear();
    if (activeSeat === null || activeSeat === 0) return;
    const player = state.players[activeSeat];
    if (!player || player.isHuman) return;
    // Don't call UNO while being penalised — activeSeat lands on the victim before the action resolves
    const pa = state.pendingAction;
    if (pa && (pa.type === 'skip' || pa.type === 'wild4' || (pa.type === 'reverse' && state.players.length === 2)) && pa.target === activeSeat) return;
    // Cancel UNO if CPU's 1 remaining card is unplayable
    if (player.hand.length === 1 && !player.hand.some(c => isPlayable(c, top))) {
      setCpuUnoCalledState(s => { const n = new Set(s); n.delete(activeSeat); return n; });
      cpuUnoForgotRef.current.add(activeSeat);
      return;
    }
    if (player.hand.length !== 2) return;
    if (!player.hand.some(c => isPlayable(c, top))) return;
    const diff = player.difficulty ?? 'hard';
    const forgot = cpuUnoForgotRef.current.has(activeSeat);
    const boost = recentUnoCalledRef.current ? Math.random() * 0.10 : 0;
    const baseChance = diff === 'hard' ? 0.95 : diff === 'medium' ? 0.75 : 0.50;
    const chance = Math.min((forgot ? baseChance - Math.random() * 0.10 : baseChance) + boost, 1.0);
    if (Math.random() >= chance) return;
    const delay = diff === 'hard' ? 50 + Math.random() * 200 :
                  diff === 'medium' ? 100 + Math.random() * 300 :
                  150 + Math.random() * 300;
    const seat = activeSeat;
    const t = setTimeout(() => {
      cpuUnoCalledRef.current.add(seat);
      cpuUnoForgotRef.current.delete(seat);
      recentUnoCalledRef.current = true;
      setCpuUnoCalledState(s => new Set([...s, seat]));
      setCpuUnoSeats(s => new Set([...s, seat]));
      setTimeout(() => setCpuUnoSeats(s => { const n = new Set(s); n.delete(seat); return n; }), 1400);
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeat]);

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
        <OpponentFan key={opp.id} opp={opp} hiddenCardIds={hiddenCardIds} revealAll={revealAll} />
      ))}

      <div
        ref={deskRef}
        className="absolute flex items-center justify-center"
        style={{
          inset: 0, margin: 'auto', width: 'min(88vw, 700px)', height: 'clamp(200px, 44vh, 420px)',
          borderRadius: 32, background: 'radial-gradient(ellipse at 50% 40%, var(--uno-felt-a) 0%, var(--uno-felt-b) 100%)',
          border: '2px solid rgba(255,255,255,0.07)',
          boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.6)',
          animation: 'fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <TurnLineSVG desk={desk} displayedDir={displayedDir} dirOpacity={dirOpacity} color={COLOR_BG[topColor] ?? 'white'} turnLine={turnLine} wildTravelColor={wildTravelColor} direction={state.direction} pendingAction={state.pendingAction} />
        {dealLightningOffset && <DealLightningSVG deskW={desk.w} deskH={desk.h} dealLightningOffset={dealLightningOffset} />}
        {wild4Strike !== null && <Wild4LightningSVG desk={desk} attackerSeat={pa?.attacker ?? null} targetSeat={wild4Strike} players={state.players} direction={state.direction} />}
        {state.players.map((p, idx) => (
          <NameTag key={p.id} player={p} idx={idx} activeSeat={effectiveActiveSeat} initCardRevealed={initCardRevealed} actionTag={effectiveActionTag} unoCalled={p.id === 0 ? unoCalled : cpuUnoCalledState.has(idx)} unoTagActive={p.id === 0 ? unoTagActive : cpuUnoSeats.has(idx)} isBusted={bustedSeats.has(idx) && idx !== 0} bustPopActive={bustPopSeats.has(idx)} isGotcha={gotchaSeat === idx} onBust={bustedSeats.has(idx) && idx !== 0 ? () => handleBust(idx, 0) : undefined} />
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

      {pendingWild4ForHuman && !challengeDismissed && (
        <ChallengeUI
          attackerName={state.players[state.pendingAction!.attacker ?? -1]?.name ?? 'CPU'}
          prevColor={state.pendingAction!.prevColor}
          onChallenge={() => {
            setChallengeDismissed(true);
            humanChallenge(succeeded => { if (!succeeded) setChallengeOops(true); });
          }}
          onAccept={() => { setChallengeDismissed(true); acceptDraw4(0); }}
        />
      )}

      {challengeOops && <ChallengeOopsText />}

      {pendingWild4ForCPU && !cpuChallengeDecided && (
        <CpuChallengePrompt
          attackerName={state.players[state.pendingAction!.attacker ?? -1]?.name ?? 'CPU'}
          prevColor={state.pendingAction!.prevColor}
        />
      )}
      {cpuChallengeOops && <CpuChallengeOopsText />}

      {(() => {
        const inBustWindow = bustedSeats.has(0);
        const canCallUno = !unoCalled && (
          (isMyTurn && me.hand.length === 2 && me.hand.some(c => isPlayable(c, top))) ||
          (state.drawnCard != null && isPlayable(state.drawnCard, top) && me.hand.length === 1) ||
          inBustWindow
        );
        return (
          <button
            disabled={!canCallUno}
            className="absolute font-sans font-bold bg-transparent border rounded-full"
            style={{ bottom: 'clamp(10px, 2.5vh, 20px)', right: 'clamp(10px, 2.5vw, 18px)', zIndex: Z.DECISION, padding: '6px 18px', fontSize: 'clamp(13px, 3.5vw, 15px)', letterSpacing: '0.04em', borderColor: 'var(--uno-pink)', color: 'var(--uno-pink)', opacity: canCallUno ? 1 : 0.4, cursor: canCallUno ? 'pointer' : 'default', transform: unoFlash ? 'scale(1.15)' : 'scale(1)', transition: 'transform 150ms ease, opacity 300ms ease', boxShadow: unoFlash ? '0 0 12px rgba(244,114,182,0.6)' : 'none' }}
            onClick={() => { setUnoCalled(true); recentUnoCalledRef.current = true; setUnoFlash(true); setUnoTagActive(true); setTimeout(() => setUnoFlash(false), 600); setTimeout(() => setUnoTagActive(false), 1400); if (inBustWindow) setBustedSeats(s => { const n = new Set(s); n.delete(0); return n; }); }}
          >
            Call UNO!
          </button>
        );
      })()}

      <div className="absolute flex gap-1" style={{ bottom: 'clamp(10px, 2.5vh, 20px)', left: 'clamp(10px, 2.5vw, 18px)', zIndex: Z.DECISION }}>
        {[{ label: '+4', value: 'wild4' as const }, { label: '🎨', value: 'wild' as const }].map(({ label, value }) => (
          <button key={value} onClick={() => debugAddCard(value, 0)}
            className="font-sans font-bold bg-transparent border rounded-full"
            style={{ padding: '4px 12px', fontSize: 13, borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.5)' }}>
            {label}
          </button>
        ))}
        <button onClick={() => debugAddCard('wild4', state.players.slice(1).map((_, i) => i + 1))}
          className="font-sans font-bold bg-transparent border rounded-full"
          style={{ padding: '4px 12px', fontSize: 13, borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.5)' }}>
          🤖+4
        </button>
        <button onClick={() => setRevealAll(v => !v)}
          className="font-sans font-bold bg-transparent border rounded-full"
          style={{ padding: '4px 12px', fontSize: 13, borderColor: revealAll ? 'var(--uno-yellow)' : 'rgba(255,255,255,0.3)', color: revealAll ? 'var(--uno-yellow)' : 'rgba(255,255,255,0.5)' }}>
          👁
        </button>
      </div>

      {pickerBg && (
        <div className="absolute inset-0 bg-black/60 pointer-events-none" style={{ zIndex: Z.COLOR_DIM, animation: pickerBg === 'in' ? 'fade-in 700ms ease-out forwards' : 'fade-out 600ms ease-out forwards' }} />
      )}

      {state.phase === 'color-pick' && state.pendingCardId && (() => {
        const card = me.hand.find(c => c.id === state.pendingCardId)!;
        const dragPos = dragPlayOverrideRef.current;
        const { tx, ty, trot } = dragPos ?? getHumanCardTarget(me.hand, card.id, true);
        return <ColorPicker onPick={handlePickColor} tx={tx} ty={ty} trot={trot} card={card} isDrag={!!dragPos} startScale={dragPos?.startScale} />;
      })()}


      {showWinScreen && (
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
