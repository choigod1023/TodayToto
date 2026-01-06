import { GameDetailAggregate } from '../games/games.types';

interface CalculatedStats {
  homeRecentAvgGoals: number;
  homeRecentAvgConceded: number;
  homeRecentWinRate: number;
  homeRecentOverRate: number;
  awayRecentAvgGoals: number;
  awayRecentAvgConceded: number;
  awayRecentWinRate: number;
  awayRecentOverRate: number;
  combinedAvgGoals: number;
  combinedAvgConceded: number;
}

/**
 * 최근 경기 기록에서 득점/실점 추출
 */
function extractScore(
  game: unknown,
  isHome: boolean,
): { goals: number; conceded: number } | null {
  if (!game || typeof game !== 'object') return null;

  const gameObj = game as Record<string, unknown>;

  // 다양한 필드명 시도
  const homeScore =
    (gameObj.home?.score as number | undefined) ??
    (gameObj.homeScore as number | undefined) ??
    (gameObj.score?.home as number | undefined) ??
    (gameObj.home_score as number | undefined) ??
    null;

  const awayScore =
    (gameObj.away?.score as number | undefined) ??
    (gameObj.awayScore as number | undefined) ??
    (gameObj.score?.away as number | undefined) ??
    (gameObj.away_score as number | undefined) ??
    null;

  // periodData에서 합산
  if (homeScore === null || awayScore === null) {
    const homePeriods = (gameObj.home as { periodData?: { score?: number }[] } | undefined)
      ?.periodData;
    const awayPeriods = (gameObj.away as { periodData?: { score?: number }[] } | undefined)
      ?.periodData;

    if (Array.isArray(homePeriods) && Array.isArray(awayPeriods)) {
      const homeSum = homePeriods.reduce(
        (acc, p) => acc + (typeof p?.score === 'number' ? p.score : 0),
        0,
      );
      const awaySum = awayPeriods.reduce(
        (acc, p) => acc + (typeof p?.score === 'number' ? p.score : 0),
        0,
      );
      if (homeSum > 0 || awaySum > 0) {
        return {
          goals: isHome ? homeSum : awaySum,
          conceded: isHome ? awaySum : homeSum,
        };
      }
    }
  }

  if (homeScore !== null && awayScore !== null) {
    return {
      goals: isHome ? homeScore : awayScore,
      conceded: isHome ? awayScore : homeScore,
    };
  }

  return null;
}

/**
 * 최근 N경기 통계 계산
 */
function calculateRecentStats(
  recentGames: unknown[],
  isHome: boolean,
  overUnderLine?: number,
): {
  avgGoals: number;
  avgConceded: number;
  winRate: number;
  overRate: number;
} {
  if (!Array.isArray(recentGames) || recentGames.length === 0) {
    return { avgGoals: 0, avgConceded: 0, winRate: 0, overRate: 0 };
  }

  const validGames = recentGames
    .slice(0, 5) // 최근 5경기만
    .map((g) => extractScore(g, isHome))
    .filter((s): s is { goals: number; conceded: number } => s !== null);

  if (validGames.length === 0) {
    return { avgGoals: 0, avgConceded: 0, winRate: 0, overRate: 0 };
  }

  const totalGoals = validGames.reduce((sum, g) => sum + g.goals, 0);
  const totalConceded = validGames.reduce((sum, g) => sum + g.conceded, 0);
  const wins = validGames.filter((g) => g.goals > g.conceded).length;
  const overs = overUnderLine
    ? validGames.filter((g) => g.goals + g.conceded > overUnderLine).length
    : 0;

  return {
    avgGoals: totalGoals / validGames.length,
    avgConceded: totalConceded / validGames.length,
    winRate: wins / validGames.length,
    overRate: overUnderLine ? overs / validGames.length : 0,
  };
}

/**
 * 배당에서 암묵확률 계산
 */
function calculateImpliedProbability(odds: number): number {
  if (!Number.isFinite(odds) || odds <= 0) return 0;
  return 1 / odds;
}

/**
 * 배당 스냅샷에서 암묵확률 추출
 */
