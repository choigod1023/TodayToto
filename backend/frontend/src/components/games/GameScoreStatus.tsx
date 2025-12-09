type Score = { home: number | null; away: number | null } | undefined;

export function GameScoreStatus({
  score,
  statusLabel,
}: {
  score?: Score;
  statusLabel?: string;
}) {
  if (!score || score.home === null || score.away === null) return null;
  return (
    <p className="mt-2 text-sm font-semibold text-slate-200">
      스코어 {score.home} - {score.away}{' '}
      {statusLabel && (
        <span className="text-xs text-slate-400">({statusLabel})</span>
      )}
    </p>
  );
}
