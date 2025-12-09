export interface RawVsRecordItem {
  startDateTime?: string;
  start_datetime?: string;
  leagueName?: string;
  home?: { name?: string; score?: number };
  away?: { name?: string; score?: number };
  score?: { home?: number; away?: number };
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number;
  awayScore?: number;
  [key: string]: unknown;
}

interface HeadToHeadPanelProps {
  headToHead: RawVsRecordItem[];
  homeRecent?: RawVsRecordItem[];
  awayRecent?: RawVsRecordItem[];
}

function RecentList({
  title,
  items,
}: {
  title: string;
  items: RawVsRecordItem[];
}) {
  const top = (items ?? []).slice(0, 5);

  if (!top.length) {
    return (
      <div>
        <p className="mb-1 text-[11px] font-semibold text-slate-300">{title}</p>
        <p className="text-[10px] text-slate-500">기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-slate-300">{title}</p>
      <ul className="space-y-1 text-[11px]">
        {top.map((m, idx) => {
          const sumPeriods = (periods?: { score?: number }[]) =>
            (periods ?? []).reduce(
              (acc, p) => acc + (typeof p.score === 'number' ? p.score : 0),
              0,
            );

          const date =
            (m.startDateTime as string) || (m.start_datetime as string) || '';
          const homeName =
            m.home?.name || (m.homeTeamName as string) || '홈 팀';
          const awayName =
            m.away?.name || (m.awayTeamName as string) || '원정 팀';
          const homeScore =
            m.home?.score ??
            (m.homeScore as number | undefined) ??
            (m as any).home_score ??
            m.score?.home ??
            sumPeriods((m.home as any)?.periodData);
          const awayScore =
            m.away?.score ??
            (m.awayScore as number | undefined) ??
            (m as any).away_score ??
            m.score?.away ??
            sumPeriods((m.away as any)?.periodData);

          const scoreText =
            homeScore != null && awayScore != null
              ? `${homeScore} : ${awayScore}`
              : '-';

          return (
            <li
              key={idx}
              className="flex items-center justify-between rounded bg-slate-950/40 px-2 py-1"
            >
              <div>
                <p className="text-slate-100">
                  {homeName} vs {awayName}
                </p>
                <p className="text-[10px] text-slate-400">{date}</p>
              </div>
              <span className="text-xs font-semibold text-slate-200">
                {scoreText}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HeadToHeadPanel({
  headToHead,
  homeRecent,
  awayRecent,
}: HeadToHeadPanelProps) {
  const vsItems = (headToHead ?? []).slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-2 text-sm font-semibold">맞대결 / 최근 전적</h2>
      <div className="space-y-4">
        {vsItems.length ? (
          <RecentList title="맞대결 상위 5경기" items={vsItems} />
        ) : (
          <p className="text-xs text-slate-400">
            기록된 맞대결 전적이 없습니다.
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <RecentList title="홈팀 최근 5경기" items={homeRecent ?? []} />
          <RecentList title="원정팀 최근 5경기" items={awayRecent ?? []} />
        </div>
      </div>
    </div>
  );
}
