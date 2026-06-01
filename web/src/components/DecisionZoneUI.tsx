import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UnoCard } from '../lib/uno';
import { Card } from './Card';
import { getDecisionZonePos } from '../lib/boardGeometry';
import { Z } from '../lib/zIndex';

const THRESHOLD = 50;

interface Props {
  drawnCard: UnoCard;
  onPlay: (dx: number, dy: number) => void;
  onKeep: (dx: number, dy: number) => void;
}

export function DecisionZoneUI({ drawnCard, onPlay, onKeep }: Props) {
  const [cssTop, setCssTop] = useState(0);
  const [dragDx, setDragDx] = useState(0);
  const [dragDy, setDragDy] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [settled, setSettled] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const dxRef = useRef(0);
  const dyRef = useRef(0);

  useLayoutEffect(() => {
    setCssTop(getDecisionZonePos().cssTop);
  }, []);

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    return () => cancelAnimationFrame(r);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDragActive(true);
    setSettled(false);
    setSnapEnabled(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    dxRef.current = dx; dyRef.current = dy;
    setDragDx(dx); setDragDy(dy);
  }

  function handlePointerUp() {
    if (!startRef.current) return;
    startRef.current = null;
    const dx = dxRef.current, dy = dyRef.current;
    dxRef.current = 0; dyRef.current = 0;
    if (dy < -THRESHOLD) {
      onPlay(dx, dy);
    } else if (dy > THRESHOLD) {
      onKeep(dx, dy);
    } else {
      setDragActive(false);
      setDragDx(0); setDragDy(0);
      if (Math.hypot(dx, dy) < 5) setSettled(true);
    }
  }

  const pastThreshold = dragDy < -THRESHOLD || dragDy > THRESHOLD;

  return (
    <>
      <div
        style={{
          position: 'absolute', left: '50%', top: `${cssTop}px`,
          transform: `translate(calc(-50% + ${dragDx}px), calc(-50% + ${dragDy}px))`,
          transition: (dragActive || !snapEnabled) ? 'none' : 'transform 220ms cubic-bezier(0.34,1.2,0.64,1)',
          zIndex: Z.FLY_AIR + 1, touchAction: 'none',
          cursor: dragActive ? 'grabbing' : 'grab',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTransitionEnd={e => { if (e.target === e.currentTarget) setSettled(true); }}
        className="decision-draggable"
      >
        <div style={{
          transform: `scale(${dragActive ? 1.15 : 1})`,
          filter: pastThreshold ? 'drop-shadow(0 0 14px rgba(255,255,255,0.9))' : 'none',
          transition: 'transform 150ms ease, filter 200ms ease',
        }}>
          <Card card={drawnCard} size="md" />
        </div>
      </div>

      <div
        className="absolute pointer-events-none font-sans font-semibold"
        style={{
          left: '50%', top: `${cssTop}px`, transform: 'translate(-50%, -50%)',
          zIndex: Z.DECISION, color: 'rgba(255,255,255,0.9)',
          fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap',
          opacity: pastThreshold ? 1 : 0, transition: 'opacity 100ms ease',
        }}
      >
        {dragDy < 0 ? 'Release to play' : 'Release to draw'}
      </div>

      <div
        className="absolute pointer-events-none"
        style={{
          left: 0, right: 0, top: `${cssTop}px`, transform: 'translateY(-50%)',
          zIndex: Z.DECISION, display: 'grid',
          gridTemplateColumns: '1fr var(--card-md-w) 1fr', alignItems: 'center',
          columnGap: 'clamp(12px, 3vw, 20px)', padding: '0 clamp(16px, 5vw, 32px)',
          opacity: settled && !pastThreshold ? 1 : 0, transition: 'opacity 150ms ease',
        }}
      >
        <button onClick={() => onPlay(0, 0)} className="pointer-events-auto cursor-pointer font-sans font-semibold hover:opacity-60" style={{ justifySelf: 'end', background: 'none', border: '1.5px solid rgba(255,255,255,0.85)', borderRadius: 9999, color: 'rgba(255,255,255,0.85)', padding: '8px clamp(14px, 4vw, 22px)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap', minWidth: 'clamp(72px, 18vw, 88px)', textAlign: 'center' }}>Play</button>
        <div />
        <button onClick={() => onKeep(0, 0)} className="pointer-events-auto cursor-pointer font-sans font-semibold hover:opacity-60" style={{ justifySelf: 'start', background: 'none', border: '1.5px solid rgba(255,255,255,0.85)', borderRadius: 9999, color: 'rgba(255,255,255,0.85)', padding: '8px clamp(14px, 4vw, 22px)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap', minWidth: 'clamp(72px, 18vw, 88px)', textAlign: 'center' }}>Draw</button>
      </div>
    </>
  );
}
