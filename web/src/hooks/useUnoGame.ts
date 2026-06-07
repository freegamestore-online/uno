import { useCallback, useEffect, useRef, useState, MutableRefObject } from 'react';
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
  cpuPassedSeat: number | null;
  cpuPassedDrawnId: string | null;
}

function makeExt(s: GameState): ExtState {
  return { ...s, pendingCardId: null, drawnCard: null, cpuPendingPlay: null, cpuPassedSeat: null, cpuPassedDrawnId: null };
}

export interface AnimWatchRef {
  watchDraw: (playerIdx: number) => Promise<void>;
  watchCardAnim: (cardId: string) => Promise<void>;
  waitAllAnims: () => Promise<void>;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const noopWatch: AnimWatchRef = { watchDraw: () => Promise.resolve(), watchCardAnim: () => Promise.resolve(), waitAllAnims: () => Promise.resolve() };

export function useUnoGame(opponentConfigs: OpponentConfig[], activeSeat?: number | null, animWatchRef?: MutableRefObject<AnimWatchRef>, bustActiveRef?: MutableRefObject<boolean>) {
  const [state, setState] = useState<ExtState>(() => makeExt(initGame(opponentConfigs)));
  const [isLocked, setIsLocked] = useState(false);
  const [actionTag, setActionTag] = useState<{ seat: number; text: string; type: string; color?: CardColor } | null>(null);
  const [cpuChallengeDecided, setCpuChallengeDecided] = useState(false);
  const [cpuChallengeOopsKey, setCpuChallengeOopsKey] = useState(0);
  const [wild4Strike, setWild4Strike] = useState<number | null>(null);
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lockBoard = useCallback((duration = 1150) => {
    setIsLocked(true);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => setIsLocked(false), duration);
  }, []);

  const cpuDrawWatchRef = useRef<Promise<void> | null>(null);

