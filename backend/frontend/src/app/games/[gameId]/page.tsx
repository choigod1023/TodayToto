import Link from 'next/link';
import { GameHeader } from '@/components/games/GameHeader';
import { RawVsRecordItem } from '@/components/games/HeadToHeadPanel';
import { GameScoreStatus } from '@/components/games/GameScoreStatus';
import { GameStatsSection } from '@/components/games/GameStatsSection';
import { GameAnalysisSection } from '@/components/games/GameAnalysisSection';
import { computeHitStatus, formatStatus } from '@/lib/gameHitUtils';
import { pickTopPlayers, PlayerSeasonStatRaw } from '@/lib/playerStats';
import { fetchAnalysis, fetchGameDetail } from '@/lib/gameApi';

interface CommunityPost {
  post_id: number;
  game_id: number;
  title: string;
  content: string;
  likes: number;
  created_at: string;
}

interface GameDetail {
  gameId: number;
  sportsType?: string;
  sport?: string;
  basic: {
    leagueName: string;
    startTime: string;
    homeTeamName: string;
    awayTeamName: string;
  };
  record: {
    headToHead: RawVsRecordItem[];
    homeRecent: RawVsRecordItem[];
    awayRecent: RawVsRecordItem[];
    rank?: unknown;
    seasonStat?: unknown;
    playerSeasonStat?: unknown;
  };
  gameStatus?: string;
  result?: string;
  score?: { home: number | null; away: number | null };
  odds: Record<string, unknown>;
  community: {
    posts: CommunityPost[];
  };
}

interface AnalysisResult {
  _id: string;
  gameId: number;
  result: {
    fullTime1x2?: {
      recommendedSide: string;
      probability: number;
      summary: string;
    };
    overUnder?: {
      recommendedSide: string;
      probability: number;
      summary: string;
    };
    handicap?: {
      recommendedSide: string;
      probability: number;
      summary: string;
    };
    primaryPick?: {
      market: 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP';
      side: string;
      probability: number;
      reason: string;
    };
  };
  hitStatus?: 'hit' | 'miss' | 'neutral';
}

export default async function GameDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams?: Promise<{
    sportsType?: string;
    scoreHome?: string;
    scoreAway?: string;
    gameStatus?: string;
    result?: string;
  }>;
}) {
  const { gameId } = await params;
  const sp = await searchParams;
  const sportsType = sp?.sportsType;

  const game = await fetchGameDetail<GameDetail>(gameId, {
    sportsType,
    scoreHome: sp?.scoreHome,
    scoreAway: sp?.scoreAway,
    gameStatus: sp?.gameStatus,
    result: sp?.result,
  });
  const analysis = await fetchAnalysis<AnalysisResult>(gameId, {
    sportsType: sportsType ?? game.sportsType,
    scoreHome: game.score?.home,
    scoreAway: game.score?.away,
    gameStatus: game.gameStatus,
  });

  const scoreFromQuery =
    sp &&
    sp.scoreHome !== undefined &&
    sp.scoreAway !== undefined &&
    !Number.isNaN(Number(sp.scoreHome)) &&
    !Number.isNaN(Number(sp.scoreAway))
      ? {
          home: Number(sp.scoreHome),
          away: Number(sp.scoreAway),
        }
      : undefined;

  const score = game.score ?? scoreFromQuery;
  const gameStatus = game.gameStatus ?? sp?.gameStatus;

  const primary = analysis.result.primaryPick;

  const rankData = game.record.rank as
    | Array<{
        rankings?: Array<{
          teamName?: string;
          ranking?: number;
          winCount?: number;
          lossCount?: number;
          winPercentage?: string;
        }>;
      }>
    | undefined;

  const seasonStat = game.record.seasonStat as
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

  const hasRank = Boolean(
    Array.isArray(rankData) &&
    rankData.some((r) => Array.isArray(r.rankings) && r.rankings.length > 0),
  );
  const hasSeasonStat = Boolean(
    seasonStat &&
    (seasonStat.home || seasonStat.away) &&
    (seasonStat.home?.winPercentage || seasonStat.away?.winPercentage),
  );

  const playerSeasonStat = game.record.playerSeasonStat as
    | {
        home?: { additionalTeamData?: PlayerSeasonStatRaw[] };
        away?: { additionalTeamData?: PlayerSeasonStatRaw[] };
      }
    | undefined;

  const homePlayers = pickTopPlayers(
    playerSeasonStat?.home?.additionalTeamData,
  );
  const awayPlayers = pickTopPlayers(
    playerSeasonStat?.away?.additionalTeamData,
  );
  const hasPlayerSeason = homePlayers.length > 0 || awayPlayers.length > 0;

  const hitStatus = computeHitStatus(primary, score, gameStatus);
  const primaryHit = analysis.hitStatus ?? hitStatus;

  const hitFullTime =
    gameStatus === 'FINAL' && analysis.result.fullTime1x2
      ? primaryHit
      : 'neutral';
  const hitOverUnder =
    gameStatus === 'FINAL' && analysis.result.overUnder
      ? primaryHit
      : 'neutral';
  const hitHandicap =
    gameStatus === 'FINAL' && analysis.result.handicap ? primaryHit : 'neutral';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <GameHeader
              leagueName={game.basic.leagueName}
              gameId={game.gameId}
              homeTeamName={game.basic.homeTeamName}
              awayTeamName={game.basic.awayTeamName}
              startTime={game.basic.startTime}
            />
            {score && score.home !== null && score.away !== null && (
              <GameScoreStatus
                score={score}
                statusLabel={formatStatus(gameStatus)}
              />
            )}
          </div>
          <Link
            href="/games"
            className="text-xs text-slate-400 underline-offset-4 hover:underline"
          >
            목록으로
          </Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr,1.3fr]">
          <GameStatsSection
            odds={game.odds}
            headToHead={game.record.headToHead}
            homeRecent={game.record.homeRecent}
            awayRecent={game.record.awayRecent}
            hasRank={hasRank}
            hasSeasonStat={hasSeasonStat}
            hasPlayerSeason={hasPlayerSeason}
            rankData={rankData}
            seasonStat={seasonStat}
            playerSeasonStat={playerSeasonStat}
          />

          <div className="space-y-4">
            <GameAnalysisSection
              primary={primary ?? null}
              fullTime1x2={analysis.result.fullTime1x2 ?? null}
              overUnder={analysis.result.overUnder ?? null}
              handicap={analysis.result.handicap ?? null}
              primaryHit={primaryHit}
              hitFullTime={hitFullTime}
              hitOverUnder={hitOverUnder}
              hitHandicap={hitHandicap}
            />

            <p className="mt-4 text-[10px] text-slate-500">
              이 페이지는 서버 컴포넌트에서 백엔드 Nest API를 직접 호출해
              데이터를 불러오고, 첫 진입 시 Gemini 분석까지 함께 수행합니다.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
