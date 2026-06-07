interface Props {
  desk: { w: number; h: number };
  displayedDir: 1 | -1;
  dirOpacity: number;
  color: string;
  turnLine: { offset: number; length: number; traveling: boolean };
  wildTravelColor: string | null;
  direction: number;
  pendingAction: { type: string; color?: string } | null | undefined;
}

export function TurnLineSVG({ desk, displayedDir, dirOpacity, color, turnLine, wildTravelColor, direction, pendingAction }: Props) {
  const cw = displayedDir === 1;
  const { w, h } = desk;

  const ox = 2, oy = 2, or = 30;
  const outerD = `M ${w/2},${oy} H ${w-ox-or} A ${or},${or} 0 0,1 ${w-ox},${oy+or} V ${h-oy-or} A ${or},${or} 0 0,1 ${w-ox-or},${h-oy} H ${ox+or} A ${or},${or} 0 0,1 ${ox},${h-oy-or} V ${oy+or} A ${or},${or} 0 0,1 ${ox+or},${oy} Z`;

  const ix = 24, iy = 24, ir = 8;
  const drawLoop = `H ${w-ix-ir} A ${ir},${ir} 0 0,1 ${w-ix},${iy+ir} V ${h-iy-ir} A ${ir},${ir} 0 0,1 ${w-ix-ir},${h-iy} H ${ix+ir} A ${ir},${ir} 0 0,1 ${ix},${h-iy-ir} V ${iy+ir} A ${ir},${ir} 0 0,1 ${ix+ir},${iy} H ${w/2}`;
  const innerD = `M ${w/2},${iy} ${drawLoop} ${drawLoop} ${drawLoop} Z`;
  const dur = 30;

  const layers = [
    { len: 160, op: 0.04 }, { len: 145, op: 0.08 }, { len: 127, op: 0.13 },
    { len: 110, op: 0.19 }, { len: 92,  op: 0.27 }, { len: 74,  op: 0.36 },
    { len: 55,  op: 0.47 }, { len: 37,  op: 0.59 }, { len: 21,  op: 0.72 },
    { len: 7,   op: 0.85 },
  ];

  const isFwd = direction === 1;
  const dashArray = isFwd
    ? `0 ${3000 - turnLine.length} ${turnLine.length} 0`
    : `${turnLine.length} 3000 0 0`;
  const isWild4 = pendingAction?.type === 'wild4';
  const isWild = !!wildTravelColor && turnLine.traveling;
  const wildColor = wildTravelColor ?? 'white';
  const transition = turnLine.traveling
    ? 'stroke-dashoffset 450ms linear, stroke-dasharray 450ms linear, opacity 50ms'
    : 'opacity 200ms ease-out';
  const commonProps = {
    d: innerD, pathLength: '3000', fill: 'none',
    strokeLinecap: 'round' as const,
    strokeDasharray: dashArray,
    strokeDashoffset: `${-turnLine.offset}`,
    opacity: turnLine.traveling ? 1 : 0,
  };

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ overflow: 'visible', opacity: dirOpacity, transition: 'opacity 350ms ease' }}
    >
      <defs>
        <filter id="lightning-noise" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" seed="42" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="displaced" />
          </feMerge>
        </filter>
      </defs>
      {[0, -dur / 2].map((begin, i) => (
        <g key={`${i}-${displayedDir}`}>
          {layers.map(({ len, op }) => (
            <path
              key={len}
              d={outerD}
              pathLength="1000"
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${len} ${1000 - len}`}
              opacity={op}
            >
              <animate
                attributeName="stroke-dashoffset"
                from={cw ? `${len}` : `-1000`}
                to={cw ? `${len - 1000}` : `0`}
                dur={`${dur}s`}
                begin={`${begin}s`}
                repeatCount="indefinite"
                calcMode="linear"
              />
            </path>
          ))}
        </g>
      ))}
      {isWild4 ? (
        <path
          {...commonProps}
          stroke="var(--uno-red)"
          strokeWidth="3"
          style={{
            transition,
            filter: 'url(#lightning-noise)',
            animation: 'wild4-color-cycle 0.5s steps(1) infinite, wild4-flicker 0.15s linear infinite',
          }}
        />
      ) : isWild ? (
        <path
          {...commonProps}
          stroke={wildColor}
          strokeWidth="3"
          style={{
            transition,
            filter: 'url(#lightning-noise)',
            animation: 'wild4-flicker 0.15s linear infinite',
          }}
        />
      ) : (
        <path
          {...commonProps}
          stroke="white"
          strokeWidth="2"
          style={{
            transition,
            filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))',
          }}
        />
      )}
    </svg>
  );
}
