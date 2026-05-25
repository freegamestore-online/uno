import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CardColor,
  OpponentConfig,
  initGame,
  playCard,
  drawCards,
  topCard,
  isPlayable,
  cpuChooseCard,
  cpuChooseColor,
} from '../lib/uno';
import type { GameState } from '../lib/uno';

interface ExtState extends GameState {
  pendingCardId: string | null;
}

function makeExt(s: GameState): ExtState {
  return { ...s, pendingCardId: null };
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
      return { ...playCard(prev, cardId, chosenColor), pendingCardId: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const humanPickColor = useCallback((color: CardColor) => {
    if (state.phase !== 'color-pick' || !state.pendingCardId) return;

    lockBoard();
    setState(prev => {
      if (prev.phase !== 'color-pick' || !prev.pendingCardId) return prev;
      return { ...playCard(prev, prev.pendingCardId, color), pendingCardId: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const humanDraw = useCallback(() => {
    if (state.phase !== 'playing' || state.players[state.currentPlayer]?.id !== 0) return;

    lockBoard();
    setState(prev => {
      if (prev.phase !== 'playing' || prev.players[prev.currentPlayer]?.id !== 0) return prev;
      const s = drawCards(prev, 0, 1);
      const hand = s.players[0]?.hand ?? [];
      const drawn = hand[hand.length - 1];
      const n = s.players.length;
      const next = ((s.currentPlayer + s.direction) % n + n) % n;
      return { ...s, currentPlayer: next, pendingCardId: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  // Action phase: distinct physical animations for victims and actors
  useEffect(() => {
    if (state.pendingAction && activeSeat === state.pendingAction.target) {
      const { type, target, nextPlayer, color } = state.pendingAction;
      const isVictimPenalty = type === 'skip' || type === 'draw2' || type === 'wild4';

      if (isVictimPenalty) {
        const text = type === 'skip' ? '🥲 skipped' : type === 'draw2' ? '😢 draw 2 cards' : '😭 draw 4 cards';
        const flyTime = type === 'draw2' ? (130 * 1 + 720) : type === 'wild4' ? (130 * 3 + 720) : 0;

        setActionTag({ seat: target, text, type });

        const t1 = setTimeout(() => {
          if (type !== 'skip') {
            setState(prev => {
              let s = { ...prev, players: prev.players.map(p => ({ ...p, hand: [...p.hand] })) };
              if (type === 'draw2') s = drawCards(s, target, 2);
              if (type === 'wild4') s = drawCards(s, target, 4);
              return makeExt(s);
            });
          }
        }, 600);

        const t2 = setTimeout(() => {
          lockBoard(1800);
          setState(prev => {
            if (!prev.pendingAction) return prev;
            return makeExt({ ...prev, currentPlayer: nextPlayer, pendingAction: null });
          });
        }, 600 + flyTime + 100);

        return () => { clearTimeout(t1); clearTimeout(t2); };
      } else {
        // Actor actions (Reverse, Wild) — wait for card to land before flashing tag
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

  // CPU turns — waits for both isLocked and activeSeat to confirm the UI has caught up
  useEffect(() => {
    if (state.phase !== 'playing' || isLocked || activeSeat !== state.currentPlayer || state.pendingAction) return;
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
          const n = s.players.length;
          const next = ((s.currentPlayer + s.direction) % n + n) % n;
          return { ...s, currentPlayer: next, pendingCardId: null };
        }

        const chosenColor =
          card.value === 'wild' || card.value === 'wild4'
            ? cpuChooseColor(cpu.hand.filter(c => c.id !== card.id))
            : undefined;

        return { ...playCard(prev, card.id, chosenColor), pendingCardId: null };
      });
    }, 500);

    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayer, state.phase, isLocked, activeSeat, state.pendingAction]);

  return { state, isLocked, actionTag, humanPlay, humanPickColor, humanDraw, restart };
}
