export function SeasonStatPanel({
  seasonStat,
}: {
  seasonStat?:
    | {
        home?: {
          name?: string;
          winPercentage?: string;
          pointsAverage?: string;
          fieldGoalsPercentage?: string;
          threePointFieldGoalsPercentage?: string;
          freeThrowsPercentage?: string;
          assistsAverage?: string;
          reboundsTotalAverage?: string;
          stealsAverage?: string;
          blockedShotsAverage?: string;
          turnoversAverage?: string;
        };
        away?: {
          name?: string;
          winPercentage?: string;
          pointsAverage?: string;
          fieldGoalsPercentage?: string;
          threePointFieldGoalsPercentage?: string;
          freeThrowsPercentage?: string;
          assistsAverage?: string;
          reboundsTotalAverage?: string;
          stealsAverage?: string;
          blockedShotsAverage?: string;
          turnoversAverage?: string;
        };
      }
    | undefined;
}) {
  if (!seasonStat || (!seasonStat.home && !seasonStat.away)) {
    return (
      <p className="text-[11px] text-slate-500">시즌 팀 스탯이 없습니다.</p>
    );
  }

  const fields: Array<{
    key: keyof NonNullable<typeof seasonStat>['home'];
    label: string;
  }> = [
    { key: 'winPercentage', label: '승률' },
    { key: 'pointsAverage', label: '평균 득점' },
    { key: 'fieldGoalsPercentage', label: '야투%' },
    { key: 'threePointFieldGoalsPercentage', label: '3점%' },
    { key: 'freeThrowsPercentage', label: '자유투%' },
    { key: 'assistsAverage', label: '어시스트' },
    { key: 'reboundsTotalAverage', label: '리바운드' },
    { key: 'stealsAverage', label: '스틸' },
    { key: 'blockedShotsAverage', label: '블록' },
    { key: 'turnoversAverage', label: '턴오버' },
  ];

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold text-slate-200">
        시즌 스탯
      </h3>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full text-[11px] text-left">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-2 py-1">지표</th>
              <th className="px-2 py-1">{seasonStat.home?.name ?? '홈'}</th>
              <th className="px-2 py-1">{seasonStat.away?.name ?? '원정'}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr
                key={f.key}
                className="border-t border-slate-800/80 text-slate-200"
              >
                <td className="px-2 py-1 text-slate-300">{f.label}</td>
                <td className="px-2 py-1">
                  {(seasonStat.home as any)?.[f.key] ?? '-'}
                </td>
                <td className="px-2 py-1">
                  {(seasonStat.away as any)?.[f.key] ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

