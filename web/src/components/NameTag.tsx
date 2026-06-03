import type { Player } from '../lib/uno';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626', green: '#16a34a', blue: '#2563eb', yellow: '#eab308', wild: '#7c3aed',
};

interface ActionTag { seat: number; text: string; type: string; color?: string }

interface Props {
  player: Player;
  idx: number;
  activeSeat: number | null;
  initCardRevealed: boolean;
  actionTag: ActionTag | null | undefined;
  unoCalled?: boolean;
  unoTagActive?: boolean;
  isBusted?: boolean;
  bustPopActive?: boolean;
  isGotcha?: boolean;
  onBust?: () => void;
}

export function NameTag({ player: p, idx, activeSeat, initCardRevealed, actionTag, unoCalled, unoTagActive, isBusted, bustPopActive, isGotcha, onBust }: Props) {
  const posClass =
    p.position === 'bottom' ? 'bottom-[24px] left-1/2 -translate-x-1/2 translate-y-1/2' :
    p.position === 'top'    ? 'top-[24px] left-1/2 -translate-x-1/2 -translate-y-1/2' :
    p.position === 'left'   ? 'left-[12px] top-1/2 -translate-y-1/2' :
    p.position === 'right'  ? 'right-[12px] top-1/2 -translate-y-1/2' : '';
  if (!posClass) return null;

  const isActive = initCardRevealed && activeSeat === idx;
  const isPunished = actionTag?.seat === idx;
  const displayTag = isGotcha ? 'GOTCHA!' : bustPopActive ? '🤯 BUSTED' : unoTagActive ? 'UNO!' : isBusted ? 'BUST' : isPunished ? actionTag!.text : p.name;
  const tOrigin =
    p.position === 'bottom' ? 'bottom center' : p.position === 'top' ? 'top center' :
    p.position === 'left'   ? 'left center'   : p.position === 'right' ? 'right center' : 'center';

  let textColor = isActive ? '#000000' : 'rgba(255,255,255,0.4)';
  if (unoCalled && !isPunished) textColor = isActive ? '#ffffff' : '#f472b6';
  if (unoTagActive) textColor = '#f472b6';
  if (isBusted) textColor = '#000000';
  if (bustPopActive) textColor = '#eab308';
  if (isGotcha) textColor = '#ffffff';
  if (isPunished && !isBusted && !bustPopActive && !isGotcha) {
    if (actionTag!.type === 'challenge') textColor = '#ffffff';
    else if (actionTag!.type === 'skip' || actionTag!.type === 'draw2' || actionTag!.type === 'wild4') textColor = '#facc15';
    else textColor = COLOR_BG[actionTag!.color ?? 'wild'] ?? '#ffffff';
  }

  return (
    <div
      id={p.id === 0 ? 'you-nametag' : p.position === 'top' ? 'top-nametag' : undefined}
      className={`absolute ${posClass} px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-sans font-bold z-0${isBusted ? ' bust-glow' : ''}`}
      onClick={isBusted && onBust ? onBust : undefined}
      style={{
        backgroundColor: isGotcha ? '#dc2626' : bustPopActive ? 'rgba(0,0,0,0.25)' : isBusted ? '#eab308' : unoTagActive ? 'rgba(0,0,0,0.25)' : unoCalled && isActive && !isPunished ? '#f472b6' : isActive && !isPunished ? '#ffffff' : 'rgba(0,0,0,0.25)',
        color: textColor,
        boxShadow: isGotcha ? '0 0 16px rgba(220,38,38,0.5)' : isBusted ? undefined : isActive && !isPunished && !unoCalled ? '0 0 16px rgba(255,255,255,0.3)' : unoCalled && isActive ? '0 0 16px rgba(244,114,182,0.5)' : 'inset 0 1px 3px rgba(0,0,0,0.3)',
        transition: isGotcha || bustPopActive || isBusted || isPunished || unoTagActive ? 'none' : 'all 300ms',
        fontSize: isGotcha || bustPopActive || isBusted || isPunished || unoTagActive ? '13px' : '11px',
        cursor: isBusted && !!onBust ? 'pointer' : 'default',
        transformOrigin: tOrigin,
        animation: isGotcha ? 'penalty-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both' : bustPopActive ? 'penalty-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both' : isBusted ? undefined : unoTagActive ? 'penalty-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both' : isPunished ? 'penalty-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both' : undefined,
      }}
    >
      {displayTag}
    </div>
  );
}
