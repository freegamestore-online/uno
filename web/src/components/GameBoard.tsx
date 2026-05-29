import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GameButton } from '@freegamestore/games';
import { useUnoGame } from '../hooks/useUnoGame';
import { Card } from './Card';
import { ColorPicker } from './ColorPicker';
import { UnoCard, OpponentConfig, Player, topCard, isPlayable, effectiveColor, CardColor } from '../lib/uno';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626',
  green: '#16a34a',
  blue: '#2563eb',
  yellow: '#eab308',
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
function getHumanCardTarget(hand: UnoCard[], cardId: string, isPlaying = false): { tx: string; ty: string; trot: string; tzIndex: number } {
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
  const lift = isPlaying ? -30 : 0;
  const bottomY = vh - anchorBottom + yArc + lift;

  const cardCenterX = bottomX + (cardH / 2) * Math.sin(rotationRad);
  const cardCenterY = bottomY - (cardH / 2) * Math.cos(rotationRad);

  const startX = vw / 2 - (cardW / 2 + 10);
  const tx = `${Math.round(cardCenterX - startX)}px`;
  const ty = `${Math.round(cardCenterY - vh / 2)}px`;
  const trot = `${rotationDeg}deg`;

  return { tx, ty, trot, tzIndex: cardIdx };
}

interface FlyAnim { id: string; cardId: string; playerId: number; delay: number; tx: string; ty: string; trot: string; tzIndex: number; size: 'sm' | 'md'; card: UnoCard | null; isDragDraw?: boolean; drawStartX?: string; drawStartY?: string; }

// Calculates exact --tx/--ty for a CPU card slot using the player's physical position.
function getCPUCardTarget(hand: UnoCard[], playerIdx: number, cardIdx: number, players: Player[]): { tx: string; ty: string; trot: string; tzIndex: number } {
  const board = document.getElementById('board-container');
  const vw = board ? board.clientWidth : window.innerWidth;
  const vh = board ? board.clientHeight : window.innerHeight;

  const total = hand.length;
  const effectiveIdx = Math.min(Math.max(cardIdx, 0), total - 1);
  const fanCenter = (total - 1) / 2;
  const offset = effectiveIdx - fanCenter;

  const pos = players[playerIdx]?.position ?? 'top';
  const isSidePlayer = pos === 'left' || pos === 'right';
  const baseCurve = isSidePlayer ? 4.5 : 3.5;
  const maxArcPx = isSidePlayer ? 36 : 28;
  const naturalMult = total <= 1 ? 0 : baseCurve / Math.max(1, total * 0.3);
  const yArcMult = total <= 1 ? 0 : Math.min(naturalMult, fanCenter > 0 ? maxArcPx / (fanCenter * fanCenter) : 1);
  const xStep = Math.min(24, 200 / Math.max(total - 1, 1));
  const degsEach = total <= 1 ? 0 : Math.min(10, 60 / (total - 1));

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

function PlayingCardAnim({ startX, startY, startRot, startScale = 1, card, isCPU, isFromPicker, isDrag, onDone }: { startX: string; startY: string; startRot: string; startScale?: number; card: UnoCard; isCPU?: boolean; isFromPicker?: boolean; isDrag?: boolean; onDone: () => void }) {
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
        '--startScale': isCPU ? 0.7 : startScale,
        '--endX': 'calc(var(--card-md-w) + 20px)',
        '--endY': '0px',
        animation: isFromPicker ? 'picker-to-discard 700ms ease-in-out both' : isDrag ? 'card-play-direct 420ms both' : 'card-play-arc 700ms linear both',
        zIndex: 300,
        perspective: (isCPU || isFromPicker) ? '600px' : undefined,
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
      ) : isFromPicker ? (
        <div style={{ transformStyle: 'preserve-3d', animation: 'card-flip 700ms ease-in-out reverse both' }}>
          <div style={{ backfaceVisibility: 'hidden' }}>
            <Card card={card} size="md" />
          </div>
          <div
            className="absolute top-0 left-0 rounded-lg border-[3px] border-white overflow-hidden bg-[#0a0a0a]"
            style={{ width: 'var(--card-md-w)', aspectRatio: '1 / 1.45', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <svg viewBox="0 0 100 145" className="absolute inset-0 w-full h-full">
              <defs>
                <clipPath id="picker-oval-clip-play">
                  <ellipse cx="0" cy="0" rx="40" ry="66.7" transform="rotate(22)" />
                </clipPath>
                <path id="arc-top-play" d="M -46,0 A 46 72.7 0 0 1 46 0" transform="rotate(22)" />
                <path id="arc-bot-play" d="M -46,0 A 46 72.7 0 0 0 46 0" transform="rotate(22)" />
              </defs>
              <g clipPath="url(#picker-oval-clip-play)" transform="translate(50, 72.5)">
                <polygon points="0,0 74.92,-185.44 200,-200 200,0" fill="#2563eb" />
                <polygon points="0,0 200,0 200,200 -74.92,185.44" fill="#16a34a" />
                <polygon points="0,0 -74.92,185.44 -200,200 -200,0" fill="#eab308" />
                <polygon points="0,0 -200,0 -200,-200 74.92,-185.44" fill="#dc2626" />
              </g>
              <g transform="translate(50, 72.5)">
                <text fill="#ffffff" fontSize="7.5" fontFamily="var(--font-sans), sans-serif" fontWeight="900" letterSpacing="0.8" dominantBaseline="middle">
                  <textPath href="#arc-top-play" startOffset="24%" textAnchor="middle">CHOOSE</textPath>
                </text>
                <text fill="#ffffff" fontSize="7.5" fontFamily="var(--font-sans), sans-serif" fontWeight="900" letterSpacing="0.8" dominantBaseline="middle">
                  <textPath href="#arc-bot-play" startOffset="76%" textAnchor="middle">COLOR</textPath>
                </text>
              </g>
            </svg>
          </div>
        </div>
      ) : (
        <Card card={card} size="md" />
      )}
    </div>
  );
}

