import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameShell, GameTopbar, GameButton } from '@freegamestore/games';
import { useUnoGame } from '../hooks/useUnoGame';
import { Card } from './Card';
import { ColorPicker } from './ColorPicker';
import { UnoCard, OpponentConfig, Player, topCard, isPlayable, effectiveColor, CardColor } from '../lib/uno';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626',
  green: '#16a34a',
  blue: '#2563eb',
  yellow: '#d97706',
  wild: '#7c3aed',
};

// Shared sort so render and target-calculation stay in sync
function sortHand(hand: UnoCard[]): UnoCard[] {
  const colorOrder: Record<string, number> = { red: 0, green: 1, blue: 2, yellow: 3, wild: 4 };
  return [...hand].sort((a, b) => {
    const aWild = a.value === 'wild' || a.value === 'wild4';
    const bWild = b.value === 'wild' || b.value === 'wild4';
    if (aWild !== bWild) return aWild ? -1 : 1;
    if (aWild && bWild) return (a.value === 'wild4' ? 0 : 1) - (b.value === 'wild4' ? 0 : 1);
    const colorDiff = (colorOrder[a.color] ?? 4) - (colorOrder[b.color] ?? 4);
    if (colorDiff !== 0) return colorDiff;
    const specialOrder: Record<string, number> = { reverse: 0, skip: 1, draw2: 2 };
    const aRank = specialOrder[a.value] ?? (3 + Number(a.value));
    const bRank = specialOrder[b.value] ?? (3 + Number(b.value));
    return aRank - bRank;
  });
}

// Calculates exact --tx/--ty offset from the flying card's absolute anchor to the real slot.
// Uses board container dimensions so the topbar height is properly excluded.
function getHumanCardTarget(hand: UnoCard[], cardId: string): { tx: string; ty: string; trot: string; tzIndex: number } {
  const board = document.getElementById('board-container');
  const vw = board ? board.clientWidth : window.innerWidth;
  const vh = board ? board.clientHeight : window.innerHeight;

  const sorted = sortHand(hand);
  const cardIdx = sorted.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return { tx: '36px', ty: '32vh', trot: '0deg', tzIndex: 200 };

  const total = sorted.length;
  const center = (total - 1) / 2;
  const offset = cardIdx - center;

  const maxStep = Math.min(40, vw * 0.085);
  const xStep = Math.min(maxStep, Math.max(16, (vw * 0.65) / Math.max(total - 1, 1)));
  const yArcMult = total <= 1 ? 0 : Math.max(0.4, 3.0 / Math.max(1, total * 0.2));
  const handH = Math.min(148, Math.max(110, vh * 0.19));
  const maxYArc = center * center * yArcMult;
  const anchorBottom = Math.min(12 + maxYArc, handH * 0.82);

  const degsEach = total <= 1 ? 0 : Math.min(6, 40 / (total - 1));
  const rotationDeg = offset * degsEach;
  const rotationRad = (rotationDeg * Math.PI) / 180;

  const x = offset * xStep;
  const yArc = offset * offset * yArcMult;
  const cardW = Math.min(52, Math.max(40, vw * 0.1));
  const cardH = cardW * 1.45;

  const bottomX = vw / 2 + x;
  const bottomY = vh - anchorBottom + yArc;

  const cardCenterX = bottomX + (cardH / 2) * Math.sin(rotationRad);
  const cardCenterY = bottomY - (cardH / 2) * Math.cos(rotationRad);

  const startX = vw / 2 - (cardW / 2 + 10);
  const tx = `${Math.round(cardCenterX - startX)}px`;
  const ty = `${Math.round(cardCenterY - vh / 2)}px`;
  const trot = `${rotationDeg}deg`;

  return { tx, ty, trot, tzIndex: cardIdx };
}

interface FlyAnim { id: string; cardId: string; playerId: number; delay: number; tx: string; ty: string; trot: string; tzIndex: number; size: 'sm' | 'md'; card: UnoCard | null }