  const lockBoardManual = useCallback(() => {
    setIsLocked(true);
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => setIsLocked(false), 5000); // safety fallback
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      setIsLocked(false);
    };
  }, []);

  useEffect(() => {
    if (!state.pendingAction) setCpuChallengeDecided(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingAction]);

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
      return { ...playCard(prev, cardId, chosenColor), pendingCardId: null, drawnCard: null, cpuPendingPlay: null, cpuPassedSeat: null, cpuPassedDrawnId: null };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const humanPickColor = useCallback((color: CardColor) => {
    if (state.phase !== 'color-pick' || !state.pendingCardId) return;

    lockBoard();
    setState(prev => {
      if (prev.phase !== 'color-pick' || !prev.pendingCardId) return prev;
      const next = playCard(prev, prev.pendingCardId, color);
      return { ...next, pendingCardId: null, drawnCard: null, cpuPendingPlay: null, cpuPassedSeat: null, cpuPassedDrawnId: null, phase: next.phase === 'game-over' ? 'game-over' : 'playing' };
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
      return { ...playCard(stateWithCard, c.id, chosenColor), pendingCardId: null, drawnCard: null, cpuPendingPlay: null, cpuPassedSeat: null, cpuPassedDrawnId: null };
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

  // 2P Reverse: show REVERSE! on actor at 720ms, then send turn line to opponent at 1720ms
  useEffect(() => {
    if (state.pendingAction?.type === 'reverse' && state.players.length === 2) {
      const { nextPlayer, color } = state.pendingAction;
      let cancelled = false;
      (async () => {
        await sleep(720);
        if (cancelled) return;
        while (bustActiveRef?.current) { await sleep(50); if (cancelled) return; }
        setActionTag({ seat: nextPlayer, text: 'REVERSE!', type: 'reverse', color });
        await sleep(1200);
        if (cancelled) return;
        setActionTag(null);
        await sleep(0);
        if (cancelled) return;
        setState(prev => { if (!prev.pendingAction) return prev; return { ...prev, currentPlayer: prev.pendingAction.target }; });
      })();
      return () => { cancelled = true; };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingAction]);

  // Action phase: distinct physical animations for victims and actors
  useEffect(() => {
    const pa = state.pendingAction;
    if (!pa) {
      let cancelled = false;
      (async () => { await sleep(800); if (!cancelled) setActionTag(null); })();
      return () => { cancelled = true; };
    }

    const { type, target, nextPlayer, color } = pa;

    // Wild4: trigger fires at victim's seat (turn moves there so challenge dialog / CPU decision fires)
    if (type === 'wild4') {
      const { attacker, prevColor } = pa;
      if (attacker == null || activeSeat !== target) return () => {};
      // Human victim: GameBoard shows ChallengeUI instead of auto-resolving
      if (target === 0) return () => {};
      // CPU victim: decide whether to challenge based on difficulty
      const diff = state.players[target]?.difficulty ?? 'medium';
      const attackerHand = state.players[attacker]?.hand ?? [];
      const shouldChallenge = attackerHand.some(c => c.color === prevColor);
      const accuracy = diff === 'hard' ? 0.90 : diff === 'medium' ? 0.60 : 0.35;
      const willChallenge = (Math.random() < accuracy) ? shouldChallenge : !shouldChallenge;
      const thinkDelay = diff === 'hard' ? 600 + Math.random() * 400 :
                         diff === 'medium' ? 900 + Math.random() * 600 :
                         1100 + Math.random() * 800;
      const watch = animWatchRef?.current ?? noopWatch;
      let cancelled = false;
      (async () => {
        await watch.waitAllAnims(); // wait for wild4 card to land before CPU reacts
        if (cancelled) return;
        while (bustActiveRef?.current) { await sleep(50); if (cancelled) return; }
        await sleep(thinkDelay);
        if (cancelled) return;
        setCpuChallengeDecided(true);
        if (willChallenge && shouldChallenge) {
          // Challenge succeeds — attacker draws 4, CPU victim gets their turn
          setActionTag({ seat: target, text: 'Challenge!', type: 'challenge' });
          await sleep(350);
          if (cancelled) return;
          setActionTag({ seat: target, text: '🥳 Challenge Successful!', type: 'wild4' });
          await sleep(900);
          if (cancelled) return;
          setActionTag({ seat: attacker, text: '🤡 draw 4 cards', type: 'wild4' });
          await sleep(600);
          if (cancelled) return;
          const drawDone = watch.watchDraw(attacker);
          setState(prev => { if (!prev.pendingAction) return prev; return makeExt(drawCards(prev, attacker, 4)); });
          await drawDone;
          await sleep(600);
          if (cancelled) return;
          setActionTag(null);
          await sleep(0);
          if (cancelled) return;
          lockBoard(1150);
          setState(prev => { if (!prev.pendingAction) return prev; return makeExt({ ...prev, currentPlayer: target, pendingAction: null }); });
        } else if (willChallenge && !shouldChallenge) {
          // Challenge fails — CPU draws 6
          setActionTag({ seat: target, text: 'Challenge!', type: 'challenge' });
          await sleep(350);
          if (cancelled) return;
          setCpuChallengeOopsKey(k => k + 1);
          setActionTag({ seat: target, text: '🤡 draw 6 cards', type: 'wild4' });
          await sleep(600);
          if (cancelled) return;
          const drawDone = watch.watchDraw(target);
          setState(prev => { if (!prev.pendingAction) return prev; return makeExt(drawCards(prev, target, 6)); });
          await drawDone;
          await sleep(600);
          if (cancelled) return;
          setActionTag(null);
          await sleep(0);
          if (cancelled) return;
          lockBoard(1150);
          setState(prev => { if (!prev.pendingAction) return prev; return makeExt({ ...prev, currentPlayer: prev.pendingAction.nextPlayer, pendingAction: null }); });
        } else {
          acceptDraw4(target);
        }
      })();
      return () => { cancelled = true; };
    }

    // All other pending actions: trigger fires at target's seat
    if (activeSeat !== target) return () => {};

    const is2PReverse = type === 'reverse' && state.players.length === 2;
    const isVictimPenalty = type === 'skip' || type === 'draw2' || is2PReverse;
    const watch = animWatchRef?.current ?? noopWatch;
    let cancelled = false;

    if (isVictimPenalty) {
      const isSkipLike = type === 'skip' || is2PReverse;
      (async () => {
        while (bustActiveRef?.current) { await sleep(50); if (cancelled) return; }
        if (is2PReverse || type === 'skip') {
          setActionTag({ seat: target, text: '🥲 skipped', type: 'skip' });
        } else {
          setActionTag({ seat: target, text: '😢 draw 2 cards', type });
        }
        if (isSkipLike) {
          await sleep(1200);
        } else {
          await sleep(600);
          if (cancelled) return;
          const drawDone = watch.watchDraw(target);
          setState(prev => {
            let s: GameState = { ...prev, players: prev.players.map(p => ({ ...p, hand: [...p.hand] })) };
            if (type === 'draw2') s = drawCards(s, target, 2);
            return makeExt(s);
          });
          await drawDone;
          await sleep(600);
        }
        if (cancelled) return;
        setActionTag(null);
        await sleep(0);
        if (cancelled) return;
        lockBoard(1150);
        setState(prev => { if (!prev.pendingAction) return prev; return makeExt({ ...prev, currentPlayer: nextPlayer, pendingAction: null }); });
      })();
    } else {
      // Normal 3+ player Reverse & Wild
      const text = type === 'reverse' ? 'REVERSE!' : `${color?.toUpperCase()}!`;
      (async () => {
        await sleep(720);
        if (cancelled) return;
        while (bustActiveRef?.current) { await sleep(50); if (cancelled) return; }
        setActionTag({ seat: target, text, type, color });
        await sleep(1000);
        if (cancelled) return;
        setActionTag(null);
        await sleep(0);
        if (cancelled) return;
        lockBoard(1150);
        setState(prev => { if (!prev.pendingAction) return prev; return makeExt({ ...prev, currentPlayer: nextPlayer, pendingAction: null }); });
      })();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeat, state.pendingAction, lockBoard]);

  // CPU drew a playable card: play it once the draw animation lands — wait for tag to light up first
  useEffect(() => {
    if (!state.cpuPendingPlay) return;
    if (activeSeat !== state.currentPlayer) return;
    const { cardId, chosenColor } = state.cpuPendingPlay;
    const watch = animWatchRef?.current ?? noopWatch;
    let cancelled = false;
    (async () => {
      await watch.watchCardAnim(cardId);
      if (cancelled) return;
      lockBoard();
      setState(prev => {
        if (!prev.cpuPendingPlay) return prev;
        return { ...playCard(prev, cardId, chosenColor), pendingCardId: null, drawnCard: null, cpuPendingPlay: null, cpuPassedSeat: null, cpuPassedDrawnId: null };
      });
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cpuPendingPlay, activeSeat]);

  // CPU drew an unplayable card: wait for draw animation, then advance turn
  useEffect(() => {
    if (state.cpuPassedSeat === null) return;
    if (activeSeat !== state.cpuPassedSeat) return;
    const seat = state.cpuPassedSeat;
    const hasDrawn = state.cpuPassedDrawnId !== null;
    let cancelled = false;
    (async () => {
      if (hasDrawn && cpuDrawWatchRef.current) {
        await cpuDrawWatchRef.current;
        cpuDrawWatchRef.current = null;
      }
      if (cancelled) return;
      lockBoard(1150);
      setState(prev => {
        if (prev.cpuPassedSeat !== seat) return prev;
        const n = prev.players.length;
        const next = ((prev.currentPlayer + prev.direction) % n + n) % n;
        return { ...prev, cpuPassedSeat: null, cpuPassedDrawnId: null, currentPlayer: next };
      });
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cpuPassedSeat, activeSeat]);

  // CPU turns — waits for both isLocked and activeSeat to confirm the UI has caught up
  useEffect(() => {
    if (state.phase !== 'playing' || isLocked || activeSeat !== state.currentPlayer || state.pendingAction || state.cpuPendingPlay || state.cpuPassedSeat !== null) return;
    const current = state.players[state.currentPlayer];
    if (!current || current.isHuman) return;

    cpuTimerRef.current = setTimeout(() => {
      const watch = animWatchRef?.current ?? noopWatch;
      if (!cpuChooseCard(state)) {
        cpuDrawWatchRef.current = watch.watchDraw(state.currentPlayer);
      }
      lockBoard();
      setState(prev => {
        if (prev.phase !== 'playing') return prev;
        const cpu = prev.players[prev.currentPlayer];
        if (!cpu || cpu.isHuman) return prev;

        const card = cpuChooseCard(prev);
        if (!card) {
          const prevHandLen = prev.players[prev.currentPlayer]?.hand.length ?? 0;
          const s = drawCards(prev, prev.currentPlayer, 1);
          const newHand = s.players[prev.currentPlayer]?.hand ?? [];
          const drawn = newHand.length > prevHandLen ? newHand.at(-1) : null;
          if (drawn && isPlayable(drawn, topCard(s))) {
            const chosenColor = drawn.value === 'wild' || drawn.value === 'wild4'
              ? cpuChooseColor(s.players[s.currentPlayer]?.hand.filter(c => c.id !== drawn.id) ?? [])
              : undefined;
            return { ...makeExt(s), cpuPendingPlay: { cardId: drawn.id, chosenColor } };
          }
          return { ...makeExt(s), cpuPassedSeat: s.currentPlayer, cpuPassedDrawnId: drawn?.id ?? null };
        }

        const chosenColor =
          card.value === 'wild' || card.value === 'wild4'
            ? cpuChooseColor(cpu.hand.filter(c => c.id !== card.id))
            : undefined;

        return { ...playCard(prev, card.id, chosenColor), pendingCardId: null, drawnCard: null, cpuPendingPlay: null, cpuPassedSeat: null, cpuPassedDrawnId: null };
      });
    }, 500);

    return () => {
      if (cpuTimerRef.current) clearTimeout(cpuTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayer, state.phase, isLocked, activeSeat, state.pendingAction]);

  const acceptDraw4 = useCallback((targetSeat: number) => {
    const pa = state.pendingAction;
    if (!pa || pa.type !== 'wild4' || pa.target !== targetSeat) return;
    const { nextPlayer } = pa;
    const watch = animWatchRef?.current ?? noopWatch;
    lockBoard(5000);
    (async () => {
      setWild4Strike(targetSeat);
      await sleep(700);
      setWild4Strike(null);
      setActionTag({ seat: targetSeat, text: '😭 draw 4 cards', type: 'wild4' });
      await sleep(600);
      const drawDone = watch.watchDraw(targetSeat);
      setState(prev => { if (!prev.pendingAction) return prev; return makeExt(drawCards(prev, targetSeat, 4)); });
      await drawDone;
      await sleep(600);
      setActionTag(null);
      await sleep(0);
      lockBoard(1150);
      setState(prev => { if (!prev.pendingAction) return prev; return makeExt({ ...prev, currentPlayer: nextPlayer, pendingAction: null }); });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const humanChallenge = useCallback((onResult?: (succeeded: boolean) => void) => {
    const pa = state.pendingAction;
    if (!pa || pa.type !== 'wild4' || pa.target !== 0) return;
    const { attacker, prevColor, nextPlayer } = pa;
    const attackerHand = state.players[attacker ?? -1]?.hand ?? [];
    const challengeSucceeds = attackerHand.some(c => c.color === prevColor);
    onResult?.(challengeSucceeds);
    const watch = animWatchRef?.current ?? noopWatch;
    (async () => {
      if (challengeSucceeds) {
        lockBoard(5000);
        setActionTag({ seat: 0, text: '🥳 Challenge Successful', type: 'wild4' });
        await sleep(1000);
        setActionTag({ seat: attacker ?? 0, text: '🤡 draw 4 cards', type: 'wild4' });
        await sleep(600);
        const drawDone = watch.watchDraw(attacker ?? 0);
        setState(prev => { if (!prev.pendingAction) return prev; return makeExt(drawCards(prev, attacker ?? 0, 4)); });
        await drawDone;
        await sleep(600);
        setActionTag(null);
        await sleep(0);
        lockBoard(1150);
        // Human gets their turn back — wild4 was illegal
        setState(prev => { if (!prev.pendingAction) return prev; return makeExt({ ...prev, currentPlayer: 0, pendingAction: null }); });
      } else {
        lockBoard(7000);
        await sleep(1400);
        setActionTag({ seat: 0, text: '🤡 draw 6 cards', type: 'wild4' });
        await sleep(600);
        const drawDone = watch.watchDraw(0);
        setState(prev => { if (!prev.pendingAction) return prev; return makeExt(drawCards(prev, 0, 6)); });
        await drawDone;
        await sleep(600);
        setActionTag(null);
        await sleep(0);
        lockBoard(1150);
        setState(prev => { if (!prev.pendingAction) return prev; return makeExt({ ...prev, currentPlayer: nextPlayer, pendingAction: null }); });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, lockBoard]);

  const bustDraw = useCallback((targetSeat: number) => {
    const unlock = lockBoardManual();
    setState(prev => {
      if (prev.phase !== 'playing') return prev;
      const drawn = drawCards(prev, targetSeat, 2);
      return { ...drawn, pendingCardId: prev.pendingCardId, drawnCard: prev.drawnCard, cpuPendingPlay: prev.cpuPendingPlay, cpuPassedSeat: prev.cpuPassedSeat, cpuPassedDrawnId: prev.cpuPassedDrawnId, pendingAction: prev.pendingAction };
    });
    return unlock;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockBoardManual]);

  return { state, isLocked, actionTag, wild4Strike, cpuChallengeDecided, cpuChallengeOopsKey, humanPlay, humanPickColor, humanDraw, humanPlayDrawn, humanKeepDrawn, acceptDraw4, humanChallenge, bustDraw, restart };
}
