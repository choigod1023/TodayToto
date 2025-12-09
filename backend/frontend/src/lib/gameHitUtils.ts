export type Score = { home: number | null; away: number | null } | undefined;

const getGameWinner = (sc?: Score) => {
  if (!sc || sc.home === null || sc.away === null) return null;
  if (sc.home > sc.away) return 'HOME' as const;
  if (sc.home < sc.away) return 'AWAY' as const;
  return 'DRAW' as const;
};

const parseOverUnder = (
  side?: string,
): { line: number; pick: 'OVER' | 'UNDER' } | null => {
  if (!side) return null;
  const upper = side.toUpperCase();
  const isOver = upper.startsWith('OVER_');
  const isUnder = upper.startsWith('UNDER_');
  if (!isOver && !isUnder) return null;
  const parts = upper.split('_').slice(1);
  if (!parts.length) return null;
  const lineStr = parts.join('.').replace(/[^\d.]/g, '');
  const line = Number(lineStr);
  if (Number.isNaN(line)) return null;
  return { line, pick: isOver ? 'OVER' : 'UNDER' };
};

const parseHandicap = (
  side?: string,
): { line: number; pick: 'HOME' | 'AWAY' } | null => {
  if (!side) return null;
  const upper = side.toUpperCase();
  const isHome = upper.startsWith('HOME_');
  const isAway = upper.startsWith('AWAY_');
  if (!isHome && !isAway) return null;
  const parts = upper.split('_').slice(1);
  if (!parts.length) return null;
  const lineStr = parts.join('.').replace(/[^\d.-]/g, '');
  const line = Number(lineStr);
  if (Number.isNaN(line)) return null;
  return { line, pick: isHome ? 'HOME' : 'AWAY' };
};

export const formatStatus = (status?: string) => {
  const upper = status?.toUpperCase();
  if (upper === 'FINAL') return '경기 종료';
  if (upper === 'IN_PROGRESS' || upper === 'LIVE') return '진행중';
  if (upper === 'READY' || upper === 'SCHEDULED') return '예정';
  return status ?? '';
};

export const computeHitStatus = (
  primary:
    | {
        market: 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP';
        side: string;
      }
    | undefined,
  score: Score,
  gameStatus?: string,
): 'hit' | 'miss' | 'neutral' => {
  const isFinal = gameStatus === 'FINAL';
  if (!isFinal || !primary) return 'neutral';

  if (primary.market === 'FULL_TIME_1X2') {
    const winner = getGameWinner(score);
    if (!winner) return 'neutral';
    return winner === primary.side ? 'hit' : 'miss';
  }

  if (primary.market === 'OVER_UNDER') {
    if (!score || score.home === null || score.away === null) return 'neutral';
    const parsed = parseOverUnder(primary.side);
    if (!parsed) return 'neutral';
    const total = score.home + score.away;
    if (total === parsed.line) return 'neutral';
    const hit =
      (parsed.pick === 'OVER' && total > parsed.line) ||
      (parsed.pick === 'UNDER' && total < parsed.line);
    return hit ? 'hit' : 'miss';
  }

  if (primary.market === 'HANDICAP') {
    if (!score || score.home === null || score.away === null) return 'neutral';
    const parsed = parseHandicap(primary.side);
    if (!parsed) return 'neutral';
    const line = parsed.line;
    const adjustedHome = score.home + line;
    const adjustedAway = score.away;
    if (adjustedHome === adjustedAway) return 'neutral';
    const hit =
      (parsed.pick === 'HOME' && adjustedHome > adjustedAway) ||
      (parsed.pick === 'AWAY' && adjustedAway > adjustedHome);
    return hit ? 'hit' : 'miss';
  }

  return 'neutral';
};