function FlyingCardAnim({ delay, tx, ty, trot, tzIndex, size, card, isDragDraw, drawStartX, drawStartY, onDone }: { playerId: number; delay: number; tx: string; ty: string; trot: string; tzIndex: number; size: 'sm' | 'md'; card: UnoCard | null; isDragDraw?: boolean; drawStartX?: string; drawStartY?: string; onDone: () => void }) {
  const dur = isDragDraw ? 520 : 720;
  useEffect(() => {
    const t = setTimeout(onDone, delay + dur);
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
        '--endScale': size === 'sm' ? 0.7 : 1,
        '--startX': isDragDraw ? drawStartX : undefined,
        '--startY': isDragDraw ? drawStartY : undefined,
        opacity: isDragDraw ? undefined : 0,
        animation: isDragDraw
          ? `card-draw-direct 500ms ${delay}ms both`
          : `card-draw-arc 700ms linear ${delay}ms forwards`,
        perspective: card ? '600px' : undefined,
      } as React.CSSProperties}
    >
      {/* Inner div: owns the flip (rotateY). Separated so preserve-3d isn't killed by the arc animation. */}
      <div style={{
        transformStyle: card ? 'preserve-3d' : undefined,
        animation: card ? `card-flip ${isDragDraw ? 500 : 700}ms ease-in-out ${delay}ms both` : undefined,
      }}>
        {/* Back face — hidden after 90° */}
        <div style={{ backfaceVisibility: card ? 'hidden' : undefined }}>
          <Card card={{ id: 'flying-back', color: 'wild', value: 'wild' }} faceDown size="md" thick={size === 'sm'} />
        </div>
        {/* Front face — pre-rotated so it faces viewer at 180° */}
        {card && (
          <div style={{
            position: 'absolute',
            top: 0, left: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}>
            <Card card={card} size="md" thick={size === 'sm'} />
          </div>
        )}
      </div>
    </div>
  );
}

interface Props {
  opponents: OpponentConfig[];
  onExit: () => void;
  onRestart?: () => void;
  onGameInfoChange?: (info: { cards: number; turn: string; isMyTurn: boolean }) => void;
}

