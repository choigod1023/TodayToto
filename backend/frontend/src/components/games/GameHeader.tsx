interface GameHeaderProps {
  leagueName: string;
  gameId: number;
  homeTeamName: string;
  awayTeamName: string;
  startTime: string;
}

export function GameHeader({
  leagueName,
  gameId,
  homeTeamName,
  awayTeamName,
  startTime,
}: GameHeaderProps) {
  return (
    <div>
      <p className="text-xs text-slate-400">
        {leagueName} · 경기 ID {gameId}
      </p>
      <h1 className="mt-1 text-xl font-semibold">
        {homeTeamName} vs {awayTeamName}
      </h1>
      <p className="mt-1 text-xs text-slate-400">
        시작 시간: <span className="font-mono">{startTime}</span>
      </p>
    </div>
  );
}
