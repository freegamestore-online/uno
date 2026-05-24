import { CardColor } from '../lib/uno';

const COLORS: { color: CardColor; bg: string; label: string }[] = [
  { color: 'red', bg: '#dc2626', label: 'Red' },
  { color: 'green', bg: '#16a34a', label: 'Green' },
  { color: 'blue', bg: '#2563eb', label: 'Blue' },
  { color: 'yellow', bg: '#d97706', label: 'Yellow' },
];

interface Props {
  onPick: (color: CardColor) => void;
}

export function ColorPicker({ onPick }: Props) {
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4 z-50">
      <p className="text-white font-serif font-bold text-xl m-0">Choose a color</p>
      <div className="flex gap-4">
        {COLORS.map(({ color, bg, label }) => (
          <button
            key={color}
            onClick={() => onPick(color)}
            className="w-16 h-16 rounded-full border-[3px] border-white/50 cursor-pointer text-white font-bold text-[12px] font-sans transition-transform duration-100"
            style={{ background: bg, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.12)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
