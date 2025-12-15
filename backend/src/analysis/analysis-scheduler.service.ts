import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AnalysisService } from './analysis.service';
import { GamesService } from '../games/games.service';

type Trigger = 'startup' | 'midnight' | 'everySixHours';

@Injectable()
export class AnalysisSchedulerService implements OnModuleInit {
  constructor(
    private readonly gamesService: GamesService,
    private readonly analysisService: AnalysisService,
  ) {}

  async onModuleInit() {
    // 서버 기동 시 분석은 제거 (서버 시작 지연 방지)
    // 필요시 백그라운드에서 처리하거나 스케줄러에 의존
    // await this.runToday('startup');
    // await this.runTomorrowMorning();
    console.log('[AnalysisScheduler] 서버 시작 완료 (초기 분석 스킵)');
  }

  @Cron('0 0 * * *', {
    timeZone: 'Asia/Seoul',
  })
  async handleMidnight() {
    await this.runToday('midnight');
  }

  // 6시간 단위로 당일 경기 미예측분 재확인 (00, 06, 12, 18 KST)
  @Cron('0 */6 * * *', {
    timeZone: 'Asia/Seoul',
  })
  async handleEverySixHours() {
    await this.runToday('everySixHours');
  }

  // 자정 직후 경기를 대비해 전날 저녁 18시(KST)에 다음 날 12시 이전 경기만 선분석
  @Cron('0 18 * * *', {
    timeZone: 'Asia/Seoul',
  })
  async handleEarlyTomorrow() {
    await this.runTomorrowMorning();
  }

  // 5분마다 primaryPick이 비어있는 경기 감시 및 백그라운드 예측
  @Cron('*/5 * * * *', {
    timeZone: 'Asia/Seoul',
  })
  async handleEveryFiveMinutes() {
    await this.runMissingPrimaryPicks();
  }

  private getTodayKst(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private isBeforeNoonKst(startTime?: string): boolean {
    if (!startTime) return false;
    const date = new Date(startTime);
    if (Number.isNaN(date.getTime())) return false;
    const localHour = date.getHours();
    const kstHour = new Date(date.getTime() + 9 * 60 * 60 * 1000).getHours();
    return localHour < 12 || kstHour < 12;
  }

  private async runToday(trigger: Trigger) {
    const date = this.getTodayKst();
    try {
      // 내일 경기는 미리 예측하지 않고, 당일 경기만 처리
      const { games } = await this.gamesService.fetchPopularGames(
        date,
        false, // tomorrowFlag = false
      );

      for (const game of games) {
        try {
          await this.analysisService.getOrCreateAnalysis(
            game.gameId,
            {
              fullTime1x2: true,
              overUnder: true,
              handicap: true,
            },
            false, // refresh = false -> 이미 있으면 캐시 사용
            (game as { sportsType?: string }).sportsType ??
              (game as { sport?: string }).sport,
          );
        } catch (error) {
          console.warn(
            `[AnalysisScheduler] 분석 실패 gameId=${game.gameId} trigger=${trigger}`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      console.log(
        `[AnalysisScheduler] 완료 trigger=${trigger} date=${date} processed=${games.length}`,
      );
    } catch (error) {
      console.error(
        `[AnalysisScheduler] 실행 실패 trigger=${trigger} date=${date}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 다음 날 12시(KST) 이전 시작 경기만 전날 저녁에 선분석
   */
  private async runTomorrowMorning() {
    const now = new Date();
    const tomorrowKst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    tomorrowKst.setDate(tomorrowKst.getDate() + 1);
    const targetDate = tomorrowKst.toISOString().slice(0, 10);

    try {
      const { games } = await this.gamesService.fetchPopularGames(
        targetDate,
        true, // tomorrowFlag = true
      );

      const morningGames = games.filter((g) =>
        this.isBeforeNoonKst(g.startTime),
      );

      for (const game of morningGames) {
        try {
          await this.analysisService.getOrCreateAnalysis(
            game.gameId,
            {
              fullTime1x2: true,
              overUnder: true,
              handicap: true,
            },
            false,
            (game as { sportsType?: string }).sportsType ??
              (game as { sport?: string }).sport,
          );
        } catch (error) {
          console.warn(
            `[AnalysisScheduler] 내일 오전 경기 선분석 실패 gameId=${game.gameId}`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      console.info(
        `[AnalysisScheduler] precompute tomorrow-morning done date=${targetDate} processed=${morningGames.length}`,
      );
    } catch (error) {
      console.error(
        `[AnalysisScheduler] precompute tomorrow-morning failed date=${targetDate} msg=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * primaryPick이 비어있는 경기만 백그라운드 예측
   * - 오늘 경기 전체
   * - 내일 정오 이전 경기
   */
  private async runMissingPrimaryPicks() {
    const today = this.getTodayKst();

    // 오늘 경기
    try {
      const { games } = await this.gamesService.fetchPopularGames(today, false);
      await this.processMissing(games, false);
    } catch (error) {
      console.error(
        `[AnalysisScheduler] 오늘 경기 감시 실패 date=${today}`,
        error instanceof Error ? error.message : String(error),
      );
    }

    // 내일 정오 이전 경기
    try {
      const now = new Date();
      const tomorrowKst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      tomorrowKst.setDate(tomorrowKst.getDate() + 1);
      const targetDate = tomorrowKst.toISOString().slice(0, 10);

      const { games } = await this.gamesService.fetchPopularGames(
        targetDate,
        true,
      );
      const morningGames = games.filter((g) =>
        this.isBeforeNoonKst(g.startTime),
      );
      await this.processMissing(morningGames, true);
    } catch (error) {
      console.error(
        `[AnalysisScheduler] 내일 오전 경기 감시 실패`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async processMissing(
    games: {
      gameId: number;
      startTime?: string;
      score?: any;
      gameStatus?: string;
      result?: string;
      sportsType?: string;
      sport?: string;
    }[],
    isFuture: boolean,
  ) {
    for (const game of games) {
      // 미래 경기이고 정오 이후면 스킵
      if (isFuture && !this.isBeforeNoonKst(game.startTime)) {
        continue;
      }

      try {
        const existing = await this.analysisService.getExistingAnalysis(
          game.gameId,
          (game as { sportsType?: string }).sportsType ??
            (game as { sport?: string }).sport,
          {
            scoreHome: game.score?.home ?? undefined,
            scoreAway: game.score?.away ?? undefined,
            gameStatus: game.gameStatus,
            result: game.result,
          },
        );

        const hasPrimary =
          existing &&
          existing.result &&
          typeof existing.result === 'object' &&
          (existing.result as { primaryPick?: unknown }).primaryPick;

        if (hasPrimary) {
          continue;
        }

        // 추천 픽이 없으면 예측 실행
        await this.analysisService.getOrCreateAnalysis(
          game.gameId,
          {
            fullTime1x2: true,
            overUnder: true,
            handicap: true,
          },
          false,
          (game as { sportsType?: string }).sportsType ??
            (game as { sport?: string }).sport,
          {
            scoreHome: game.score?.home ?? undefined,
            scoreAway: game.score?.away ?? undefined,
            gameStatus: game.gameStatus,
            result: game.result,
          },
        );
      } catch (error) {
        console.warn(
          `[AnalysisScheduler] missing primaryPick 처리 실패 gameId=${game.gameId}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }
}
