import { useState, useEffect } from 'react';
import type { Player } from '../lib/uno';

type LightningState = { offset: number; length: number; phase: 0 | 1 | 2 | 3; dur: number } | null;

export function useDealLightning(players: Player[], currentPlayer: number) {
  const [dealLightningOffset, setDealLightningOffset] = useState<LightningState>(null);
  const [showInitAnim, setShowInitAnim] = useState(false);

  useEffect(() => {
    const totalCards = players.reduce((sum, p) => sum + p.hand.length, 0);
    const dur = 600 + (totalCards - 1) * 150 + 720;
    const nLoops = Math.min(2, Math.ceil(totalCards / 7));
    const toPos = (pos: string | undefined) => pos === 'top' ? 0 : pos === 'right' ? 250 : pos === 'bottom' ? 500 : pos === 'left' ? 750 : 500;
    const startPos = toPos(players[0]?.position);
    const endPos   = toPos(players[currentPlayer]?.position);
    const dist     = (endPos - startPos + 1000) % 1000;
    const departure    = startPos + 1000;
    const launchOffset = departure + 160;
    const arrival      = departure + nLoops * 1000 + dist;
    const launchDur    = 250;
    const travelDist   = nLoops * 1000 - 160;
    const travelDurRaw = Math.max(400, dur - 536 - launchDur);
    const catchUpDur   = Math.round(160 * travelDurRaw / (travelDist + 160));
    const travelDur    = travelDurRaw - catchUpDur;

    const t0 = setTimeout(() => setDealLightningOffset({ offset: departure,    length: 0,   phase: 0, dur: 0          }), 520);
    const t1 = setTimeout(() => setDealLightningOffset({ offset: launchOffset, length: 160, phase: 1, dur: launchDur  }), 536);
    const t2 = setTimeout(() => setDealLightningOffset({ offset: arrival,      length: 160, phase: 2, dur: travelDur  }), 536 + launchDur);
    const t3 = setTimeout(() => setDealLightningOffset({ offset: arrival,      length: 0,   phase: 3, dur: catchUpDur }), 536 + launchDur + travelDur);
    const t4 = setTimeout(() => setDealLightningOffset(null), 536 + launchDur + travelDur + catchUpDur + 50);
    const t5 = setTimeout(() => setShowInitAnim(true), 536 + launchDur + travelDur + catchUpDur + 250);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { dealLightningOffset, showInitAnim, setShowInitAnim };
}
