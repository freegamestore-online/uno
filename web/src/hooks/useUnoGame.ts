import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CardColor,
  UnoCard,
  OpponentConfig,
  initGame,
  playCard,
  drawCards,
  topCard,
  isPlayable,
  cpuChooseCard,
  cpuChooseColor,
  shuffle,
} from '../lib/uno';
import type { GameState } from '../lib/uno';

interface ExtState extends GameState {
  pendingCardId: string | null;
  drawnCard: UnoCard | null;
  cpuPendingPlay: { cardId: string; chosenColor?: CardColor } | null;
}

function makeExt(s: GameState): ExtState {
  return { ...s, pendingCardId: null, drawnCard: null, cpuPendingPlay: null };
}

export function useUnoGame(opponentConfigs: OpponentConfig[], activeSeat?: number | null) {
  const [state, setState] = useState<ExtState>(() => makeExt(initGame(opponentConfigs)));
  const [isLocked, setIsLocked] = useState(false);
  const [actionTag, setActionTag] = useState<{ seat: number; text: string; type: string; color?: CardColor } | null>(null);
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lockBoard = useCallback((duration = 1800) => {
    setIsLocked(true);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => setIsLocked(false), duration);
  }, []);

  const restart = useCallback((newOpponents?: OpponentConfig[]) => {
    setState(makeExt(initGame(newOpponents ?? opponentConfigs)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const humanPlay = useCallback((cardId: string, chosenColor?: CardColor) => {
    if (state.phase !== 'playing' || state.players[state.currentPlayer]?.id !== 0) return;
    const card = state.players[0]?.hand.find(c => c.id === cardId);
    if (!card || !isPlayable(card, topCard(state))) return;

    lockBoard();
    setState(prev => {
      if (prev.phase !== 'playing' || prev.players[prev.currentPlayer]?.id !== 0) return prev;
      const c = prev.players[0]?.hand.find(c => c.id === cardId);
      if (!c || !isPlayable(c, topCard(prev))) return prev;

      if ((c.value === 'wild' || c.value === 'wild4') && !chosenColor) {
        return { ...prev, phase: 'color-pick', pendingCardId: cardId };
      }
      return { ...playCard(prev, cardId, chosenColor), pendingCardId: null, drawnCard: null, cpuPendingPlay: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const humanPickColor = useCallback((color: CardColor) => {
    if (state.phase !== 'color-pick' || !state.pendingCardId) return;

    lockBoard();
    setState(prev => {
      if (prev.phase !== 'color-pick' || !prev.pendingCardId) return prev;
      const next = playCard(prev, prev.pendingCardId, color);
      return { ...next, pendingCardId: null, drawnCard: null, cpuPendingPlay: null, phase: next.phase === 'game-over' ? 'game-over' : 'playing' };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const humanDraw = useCallback(() => {
    if (state.phase !== 'playing' || state.players[state.currentPlayer]?.id !== 0) return;

    lockBoard();
    setState(prev => {
      if (prev.phase !== 'playing' || prev.players[prev.currentPlayer]?.id !== 0) return prev;
      // Pop one card from deck without adding to hand yet
      let { deck, discard } = prev;
      if (deck.length === 0) {
        const top = discard[discard.length - 1] as UnoCard;
        deck = shuffle(discard.slice(0, -1).map(c => ({ ...c, chosenColor: undefined })));
        discard = [top];
      }
      const drawn = deck[deck.length - 1];
      if (!drawn) return prev;
      deck = deck.slice(0, -1);
      if (isPlayable(drawn, topCard(prev))) {
        // Card stays in limbo until user decides; hand is NOT updated yet
        return { ...prev, deck, discard, pendingCardId: null, drawnCard: drawn };
      }
      // Not playable: add to hand and advance turn
      const players = prev.players.map((p, i) => i === 0 ? { ...p, hand: [...p.hand, drawn] } : p);
      const n = players.length;
      const next = ((prev.currentPlayer + prev.direction) % n + n) % n;
      return { ...prev, deck, discard, players, currentPlayer: next, pendingCardId: null, drawnCard: null, cpuPendingPlay: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const humanPlayDrawn = useCallback((chosenColor?: CardColor) => {
    if (!state.drawnCard) return;
    lockBoard();
    setState(prev => {
      if (!prev.drawnCard) return prev;
      const c = prev.drawnCard;
      // Add to hand so playCard can find it, then play immediately
      const players = prev.players.map((p, i) => i === 0 ? { ...p, hand: [...p.hand, c] } : p);
      const stateWithCard = { ...prev, players, drawnCard: null };
      if ((c.value === 'wild' || c.value === 'wild4') && !chosenColor) {
        return { ...stateWithCard, phase: 'color-pick', pendingCardId: c.id };
      }
      return { ...playCard(stateWithCard, c.id, chosenColor), pendingCardId: null, drawnCard: null, cpuPendingPlay: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const humanKeepDrawn = useCallback(() => {
    if (!state.drawnCard) return;
    lockBoard();
    setState(prev => {
      if (!prev.drawnCard) return prev;
      // Now add the card to hand and advance turn
      const card = prev.drawnCard;
      const players = prev.players.map((p, i) => i === 0 ? { ...p, hand: [...p.hand, card] } : p);
      const n = players.length;
      const next = ((prev.currentPlayer + prev.direction) % n + n) % n;
      return { ...prev, players, currentPlayer: next, pendingCardId: null, drawnCard: null, cpuPendingPlay: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  // 2P Reverse: show REVERSE! on actor at 720ms, clear it at 1400ms, then send turn line to opponent at 1500ms
  useEffect(() => {
    if (state.pendingAction?.type === 'reverse' && state.players.length === 2) {
      const { nextPlayer, color } = state.pendingAction;
      const t1 = setTimeout(() => {
        setActionTag({ seat: nextPlayer, text: 'REVERSE!', type: 'reverse', color });
      }, 720);
      const t2 = setTimeout(() => {
        setActionTag(null);
        setState(prev => {
          if (!prev.pendingAction) return prev;
          return { ...prev, currentPlayer: prev.pendingAction.target };
        });
      }, 1720);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingAction]);

  // Action phase: distinct physical animations for victims and actors
  useEffect(() => {
    if (state.pendingAction && activeSeat === state.pendingAction.target) {
      const { type, target, nextPlayer, color } = state.pendingAction;
      const is2PReverse = type === 'reverse' && state.players.length === 2;
      const isVictimPenalty = type === 'skip' || type === 'draw2' || type === 'wild4' || is2PReverse;

      if (isVictimPenalty) {
        const isSkipLike = type === 'skip' || is2PReverse;
        const flyTime = type === 'draw2' ? (130 * 1 + 720) : type === 'wild4' ? (130 * 3 + 720) : 0;

        if (is2PReverse) {
          setActionTag({ seat: target, text: '🥲 skipped', type: 'skip' });
        } else if (type === 'skip') {
          setActionTag({ seat: target, text: '🥲 skipped', type: 'skip' });
        } else {
          const text = type === 'draw2' ? '😢 draw 2 cards' : '😭 draw 4 cards';
          setActionTag({ seat: target, text, type });
        }

        const t1 = setTimeout(() => {
          if (type === 'draw2' || type === 'wild4') {
            setState(prev => {
              let s: GameState = { ...prev, players: prev.players.map(p => ({ ...p, hand: [...p.hand] })) };
              if (type === 'draw2') s = drawCards(s, target, 2);
              if (type === 'wild4') s = drawCards(s, target, 4);
              return makeExt(s);
            });
          }
        }, 600);

        const baseWait = isSkipLike ? 1000 : 600 + flyTime + 100;
        const t2 = setTimeout(() => {
          lockBoard(1800);
          setState(prev => {
            if (!prev.pendingAction) return prev;
            return makeExt({ ...prev, currentPlayer: nextPlayer, pendingAction: null });
          });
        }, baseWait);

        return () => { clearTimeout(t1); clearTimeout(t2); };
      } else {
        // Normal 3+ player Reverse & Wild — activeSeat is still on the actor
        const text = type === 'reverse' ? 'REVERSE!' : `${color?.toUpperCase()}!`;

        const t1 = setTimeout(() => {
          setActionTag({ seat: target, text, type, color });
        }, 720);

        const t2 = setTimeout(() => {
          lockBoard(1800);
          setState(prev => {
            if (!prev.pendingAction) return prev;
            return makeExt({ ...prev, currentPlayer: nextPlayer, pendingAction: null });
          });
        }, 720 + 600);

        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    } else if (!state.pendingAction) {
      const t3 = setTimeout(() => setActionTag(null), 800);
      return () => clearTimeout(t3);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeat, state.pendingAction, lockBoard]);

  // CPU drew a playable card: play it after the draw animation lands (~900ms)
  useEffect(() => {
    if (!state.cpuPendingPlay) return;
    const { cardId, chosenColor } = state.cpuPendingPlay;
    const t = setTimeout(() => {
      lockBoard();
      setState(prev => {
        if (!prev.cpuPendingPlay) return prev;
        return { ...playCard(prev, cardId, chosenColor), pendingCardId: null, drawnCard: null, cpuPendingPlay: null };
      });
    }, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cpuPendingPlay, lockBoard]);

  // CPU turns — waits for both isLocked and activeSeat to confirm the UI has caught up
  useEffect(() => {
    if (state.phase !== 'playing' || isLocked || activeSeat !== state.currentPlayer || state.pendingAction || state.cpuPendingPlay) return;
    const current = state.players[state.currentPlayer];
    if (!current || current.isHuman) return;

    cpuTimerRef.current = setTimeout(() => {
      lockBoard();
      setState(prev => {
        if (prev.phase !== 'playing') return prev;
        const cpu = prev.players[prev.currentPlayer];
        if (!cpu || cpu.isHuman) return prev;

        const card = cpuChooseCard(prev);
        if (!card) {
          const s = drawCards(prev, prev.currentPlayer, 1);
          const drawn = s.players[prev.currentPlayer]?.hand.at(-1);
          if (drawn && isPlayable(drawn, topCard(s))) {
            const chosenColor = drawn.value === 'wild' || drawn.value === 'wild4'
              ? cpuChooseColor(s.players[s.currentPlayer]?.hand.filter(c => c.id !== drawn.id) ?? [])
              : undefined;
            return { ...makeExt(s), cpuPendingPlay: { cardId: drawn.id, chosenColor } };
          }
          const n = s.players.length;
          const next = ((s.currentPlayer + s.direction) % n + n) % n;
          return { ...makeExt(s), currentPlayer: next };
        }

        const chosenColor =
          card.value === 'wild' || card.value === 'wild4'
            ? cpuChooseColor(cpu.hand.filter(c => c.id !== card.id))
            : undefined;

        return { ...playCard(prev, card.id, chosenColor), pendingCardId: null, drawnCard: null, cpuPendingPlay: null };
      });
    }, 500);

    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayer, state.phase, isLocked, activeSeat, state.pendingAction]);

  const debugDrawTest = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'playing' || prev.players[0] === undefined) return prev;
      const top = topCard(prev);
      const human = prev.players[0];
      // Move all playable cards from human's hand into the deck, then surface one playable card to the top
      const playableInHand = human.hand.filter(c => isPlayable(c, top));
      const nonPlayable = human.hand.filter(c => !isPlayable(c, top));
      let deck = [...prev.deck, ...playableInHand];
      const playableIdx = deck.findIndex(c => isPlayable(c, top));
      if (playableIdx === -1) return prev;
      const [surfaced] = deck.splice(playableIdx, 1);
      deck = [...deck, surfaced!]; // put playable card at top of draw pile
      const players = prev.players.map((p, i) =>
        i === 0 ? { ...p, hand: nonPlayable.length > 0 ? nonPlayable : [deck.pop()!] } : p
      );
      return { ...prev, deck, players, drawnCard: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debugCPUDrawTest = useCallback(() => {
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      const cpuIdx = prev.players.findIndex(p => !p.isHuman);
      if (cpuIdx === -1) return prev;
      const top = topCard(prev);
      const cpu = prev.players[cpuIdx]!;
      // Strip playables from CPU hand, surface a playable to deck top
      const playableInHand = cpu.hand.filter(c => isPlayable(c, top));
      const nonPlayable = cpu.hand.filter(c => !isPlayable(c, top));
      let deck = [...prev.deck, ...playableInHand];
      const playableIdx = deck.findIndex(c => isPlayable(c, top));
      if (playableIdx === -1) return prev;
      const [surfaced] = deck.splice(playableIdx, 1);
      deck = [...deck, surfaced!];
      const players = prev.players.map((p, i) =>
        i === cpuIdx ? { ...p, hand: nonPlayable.length > 0 ? nonPlayable : [deck[deck.length - 2]!] } : p
      );
      return { ...prev, deck, players, currentPlayer: cpuIdx, drawnCard: null, pendingCardId: null, cpuPendingPlay: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, isLocked, actionTag, humanPlay, humanPickColor, humanDraw, humanPlayDrawn, humanKeepDrawn, debugDrawTest, debugCPUDrawTest, restart };
}
