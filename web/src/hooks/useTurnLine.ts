import { useState, useEffect, useLayoutEffect } from 'react';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626', green: '#16a34a', blue: '#2563eb', yellow: '#eab308',
};

interface TurnLineInput {
  currentPlayer: number;
  direction: number;
  visualDirection: number;
  players: { position?: string }[];
  pendingAction: { type: string; color?: string } | null | undefined;
  setActiveSeat: (seat: number | null) => void;
}

export function useTurnLine({ currentPlayer, direction, visualDirection, players, pendingAction, setActiveSeat }: TurnLineInput) {
  const [turnLine, setTurnLine] = useState({ offset: 0, length: 0, traveling: false });
  const [wildTravelColor, setWildTravelColor] = useState<string | null>(null);
  const [animatingFrom, setAnimatingFrom] = useState<number>(0);
  const [displayedDir, setDisplayedDir] = useState<1 | -1>(1);
  const [dirOpacity, setDirOpacity] = useState(0);

  useLayoutEffect(() => {
    const P = 1000;
    const getPos = (pIdx: number) => {
      const p = players[pIdx]?.position;
      if (p === 'top')    return 0;
      if (p === 'right')  return 250;
      if (p === 'bottom') return 500;
      if (p === 'left')   return 750;
      return 0;
    };

    if (animatingFrom === currentPlayer) {
      setActiveSeat(currentPlayer);
      setTurnLine({ offset: getPos(currentPlayer) + P, length: 0, traveling: false });
      return;
    }

    const from = animatingFrom;
    const to = currentPlayer;
    setActiveSeat(null);

    let startOffset = getPos(from);
    let targetOffset = getPos(to);

    if (direction === 1 && targetOffset < startOffset) {
      targetOffset += P;
    } else if (direction === -1 && targetOffset > startOffset) {
      targetOffset -= P;
    }

    startOffset += P;
    targetOffset += P;

    const D = Math.abs(targetOffset - startOffset);

    setTurnLine({ offset: startOffset, length: 0, traveling: false });

    const t1 = setTimeout(() => {
      setTurnLine({ offset: targetOffset, length: D, traveling: true });
    }, 720);

    const t2 = setTimeout(() => {
      setTurnLine({ offset: targetOffset, length: 0, traveling: true });
    }, 1170);

    const t3 = setTimeout(() => {
      setTurnLine({ offset: targetOffset, length: 0, traveling: false });
      setAnimatingFrom(to);
    }, 1670);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayer, direction, players, animatingFrom]);

  useEffect(() => {
    if (visualDirection === displayedDir) return;
    setDirOpacity(0);
    const t = setTimeout(() => {
      setDisplayedDir(visualDirection as 1 | -1);
      setDirOpacity(1);
    }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualDirection]);

  useEffect(() => {
    if (pendingAction?.type === 'wild' && pendingAction.color) {
      setWildTravelColor(COLOR_BG[pendingAction.color] ?? '#ffffff');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction?.type, pendingAction?.color]);

  useEffect(() => {
    if (!turnLine.traveling) setWildTravelColor(null);
  }, [turnLine.traveling]);

  return { turnLine, wildTravelColor, displayedDir, dirOpacity, revealDir: () => setDirOpacity(1) };
}
