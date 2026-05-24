import { UnoCard, effectiveColor } from '../lib/uno';

const COLOR_BG: Record<string, string> = {
  red: '#dc2626',
  green: '#16a34a',
  blue: '#2563eb',
  yellow: '#d97706',
  wild: '#7c3aed',
};

const LABEL: Record<string, string> = {
  skip: '⊘',
  reverse: '⇄',
  draw2: '+2',
  wild: '★',
  wild4: '+4',
};

interface Props {
  card: UnoCard;
  faceDown?: boolean;
  playable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function Card({ card, faceDown, playable, selected, onClick, size = 'md' }: Props) {
  const color = effectiveColor(card);
  const bg = COLOR_BG[color] ?? '#7c3aed';
  const label = LABEL[card.value] ?? card.value;

  // Width via CSS variable (defined on the game board root); height via aspect-ratio
  const cardW = size === 'sm' ? 'var(--card-sm-w)' : 'var(--card-md-w)';
  const fontSize = size === 'sm' ? 'clamp(10px, 2.5vw, 13px)' : 'clamp(14px, 3.5vw, 18px)';

  if (faceDown) {
    return (
      <div
        className="rounded-lg border-[3px] border-white shrink-0 flex items-center justify-center overflow-hidden bg-[#0a0a0a]"
        style={{ width: cardW, aspectRatio: '1 / 1.45' }}
      >
        <div
          className="rounded-[50%] flex items-center justify-center shrink-0 -rotate-[15deg]"
          style={{
            background: 'linear-gradient(160deg, #ef4444 0%, #b91c1c 100%)',
            width: '92%',
            height: '38%',
            boxShadow: '0 2px 8px rgba(185,28,28,0.6)',
          }}
        >
          <svg viewBox="0 0 120 56" width="100%" height="100%" className="block overflow-visible">
            <text x="62" y="47" textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="800" fontSize={54} fill="#000" letterSpacing="-1">UNO</text>
            <text x="61" y="46" textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="800" fontSize={54} fill="#000" letterSpacing="-1">UNO</text>
            <text x="59" y="44" textAnchor="middle" fontFamily="Fraunces, serif" fontWeight="800" fontSize={54} fill="#facc15" stroke="#000" strokeWidth="3" strokeLinejoin="round" paintOrder="stroke fill" letterSpacing="-1">UNO</text>
          </svg>
        </div>
      </div>
    );
  }

  const shadow = selected
    ? '0 8px 20px rgba(0,0,0,0.4)'
    : playable
    ? '0 4px 12px rgba(0,0,0,0.3)'
    : '0 2px 4px rgba(0,0,0,0.2)';

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={[
        'flex items-center justify-center shrink-0 outline-none relative rounded-lg border-white',
        'transition-[transform,box-shadow] duration-150',
        selected ? 'border-[4px] -translate-y-2' : 'border-[3px]',
        !selected && playable ? '-translate-y-1' : '',
        onClick ? 'cursor-pointer' : 'cursor-default',
      ].filter(Boolean).join(' ')}
      style={{ width: cardW, aspectRatio: '1 / 1.45', background: bg, boxShadow: shadow }}
    >
      <div className="absolute w-[70%] h-[85%] rounded-full bg-white/15 -rotate-[20deg]" />
      <span
        className="font-serif font-extrabold text-white relative z-10 leading-none"
        style={{ fontSize, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
      >
        {label}
      </span>
    </button>
  );
}
