import { useEffect, type CSSProperties } from 'react';
import { UnoCard } from '../lib/uno';
import { Card } from './Card';
import { Z } from '../lib/zIndex';

export function PlayingCardAnim({ startX, startY, startRot, startScale = 1, card, isCPU, isFromPicker, isDrag, isDecisionZone, onDone }: { startX: string; startY: string; startRot: string; startScale?: number; card: UnoCard; isCPU?: boolean; isFromPicker?: boolean; isDrag?: boolean; isDecisionZone?: boolean; onDone: () => void }) {
  const duration = isDrag ? 480 : isDecisionZone ? 480 : 720;
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decision zone: keep the same arc proportions as a regular hand play.
  // Regular play at ty=200: 18% lands at 62% of distance (200*0.94-64=124), 74% at 9% (200*0.18-18=18).
  // Scale those fractions to decision-zone ty so the arc shape is identical, just compressed.
  const tyNum = isDecisionZone ? parseFloat(startY) : null;
  const playLift   = tyNum != null ? `${Math.round(tyNum * 0.32)}px` : undefined;
  const playLiftSm = tyNum != null ? `${Math.round(tyNum * 0.09)}px` : undefined;

  const s = isCPU ? 0.7 : startScale;
  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'absolute',
        left: 'calc(50% - (var(--card-md-w) / 2) - 10px)',
        top: '50%',
        transform: `translate(calc(-50% + ${startX}), calc(-50% + ${startY})) scale(${s}) rotate(${startRot})`,
        '--startX': startX,
        '--startY': startY,
        '--startRot': startRot,
        '--startScale': s,
        '--endX': 'calc(var(--card-md-w) + 20px)',
        '--endY': '0px',
        '--play-lift': playLift,
        '--play-lift-sm': playLiftSm,
        animation: isFromPicker ? 'picker-to-discard 700ms ease-in-out both' : isDrag ? `card-play-direct ${duration}ms both` : `card-play-arc ${duration}ms linear both`,
        zIndex: Z.FLY_AIR,
        perspective: isCPU ? '600px' : undefined,
      } as CSSProperties}
    >
      {isCPU ? (
        <div style={{ transformStyle: 'preserve-3d', animation: 'card-flip 700ms ease-in-out both' }}>
          <div className="[backface-visibility:hidden]">
            <Card card={{ id: 'play-back', color: 'wild', value: 'wild' }} faceDown size="md" />
          </div>
          <div className="absolute top-0 left-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <Card card={card} size="md" />
          </div>
        </div>
      ) : isFromPicker ? (
        <div style={{ position: 'relative', width: 'var(--card-md-w)', aspectRatio: '1 / 1.45', perspective: '600px' }}>
          {/* 3D flip: picker face → card face, matches full 700ms fly duration */}
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', animation: 'card-flip 700ms ease-in-out both' }}>
            {/* Front: picker SVG — visible initially, opacity cut at 90° midpoint */}
            <div className="absolute inset-0 rounded-lg border-[3px] border-white overflow-hidden bg-[var(--uno-ink)] [backface-visibility:hidden]"
              style={{ animation: 'picker-front-hide 700ms linear forwards' }}
            >
              <svg viewBox="0 0 100 145" className="absolute inset-0 w-full h-full">
                <defs>
                  <clipPath id="picker-oval-clip-play">
                    <ellipse cx="0" cy="0" rx="40" ry="66.7" transform="rotate(22)" />
                  </clipPath>
                </defs>
                <g clipPath="url(#picker-oval-clip-play)" transform="translate(50, 72.5)">
                  <polygon points="0,0 74.92,-185.44 200,-200 200,0" fill="var(--uno-blue)" />
                  <polygon points="0,0 200,0 200,200 -74.92,185.44" fill="var(--uno-green)" />
                  <polygon points="0,0 -74.92,185.44 -200,200 -200,0" fill="var(--uno-yellow)" />
                  <polygon points="0,0 -200,0 -200,-200 74.92,-185.44" fill="var(--uno-red)" />
                </g>
              </svg>
            </div>
            {/* Back: card face — pre-rotated 180°, visible after flip */}
            <div className="absolute inset-0 [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
              <Card card={card} size="md" />
            </div>
          </div>
        </div>
      ) : (
        <Card card={card} size="md" />
      )}
    </div>
  );
}

export function InitCardReveal({ card, onDone }: { card: UnoCard; onDone: () => void }) {
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
        animation: 'init-card-arc 700ms linear both',
        zIndex: Z.FLY_AIR,
        perspective: '600px',
      } as CSSProperties}
    >
      <div style={{ transformStyle: 'preserve-3d', animation: 'card-flip 700ms ease-in-out both' }}>
        <div className="[backface-visibility:hidden]">
          <Card card={{ id: 'init-back', color: 'wild', value: 'wild' }} faceDown />
        </div>
        <div className="absolute top-0 left-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <Card card={card} />
        </div>
      </div>
    </div>
  );
}

export function FlyingCardAnim({ delay, tx, ty, trot, tzIndex, size, card, isDragDraw, isKeepDraw, isDragKeep, drawStartX, drawStartY, onDone }: { playerId: number; delay: number; tx: string; ty: string; trot: string; tzIndex: number; size: 'sm' | 'md'; card: UnoCard | null; isDragDraw?: boolean; isKeepDraw?: boolean; isDragKeep?: boolean; drawStartX?: string; drawStartY?: string; onDone: () => void }) {
  const dur = isKeepDraw ? 580 : isDragKeep ? 500 : isDragDraw ? 520 : 720;
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
        zIndex: Z.FLY_AIR,
        '--tx': tx,
        '--ty': ty,
        '--trot': trot,
        '--tzIndex': tzIndex,
        '--endScale': size === 'sm' ? 0.7 : 1,
        '--startX': (isDragDraw || isKeepDraw || isDragKeep) ? drawStartX : undefined,
        '--startY': (isDragDraw || isKeepDraw || isDragKeep) ? drawStartY : undefined,
        opacity: (isDragDraw || isKeepDraw || isDragKeep) ? undefined : 0,
        animation: isDragKeep
          ? `card-draw-direct ${dur}ms ${delay}ms both`
          : isKeepDraw
          ? `card-keep-arc ${dur}ms linear ${delay}ms both`
          : isDragDraw
          ? `card-draw-direct 500ms ${delay}ms both`
          : `card-draw-arc 700ms linear ${delay}ms forwards`,
        perspective: card ? '600px' : undefined,
      } as CSSProperties}
    >
      {(isKeepDraw || isDragKeep) && card ? (
        /* Card is already face-up at decision zone — no flip needed */
        <Card card={card} size="md" />
      ) : (
        /* Inner div: owns the flip (rotateY). Separated so preserve-3d isn't killed by the arc animation. */
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
      )}
    </div>
  );
}