export function GameBoard({ opponents, onExit, onRestart, onGameInfoChange }: Props) {
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
  const [playingCards, setPlayingCards] = useState<Array<{ id: string; tx: string; ty: string; trot: string; startScale?: number; card: UnoCard; isCPU?: boolean; isFromPicker?: boolean; isDrag?: boolean }>>([]);
  const [hiddenDiscardId, setHiddenDiscardId] = useState<string | null>(null);
  const prevDiscardIdsRef = useRef<Set<string>>(new Set());
  const prevPlayersRef = useRef<import('../lib/uno').Player[]>([]);
  // Turn-line animation state
  const [turnLine, setTurnLine] = useState({ offset: 0, length: 0, traveling: false });
  const [wildTravelColor, setWildTravelColor] = useState<string | null>(null);
  const [animatingFrom, setAnimatingFrom] = useState<number>(0);
  const [pickerBg, setPickerBg] = useState<'in' | 'out' | null>(null);
  const [dealLightningOffset, setDealLightningOffset] = useState<{ offset: number; length: number; phase: 0 | 1 | 2 | 3; dur: number } | null>(null);
  // Drag-to-play / drag-to-draw
  const DRAG_THRESHOLD = 120;
  const dragRef = useRef<{ el: HTMLElement; parent: HTMLElement | null; baseTransform: string; baseTransformNoRot: string; baseRotation: number; baseZIndex: string; liftedZIndex: string; usePositionOverride: boolean; invertY: boolean; startX: number; startY: number; elCX: number; elCY: number; action: () => void } | null>(null);
  const didDragActionRef = useRef(false);
  const didDragMoveRef = useRef(false);
  const dragPlayOverrideRef = useRef<{ tx: string; ty: string; trot: string; startScale: number } | null>(null);
  const dragDrawOverrideRef = useRef<{ startX: string; startY: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startDrag(e: React.PointerEvent<HTMLElement>, action: () => void, baseRotation = 0, usePositionOverride = true, invertY = false) {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const baseTransform = el.style.transform;
    const baseTransformNoRot = baseTransform.replace(/\s*rotate\([^)]*\)/, '');
    const baseZIndex = el.style.zIndex;
    const liftedZIndex = '9999';

    if (invertY) {
      el.style.transition = 'transform 180ms ease-out, filter 200ms ease';
      const capturedNoRot = baseTransformNoRot;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (dragRef.current) {
          if (dragRef.current.parent) dragRef.current.parent.style.zIndex = '50';
          if (deskRef.current) deskRef.current.style.zIndex = '50';
          dragRef.current.el.style.zIndex = dragRef.current.liftedZIndex;
          dragRef.current.el.style.transform = `${capturedNoRot} scale(1.5)`;
        }
      }, 150);
    }

    didDragMoveRef.current = false;
    dragRef.current = { el, parent: el.parentElement as HTMLElement | null, baseTransform, baseTransformNoRot, baseRotation, baseZIndex, liftedZIndex, usePositionOverride, invertY, startX: e.clientX, startY: e.clientY, elCX: r.left + r.width / 2, elCY: r.top + r.height / 2, action };
  }

  function moveDrag(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 8) didDragMoveRef.current = true;

    d.el.style.zIndex = d.liftedZIndex;
    if (d.invertY) {
      if (d.parent) d.parent.style.zIndex = '50';
      if (deskRef.current) deskRef.current.style.zIndex = '50';
    }

    if (d.invertY) {
      if (didDragMoveRef.current) d.el.style.transition = 'filter 200ms ease';
      const progress = Math.min(Math.max(dy, 0) / DRAG_THRESHOLD, 1);
      const scale = 1.5 - progress * 0.5;
      d.el.style.transform = `${d.baseTransformNoRot} translate(${dx}px,${dy}px) scale(${scale.toFixed(3)})`;
      d.el.style.filter = progress >= 1 ? 'drop-shadow(0 0 14px rgba(255,255,255,0.9))' : '';
    } else {
      d.el.style.transition = 'filter 200ms ease';
      const progress = Math.min(Math.max(-dy, 0) / DRAG_THRESHOLD, 1);
      const scale = 1 + progress * 0.5;
      const rot = (d.baseRotation * (1 - progress)).toFixed(2);
      d.el.style.transform = `${d.baseTransformNoRot} translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${scale.toFixed(3)})`;
      d.el.style.filter = progress >= 1 ? 'drop-shadow(0 0 14px rgba(255,255,255,0.9))' : '';
    }
  }

  function endDrag(e: React.PointerEvent<HTMLElement>) {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }

    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    d.el.style.filter = '';

    const triggered = d.invertY ? dy >= DRAG_THRESHOLD : dy <= -DRAG_THRESHOLD;

    if (d.parent) d.parent.style.zIndex = '';
    if (deskRef.current) deskRef.current.style.zIndex = '';

    if (triggered) {
      d.el.style.zIndex = d.baseZIndex;
      const r2 = d.el.getBoundingClientRect();
      const relCX = r2.left + r2.width / 2;
      const relCY = r2.top + r2.height / 2;

      const board = document.getElementById('board-container')!;
      const br = board.getBoundingClientRect();
      const bvw = board.clientWidth;
      const bvh = board.clientHeight;

      const cardW = Math.min(52, Math.max(40, bvw * 0.1));
      const anchorX = br.left + bvw / 2 - cardW / 2 - 10;
      const anchorY = br.top + bvh / 2;

      if (!d.invertY) {
        const tx = `${Math.round(relCX - anchorX)}px`;
        const ty = `${Math.round(relCY - anchorY)}px`;

        if (d.usePositionOverride) {
          const scale = 1 + Math.min(-dy / DRAG_THRESHOLD, 1) * 0.5;
          dragPlayOverrideRef.current = { tx, ty, trot: '0deg', startScale: parseFloat(scale.toFixed(3)) };
        }
      } else {
        dragDrawOverrideRef.current = {
          startX: `${Math.round(relCX - anchorX)}px`,
          startY: `${Math.round(relCY - anchorY)}px`,
        };
        d.el.style.transition = '';
        d.el.style.transform = d.baseTransform;
        d.el.style.opacity = '0';

        const el = d.el;
        setTimeout(() => {
          el.style.opacity = '';
          el.style.animation = 'deck-restock 320ms cubic-bezier(0.22, 1, 0.36, 1) both';
          setTimeout(() => { el.style.animation = ''; }, 350);
        }, 200);
      }

      didDragActionRef.current = true;
      d.action();
      setTimeout(() => { didDragActionRef.current = false; didDragMoveRef.current = false; }, 0);
    } else {
      d.el.style.zIndex = d.baseZIndex;
      void d.el.offsetHeight;
      d.el.style.transition = 'transform 0.35s cubic-bezier(0.34,1.2,0.64,1), filter 0.2s ease';
      d.el.style.transform = d.baseTransform;
    }
  }

  // Direction indicator fade
  const [displayedDir, setDisplayedDir] = useState<1 | -1>(1);
  const [dirOpacity, setDirOpacity] = useState(1);

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
        const delay = j * 130;
        let tx: string, ty: string, size: 'sm' | 'md';
        const actualCard = player.hand.find(c => c.id === cardId) ?? null;
        let trot: string, tzIndex: number;
        let isDragDraw = false;
        let drawStartX: string | undefined;
        let drawStartY: string | undefined;

        if (playerIdx === 0) {
          ({ tx, ty, trot, tzIndex } = getHumanCardTarget(player.hand, cardId));
          size = 'md';
          if (j === 0 && dragDrawOverrideRef.current) {
            isDragDraw = true;
            drawStartX = dragDrawOverrideRef.current.startX;
            drawStartY = dragDrawOverrideRef.current.startY;
            dragDrawOverrideRef.current = null;
          }
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
                   !dealLightningOffset;
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

    const pos = state.players[state.currentPlayer]?.position;
    const nameTagPos = pos === 'top' ? 0 : pos === 'right' ? 250 : pos === 'bottom' ? 500 : pos === 'left' ? 750 : 500;

    const departure    = nameTagPos + 1000;             // loop-2 name tag
    const launchOffset = departure + 160;               // after launch: tail at name tag, head 160 ahead
    const arrival      = nameTagPos + (1 + nLoops) * 1000; // where head stops (name tag, next loop)

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
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
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
              style={{ overflow: 'visible', zIndex: 10 }}
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
            {/* Draw pile (Static 3D Stack) */}
            <div className="relative shrink-0" style={{ width: 'var(--card-md-w)', aspectRatio: '1 / 1.45', animation: isMyTurn && !me.hand.some(c => isPlayable(c, top)) ? 'draw-pile-pulse 1.4s ease-in-out infinite' : undefined }}>
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
              {state.discard.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  <Card card={visualTopCard} />
                </div>
              )}
            </div>
          </div>
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
                        filter: isColorPicking ? undefined : !dealLightningOffset && isMyTurn && !isSelected && (!anyPlayable || !playable) ? 'brightness(0.45)' : undefined,
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
            isDragDraw={fc.isDragDraw}
            drawStartX={fc.drawStartX}
            drawStartY={fc.drawStartY}
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
            startScale={pc.startScale}
            card={pc.card}
            isCPU={pc.isCPU}
            isFromPicker={pc.isFromPicker}
            isDrag={pc.isDrag}
            onDone={() => {
              setPlayingCards(prev => prev.filter(c => c.id !== pc.id));
              setHiddenDiscardId(null);
            }}
          />
        ))}

        {/* Color picker dim background — lives in GameBoard so it outlasts ColorPicker unmount */}
        {pickerBg && (
          <div
            className="absolute inset-0 bg-black/60 pointer-events-none"
            style={{
              zIndex: 49,
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
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-5 z-50">
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
