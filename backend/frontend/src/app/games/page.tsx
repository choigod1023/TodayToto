import Link from 'next/link';
import { getJson } from '@/lib/apiClient';
//메인페이지

// 쿼리 파라미터(day) 변경마다 새로 데이터를 가져오도록 강제
export const dynamic = 'force-dynamic';

interface PopularGame {
  gameId: number;
  sport: string;
  leagueName: string;
  startTime: string;
  homeTeamName: string;
  awayTeamName: string;
  gameStatus?: string;
  result?: string;
  score?: { home: number | null; away: number | null };
  primaryPick?: {
    market: 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP';
    side: string;
    probability?: number;
    reason?: string;
  } | null;
  hitStatus?: 'hit' | 'miss' | 'neutral';
}

interface PopularGamesResponse {
  date: string;
  games: PopularGame[];
}

const formatStatus = (status?: string) => {
  const upper = status?.toUpperCase();
  if (upper === 'FINAL') return '경기 종료';
  if (upper === 'IN_PROGRESS' || upper === 'LIVE') return '진행중';
  if (upper === 'READY' || upper === 'SCHEDULED') return '예정';
  return status ?? '';
};

async function fetchPopularGames(
  day: 'yesterday' | 'today' | 'tomorrow',
): Promise<PopularGamesResponse> {
  // 한국 시간(KST, UTC+9) 기준으로 현재 날짜 계산
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간을 밀리초로 변환
  const kstDate = new Date(now.getTime() + kstOffset);

  let dayOffset = 0;
  if (day === 'yesterday') {
    dayOffset = -24 * 60 * 60 * 1000;
  } else if (day === 'tomorrow') {
    dayOffset = 24 * 60 * 60 * 1000;
  }

  const targetDate = new Date(kstDate.getTime() + dayOffset);
  const requestDate = targetDate.toISOString().slice(0, 10);

  return getJson<PopularGamesResponse>('games/popular-with-pick', {
    date: requestDate,
  });
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams?: Promise<{ day?: string }>;
}) {
  const params = await searchParams;
  const dayParam = params?.day;
  const day =
    dayParam === 'yesterday'
      ? 'yesterday'
      : dayParam === 'tomorrow'
        ? 'tomorrow'
        : 'today';
  const { date, games } = await fetchPopularGames(day);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-semibold">주요 경기 목록</h1>
            <p className="text-xs text-slate-400">
              날짜 기준: <span className="font-mono">{date}</span>
              {day === 'yesterday' && <span className="ml-1">(어제 경기)</span>}
              {day === 'tomorrow' && <span className="ml-1">(내일 경기)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-700 bg-slate-900 text-xs">
              <Link
                href="/games?day=yesterday"
                className={`px-3 py-1.5 ${
                  day === 'yesterday'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                어제
              </Link>
              <Link
                href="/games"
                className={`px-3 py-1.5 border-l border-slate-700 ${
                  day === 'today'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                오늘
              </Link>
              <Link
                href="/games?day=tomorrow"
                className={`px-3 py-1.5 border-l border-slate-700 ${
                  day === 'tomorrow'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                내일
              </Link>
            </div>
            <Link
              href="/"
              className="text-xs text-slate-400 underline-offset-4 hover:underline"
            >
              홈으로
            </Link>
          </div>
        </header>

        {games.length === 0 ? (
          <p className="text-sm text-slate-400">
            현재 인기 경기 데이터가 없습니다.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {games.map((game) => {
              const hitClass =
                game.hitStatus === 'hit'
                  ? 'border-emerald-400/70 bg-emerald-500/10'
                  : game.hitStatus === 'miss'
                    ? 'border-rose-400/70 bg-rose-500/10'
                    : 'border-slate-800 bg-slate-900/60';

              return (
                <li key={game.gameId}>
                  <Link
                    href={{
                      pathname: `/games/${game.gameId}`,
                      query: {
                        ...(game.score?.home != null
                          ? { scoreHome: game.score.home }
                          : {}),
                        ...(game.score?.away != null
                          ? { scoreAway: game.score.away }
                          : {}),
                        ...(game.gameStatus
                          ? { gameStatus: game.gameStatus }
                          : {}),
                        ...(game.result ? { result: game.result } : {}),
                      },
                    }}
                    className={`flex min-h-[180px] flex-col rounded-xl border p-4 transition hover:border-sky-500 hover:bg-slate-900 ${hitClass}`}
                  >
                    <div className="flex-1">
                      <p className="text-xs text-slate-400">
                        {game.sport} · {game.leagueName}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {game.homeTeamName} vs {game.awayTeamName}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        시작 시간:{' '}
                        <span className="font-mono">{game.startTime}</span>
                      </p>
                      {game.score &&
                        game.score.home != null &&
                        game.score.away != null && (
                          <p className="mt-1 text-xs text-slate-300">
                            스코어: {game.score.home} - {game.score.away}{' '}
                            {game.gameStatus && (
                              <span className="text-[10px] text-slate-400">
                                ({formatStatus(game.gameStatus)})
                              </span>
                            )}
                          </p>
                        )}
                    </div>
                    <div className="mt-auto">
                      {game.primaryPick ? (
                        <div>
                          <div className="flex items-start gap-2 text-[11px] text-sky-100">
                            <span className="rounded-lg bg-sky-900/70 px-2 py-1 whitespace-nowrap">
                              추천 픽
                            </span>
                            <div className="flex-1">
                              <p>
                                {game.primaryPick.market} /{' '}
                                {game.primaryPick.side}{' '}
                                {typeof game.primaryPick.probability ===
                                'number'
                                  ? `(${Math.round(
                                      (game.primaryPick.probability ?? 0) * 100,
                                    )}%)`
                                  : ''}
                              </p>
                              {game.hitStatus &&
                              game.hitStatus !== 'neutral' ? (
                                <p
                                  className={`mt-0.5 text-[10px] ${
                                    game.hitStatus === 'hit'
                                      ? 'text-emerald-300'
                                      : 'text-rose-300'
                                  }`}
                                >
                                  {game.hitStatus === 'hit' ? '적중' : '미적중'}
                                </p>
                              ) : (
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {' '}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[11px] text-slate-500">
                            추천 픽 없음
                          </p>
                          {game.hitStatus && game.hitStatus !== 'neutral' ? (
                            <p
                              className={`mt-0.5 text-[10px] ${
                                game.hitStatus === 'hit'
                                  ? 'text-emerald-300'
                                  : 'text-rose-300'
                              }`}
                            >
                              {game.hitStatus === 'hit' ? '적중' : '미적중'}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {' '}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
