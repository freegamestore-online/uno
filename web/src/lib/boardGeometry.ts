import { UnoCard, Player } from './uno';
import { Z } from './zIndex';

export interface FlyAnim {
  id: string;
  cardId: string;
  playerId: number;
  delay: number;
  tx: string;
  ty: string;
  trot: string;
  tzIndex: number;
  size: 'sm' | 'md';
  card: UnoCard | null;
  isDragDraw?: boolean;
  isKeepDraw?: boolean;
  isDragKeep?: boolean;
  drawStartX?: string;
  drawStartY?: string;
}

// Shared sort so render and target-calculation stay in sync
export function sortHand(hand: UnoCard[]): UnoCard[] {
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
export function getHumanCardTarget(hand: UnoCard[], cardId: string, isPlaying = false): { tx: string; ty: string; trot: string; tzIndex: number } {
  const board = document.getElementById('board-container');
  const vw = board ? board.clientWidth : window.innerWidth;
  const vh = board ? board.clientHeight : window.innerHeight;

  const sorted = sortHand(hand);
  const cardIdx = sorted.findIndex(c => c.id === cardId);
  if (cardIdx === -1) return { tx: '36px', ty: '32vh', trot: '0deg', tzIndex: Z.FLY_AIR };

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

// Calculates exact --tx/--ty for a CPU card slot using the player's physical position.
export function getCPUCardTarget(hand: UnoCard[], playerIdx: number, cardIdx: number, players: Player[]): { tx: string; ty: string; trot: string; tzIndex: number } {
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

export function getUpperZonePos() {
  const board = document.getElementById('board-container');
  const pilesRow = document.getElementById('piles-row');
  const topTag = document.getElementById('top-nametag');
  const vh = board ? board.clientHeight : window.innerHeight;

  let cssTop = vh * 0.30;
  if (board && pilesRow && topTag) {
    const br = board.getBoundingClientRect();
    const pr = pilesRow.getBoundingClientRect();
    const tr = topTag.getBoundingClientRect();
    cssTop = ((tr.bottom - br.top) + (pr.top - br.top)) / 2;
  }

  return { cssTop: Math.round(cssTop) };
}

export function getDecisionZonePos() {
  const board = document.getElementById('board-container');
  const pilesRow = document.getElementById('piles-row');
  const youTag = document.getElementById('you-nametag');
  const vw = board ? board.clientWidth : window.innerWidth;
  const vh = board ? board.clientHeight : window.innerHeight;
  const cardW = Math.min(52, Math.max(40, vw * 0.1));

  let cssTop = vh * 0.65; // fallback
  if (board && pilesRow && youTag) {
    const br = board.getBoundingClientRect();
    const pr = pilesRow.getBoundingClientRect();
    const yr = youTag.getBoundingClientRect();
    cssTop = ((pr.bottom - br.top) + (yr.top - br.top)) / 2;
  }

  return {
    tx: `${Math.round(cardW / 2 + 10)}px`,
    ty: `${Math.round(cssTop - vh / 2)}px`,
    trot: '0deg' as const,
    startScale: 1 as const,
    cssTop: Math.round(cssTop),
  };
}
