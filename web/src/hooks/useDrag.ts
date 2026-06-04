import React, { useRef } from 'react';
import { Z } from '../lib/zIndex';
import { getDecisionZonePos } from '../lib/boardGeometry';

export const DRAG_THRESHOLD = 120;

type DragState = {
  el: HTMLElement;
  parent: HTMLElement | null;
  baseTransform: string;
  baseTransformNoRot: string;
  baseRotation: number;
  baseZIndex: string;
  liftedZIndex: string;
  usePositionOverride: boolean;
  invertY: boolean;
  startX: number;
  startY: number;
  elCX: number;
  elCY: number;
  hintTop: number;
  action: () => void;
};

export function useDrag(deskRef: { readonly current: HTMLDivElement | null }) {
  const dragRef = useRef<DragState | null>(null);
  const didDragActionRef = useRef(false);
  const didDragMoveRef = useRef(false);
  const dragPlayOverrideRef = useRef<{ tx: string; ty: string; trot: string; startScale: number } | null>(null);
  const dragDrawOverrideRef = useRef<{ startX: string; startY: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragHintRef = useRef<HTMLDivElement>(null);
  const deckHintRef = useRef<HTMLDivElement>(null);

  function startDrag(e: React.PointerEvent<HTMLElement>, action: () => void, baseRotation = 0, usePositionOverride = true, invertY = false) {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const baseTransform = el.style.transform;
    const baseTransformNoRot = baseTransform.replace(/\s*rotate\([^)]*\)/, '');
    const baseZIndex = el.style.zIndex;
    const liftedZIndex = String(Z.DRAG_CARD);

    if (invertY) {
      el.style.transition = 'transform 180ms ease-out, filter 200ms ease';
      const capturedNoRot = baseTransformNoRot;
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (dragRef.current) {
          if (dragRef.current.parent) dragRef.current.parent.style.zIndex = String(Z.DRAG_PARENT);
          if (deskRef.current) deskRef.current.style.zIndex = String(Z.DRAG_DESK);
          dragRef.current.el.style.zIndex = dragRef.current.liftedZIndex;
          dragRef.current.el.style.transform = `${capturedNoRot} scale(1.5)`;
        }
      }, 150);
    }

    didDragMoveRef.current = false;
    dragRef.current = { el, parent: el.parentElement as HTMLElement | null, baseTransform, baseTransformNoRot, baseRotation, baseZIndex, liftedZIndex, usePositionOverride, invertY, startX: e.clientX, startY: e.clientY, elCX: r.left + r.width / 2, elCY: r.top + r.height / 2, hintTop: getDecisionZonePos().cssTop, action };
  }

  function moveDrag(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > 8) didDragMoveRef.current = true;

    d.el.style.zIndex = d.liftedZIndex;
    if (d.invertY) {
      if (d.parent) d.parent.style.zIndex = String(Z.DRAG_PARENT);
      if (deskRef.current) deskRef.current.style.zIndex = String(Z.DRAG_DESK);
    }

    let progress: number;
    if (d.invertY) {
      if (didDragMoveRef.current) d.el.style.transition = 'filter 200ms ease';
      progress = Math.min(Math.max(dy, 0) / DRAG_THRESHOLD, 1);
      const scale = 1.5 - progress * 0.5;
      d.el.style.transform = `${d.baseTransformNoRot} translate(${dx}px,${dy}px) scale(${scale.toFixed(3)})`;
      d.el.style.filter = progress >= 1 ? 'drop-shadow(0 0 14px rgba(255,255,255,0.9))' : '';
    } else {
      d.el.style.transition = 'filter 200ms ease';
      progress = Math.min(Math.max(-dy, 0) / DRAG_THRESHOLD, 1);
      const scale = 1 + progress * 0.5;
      const rot = (d.baseRotation * (1 - progress)).toFixed(2);
      d.el.style.transform = `${d.baseTransformNoRot} translate(${dx}px,${dy}px) rotate(${rot}deg) scale(${scale.toFixed(3)})`;
      d.el.style.filter = progress >= 1 ? 'drop-shadow(0 0 14px rgba(255,255,255,0.9))' : '';
    }

    if (d.invertY) {
      if (dragHintRef.current) dragHintRef.current.style.opacity = '0';
      if (deckHintRef.current) {
        const board = document.getElementById('board-container');
        const pilesRow = document.getElementById('piles-row');
        if (board && pilesRow) {
          const br = board.getBoundingClientRect();
          const pr = pilesRow.getBoundingClientRect();
          deckHintRef.current.style.left = `${board.clientWidth / 2 - (pr.left - br.left)}px`;
          deckHintRef.current.style.top = `${d.hintTop - (pr.top - br.top)}px`;
        }
        deckHintRef.current.textContent = 'Release to draw';
        deckHintRef.current.style.opacity = progress >= 1 ? '1' : '0';
      }
    } else {
      if (deckHintRef.current) deckHintRef.current.style.opacity = '0';
      if (dragHintRef.current) {
        const board = document.getElementById('board-container');
        dragHintRef.current.style.left = board ? `${board.clientWidth / 2}px` : '50%';
        dragHintRef.current.style.top = `${d.hintTop}px`;
        dragHintRef.current.textContent = 'Release to play';
        dragHintRef.current.style.opacity = progress >= 1 ? '1' : '0';
      }
    }
  }

  function endDrag(e: React.PointerEvent<HTMLElement>) {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (dragHintRef.current) dragHintRef.current.style.opacity = '0';
    if (deckHintRef.current) deckHintRef.current.style.opacity = '0';

    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;

    const dy = e.clientY - d.startY;
    d.el.style.filter = '';

    const triggered = d.invertY ? dy >= DRAG_THRESHOLD : dy <= -DRAG_THRESHOLD;

    if (triggered) {
      if (d.parent) d.parent.style.zIndex = '';
      if (deskRef.current) deskRef.current.style.zIndex = '';

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

      // Wait for the 350ms return-flight to finish before dropping elevation,
      // otherwise the card slides under the discard pile mid-animation.
      const parent = d.parent;
      const desk = deskRef.current;
      setTimeout(() => {
        if (parent) parent.style.zIndex = '';
        if (desk) desk.style.zIndex = '';
      }, 350);
    }
  }

  return { startDrag, moveDrag, endDrag, dragPlayOverrideRef, dragDrawOverrideRef, didDragActionRef, didDragMoveRef, dragHintRef, deckHintRef };
}
