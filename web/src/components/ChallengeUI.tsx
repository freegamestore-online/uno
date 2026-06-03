import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CardColor } from '../lib/uno';
import { getDecisionZonePos, getUpperZonePos } from '../lib/boardGeometry';
import { Z } from '../lib/zIndex';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626', green: '#16a34a', blue: '#2563eb', yellow: '#eab308',
};

interface Props {
  attackerName: string;
  prevColor: CardColor | undefined;
  onChallenge: () => void;
  onAccept: () => void;
}

export function CpuChallengeOopsText() {
  const [cssTop, setCssTop] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => { setCssTop(getUpperZonePos().cssTop); }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => requestAnimationFrame(() => setOpacity(1)));
    const t = setTimeout(() => setOpacity(0), 1000);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(t); };
  }, []);

  return (
    <div
      className="absolute pointer-events-none font-sans font-semibold"
      style={{
        left: 0, right: 0, top: `${cssTop}px`, transform: 'translateY(-50%)',
        zIndex: Z.DECISION, textAlign: 'center',
        color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap',
        opacity, transition: 'opacity 300ms ease',
      }}
    >
      OOPS...good luck next time!
    </div>
  );
}

interface CpuChallengePromptProps {
  attackerName: string;
  prevColor: CardColor | undefined;
}

export function CpuChallengePrompt({ attackerName, prevColor }: CpuChallengePromptProps) {
  const [cssTop, setCssTop] = useState(0);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => { setCssTop(getUpperZonePos().cssTop); }, []);

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(r);
  }, []);

  const colorHex = COLOR_BG[prevColor ?? ''] ?? 'rgba(255,255,255,0.85)';
  const colorLabel = prevColor ? prevColor.charAt(0).toUpperCase() + prevColor.slice(1) : '';

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: 0, right: 0, top: `${cssTop}px`, transform: 'translateY(-50%)',
        zIndex: Z.DECISION,
        display: 'flex', justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
    >
      <p
        className="font-sans font-semibold m-0 text-center pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap' }}
      >
        Does {attackerName} have{' '}
        <span className="font-bold" style={{ color: colorHex }}>{colorLabel}</span>
        {' '}cards now?
      </p>
    </div>
  );
}

export function ChallengeOopsText() {
  const [cssTop, setCssTop] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => { setCssTop(getDecisionZonePos().cssTop); }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => requestAnimationFrame(() => setOpacity(1)));
    const t = setTimeout(() => setOpacity(0), 1000);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(t); };
  }, []);

  return (
    <div
      className="absolute pointer-events-none font-sans font-semibold"
      style={{
        left: 0, right: 0, top: `${cssTop}px`, transform: 'translateY(-50%)',
        zIndex: Z.DECISION, textAlign: 'center',
        color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap',
        opacity, transition: 'opacity 300ms ease',
      }}
    >
      OOPS...good luck next time!
    </div>
  );
}

export function ChallengeUI({ attackerName, prevColor, onChallenge, onAccept }: Props) {
  const [cssTop, setCssTop] = useState(0);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    setCssTop(getDecisionZonePos().cssTop);
  }, []);

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return () => cancelAnimationFrame(r);
  }, []);

  const colorHex = COLOR_BG[prevColor ?? ''] ?? 'rgba(255,255,255,0.85)';
  const colorLabel = prevColor ? prevColor.charAt(0).toUpperCase() + prevColor.slice(1) : '';

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: 0, right: 0, top: `${cssTop}px`, transform: 'translateY(-50%)',
        zIndex: Z.DECISION,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 'clamp(10px, 2.5vw, 16px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
    >
      <p
        className="font-sans font-semibold m-0 text-center pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap' }}
      >
        Does {attackerName} have{' '}
        <span className="font-bold" style={{ color: colorHex }}>{colorLabel}</span>
        {' '}cards now?
      </p>
      <div className="flex gap-3 pointer-events-auto">
        <button
          onClick={onChallenge}
          className="cursor-pointer font-sans font-semibold hover:opacity-60"
          style={{
            background: 'none', border: '1.5px solid rgba(255,255,255,0.85)', borderRadius: 9999,
            color: 'rgba(255,255,255,0.85)', padding: '8px clamp(14px, 4vw, 22px)',
            fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap',
            minWidth: 'clamp(72px, 18vw, 88px)', textAlign: 'center',
          }}
        >
          Yes, challenge
        </button>
        <button
          onClick={onAccept}
          className="cursor-pointer font-sans font-semibold hover:opacity-60"
          style={{
            background: 'none', border: '1.5px solid rgba(255,255,255,0.85)', borderRadius: 9999,
            color: 'rgba(255,255,255,0.85)', padding: '8px clamp(14px, 4vw, 22px)',
            fontSize: 'clamp(13px, 3.5vw, 15px)', whiteSpace: 'nowrap',
            minWidth: 'clamp(72px, 18vw, 88px)', textAlign: 'center',
          }}
        >
          No, draw 4 cards
        </button>
      </div>
    </div>
  );
}
