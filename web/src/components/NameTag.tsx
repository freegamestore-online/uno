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
}

export function NameTag({ player: p, idx, activeSeat, initCardRevealed, actionTag }: Props) {
  const posClass =
    p.position === 'bottom' ? 'bottom-[24px] left-1/2 -translate-x-1/2 translate-y-1/2' :
    p.position === 'top'    ? 'top-[24px] left-1/2 -translate-x-1/2 -translate-y-1/2' :
    p.position === 'left'   ? 'left-[12px] top-1/2 -translate-y-1/2' :
    p.position === 'right'  ? 'right-[12px] top-1/2 -translate-y-1/2' : '';
  if (!posClass) return null;

  const isActive = initCardRevealed && activeSeat === idx;
  const isPunished = actionTag?.seat === idx;
  const displayTag = isPunished ? actionTag!.text : p.name;
  const tOrigin =
    p.position === 'bottom' ? 'bottom center' : p.position === 'top' ? 'top center' :
    p.position === 'left'   ? 'left center'   : p.position === 'right' ? 'right center' : 'center';

  let textColor = isActive ? '#000000' : 'rgba(255,255,255,0.4)';
  if (isPunished) {
    if (actionTag!.type === 'skip' || actionTag!.type === 'draw2' || actionTag!.type === 'wild4') textColor = '#facc15';
    else textColor = COLOR_BG[actionTag!.color ?? 'wild'] ?? '#ffffff';
  }

  return (
    <div
      id={p.id === 0 ? 'you-nametag' : undefined}
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
}
