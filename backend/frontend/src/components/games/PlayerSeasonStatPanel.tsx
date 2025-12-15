export type PlayerSeasonStatRaw = {
  player?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    position?: string;
  };
  pointsAverage?: string | number;
  points?: number;
  reboundsTotalAverage?: string | number;
  reboundsTotal?: number;
  assistsAverage?: string | number;
  assists?: number;
  fieldGoalsPercentage?: string | number;
  threePointFieldGoalsPercentage?: string | number;
  freeThrowsPercentage?: string | number;
  reboundsOffensiveAverage?: string | number;
  reboundsDefensiveAverage?: string | number;
  stealsAverage?: string | number;
  blockedShotsAverage?: string | number;
  turnoversAverage?: string | number;
  timesPlayedAverage?: string;
};

function pickTopPlayers(list: PlayerSeasonStatRaw[] | undefined, limit = 5) {
  if (!Array.isArray(list)) return [];
  return [...list]
    .map((p) => {
      const name =
        p?.player?.displayName ||
        [p?.player?.firstName, p?.player?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        '선수';
      const points = Number(p?.pointsAverage ?? p?.points ?? 0);
      const rebounds = Number(p?.reboundsTotalAverage ?? p?.reboundsTotal ?? 0);
      const assists = Number(p?.assistsAverage ?? p?.assists ?? 0);
      const fg = p?.fieldGoalsPercentage;
      const tp = p?.threePointFieldGoalsPercentage;
      const minutes = p?.timesPlayedAverage;
      const position = p?.player?.position ?? '';
      return {
        name,
        points,
        rebounds,
        assists,
        fg,
        tp,
        minutes,
        position,
      };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

export function PlayerSeasonStatPanel({
  playerSeasonStat,
}: {
  playerSeasonStat?:
    | {
        home?: { additionalTeamData?: PlayerSeasonStatRaw[] };
        away?: { additionalTeamData?: PlayerSeasonStatRaw[] };
      }
    | undefined;
}) {
  const homePlayers = pickTopPlayers(
    playerSeasonStat?.home?.additionalTeamData,
  );
  const awayPlayers = pickTopPlayers(
    playerSeasonStat?.away?.additionalTeamData,
  );

  if (!homePlayers.length && !awayPlayers.length) {
    return (
      <p className="text-[11px] text-slate-500">선수 시즌 스탯이 없습니다.</p>
    );
  }

  const renderList = (
    title: string,
    list: ReturnType<typeof pickTopPlayers>,
  ) => (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-slate-200">{title}</p>
      <ul className="space-y-1 text-[11px] text-slate-100">
        {list.map((p, idx) => (
          <li
            key={`${p.name}-${idx}`}
            className="flex items-center justify-between rounded bg-slate-950/40 px-2 py-1"
          >
            <div>
              <p className="font-semibold text-slate-100">{p.name}</p>
              <p className="text-[10px] text-slate-400">
                {p.position || '-'} · 분 {p.minutes || '-'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-200">
              <span>득점 {p.points}</span>
              <span>리바 {p.rebounds}</span>
              <span>어시 {p.assists}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-2">
      {homePlayers.length > 0 && renderList('홈 팀 상위 선수', homePlayers)}
      {awayPlayers.length > 0 && renderList('원정 팀 상위 선수', awayPlayers)}
    </div>
  );
}
