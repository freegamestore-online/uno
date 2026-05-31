import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameButton } from '@freegamestore/games';
import { useUnoGame } from '../hooks/useUnoGame';
import { Card } from './Card';
import { ColorPicker } from './ColorPicker';
import { PlayingCardAnim, InitCardReveal, FlyingCardAnim } from './CardAnimations';
import { FlyAnim, sortHand, getHumanCardTarget, getCPUCardTarget, getDecisionZonePos } from '../lib/boardGeometry';
import { useDrag } from '../hooks/useDrag';
import { UnoCard, OpponentConfig, Player, topCard, isPlayable, effectiveColor, CardColor } from '../lib/uno';
import { Z } from '../lib/zIndex';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626',
  green: '#16a34a',
  blue: '#2563eb',
  yellow: '#eab308',
  wild: '#7c3aed',
};



interface Props {
  opponents: OpponentConfig[];
  onExit: () => void;
  onRestart?: () => void;
  onGameInfoChange?: (info: { cards: number; turn: string; isMyTurn: boolean }) => void;
}

export function GameBoard({ opponents, onExit, onRestart, onGameInfoChange }: Props) {
  // activeSeat and initCardRevealed must be declared before useUnoGame so they can be passed in
  const [activeSeat, setActiveSeat] = useState<number | null>(0);
  const [initCardRevealed, setInitCardRevealed] = useState(false);
  const { state, isLocked, actionTag, humanPlay, humanPickColor, humanDraw, humanPlayDrawn, humanKeepDrawn, restart } = useUnoGame(opponents, initCardRevealed ? activeSeat : null);
  const [drawnCardLanded, setDrawnCardLanded] = useState(false);
  const [drawnCardCssTop, setDrawnCardCssTop] = useState(0);
  const drawnCardFlyAnimIdRef = useRef<string | null>(null);
  const drawnCardDzRef = useRef<ReturnType<typeof getDecisionZonePos> | null>(null);
  const drawnCardKeptRef = useRef<string | null>(null);
  const drawnCardPlayedRef = useRef<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [flyingCards, setFlyingCards] = useState<FlyAnim[]>([]);
  // cardId → animation delay ms; card stays invisible until its flying card lands (humans + CPUs)
  const [hiddenCardIds, setHiddenCardIds] = useState<Map<string, number>>(new Map());
  const knownCardIdsRef = useRef<Set<string>>(new Set());
  const prevHandLengthsRef = useRef<number[]>([]);
  // Play animation: card flies from player's slot to discard pile
  const [playingCards, setPlayingCards] = useState<Array<{ id: string; tx: string; ty: string; trot: string; startScale?: number; card: UnoCard; isCPU?: boolean; isFromPicker?: boolean; isDrag?: boolean; isDecisionZone?: boolean }>>([]);
  const [hiddenDiscardId, setHiddenDiscardId] = useState<string | null>(null);
  const prevDiscardIdsRef = useRef<Set<string>>(new Set());
  const prevPlayersRef = useRef<Player[]>([]);
  // Turn-line animation state
  const [turnLine, setTurnLine] = useState({ offset: 0, length: 0, traveling: false });
  const [wildTravelColor, setWildTravelColor] = useState<string | null>(null);
  const [animatingFrom, setAnimatingFrom] = useState<number>(0);
  const [pickerBg, setPickerBg] = useState<'in' | 'out' | null>(null);
  const [dealLightningOffset, setDealLightningOffset] = useState<{ offset: number; length: number; phase: 0 | 1 | 2 | 3; dur: number } | null>(null);
  // Decision zone drag
  const DECISION_THRESHOLD = 50;
  const [drawnDragDx, setDrawnDragDx] = useState(0);
  const [drawnDragDy, setDrawnDragDy] = useState(0);
  const [drawnDragActive, setDrawnDragActive] = useState(false);
  const [drawnCardSettled, setDrawnCardSettled] = useState(false);
  const [drawnSnapEnabled, setDrawnSnapEnabled] = useState(false);
  const [drawnFlyAnimId, setDrawnFlyAnimId] = useState<string | null>(null);
  const drawnDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const drawnDragDxRef = useRef(0);
  const drawnDragDyRef = useRef(0);

  // Direction indicator fade
  const [displayedDir, setDisplayedDir] = useState<1 | -1>(1);
  const [dirOpacity, setDirOpacity] = useState(0);
  const [showInitAnim, setShowInitAnim] = useState(false);

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

  // Exact physical pixel distances to each midline — bypasses browser arc-approximation
  const { w: deskW, h: deskH } = desk;
  const ix = 24, iy = 24, ir = 8;
  // Same path the turn line uses (triple-loop so dashoffset can cross the seam)
  const _dl = `H ${deskW-ix-ir} A ${ir},${ir} 0 0,1 ${deskW-ix},${iy+ir} V ${deskH-iy-ir} A ${ir},${ir} 0 0,1 ${deskW-ix-ir},${deskH-iy} H ${ix+ir} A ${ir},${ir} 0 0,1 ${ix},${deskH-iy-ir} V ${iy+ir} A ${ir},${ir} 0 0,1 ${ix+ir},${iy} H ${deskW/2}`;
  // 4-loop path (pathLength=4000): starting at loop 2 + up to 2 loops travel never exceeds 4000
  const deskInnerPath = `M ${deskW/2},${iy} ${_dl} ${_dl} ${_dl} ${_dl} Z`;
  const distRight = (deskW / 2 - ix - ir) + (Math.PI * ir) / 2 + (deskH / 2 - iy - ir);
  const P = distRight * 4;

  const removeFlyAnim = useCallback((id: string) => {
    setFlyingCards(prev => prev.filter(c => c.id !== id));
  }, []);

  // useLayoutEffect: fires synchronously before paint, so the new card is hidden
  // in the same frame it appears — no one-frame flash of the real card.
  useLayoutEffect(() => {
    const prevLengths = prevHandLengthsRef.current;
    const curLengths = state.players.map(p => p.hand.length);
    prevHandLengthsRef.current = curLengths;

    const allCurrentIds = new Set(state.players.flatMap(p => p.hand.map(c => c.id)));

    // Initial mount or restart (multiple players' hands change at once): repopulate ref, no anim
    const playersWhoGrew = prevLengths.length === 0 ? 99
      : state.players.filter((p, i) => p.hand.length > (prevLengths[i] ?? 0)).length;

    if (prevLengths.length === 0 || playersWhoGrew !== 1) {
      knownCardIdsRef.current = allCurrentIds;

      if (prevLengths.length === 0) {
        // Deal all cards to each player in position order: bottom → left → top → right
        const dealStart = 600;
        const cardInterval = 150;
        const anims: FlyAnim[] = [];
        const newHidden = new Map<string, number>();

        const posOrder: Record<string, number> = { bottom: 0, left: 1, top: 2, right: 3 };
        const dealOrder = [...state.players].sort((a, b) =>
          (posOrder[a.position] ?? 0) - (posOrder[b.position] ?? 0)
        );

        let dealIndex = 0;
        for (const dealPlayer of dealOrder) {
          const playerIdx = state.players.findIndex(p => p.id === dealPlayer.id);
          // Human fan is sorted; CPU fan renders in hand order — iterate matching order so cards land left→right
          const handInFanOrder = playerIdx === 0 ? sortHand(dealPlayer.hand) : dealPlayer.hand;

          for (const card of handInFanOrder) {
            const delay = dealStart + dealIndex * cardInterval;
            dealIndex++;

            let tx: string, ty: string, trot: string, tzIndex: number;
            let size: 'sm' | 'md';

            if (playerIdx === 0) {
              ({ tx, ty, trot, tzIndex } = getHumanCardTarget(dealPlayer.hand, card.id));
              size = 'md';
            } else {
              const cIdx = dealPlayer.hand.findIndex(c => c.id === card.id);
              ({ tx, ty, trot, tzIndex } = getCPUCardTarget(dealPlayer.hand, playerIdx, cIdx, state.players));
              size = 'sm';
            }

            newHidden.set(card.id, delay);
            anims.push({ id: `deal-${Date.now()}-${playerIdx}-${dealIndex}`, cardId: card.id, playerId: playerIdx, delay, tx, ty, trot, tzIndex, size, card: playerIdx === 0 ? card : null });
          }
        }

        if (newHidden.size > 0) setHiddenCardIds(prev => new Map([...prev, ...newHidden]));
        if (anims.length > 0) setFlyingCards(prev => [...prev, ...anims]);
      }

      return;
    }

    const newIds = [...allCurrentIds].filter(id => !knownCardIdsRef.current.has(id));
    knownCardIdsRef.current = allCurrentIds;
    if (newIds.length === 0) return;

    const anims: FlyAnim[] = [];
    const newHidden = new Map<string, number>();

    state.players.forEach((player, playerIdx) => {
      const playerNewIds = newIds.filter(id => player.hand.some(c => c.id === id));
      playerNewIds.forEach((cardId, j) => {
        // Card kept from decision zone: skip FlyAnim, let it appear immediately in the fan
        if (drawnCardKeptRef.current === cardId) {
          drawnCardKeptRef.current = null;
          return;
        }
        // Wild drawn card added to hand for color-pick: isColorPicking handles opacity, skip FlyAnim
        if (drawnCardPlayedRef.current === cardId) {
          drawnCardPlayedRef.current = null;
          return;
        }

        const delay = j * 130;
        let tx: string, ty: string, size: 'sm' | 'md';
        const actualCard = player.hand.find(c => c.id === cardId) ?? null;
        let trot: string, tzIndex: number;
        let isDragDraw = false;
        let drawStartX: string | undefined;
        let drawStartY: string | undefined;

        if (playerIdx === 0) {
          ({ tx, ty, trot, tzIndex } = getHumanCardTarget(player.hand, cardId));
          if (j === 0 && dragDrawOverrideRef.current) {
            isDragDraw = true;
            drawStartX = dragDrawOverrideRef.current.startX;
            drawStartY = dragDrawOverrideRef.current.startY;
            dragDrawOverrideRef.current = null;
          }
          size = 'md';
        } else {
          const cIdx = player.hand.findIndex(c => c.id === cardId);
          ({ tx, ty, trot, tzIndex } = getCPUCardTarget(player.hand, playerIdx, cIdx, state.players));
          size = 'sm';
        }

        newHidden.set(cardId, delay);
        anims.push({ id: `fly-${Date.now()}-${playerIdx}-${j}`, cardId, playerId: playerIdx, delay, tx, ty, trot, tzIndex, size, card: playerIdx === 0 ? actualCard : null, isDragDraw, drawStartX, drawStartY });
      });
    });

    if (newHidden.size > 0) setHiddenCardIds(prev => new Map([...prev, ...newHidden]));
    if (anims.length > 0) setFlyingCards(prev => [...prev, ...anims]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.players]);

  // Detect when any player plays a card: capture the pre-play slot position and animate to discard
  useLayoutEffect(() => {
    const top = state.discard[state.discard.length - 1];
    if (top && !prevDiscardIdsRef.current.has(top.id)) {
      const previousOwnerIdx = prevPlayersRef.current.findIndex(p => p.hand.some(c => c.id === top.id));
      if (previousOwnerIdx !== -1) {
        const prevHand = prevPlayersRef.current[previousOwnerIdx]!.hand;
        let tx: string, ty: string, trot: string;
        let startScale = 1;
        const dragOverride = previousOwnerIdx === 0 ? dragPlayOverrideRef.current : null;
        if (previousOwnerIdx === 0) dragPlayOverrideRef.current = null;
        if (previousOwnerIdx === 0) {
          if (dragOverride) {
            ({ tx, ty, trot, startScale } = dragOverride);
          } else if (top.value === 'wild' || top.value === 'wild4') {
            tx = 'calc(var(--card-md-w) / 2 + 10px)'; ty = '0px'; trot = '0deg'; startScale = 3.5;
          } else {
            ({ tx, ty, trot } = getHumanCardTarget(prevHand, top.id, true));
          }
        } else {
          const cIdx = prevHand.findIndex(c => c.id === top.id);
          ({ tx, ty, trot } = getCPUCardTarget(prevHand, previousOwnerIdx, cIdx, prevPlayersRef.current));
        }
        const isFromPicker = previousOwnerIdx === 0 && (top.value === 'wild' || top.value === 'wild4') && !dragOverride;
        const isDrag = previousOwnerIdx === 0 && !!dragOverride;
        setPlayingCards(prev => [...prev, { id: `play-${Date.now()}`, tx, ty, trot, startScale, card: top, isCPU: previousOwnerIdx > 0, isFromPicker, isDrag }]);
        setHiddenDiscardId(top.id);
      }
    }
    prevDiscardIdsRef.current = new Set(state.discard.map(c => c.id));
    prevPlayersRef.current = state.players.map(p => ({ ...p, hand: [...p.hand] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.discard, state.players]);

  // Turn-line travel: fires after currentPlayer or animatingFrom changes
  useLayoutEffect(() => {
    const P = 1000;
    const getPos = (pIdx: number) => {
      const p = state.players[pIdx]?.position;
      if (p === 'top')    return 0;
      if (p === 'right')  return 250;
      if (p === 'bottom') return 500;
      if (p === 'left')   return 750;
      return 0;
    };

    // Resting: snap offset to correct geometry even on load or resize
    if (animatingFrom === state.currentPlayer) {
      setActiveSeat(state.currentPlayer);
      setTurnLine({ offset: getPos(state.currentPlayer) + P, length: 0, traveling: false });
      return;
    }

    const from = animatingFrom;
    const to = state.currentPlayer;
    setActiveSeat(null);

    let startOffset = getPos(from);
    let targetOffset = getPos(to);

    // Always travel in the game's actual direction — no shortest-path guessing
    if (state.direction === 1 && targetOffset < startOffset) {
      targetOffset += P; // Force clockwise travel past the 0-seam
    } else if (state.direction === -1 && targetOffset > startOffset) {
      targetOffset -= P; // Force counter-clockwise travel past the 0-seam
    }

    // Shift into the middle of the 2P double-loop so crossing the seam never clips
    startOffset += P;
    targetOffset += P;

    const D = Math.abs(targetOffset - startOffset);
    const isFwd = (targetOffset - startOffset) >= 0;

    // Phase 0: hidden at start position
    setTurnLine({ offset: startOffset, length: 0, traveling: false });

    // T=720: head shoots out to target
    const t1 = setTimeout(() => {
      setTurnLine({ offset: targetOffset, length: D, traveling: true });
    }, 720);

    // T=1170: head arrives, tail starts catching up (720 + 450ms)
    const t2 = setTimeout(() => {
      setTurnLine({ offset: targetOffset, length: 0, traveling: true });
    }, 1170);

    // T=1670: tail fully arrived, safely trigger highlight (1170 + 450ms + 50ms buffer)
    const t3 = setTimeout(() => {
      setTurnLine({ offset: targetOffset, length: 0, traveling: false });
      setAnimatingFrom(to);
    }, 1670);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayer, state.direction, state.players, animatingFrom]);

  const isMyTurn = state.phase === 'playing' &&
                   state.players[state.currentPlayer]?.id === 0 &&
                   !isLocked &&
                   activeSeat === 0 &&
                   !state.pendingAction &&
                   !dealLightningOffset &&
                   !state.drawnCard &&
                   initCardRevealed;
  const top = topCard(state);
  const isTopFlying = hiddenDiscardId === top.id && state.discard.length > 1;

  const visualTopCard = isTopFlying ? state.discard[state.discard.length - 2]! : top;
  const topColor = effectiveColor(visualTopCard);

  const visualDirection = (isTopFlying && top.value === 'reverse')
    ? (state.direction * -1)
    : state.direction;

  useEffect(() => {
    if (state.phase === 'color-pick') {
      setPickerBg('in');
      dragPlayOverrideRef.current = null;
    }
  }, [state.phase]);

  useEffect(() => {
    if (visualDirection === displayedDir) return;
    setDirOpacity(0);
    const t = setTimeout(() => {
      setDisplayedDir(visualDirection);
      setDirOpacity(1);
    }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualDirection]);

  // Capture wild chosen color before pendingAction clears, release after turn line lands
  useEffect(() => {
    if (state.pendingAction?.type === 'wild' && state.pendingAction.color) {
      setWildTravelColor(COLOR_BG[state.pendingAction.color] ?? '#ffffff');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingAction?.type, state.pendingAction?.color]);

  useEffect(() => {
    if (!turnLine.traveling) setWildTravelColor(null);
  }, [turnLine.traveling]);

  // Deal lightning — 4-phase, mirrors turn-line head-then-tail stop:
  //   Phase 0: snap invisible (length=0, head at name tag)
  //   Phase 1: launch — both offset+length transition, head shoots out, tail stays at name tag
  //   Phase 2: travel — only dashoffset transitions, fixed 160-unit spark circles
  //   Phase 3: tail catch-up — only dasharray transitions, length 160→0
  useEffect(() => {
    const totalCards = state.players.reduce((sum, p) => sum + p.hand.length, 0);
    const dur = 600 + (totalCards - 1) * 150 + 720;
    const nLoops = Math.min(2, Math.ceil(totalCards / 7));

    const toPos = (pos: string | undefined) => pos === 'top' ? 0 : pos === 'right' ? 250 : pos === 'bottom' ? 500 : pos === 'left' ? 750 : 500;
    const startPos = toPos(state.players[0]?.position);           // always human
    const endPos   = toPos(state.players[state.currentPlayer]?.position); // first player
    const dist     = (endPos - startPos + 1000) % 1000;

    const departure    = startPos + 1000;
    const launchOffset = departure + 160;
    const arrival      = departure + nLoops * 1000 + dist;

    const launchDur   = 250;
    // tail must travel 160 units at the same speed as phase-2 spark
    // travelDist = nLoops*1000 - 160; catchUpDur = 160 / (travelDist/travelDur)
    // Solve jointly: travelDur = max(400, dur - 536 - launchDur - catchUpDur)
    // where catchUpDur = 160 * travelDur / travelDist
    const travelDist  = nLoops * 1000 - 160;
    const travelDurRaw = Math.max(400, dur - 536 - launchDur);
    const catchUpDur  = Math.round(160 * travelDurRaw / (travelDist + 160));
    const travelDur   = travelDurRaw - catchUpDur;

    const t0 = setTimeout(() => setDealLightningOffset({ offset: departure,    length: 0,   phase: 0, dur: 0          }), 520);
    const t1 = setTimeout(() => setDealLightningOffset({ offset: launchOffset, length: 160, phase: 1, dur: launchDur  }), 536);
    const t2 = setTimeout(() => setDealLightningOffset({ offset: arrival,      length: 160, phase: 2, dur: travelDur  }), 536 + launchDur);
    const t3 = setTimeout(() => setDealLightningOffset({ offset: arrival,      length: 0,   phase: 3, dur: catchUpDur }), 536 + launchDur + travelDur);
    const t4 = setTimeout(() => setDealLightningOffset(null), 536 + launchDur + travelDur + catchUpDur + 50);
    const t5 = setTimeout(() => setShowInitAnim(true), 536 + launchDur + travelDur + catchUpDur + 250);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = state.players[0]!;

  function handleCardClick(card: UnoCard) {
    if (!isMyTurn) return;
    const playable = isPlayable(card, top);
    if (!playable) return;
    if (selected === card.id) {
      humanPlay(card.id);
      setSelected(null);
    } else {
      setSelected(card.id);
    }
  }

  function handlePickColor(color: CardColor) {
    setPickerBg('out');
    setTimeout(() => setPickerBg(null), 600);
    if (selected) {
      humanPlay(selected, color);
      setSelected(null);
    } else {
      humanPickColor(color);
    }
  }

  // Reset landing flag whenever drawnCard changes (guards against stale true from a previous round)
  useEffect(() => {
    setDrawnCardLanded(false);
    setDrawnFlyAnimId(null);
    setDrawnDragDx(0);
    setDrawnDragDy(0);
    setDrawnDragActive(false);
    setDrawnCardSettled(false);
    setDrawnSnapEnabled(false);
    drawnDragStartRef.current = null;
    drawnDragDxRef.current = 0;
    drawnDragDyRef.current = 0;
    drawnCardDzRef.current = null;
    if (!state.drawnCard && drawnCardFlyAnimIdRef.current) {
      removeFlyAnim(drawnCardFlyAnimIdRef.current);
      drawnCardFlyAnimIdRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.drawnCard]);

  // When a playable card is drawn, create its FlyAnim from deck to the decision zone.
  // The card is NOT in any player's hand yet — it lives only in state.drawnCard.
  // Always use card-draw-arc (deck base position): endDrag snaps the deck card back to
  // its base position before opacity 0, so the drag release position is visually stale.
  useLayoutEffect(() => {
    if (!state.drawnCard) return;
    const dz = getDecisionZonePos();
    const { id: cardId } = state.drawnCard;

    // Capture drag coords before nulling so playable drag-draws fly from the drop point.
    const dragDraw = dragDrawOverrideRef.current;
    dragDrawOverrideRef.current = null;

    setFlyingCards(prev => [...prev, {
      id: `drawn-${Date.now()}`,
      cardId,
      playerId: 0,
      delay: 0,
      tx: dz.tx,
      ty: dz.ty,
      trot: '0deg',
      tzIndex: Z.FLY_AIR,
      size: 'md' as const,
      card: state.drawnCard,
      isDragDraw: !!dragDraw,
      drawStartX: dragDraw?.startX,
      drawStartY: dragDraw?.startY,
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.drawnCard?.id]);

  function handleDecisionPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawnDragStartRef.current = { x: e.clientX, y: e.clientY };
    setDrawnDragActive(true);
    setDrawnCardSettled(false);
    setDrawnSnapEnabled(true);
  }

  function handleDecisionPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawnDragStartRef.current) return;
    const dx = e.clientX - drawnDragStartRef.current.x;
    const dy = e.clientY - drawnDragStartRef.current.y;
    drawnDragDxRef.current = dx;
    drawnDragDyRef.current = dy;
    setDrawnDragDx(dx);
    setDrawnDragDy(dy);
  }

  function handleDecisionPointerUp() {
    if (!drawnDragStartRef.current) return;
    drawnDragStartRef.current = null;
    const dx = drawnDragDxRef.current;
    const dy = drawnDragDyRef.current;
    drawnDragDxRef.current = 0;
    drawnDragDyRef.current = 0;
    if (dy < -DECISION_THRESHOLD) {
      // Leave drawnDragActive=true so card stays scaled until overlay unmounts
      handlePlayDrawn(dx, dy);
    } else if (dy > DECISION_THRESHOLD) {
      handleKeepDrawn(dx, dy);
    } else {
      setDrawnDragActive(false);
      setDrawnDragDx(0);
      setDrawnDragDy(0);
      if (Math.hypot(dx, dy) < 5) setDrawnCardSettled(true);
      // else: onTransitionEnd fires after snap-back
    }
  }

  function handlePlayDrawn(dragOffsetX = 0, dragOffsetY = 0) {
    if (!state.drawnCard) return;
    const card = state.drawnCard;
    setDrawnCardLanded(false);
    if (drawnCardFlyAnimIdRef.current) { removeFlyAnim(drawnCardFlyAnimIdRef.current); drawnCardFlyAnimIdRef.current = null; }
    const dz = drawnCardDzRef.current ?? getDecisionZonePos();
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
    const dz = drawnCardDzRef.current ?? getDecisionZonePos();

    // Predict the fan target: card will be appended to hand after humanKeepDrawn
    const predictedHand = [...me.hand, card];
    const { tx: fanTx, ty: fanTy, trot: fanTrot, tzIndex: fanTz } = getHumanCardTarget(predictedHand, card.id);

    // Suppress the auto-FlyAnim from useLayoutEffect (we're creating our own)
    drawnCardKeptRef.current = card.id;
    setDrawnCardLanded(false);
    if (drawnCardFlyAnimIdRef.current) { removeFlyAnim(drawnCardFlyAnimIdRef.current); drawnCardFlyAnimIdRef.current = null; }

    // Hide card in hand until FlyAnim completes
    setHiddenCardIds(prev => new Map([...prev, [card.id, 0]]));
    setFlyingCards(prev => [...prev, {
      id: `keep-${Date.now()}`,
      cardId: card.id,
      playerId: 0,
      delay: 0,
      tx: fanTx,
      ty: fanTy,
      trot: fanTrot,
      tzIndex: fanTz,
      size: 'md' as const,
      card,
      isKeepDraw: dragOffsetX === 0 && dragOffsetY === 0,
      isDragKeep: dragOffsetX !== 0 || dragOffsetY !== 0,
      drawStartX: `${parseFloat(dz.tx) + dragOffsetX}px`,
      drawStartY: `${parseFloat(dz.ty) + dragOffsetY}px`,
    }]);

    humanKeepDrawn();
  }

  const cpuPlayers = state.players.slice(1);

  useEffect(() => {
    onGameInfoChange?.({ cards: me.hand.length, turn: state.players[state.currentPlayer]?.name ?? '', isMyTurn });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.hand.length, state.currentPlayer, isMyTurn]);

  return (
      <div
        id="board-container"
        className="relative isolate w-full h-full overflow-hidden"
        onClick={() => setSelected(null)}
        style={{
          '--card-sm-w': 'clamp(28px, 7vw, 36px)',
          '--card-md-w': 'clamp(40px, 10vw, 52px)',
        } as React.CSSProperties}
      >
        {/* Opponents */}
        {cpuPlayers.map((opp) => {
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

          let layoutStyle: React.CSSProperties = { top: 'clamp(32px, 8vh, 100px)', left: '50%', transform: 'translateX(-50%)' };
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
              key={opp.id}
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
                      <Card card={card} faceDown size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Desk */}
        <div
          ref={deskRef}
          className="absolute flex items-center justify-center"
          style={{
            inset: 0,
            margin: 'auto',
            width: 'min(88vw, 700px)',
            height: 'clamp(200px, 44vh, 420px)',
            borderRadius: 32,
            background: 'radial-gradient(ellipse at 50% 40%, #1a5c32 0%, #0f3d20 100%)',
            border: '2px solid rgba(255,255,255,0.07)',
            boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.6)',
            animation: 'fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          {/* Circulating direction & color arrows + turn line */}
          {(() => {
            const cw = displayedDir === 1;
            const color = COLOR_BG[topColor] ?? '#ffffff';
            const { w, h } = desk;

            // Desk border-radius is 32px. Outer path sits on edge (2px inset). Radius: 32 - 2 = 30.
            const ox = 2, oy = 2, or = 30;
            const outerD = `M ${w/2},${oy} H ${w - ox - or} A ${or},${or} 0 0,1 ${w - ox},${oy + or} V ${h - oy - or} A ${or},${or} 0 0,1 ${w - ox - or},${h - oy} H ${ox + or} A ${or},${or} 0 0,1 ${ox},${h - oy - or} V ${oy + or} A ${or},${or} 0 0,1 ${ox + or},${oy} Z`;

            // Inner turn line sits 24px inside. Radius: 32 - 24 = 8.
            const ix = 24, iy = 24, ir = 8;
            const drawLoop = `H ${w - ix - ir} A ${ir},${ir} 0 0,1 ${w - ix},${iy + ir} V ${h - iy - ir} A ${ir},${ir} 0 0,1 ${w - ix - ir},${h - iy} H ${ix + ir} A ${ir},${ir} 0 0,1 ${ix},${h - iy - ir} V ${iy + ir} A ${ir},${ir} 0 0,1 ${ix + ir},${iy} H ${w/2}`;
            // Draw the path TWICE so offsets can cross the 0/P seam without getting clipped
            const innerD = `M ${w/2},${iy} ${drawLoop} ${drawLoop} ${drawLoop} Z`;
            const dur = 30;

            // Re-scaled for 1000 pathLength
            const layers = [
              { len: 160, op: 0.04 },
              { len: 145, op: 0.08 },
              { len: 127, op: 0.13 },
              { len: 110, op: 0.19 },
              { len: 92,  op: 0.27 },
              { len: 74,  op: 0.36 },
              { len: 55,  op: 0.47 },
              { len: 37,  op: 0.59 },
              { len: 21,  op: 0.72 },
              { len: 7,   op: 0.85 },
            ];
            return (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${w} ${h}`}
                preserveAspectRatio="none"
                style={{ overflow: 'visible', opacity: dirOpacity, transition: 'opacity 350ms ease' }}
              >
                <defs>
                  <filter id="lightning-noise" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" seed="42" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                </defs>

                {[0, -dur / 2].map((begin, i) => (
                  <g key={`${i}-${displayedDir}`}>
                    {layers.map(({ len, op }) => (
                      <path
                        key={len}
                        d={outerD}
                        pathLength="1000"
                        fill="none"
                        stroke={color}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${len} ${1000 - len}`}
                        opacity={op}
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from={cw ? `${len}` : `-1000`}
                          to={cw ? `${len - 1000}` : `0`}
                          dur={`${dur}s`}
                          begin={`${begin}s`}
                          repeatCount="indefinite"
                          calcMode="linear"
                        />
                      </path>
                    ))}
                  </g>
                ))}
                {/* Turn transition line — lightning mode when wild4 is active */}
                {(() => {
                  const isFwd = state.direction === 1;
                  const dashArray = isFwd
                    ? `0 ${3000 - turnLine.length} ${turnLine.length} 0`
                    : `${turnLine.length} 3000 0 0`;
                  const isWild4 = state.pendingAction?.type === 'wild4';
                  const isWild = !!wildTravelColor && turnLine.traveling;
                  const wildColor = wildTravelColor ?? '#ffffff';
                  const transition = turnLine.traveling
                    ? 'stroke-dashoffset 450ms linear, stroke-dasharray 450ms linear, opacity 50ms'
                    : 'opacity 200ms ease-out';
                  const commonProps = {
                    d: innerD, pathLength: '3000', fill: 'none',
                    strokeLinecap: 'round' as const,
                    strokeDasharray: dashArray,
                    strokeDashoffset: `${-turnLine.offset}`,
                    opacity: turnLine.traveling ? 1 : 0,
                  };
                  return isWild4 ? (
                    <path
                      {...commonProps}
                      stroke="#dc2626"
                      strokeWidth="3"
                      style={{
                        transition,
                        filter: 'url(#lightning-noise) drop-shadow(0 0 10px currentColor)',
                        animation: 'wild4-color-cycle 0.5s steps(1) infinite, wild4-flicker 0.15s linear infinite',
                      }}
                    />
                  ) : isWild ? (
                    <path
                      {...commonProps}
                      stroke={wildColor}
                      strokeWidth="3"
                      style={{
                        transition,
                        filter: `url(#lightning-noise) drop-shadow(0 0 10px ${wildColor})`,
                        animation: 'wild4-flicker 0.15s linear infinite',
                      }}
                    />
                  ) : (
                    <path
                      {...commonProps}
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{
                        transition,
                        filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))',
                      }}
                    />
                  );
                })()}
              </svg>
            );
          })()}

          {/* Deal lightning — same pattern as wild-card turn line: state offset + CSS transition */}
          {dealLightningOffset && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${deskW} ${deskH}`}
              preserveAspectRatio="none"
              style={{ overflow: 'visible', zIndex: Z.UI_CHROME }}
            >
              <defs>
                <filter id="deal-lightning-noise" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" seed="42" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>
              <path
                d={deskInnerPath}
                pathLength="4000"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`0 ${4000 - dealLightningOffset.length} ${dealLightningOffset.length} 0`}
                strokeDashoffset={-dealLightningOffset.offset}
                style={{
                  transition:
                    dealLightningOffset.phase === 1 ? `stroke-dashoffset ${dealLightningOffset.dur}ms linear, stroke-dasharray ${dealLightningOffset.dur}ms linear` :
                    dealLightningOffset.phase === 2 ? `stroke-dashoffset ${dealLightningOffset.dur}ms linear` :
                    dealLightningOffset.phase === 3 ? `stroke-dasharray ${dealLightningOffset.dur}ms linear` :
                    'none',
                  filter: 'url(#deal-lightning-noise) drop-shadow(0 0 10px white)',
                  animation: 'wild4-flicker 0.15s linear infinite',
                }}
              />
            </svg>
          )}

          {/* Player name tags on the table edges */}
          {state.players.map((p, idx) => {
            const posClass =
              p.position === 'bottom' ? 'bottom-[24px] left-1/2 -translate-x-1/2 translate-y-1/2' :
              p.position === 'top'    ? 'top-[24px] left-1/2 -translate-x-1/2 -translate-y-1/2' :
              p.position === 'left'   ? 'left-[12px] top-1/2 -translate-y-1/2' :
              p.position === 'right'  ? 'right-[12px] top-1/2 -translate-y-1/2' : '';
            if (!posClass) return null;
            const isActive = initCardRevealed && activeSeat === idx;
            const isPunished = actionTag?.seat === idx;
            const displayTag = isPunished ? actionTag!.text : p.name;

            // Scale anchors to the outer edge so penalty-pop grows strictly inward toward the felt
            const tOrigin =
              p.position === 'bottom' ? 'bottom center' :
              p.position === 'top'    ? 'top center' :
              p.position === 'left'   ? 'left center' :
              p.position === 'right'  ? 'right center' : 'center';

            let textColor = isActive ? '#000000' : 'rgba(255,255,255,0.4)';
            if (isPunished) {
              if (actionTag!.type === 'skip' || actionTag!.type === 'draw2' || actionTag!.type === 'wild4') textColor = '#facc15';
              else textColor = COLOR_BG[actionTag!.color ?? 'wild'] ?? '#ffffff';
            }

            return (
              <div
                key={p.id}
                id={p.id === 0 ? 'you-nametag' : undefined}
                className={`absolute ${posClass} px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-sans font-bold z-0`}
                style={{
                  backgroundColor: isActive && !isPunished ? '#ffffff' : 'rgba(0,0,0,0.25)',
                  color: textColor,
                  boxShadow: isActive && !isPunished ? '0 0 16px rgba(255,255,255,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
                  transition: isPunished ? 'none' : 'all 300ms',
                  fontSize: isPunished ? '13px' : '11px',
                  transformOrigin: tOrigin,
                  animation: isPunished ? 'penalty-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both' : undefined,
                }}
              >
                {displayTag}
              </div>
            );
          })}

          {/* Cards row */}
          <div id="piles-row" className="flex gap-5 items-center relative">
            {/* Draw pile (Static 3D Stack) */}
            <div className="relative shrink-0" style={{ width: 'var(--card-md-w)', aspectRatio: '1 / 1.45', animation: isMyTurn && !me.hand.some(c => isPlayable(c, top)) ? 'draw-pile-pulse 1.4s ease-in-out infinite' : undefined, filter: state.drawnCard ? 'brightness(0.45)' : undefined }}>
              {Array.from({ length: 4 }).map((_, i, arr) => {
                const isTop = i === arr.length - 1;
                return (
                  <button
                    key={i}
                    onPointerDown={isTop && isMyTurn ? e => {
                      e.stopPropagation();
                      startDrag(e, () => { setSelected(null); humanDraw(); }, 0, false, true);
                    } : undefined}
                    onPointerMove={isTop && isMyTurn ? moveDrag : undefined}
                    onPointerUp={isTop && isMyTurn ? endDrag : undefined}
                    onClick={isTop && isMyTurn ? e => {
                      e.stopPropagation();
                      if (didDragActionRef.current) { didDragActionRef.current = false; didDragMoveRef.current = false; return; }
                      if (didDragMoveRef.current) { didDragMoveRef.current = false; return; }
                      setSelected(null);
                      humanDraw();
                    } : undefined}
                    disabled={!isTop || !isMyTurn}
                    className={`absolute inset-0 bg-transparent border-none p-0 outline-none ${isTop && isMyTurn ? 'cursor-pointer' : 'cursor-default'} ${!isTop ? 'pointer-events-none' : ''}`}
                    style={{
                      zIndex: i,
                      transform: `translateY(-${i * 2.5}px)`,
                    }}
                  >
                    <Card card={{ id: `draw-${i}`, color: 'wild', value: 'wild' }} faceDown />
                  </button>
                );
              })}
            </div>

            {/* Discard pile (Single Flat Card) */}
            <div className="relative shrink-0" style={{ width: 'var(--card-md-w)', aspectRatio: '1 / 1.45' }}>
              {state.discard.length > 0 && initCardRevealed ? (
                <div className="absolute inset-0 pointer-events-none">
                  <Card card={visualTopCard} />
                </div>
              ) : (
                <div
                  className="absolute inset-0 rounded-lg border-[3px]"
                  style={{ borderColor: 'rgba(255,255,255,0.15)', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)' }}
                />
              )}
            </div>
          </div>

          {/* Deck-drag release hint — inside desk stacking context, below DRAG_PARENT (95) */}
          <div
            ref={deckHintRef}
            className="absolute pointer-events-none font-sans font-semibold"
            style={{
              left: 0,
              top: 0,
              transform: 'translate(-50%, -50%)',
              zIndex: 88,
              color: 'rgba(255,255,255,0.9)',
              fontSize: 'clamp(13px, 3.5vw, 15px)',
              whiteSpace: 'nowrap',
              opacity: 0,
              transition: 'opacity 100ms ease',
            }}
          />
        </div>


        {/* Player hand — fan layout */}
        {(() => {
          const hand = sortHand(me.hand);
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
            <div
              className="absolute bottom-0 left-0 right-0"
              style={{ height: handH }}
            >

              {/* fan container — bottom lifts as cards increase to keep arc inside panel */}
              <div
                className="absolute left-1/2 h-0"
                style={{
                  bottom: anchorBottom,
                  transition: 'bottom 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              >
                {hand.map((card, i) => {
                  const offset = i - center;
                  const rotation = offset * degsEach;
                  const x = offset * xStep;
                  const yArc = offset * offset * yArcMult;
                  const playable = isMyTurn && isPlayable(card, top);
                  const isSelected = selected === card.id;
                  const isColorPicking = state.phase === 'color-pick' && state.pendingCardId === card.id;
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
                        filter: isColorPicking ? undefined : (state.drawnCard || (!dealLightningOffset && isMyTurn && !isSelected && (!anyPlayable || !playable))) ? 'brightness(0.45)' : undefined,
                        pointerEvents: isColorPicking ? 'none' : 'auto',
                      }}
                      onPointerDown={e => {
                        e.stopPropagation();
                        if (playable) startDrag(e, () => { setSelected(null); humanPlay(card.id); }, rotation, true);
                        else setSelected(null);
                      }}
                      onPointerMove={playable ? moveDrag : undefined}
                      onPointerUp={playable ? endDrag : undefined}
                      onClick={e => {
                        e.stopPropagation();
                        if (didDragActionRef.current) { didDragActionRef.current = false; didDragMoveRef.current = false; return; }
                        if (didDragMoveRef.current) { didDragMoveRef.current = false; return; }
                        if (playable) handleCardClick(card);
                      }}
                    >
                      <Card
                        card={card}
                        playable={playable}
                        selected={isSelected}
                        onClick={playable ? () => {} : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Flying card animations */}
        {flyingCards.map(fc => (
          <div key={fc.id} style={drawnFlyAnimId === fc.id ? { visibility: 'hidden' } : undefined}>
          <FlyingCardAnim
            playerId={fc.playerId}
            delay={fc.delay}
            tx={fc.tx}
            ty={fc.ty}
            trot={fc.trot}
            tzIndex={fc.tzIndex}
            size={fc.size}
            card={fc.card}
            isDragDraw={fc.isDragDraw}
            isKeepDraw={fc.isKeepDraw}
            isDragKeep={fc.isDragKeep}
            drawStartX={fc.drawStartX}
            drawStartY={fc.drawStartY}
            onDone={() => {
              if (state.drawnCard?.id === fc.cardId) {
                // Keep the FlyAnim alive so card stays visible; record id for removal on choice
                drawnCardFlyAnimIdRef.current = fc.id;
                setDrawnFlyAnimId(fc.id);
                const dz = getDecisionZonePos();
                drawnCardDzRef.current = dz;
                setDrawnCardCssTop(dz.cssTop);
                setDrawnCardLanded(true);
                requestAnimationFrame(() => requestAnimationFrame(() => setDrawnCardSettled(true)));
              } else {
                removeFlyAnim(fc.id);
                setHiddenCardIds(prev => {
                  if (!prev.has(fc.cardId)) return prev;
                  const next = new Map(prev);
                  next.delete(fc.cardId);
                  return next;
                });
              }
            }}
          />
          </div>
        ))}

        {/* Init card reveal (deck → discard, face-down → face-up flip) */}
        {showInitAnim && (
          <InitCardReveal
            card={state.discard[0]!}
            onDone={() => {
              setShowInitAnim(false);
              setInitCardRevealed(true);
              setDirOpacity(1);
            }}
          />
        )}

        {/* Playing card animations (hand → discard pile) */}
        {playingCards.map(pc => (
          <PlayingCardAnim
            key={pc.id}
            startX={pc.tx}
            startY={pc.ty}
            startRot={pc.trot}
            startScale={pc.startScale}
            card={pc.card}
            isCPU={pc.isCPU}
            isFromPicker={pc.isFromPicker}
            isDrag={pc.isDrag}
            isDecisionZone={pc.isDecisionZone}
            onDone={() => {
              setPlayingCards(prev => prev.filter(c => c.id !== pc.id));
              setHiddenDiscardId(null);
            }}
          />
        ))}

        {/* Drag-to-play / drag-to-draw release hint (normal hand/deck drag) */}
        <div
          ref={dragHintRef}
          className="absolute pointer-events-none font-sans font-semibold"
          style={{
            left: 0,
            top: 0,
            transform: 'translate(-50%, -50%)',
            zIndex: Z.DRAG_HINT,
            color: 'rgba(255,255,255,0.9)',
            fontSize: 'clamp(13px, 3.5vw, 15px)',
            whiteSpace: 'nowrap',
            opacity: 0,
            transition: 'opacity 100ms ease',
          }}
        />

        {/* Decision zone: draggable card + release hint text */}
        {state.drawnCard && drawnCardLanded && (
          <>
            {/* Outer div: translation only — 1:1 when dragging, spring-back when released */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: `${drawnCardCssTop}px`,
                transform: `translate(calc(-50% + ${drawnDragDx}px), calc(-50% + ${drawnDragDy}px))`,
                transition: (drawnDragActive || !drawnSnapEnabled) ? 'none' : 'transform 220ms cubic-bezier(0.34,1.2,0.64,1)',
                zIndex: Z.FLY_AIR + 1,
                touchAction: 'none',
                cursor: drawnDragActive ? 'grabbing' : 'grab',
              }}
              onPointerDown={handleDecisionPointerDown}
              onPointerMove={handleDecisionPointerMove}
              onPointerUp={handleDecisionPointerUp}
              onPointerCancel={handleDecisionPointerUp}
              onTransitionEnd={(e) => { if (e.target === e.currentTarget) setDrawnCardSettled(true); }}
              className="decision-draggable"
            >
              {/* Inner div: scale + glow — always transitions smoothly */}
              <div style={{
                transform: `scale(${drawnDragActive ? 1.15 : 1})`,
                filter: (drawnDragDy < -DECISION_THRESHOLD || drawnDragDy > DECISION_THRESHOLD)
                  ? 'drop-shadow(0 0 14px rgba(255,255,255,0.9))'
                  : 'none',
                transition: 'transform 150ms ease, filter 200ms ease',
              }}>
                <Card card={state.drawnCard} size="md" />
              </div>
            </div>
            {/* Release hint — fades in past threshold */}
            <div
              className="absolute pointer-events-none font-sans font-semibold"
              style={{
                left: '50%',
                top: `${drawnCardCssTop}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: Z.DECISION,
                color: 'rgba(255,255,255,0.9)',
                fontSize: 'clamp(13px, 3.5vw, 15px)',
                whiteSpace: 'nowrap',
                opacity: (drawnDragDy < -DECISION_THRESHOLD || drawnDragDy > DECISION_THRESHOLD) ? 1 : 0,
                transition: 'opacity 100ms ease',
              }}
            >
              {drawnDragDy < 0 ? 'Release to play' : 'Release to draw'}
            </div>
            {/* Buttons — fade out when dragging or past threshold */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: 0, right: 0,
                top: `${drawnCardCssTop}px`,
                transform: 'translateY(-50%)',
                zIndex: Z.DECISION,
                display: 'grid',
                gridTemplateColumns: `1fr var(--card-md-w) 1fr`,
                alignItems: 'center',
                columnGap: 'clamp(12px, 3vw, 20px)',
                padding: '0 clamp(16px, 5vw, 32px)',
                opacity: (drawnCardSettled && drawnDragDy >= -DECISION_THRESHOLD && drawnDragDy <= DECISION_THRESHOLD) ? 1 : 0,
                transition: 'opacity 150ms ease',
              }}
            >
              <button
                onClick={() => handlePlayDrawn()}
                className="pointer-events-auto cursor-pointer font-sans font-semibold hover:opacity-60"
                style={{ justifySelf: 'end', background: 'none', border: '1.5px solid rgba(255,255,255,0.85)', borderRadius: 9999, color: 'rgba(255,255,255,0.85)', padding: '8px clamp(14px, 4vw, 22px)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap', minWidth: 'clamp(72px, 18vw, 88px)', textAlign: 'center' }}
              >
                Play
              </button>
              <div />
              <button
                onClick={() => handleKeepDrawn()}
                className="pointer-events-auto cursor-pointer font-sans font-semibold hover:opacity-60"
                style={{ justifySelf: 'start', background: 'none', border: '1.5px solid rgba(255,255,255,0.85)', borderRadius: 9999, color: 'rgba(255,255,255,0.85)', padding: '8px clamp(14px, 4vw, 22px)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap', minWidth: 'clamp(72px, 18vw, 88px)', textAlign: 'center' }}
              >
                Draw
              </button>
            </div>
          </>
        )}

        {/* Color picker dim background — lives in GameBoard so it outlasts ColorPicker unmount */}
        {pickerBg && (
          <div
            className="absolute inset-0 bg-black/60 pointer-events-none"
            style={{
              zIndex: Z.COLOR_DIM,
              animation: pickerBg === 'in' ? 'fade-in 700ms ease-out forwards' : 'fade-out 600ms ease-out forwards',
            }}
          />
        )}

        {/* Color picker overlay */}
        {state.phase === 'color-pick' && state.pendingCardId && (() => {
          const card = me.hand.find(c => c.id === state.pendingCardId)!;
          const dragPos = dragPlayOverrideRef.current;
          const { tx, ty, trot } = dragPos ?? getHumanCardTarget(me.hand, card.id, true);
          return <ColorPicker onPick={handlePickColor} tx={tx} ty={ty} trot={trot} card={card} isDrag={!!dragPos} startScale={dragPos?.startScale} />;
        })()}

        {/* Game over overlay */}
        {state.phase === 'game-over' && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-5" style={{ zIndex: Z.MODAL }}>
            <p className="text-white text-[32px] font-serif font-extrabold m-0">
              {state.winner === 0 ? 'You Win!' : `${state.players[state.winner ?? 0]?.name ?? 'CPU'} Wins!`}
            </p>
            <div className="flex gap-3">
              <GameButton variant="primary" size="lg" onClick={() => onRestart?.()}>
                Play Again
              </GameButton>
              <GameButton variant="secondary" size="lg" onClick={onExit}>
                Menu
              </GameButton>
            </div>
          </div>
        )}
      </div>
  );
}
