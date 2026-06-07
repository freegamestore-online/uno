import { Z } from '../lib/zIndex';

interface Props {
  deskW: number;
  deskH: number;
  dealLightningOffset: { offset: number; length: number; phase: 0 | 1 | 2 | 3; dur: number };
}

export function DealLightningSVG({ deskW, deskH, dealLightningOffset }: Props) {
  const ix = 24, iy = 24, ir = 8;
  const _dl = `H ${deskW-ix-ir} A ${ir},${ir} 0 0,1 ${deskW-ix},${iy+ir} V ${deskH-iy-ir} A ${ir},${ir} 0 0,1 ${deskW-ix-ir},${deskH-iy} H ${ix+ir} A ${ir},${ir} 0 0,1 ${ix},${deskH-iy-ir} V ${iy+ir} A ${ir},${ir} 0 0,1 ${ix+ir},${iy} H ${deskW/2}`;
  const path = `M ${deskW/2},${iy} ${_dl} ${_dl} ${_dl} ${_dl} Z`;

  const { offset, length, phase, dur } = dealLightningOffset;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${deskW} ${deskH}`}
      preserveAspectRatio="none"
      style={{ overflow: 'visible', zIndex: Z.UI_CHROME }}
    >
      <defs>
        <filter id="deal-lightning-noise" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" seed="42" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="displaced" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={path}
        pathLength="4000"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`0 ${4000 - length} ${length} 0`}
        strokeDashoffset={-offset}
        style={{
          transition:
            phase === 1 ? `stroke-dashoffset ${dur}ms linear, stroke-dasharray ${dur}ms linear` :
            phase === 2 ? `stroke-dashoffset ${dur}ms linear` :
            phase === 3 ? `stroke-dasharray ${dur}ms linear` :
            'none',
          filter: 'url(#deal-lightning-noise)',
          animation: 'wild4-flicker 0.15s linear infinite',
        }}
      />
    </svg>
  );
}
