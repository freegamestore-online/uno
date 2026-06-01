import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { UnoCard, Player } from '../lib/uno';
import { FlyAnim, sortHand, getHumanCardTarget, getCPUCardTarget, getDecisionZonePos } from '../lib/boardGeometry';
import { Z } from '../lib/zIndex';

export interface PlayingCardItem {
  id: string; tx: string; ty: string; trot: string; startScale?: number; card: UnoCard;
  isCPU?: boolean; isFromPicker?: boolean; isDrag?: boolean; isDecisionZone?: boolean;
}

interface Input {
  players: Player[];
  discard: UnoCard[];
  drawnCard: UnoCard | null | undefined;
  dragDrawOverrideRef: { current: { startX: string; startY: string } | null };
  dragPlayOverrideRef: { current: { tx: string; ty: string; trot: string; startScale: number } | null };
}

export function useCardFlight({ players, discard, drawnCard, dragDrawOverrideRef, dragPlayOverrideRef }: Input) {
  const [flyingCards, setFlyingCards] = useState<FlyAnim[]>([]);
  const [hiddenCardIds, setHiddenCardIds] = useState<Map<string, number>>(new Map());
  const [playingCards, setPlayingCards] = useState<PlayingCardItem[]>([]);
  const [hiddenDiscardId, setHiddenDiscardId] = useState<string | null>(null);
  const knownCardIdsRef = useRef<Set<string>>(new Set());
  const prevHandLengthsRef = useRef<number[]>([]);
  const prevDiscardIdsRef = useRef<Set<string>>(new Set());
  const prevPlayersRef = useRef<Player[]>([]);
  // Refs written by handleKeepDrawn/handlePlayDrawn in GameBoard to suppress auto-FlyAnims
  const drawnCardKeptRef = useRef<string | null>(null);
  const drawnCardPlayedRef = useRef<string | null>(null);

  const removeFlyAnim = useCallback((id: string) => {
    setFlyingCards(prev => prev.filter(c => c.id !== id));
  }, []);

  useLayoutEffect(() => {
    const prevLengths = prevHandLengthsRef.current;
    const curLengths = players.map(p => p.hand.length);
    prevHandLengthsRef.current = curLengths;

    const allCurrentIds = new Set(players.flatMap(p => p.hand.map(c => c.id)));
    const playersWhoGrew = prevLengths.length === 0 ? 99
      : players.filter((p, i) => p.hand.length > (prevLengths[i] ?? 0)).length;

    if (prevLengths.length === 0 || playersWhoGrew !== 1) {
      knownCardIdsRef.current = allCurrentIds;
      if (prevLengths.length === 0) {
        const anims: FlyAnim[] = [];
        const newHidden = new Map<string, number>();
        const posOrder: Record<string, number> = { bottom: 0, left: 1, top: 2, right: 3 };
        const dealOrder = [...players].sort((a, b) => (posOrder[a.position] ?? 0) - (posOrder[b.position] ?? 0));
        let dealIndex = 0;
        for (const dealPlayer of dealOrder) {
          const playerIdx = players.findIndex(p => p.id === dealPlayer.id);
          const handInFanOrder = playerIdx === 0 ? sortHand(dealPlayer.hand) : dealPlayer.hand;
          for (const card of handInFanOrder) {
            const delay = 600 + dealIndex * 150;
            dealIndex++;
            let tx: string, ty: string, trot: string, tzIndex: number, size: 'sm' | 'md';
            if (playerIdx === 0) {
              ({ tx, ty, trot, tzIndex } = getHumanCardTarget(dealPlayer.hand, card.id));
              size = 'md';
            } else {
              const cIdx = dealPlayer.hand.findIndex(c => c.id === card.id);
              ({ tx, ty, trot, tzIndex } = getCPUCardTarget(dealPlayer.hand, playerIdx, cIdx, players));
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

    players.forEach((player, playerIdx) => {
      const playerNewIds = newIds.filter(id => player.hand.some(c => c.id === id));
      playerNewIds.forEach((cardId, j) => {
        if (drawnCardKeptRef.current === cardId) { drawnCardKeptRef.current = null; return; }
        if (drawnCardPlayedRef.current === cardId) { drawnCardPlayedRef.current = null; return; }
        const delay = j * 130;
        const actualCard = player.hand.find(c => c.id === cardId) ?? null;
        let tx: string, ty: string, trot: string, tzIndex: number, size: 'sm' | 'md';
        let isDragDraw = false, drawStartX: string | undefined, drawStartY: string | undefined;
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
          ({ tx, ty, trot, tzIndex } = getCPUCardTarget(player.hand, playerIdx, cIdx, players));
          size = 'sm';
        }
        newHidden.set(cardId, delay);
        anims.push({ id: `fly-${Date.now()}-${playerIdx}-${j}`, cardId, playerId: playerIdx, delay, tx, ty, trot, tzIndex, size, card: playerIdx === 0 ? actualCard : null, isDragDraw, drawStartX, drawStartY });
      });
    });

    if (newHidden.size > 0) setHiddenCardIds(prev => new Map([...prev, ...newHidden]));
    if (anims.length > 0) setFlyingCards(prev => [...prev, ...anims]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  useLayoutEffect(() => {
    const top = discard[discard.length - 1];
    if (top && !prevDiscardIdsRef.current.has(top.id)) {
      const previousOwnerIdx = prevPlayersRef.current.findIndex(p => p.hand.some(c => c.id === top.id));
      if (previousOwnerIdx !== -1) {
        const prevHand = prevPlayersRef.current[previousOwnerIdx]!.hand;
        let tx: string, ty: string, trot: string, startScale = 1;
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
    prevDiscardIdsRef.current = new Set(discard.map(c => c.id));
    prevPlayersRef.current = players.map(p => ({ ...p, hand: [...p.hand] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discard, players]);

  useLayoutEffect(() => {
    if (!drawnCard) return;
    const dz = getDecisionZonePos();
    const dragDraw = dragDrawOverrideRef.current;
    dragDrawOverrideRef.current = null;
    setFlyingCards(prev => [...prev, {
      id: `drawn-${Date.now()}`,
      cardId: drawnCard.id,
      playerId: 0, delay: 0,
      tx: dz.tx, ty: dz.ty, trot: '0deg',
      tzIndex: Z.FLY_AIR, size: 'md' as const,
      card: drawnCard,
      isDragDraw: !!dragDraw,
      drawStartX: dragDraw?.startX,
      drawStartY: dragDraw?.startY,
    }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawnCard?.id]);

  return {
    flyingCards, setFlyingCards,
    hiddenCardIds, setHiddenCardIds,
    playingCards, setPlayingCards,
    hiddenDiscardId, setHiddenDiscardId,
    removeFlyAnim,
    drawnCardKeptRef, drawnCardPlayedRef,
  };
}
