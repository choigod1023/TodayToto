export function evaluateHitStatus(
  result:
    | {
        primaryPick?: { market?: string; side?: string };
      }
    | null
    | undefined,
  score?: { home: number | null; away: number | null },
  gameStatus?: string,
): 'hit' | 'miss' | 'neutral' {
  if (!result || typeof result !== 'object') return 'neutral';
  if (!score || score.home === null || score.away === null) return 'neutral';
  if (gameStatus && gameStatus.toUpperCase() !== 'FINAL') return 'neutral';

  const primary = result?.primaryPick;
  if (!primary) return 'neutral';

  const winner = (() => {
    if (score.home > score.away) return 'HOME';
    if (score.home < score.away) return 'AWAY';
    return 'DRAW';
  })();

  const market = String(primary.market || '').toUpperCase();
  const side = String(primary.side || '').toUpperCase();

  if (market === 'FULL_TIME_1X2') {
    return winner === side ? 'hit' : 'miss';
  }

  if (market === 'OVER_UNDER') {
    const parts = side.split('_').slice(1);
    if (!parts.length) return 'neutral';
    const line = Number(parts.join('.').replace(/[^\d.]/g, ''));
    if (Number.isNaN(line)) return 'neutral';
    const total = (score.home ?? 0) + (score.away ?? 0);
    if (total === line) return 'neutral';
    const pickOver = side.startsWith('OVER_');
    return pickOver
      ? total > line
        ? 'hit'
        : 'miss'
      : total < line
        ? 'hit'
        : 'miss';
  }

  if (market === 'HANDICAP') {
    const parts = side.split('_').slice(1);
    if (!parts.length) return 'neutral';
    const line = Number(parts.join('.').replace(/[^\d.-]/g, ''));
    if (Number.isNaN(line)) return 'neutral';
    const adjustedHome = (score.home ?? 0) + line;
    const adjustedAway = score.away ?? 0;
    if (adjustedHome === adjustedAway) return 'neutral';
    const pickHome = side.startsWith('HOME_');
    return pickHome
      ? adjustedHome > adjustedAway
        ? 'hit'
        : 'miss'
      : adjustedAway > adjustedHome
        ? 'hit'
        : 'miss';
  }

  return 'neutral';
}