function extractImpliedProbabilities(oddsSnapshot: unknown): {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
  over?: number;
  under?: number;
} {
  if (!oddsSnapshot || typeof oddsSnapshot !== 'object') {
    return {};
  }

  const snap = oddsSnapshot as Record<string, unknown>;
  const result: {
    homeWin?: number;
    draw?: number;
    awayWin?: number;
    over?: number;
    under?: number;
  } = {};

  // 승무패 배당
  const winLoseOdds = snap.domesticWinLoseOdds as
    | Array<{
        type?: string;
        odds?: unknown;
        latestFlag?: boolean;
        availableFlag?: boolean;
      }>
    | undefined;

  if (Array.isArray(winLoseOdds)) {
    for (const item of winLoseOdds) {
      if (
        !item ||
        (item.latestFlag !== true && item.availableFlag !== true)
      ) {
        continue;
      }
      const odds = Number(item.odds);
      if (!Number.isFinite(odds) || odds <= 0) continue;

      const type = String(item.type || '').toUpperCase();
      if (type === 'WIN') {
        result.homeWin = calculateImpliedProbability(odds);
      } else if (type === 'DRAW') {
        result.draw = calculateImpliedProbability(odds);
      } else if (type === 'LOSS') {
        result.awayWin = calculateImpliedProbability(odds);
      }
    }
  }

  // 오버언더 배당 (2.5 기준선 찾기)
  const underOverOdds = snap.domesticUnderOverOdds as
    | Array<{
        type?: string;
        optionValue?: unknown;
        odds?: unknown;
        latestFlag?: boolean;
        availableFlag?: boolean;
      }>
    | undefined;

  if (Array.isArray(underOverOdds)) {
    const targetLine = 2.5;
    for (const item of underOverOdds) {
      if (
        !item ||
        (item.latestFlag !== true && item.availableFlag !== true)
      ) {
        continue;
      }
      const optionValue = Number(item.optionValue);
      if (Math.abs(optionValue - targetLine) > 0.1) continue;

      const odds = Number(item.odds);
      if (!Number.isFinite(odds) || odds <= 0) continue;

      const type = String(item.type || '').toUpperCase();
      if (type === 'OVER') {
        result.over = calculateImpliedProbability(odds);
      } else if (type === 'UNDER') {
        result.under = calculateImpliedProbability(odds);
      }
    }
  }

  return result;
}

/**
 * 게임 데이터에서 통계 계산
 */
export function calculateGameStats(
  game: GameDetailAggregate,
  oddsSnapshot?: unknown,
): CalculatedStats {
  const homeRecent = Array.isArray(game.record.homeRecent)
    ? game.record.homeRecent
    : [];
  const awayRecent = Array.isArray(game.record.awayRecent)
    ? game.record.awayRecent
    : [];

  // 오버언더 기준선 찾기 (기본 2.5)
  let overUnderLine = 2.5;
  if (oddsSnapshot && typeof oddsSnapshot === 'object') {
    const snap = oddsSnapshot as { domesticUnderOverOdds?: unknown };
    const underOverOdds = snap.domesticUnderOverOdds as
      | Array<{ optionValue?: unknown }>
      | undefined;
    if (Array.isArray(underOverOdds) && underOverOdds.length > 0) {
      const firstLine = Number(underOverOdds[0]?.optionValue);
      if (Number.isFinite(firstLine)) {
        overUnderLine = firstLine;
      }
    }
  }

  const homeStats = calculateRecentStats(homeRecent, true, overUnderLine);
  const awayStats = calculateRecentStats(awayRecent, false, overUnderLine);

  return {
    homeRecentAvgGoals: homeStats.avgGoals,
    homeRecentAvgConceded: homeStats.avgConceded,
    homeRecentWinRate: homeStats.winRate,
    homeRecentOverRate: homeStats.overRate,
    awayRecentAvgGoals: awayStats.avgGoals,
    awayRecentAvgConceded: awayStats.avgConceded,
    awayRecentWinRate: awayStats.winRate,
    awayRecentOverRate: awayStats.overRate,
    combinedAvgGoals: homeStats.avgGoals + awayStats.avgGoals,
    combinedAvgConceded: homeStats.avgConceded + awayStats.avgConceded,
  };
}

/**
 * 배당 기반 암묵확률 추출
 */
export function extractOddsImpliedProbabilities(
  oddsSnapshot?: unknown,
): ReturnType<typeof extractImpliedProbabilities> {
  if (!oddsSnapshot) return {};
  return extractImpliedProbabilities(oddsSnapshot);
}