// Calculates exact --tx/--ty for a CPU card slot using the player's physical position.
function getCPUCardTarget(hand: UnoCard[], playerIdx: number, cardIdx: number, players: Player[]): { tx: string; ty: string; trot: string; tzIndex: number } {
  const board = document.getElementById('board-container');
  const vw = board ? board.clientWidth : window.innerWidth;
  const vh = board ? board.clientHeight : window.innerHeight;

  const total = Math.min(hand.length, 15);
  const effectiveIdx = Math.min(Math.max(cardIdx, 0), total - 1);
  const fanCenter = (total - 1) / 2;
  const offset = effectiveIdx - fanCenter;

  const pos = players[playerIdx]?.position ?? 'top';
  const isSidePlayer = pos === 'left' || pos === 'right';
  const baseCurve = isSidePlayer ? 3.2 : 2.0;
  const yArcMult = total <= 1 ? 0 : Math.max(0.15, baseCurve / Math.max(1, total * 0.3));
  const xStep = Math.min(24, 200 / Math.max(total - 1, 1));
  const degsEach = total <= 1 ? 0 : Math.min(8, 50 / (total - 1));

  const localX = offset * xStep;
  const localY = offset * offset * yArcMult;
  const localRot = offset * degsEach;
  const fanAngle = pos === 'left' ? 330 : pos === 'right' ? 30 : 0;

  let anchorX = vw / 2;
  let anchorY = vh / 2;
  if (pos === 'top') {
    anchorY = Math.max(32, Math.min(window.innerHeight * 0.08, 100));
  } else {
    anchorY = vh * 0.38;
    const baseInset = Math.max(52, Math.min(vw * 0.14, 100));
    const inset = baseInset + Math.min(fanCenter * xStep * 0.55, 52);
    if (pos === 'left') anchorX = inset;
    if (pos === 'right') anchorX = vw - inset;
  }

  const fanRad = (fanAngle * Math.PI) / 180;
  const rotatedX = localX * Math.cos(fanRad) - localY * Math.sin(fanRad);
  const rotatedY = localX * Math.sin(fanRad) + localY * Math.cos(fanRad);

  const bottomX = anchorX + rotatedX;
  const bottomY = anchorY + rotatedY;

  const totalRotRaw = fanAngle + localRot;
  const totalRot = ((totalRotRaw % 360) + 540) % 360 - 180;
  const totalRotRad = (totalRot * Math.PI) / 180;
  const cardW = Math.min(36, Math.max(28, vw * 0.07));
  const cardH = cardW * 1.45;
  const cardCenterX = bottomX + (cardH / 2) * Math.sin(totalRotRad);
  const cardCenterY = bottomY - (cardH / 2) * Math.cos(totalRotRad);

  const mdCardW = Math.min(52, Math.max(40, vw * 0.1));
  const startX = vw / 2 - (mdCardW / 2 + 10);
  const startY = vh / 2;

  return {
    tx: `${Math.round(cardCenterX - startX)}px`,
    ty: `${Math.round(cardCenterY - startY)}px`,
    trot: `${totalRot}deg`,
    tzIndex: effectiveIdx,
  };
}

function PlayingCardAnim({ startX, startY, startRot, card, isCPU, onDone }: { startX: string; startY: string; startRot: string; card: UnoCard; isCPU?: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 720);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'absolute',
        left: 'calc(50% - (var(--card-md-w) / 2) - 10px)',
        top: '50%',
        '--startX': startX,
        '--startY': startY,
        '--startRot': startRot,
        '--startScale': isCPU ? 0.7 : 1,
        '--endX': 'calc(var(--card-md-w) + 20px)',
        '--endY': '0px',
        animation: 'card-play-arc 700ms linear both',
        zIndex: 300,
        perspective: isCPU ? '600px' : undefined,
      } as React.CSSProperties}
    >
      {isCPU ? (
        <div style={{ transformStyle: 'preserve-3d', animation: 'card-flip 700ms ease-in-out both' }}>
          <div style={{ backfaceVisibility: 'hidden' }}>
            <Card card={{ id: 'play-back', color: 'wild', value: 'wild' }} faceDown size="md" />
          </div>
          <div style={{ position: 'absolute', top: 0, left: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <Card card={card} size="md" />
          </div>
        </div>
      ) : (
        <Card card={card} size="md" />
      )}
    </div>
  );
}

