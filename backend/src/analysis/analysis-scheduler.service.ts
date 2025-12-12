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
    // 서버 기동 시 당일 경기 분석 + 익일 정오 이전 경기 선분석
    await this.runToday('startup');
    await this.runTomorrowMorning();
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

  private getTodayKst(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 10); // YYYY-MM-DD
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

    const isBeforeNoonKst = (startTime?: string): boolean => {
      if (!startTime) return false;
      const date = new Date(startTime);
      if (Number.isNaN(date.getTime())) return false;
      // 일부 소스는 UTC, 일부는 KST로 들어올 수 있어 두 기준 모두 확인
      const localHour = date.getHours();
      const kstHour = new Date(date.getTime() + 9 * 60 * 60 * 1000).getHours();
      return localHour < 12 || kstHour < 12;
    };

    try {
      const { games } = await this.gamesService.fetchPopularGames(
        targetDate,
        true, // tomorrowFlag = true
      );

      const morningGames = games.filter((g) => isBeforeNoonKst(g.startTime));

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
}