function FlyingCardAnim({ delay, tx, ty, trot, tzIndex, size, card, onDone }: { playerId: number; delay: number; tx: string; ty: string; trot: string; tzIndex: number; size: 'sm' | 'md'; card: UnoCard | null; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, delay + 720);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // Outer div: owns the arc (translate + scale). Provides perspective for children.
    <div
      className="pointer-events-none"
      style={{
        position: 'absolute',
        left: 'calc(50% - (var(--card-md-w) / 2) - 10px)',
        top: '50%',
        '--tx': tx,
        '--ty': ty,
        '--trot': trot,
        '--tzIndex': tzIndex,
        animation: `card-draw-arc 700ms linear ${delay}ms both`,
        perspective: card ? '600px' : undefined,
      } as React.CSSProperties}
    >
      {/* Inner div: owns the flip (rotateY). Separated so preserve-3d isn't killed by the arc animation. */}
      <div style={{
        transformStyle: card ? 'preserve-3d' : undefined,
        animation: card ? `card-flip 700ms ease-in-out ${delay}ms both` : undefined,
      }}>
        {/* Back face — hidden after 90° */}
        <div style={{ backfaceVisibility: card ? 'hidden' : undefined }}>
          <Card card={{ id: 'flying-back', color: 'wild', value: 'wild' }} faceDown size={size} />
        </div>
        {/* Front face — pre-rotated so it faces viewer at 180° */}
        {card && (
          <div style={{
            position: 'absolute',
            top: 0, left: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}>
            <Card card={card} size={size} />
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  opponents: OpponentConfig[];
  onExit: () => void;
}

export function GameBoard({ opponents, onExit }: Props) {
  // activeSeat must be declared before useUnoGame so it can be passed in
  const [activeSeat, setActiveSeat] = useState<number | null>(0);
  const { state, isLocked, actionTag, humanPlay, humanPickColor, humanDraw, restart } = useUnoGame(opponents, activeSeat);
  const [selected, setSelected] = useState<string | null>(null);
  const [flyingCards, setFlyingCards] = useState<FlyAnim[]>([]);
  // cardId → animation delay ms; card stays invisible until its flying card lands (humans + CPUs)
  const [hiddenCardIds, setHiddenCardIds] = useState<Map<string, number>>(new Map());
  const knownCardIdsRef = useRef<Set<string>>(new Set());
  const prevHandLengthsRef = useRef<number[]>([]);
  // Play animation: card flies from player's slot to discard pile
  const [playingCards, setPlayingCards] = useState<Array<{ id: string; tx: string; ty: string; trot: string; card: UnoCard; isCPU?: boolean }>>([]);
  const [hiddenDiscardId, setHiddenDiscardId] = useState<string | null>(null);
  const prevDiscardIdsRef = useRef<Set<string>>(new Set());
  const prevPlayersRef = useRef<import('../lib/uno').Player[]>([]);
  // Turn-line animation state
  const [turnLine, setTurnLine] = useState({ offset: 0, length: 0, traveling: false });
  const [animatingFrom, setAnimatingFrom] = useState<number>(0);

  const deskRef = useRef<HTMLDivElement>(null);
  const [desk, setDesk] = useState({ w: 700, h: 340 });

  useLayoutEffect(() => {
    if (!deskRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setDesk({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(deskRef.current);
    return () => obs.disconnect();
  }, []);

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
        const delay = j * 130;
        let tx: string, ty: string, size: 'sm' | 'md';
        const actualCard = player.hand.find(c => c.id === cardId) ?? null;
        let trot: string, tzIndex: number;

        if (playerIdx === 0) {
          ({ tx, ty, trot, tzIndex } = getHumanCardTarget(player.hand, cardId));
          size = 'md';
        } else {
          const cIdx = player.hand.findIndex(c => c.id === cardId);
          ({ tx, ty, trot, tzIndex } = getCPUCardTarget(player.hand, playerIdx, cIdx, state.players));
          size = 'sm';
        }

        newHidden.set(cardId, delay);
        anims.push({ id: `fly-${Date.now()}-${playerIdx}-${j}`, cardId, playerId: playerIdx, delay, tx, ty, trot, tzIndex, size, card: playerIdx === 0 ? actualCard : null });
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
        if (previousOwnerIdx === 0) {
          ({ tx, ty, trot } = getHumanCardTarget(prevHand, top.id));
        } else {
          const cIdx = prevHand.findIndex(c => c.id === top.id);
          ({ tx, ty, trot } = getCPUCardTarget(prevHand, previousOwnerIdx, cIdx, prevPlayersRef.current));
        }
        setPlayingCards(prev => [...prev, { id: `play-${Date.now()}`, tx, ty, trot, card: top, isCPU: previousOwnerIdx > 0 }]);
        setHiddenDiscardId(top.id);
      }
    }
    prevDiscardIdsRef.current = new Set(state.discard.map(c => c.id));
    prevPlayersRef.current = state.players.map(p => ({ ...p, hand: [...p.hand] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.discard, state.players]);

  // Turn-line travel: fires after currentPlayer or animatingFrom changes
  useLayoutEffect(() => {
    const { w, h } = desk;
    const ix = 24, iy = 24, ir = 8;
    const straightW = w - 2 * ix - 2 * ir;
    const straightH = h - 2 * iy - 2 * ir;
    const P = 2 * straightW + 2 * straightH + 2 * Math.PI * ir;

    // Rectangle midpoints are exactly 0%, 25%, 50%, and 75% of perimeter
    const getPos = (pIdx: number) => {
      const p = state.players[pIdx]?.position;
      if (p === 'top')    return 0;
      if (p === 'right')  return P * 0.25;
      if (p === 'bottom') return P * 0.5;
      if (p === 'left')   return P * 0.75;
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
      setTurnLine({ offset: isFwd ? startOffset : targetOffset, length: D, traveling: true });
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
  }, [state.currentPlayer, state.direction, state.players, animatingFrom, desk.w, desk.h]);

  const isMyTurn = state.phase === 'playing' &&
                   state.players[state.currentPlayer]?.id === 0 &&
                   !isLocked &&
                   activeSeat === 0 &&
                   !state.pendingAction;
  const top = topCard(state);
  const isTopFlying = hiddenDiscardId === top.id && state.discard.length > 1;

  const visualTopCard = isTopFlying ? state.discard[state.discard.length - 2]! : top;
  const topColor = effectiveColor(visualTopCard);

  const visualDirection = (isTopFlying && top.value === 'reverse')
    ? (state.direction * -1)
    : state.direction;
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
    if (selected) {
      humanPlay(selected, color);
      setSelected(null);
    } else {
      humanPickColor(color);
    }
  }

  const cpuPlayers = state.players.slice(1);


  return (
    <GameShell
      topbar={
        <GameTopbar
          title="UNO"
          stats={[
            { label: 'Cards', value: me.hand.length },
            { label: 'Turn', value: state.players[state.currentPlayer]?.name ?? '', accent: isMyTurn },
          ]}
          actions={
            <GameButton size="sm" variant="ghost" onClick={onExit}>
              ✕
            </GameButton>
          }
        />
      }
    >
      <div
        id="board-container"
        className="relative w-full h-full overflow-hidden bg-[#0a0a0a]"
        style={{
          '--card-sm-w': 'clamp(28px, 7vw, 36px)',
          '--card-md-w': 'clamp(40px, 10vw, 52px)',
        } as React.CSSProperties}
      >

        {/* Opponents */}
        {cpuPlayers.map((opp) => {
          const pos = opp.position ?? 'top';
          const total = Math.min(opp.hand.length, 15);
          const fanCenter = (total - 1) / 2;
          const degsEach = total <= 1 ? 0 : Math.min(8, 50 / (total - 1));
          const xStep = Math.min(24, 200 / Math.max(total - 1, 1));
          const isSidePlayer = pos === 'left' || pos === 'right';
          const baseCurve = isSidePlayer ? 3.2 : 2.0;
          const yArcMult = total <= 1 ? 0 : Math.max(0.15, baseCurve / Math.max(1, total * 0.3));
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
                {opp.hand.slice(0, 15).map((card, j) => {
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
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            width: 'min(88vw, 700px)',
            height: 'clamp(200px, 44vh, 420px)',
            borderRadius: 32,
            background: 'radial-gradient(ellipse at 50% 40%, #1a5c32 0%, #0f3d20 100%)',
            border: '2px solid rgba(255,255,255,0.07)',
            boxShadow: 'inset 0 2px 16px rgba(0,0,0,0.5), 0 8px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Circulating direction & color arrows */}
          {(() => {
            const cw = visualDirection === 1;
            const color = COLOR_BG[topColor] ?? '#7c3aed';
            const { w, h } = desk;

            // Desk border-radius is 32px. Outer path sits on edge (2px inset). Radius: 32 - 2 = 30.
            const ox = 2, oy = 2, or = 30;
            const outerD = `M ${w/2},${oy} H ${w - ox - or} A ${or},${or} 0 0,1 ${w - ox},${oy + or} V ${h - oy - or} A ${or},${or} 0 0,1 ${w - ox - or},${h - oy} H ${ox + or} A ${or},${or} 0 0,1 ${ox},${h - oy - or} V ${oy + or} A ${or},${or} 0 0,1 ${ox + or},${oy} Z`;

            // Inner turn line sits 24px inside. Radius: 32 - 24 = 8.
            const ix = 24, iy = 24, ir = 8;
            const drawLoop = `H ${w - ix - ir} A ${ir},${ir} 0 0,1 ${w - ix},${iy + ir} V ${h - iy - ir} A ${ir},${ir} 0 0,1 ${w - ix - ir},${h - iy} H ${ix + ir} A ${ir},${ir} 0 0,1 ${ix},${h - iy - ir} V ${iy + ir} A ${ir},${ir} 0 0,1 ${ix + ir},${iy}`;
            // Draw the path TWICE so offsets can cross the 0/P seam without getting clipped
            const innerD = `M ${w/2},${iy} ${drawLoop} ${drawLoop} Z`;

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
                style={{ overflow: 'visible' }}
              >
                {[0, -1.5].map((begin, i) => (
                  <g key={`${i}-${visualDirection}`}>
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
                          dur="3s"
                          begin={`${begin}s`}
                          repeatCount="indefinite"
                          calcMode="linear"
                        />
                      </path>
                    ))}
                  </g>
                ))}
                {/* Turn transition glowing line */}
                <path
                  d={innerD}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${turnLine.length} 99999`}
                  strokeDashoffset={`${-turnLine.offset}`}
                  opacity={turnLine.traveling ? 1 : 0}
                  style={{
                    transition: turnLine.traveling
                      ? 'stroke-dashoffset 450ms linear, stroke-dasharray 450ms linear, opacity 50ms'
                      : 'opacity 200ms ease-out',
                    filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))',
                  }}
                />
              </svg>
            );
          })()}

          {/* Player name tags on the table edges */}
          {state.players.map((p, idx) => {
            const posClass =
              p.position === 'bottom' ? 'bottom-[24px] left-1/2 -translate-x-1/2 translate-y-1/2' :
              p.position === 'top'    ? 'top-[24px] left-1/2 -translate-x-1/2 -translate-y-1/2' :
              p.position === 'left'   ? 'left-[12px] top-1/2 -translate-y-1/2' :
              p.position === 'right'  ? 'right-[12px] top-1/2 -translate-y-1/2' : '';
            if (!posClass) return null;
            const isActive = activeSeat === idx;
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
          <div className="flex gap-5 items-center relative">
            {/* Draw pile */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={isMyTurn ? humanDraw : undefined}
                disabled={!isMyTurn}
                className={`bg-transparent border-none p-0 ${isMyTurn ? 'cursor-pointer opacity-100' : 'cursor-default opacity-60'}`}
              >
                <Card card={{ id: 'draw', color: 'wild', value: 'wild' }} faceDown />
              </button>
              <span className="text-white/70 text-[10px] font-sans">
                {state.deck.length} left
              </span>
            </div>

            {/* Discard — layered so the previous card stays visible while the new one flies in */}
            <div className="relative flex items-center justify-center">
              {state.discard.length > 1 && (
                <div className="absolute">
                  <Card card={state.discard[state.discard.length - 2]!} />
                </div>
              )}
              <div style={{ opacity: hiddenDiscardId === top.id ? 0 : 1 }} className="relative z-10">
                <Card card={top} />
              </div>
            </div>
          </div>
        </div>


        {/* Player hand — fan layout */}
        {(() => {
          const hand = sortHand(me.hand);
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
                  const lift = isSelected ? -22 : playable ? -8 : 0;
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
                        transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), z-index 0s',
                        // snap-visible: keep slot invisible until flying card lands, then snap to opacity 1
                        animation: isHidden ? `snap-visible 700ms ${snapDelay}ms both` : undefined,
                      }}
                      onMouseEnter={e => {
                        if (playable && !isSelected)
                          (e.currentTarget as HTMLDivElement).style.transform =
                            `translateX(${x}px) translateY(${yArc - 16}px) rotate(${rotation}deg)`;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLDivElement).style.transform =
                          `translateX(${x}px) translateY(${yArc + lift}px) rotate(${rotation}deg)`;
                      }}
                    >
                      <Card
                        card={card}
                        playable={playable}
                        selected={isSelected}
                        onClick={playable ? () => handleCardClick(card) : undefined}
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
          <FlyingCardAnim
            key={fc.id}
            playerId={fc.playerId}
            delay={fc.delay}
            tx={fc.tx}
            ty={fc.ty}
            trot={fc.trot}
            tzIndex={fc.tzIndex}
            size={fc.size}
            card={fc.card}
            onDone={() => {
              removeFlyAnim(fc.id);
              setHiddenCardIds(prev => {
                if (!prev.has(fc.cardId)) return prev;
                const next = new Map(prev);
                next.delete(fc.cardId);
                return next;
              });
            }}
          />
        ))}

        {/* Playing card animations (hand → discard pile) */}
        {playingCards.map(pc => (
          <PlayingCardAnim
            key={pc.id}
            startX={pc.tx}
            startY={pc.ty}
            startRot={pc.trot}
            card={pc.card}
            isCPU={pc.isCPU}
            onDone={() => {
              setPlayingCards(prev => prev.filter(c => c.id !== pc.id));
              setHiddenDiscardId(null);
            }}
          />
        ))}

        {/* Color picker overlay */}
        {state.phase === 'color-pick' && <ColorPicker onPick={handlePickColor} />}

        {/* Game over overlay */}
        {state.phase === 'game-over' && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-5 z-50">
            <p className="text-white text-[32px] font-serif font-extrabold m-0">
              {state.winner === 0 ? 'You Win!' : `${state.players[state.winner ?? 0]?.name ?? 'CPU'} Wins!`}
            </p>
            <div className="flex gap-3">
              <GameButton variant="primary" size="lg" onClick={() => { restart(); setSelected(null); }}>
                Play Again
              </GameButton>
              <GameButton variant="secondary" size="lg" onClick={onExit}>
                Menu
              </GameButton>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
