import {
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Query,
  forwardRef,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { AnalysisService } from '../analysis/analysis.service';
import { PopularGame } from './games.types';

type PopularGameWithPick = PopularGame & {
  primaryPick: unknown;
  hitStatus: 'hit' | 'miss' | 'neutral';
};

type AnalysisResponse = {
  result?: { primaryPick?: unknown };
  hitStatus?: 'hit' | 'miss' | 'neutral';
};

@Controller('games')
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    @Inject(forwardRef(() => AnalysisService))
    private readonly analysisService: AnalysisService,
  ) {}

  @Get('popular')
  getPopularGames(@Query('date') date?: string) {
    const { requestedDate, isFuture } = this.resolveDate(date);
    return this.gamesService.fetchPopularGames(requestedDate, isFuture);
  }

  @Get('popular-with-pick')
  async getPopularWithPick(@Query('date') date?: string) {
    const { requestedDate, isFuture } = this.resolveDate(date);
    const popular = await this.gamesService.fetchPopularGames(
      requestedDate,
      isFuture,
    );

    const isBeforeNoonKst = (startTime?: string): boolean => {
      if (!startTime) return false;
      const dt = new Date(startTime);
      if (Number.isNaN(dt.getTime())) return false;
      const localHour = dt.getHours();
      const kstHour = new Date(dt.getTime() + 9 * 60 * 60 * 1000).getHours();
      return localHour <= 12 || kstHour <= 12;
    };

    console.info(
      `[GamesController] popular-with-pick start date=${popular.date} total=${popular.games.length} isFuture=${isFuture}`,
    );

    const enriched = await Promise.all<PopularGameWithPick>(
      popular.games.map(async (g, idx) => {
        const step = `${idx + 1}/${popular.games.length}`;
        console.info(
          `[GamesController] popular-with-pick progress=${step} gameId=${g.gameId} start=${g.startTime}`,
        );

        // 미래 날짜라도 정오 이전 킥오프는 미리 분석(스케줄러 선분석과 동일 대상)
        if (isFuture && !isBeforeNoonKst(g.startTime)) {
          return {
            ...g,
            primaryPick: null,
            hitStatus: 'neutral',
          } as PopularGameWithPick;
        }

        try {
          const analysis = (await this.analysisService.getOrCreateAnalysis(
            g.gameId,
            {
              fullTime1x2: true,
              overUnder: true,
              handicap: true,
            },
            false,
            (g as { sportsType?: string }).sportsType ??
              (g as { sport?: string }).sport,
            {
              scoreHome: g.score?.home ?? undefined,
              scoreAway: g.score?.away ?? undefined,
              gameStatus: g.gameStatus,
              result: g.result,
            },
          )) as AnalysisResponse;

          console.info(
            `[GamesController] popular-with-pick done gameId=${g.gameId} hitStatus=${(analysis as { hitStatus?: string })?.hitStatus ?? 'neutral'}`,
          );

          return {
            ...g,
            primaryPick: analysis?.result?.primaryPick ?? null,
            hitStatus:
              (analysis as { hitStatus?: string })?.hitStatus ?? 'neutral',
          } as PopularGameWithPick;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.warn(
            `[GamesController] popular-with-pick 분석 실패 gameId=${g.gameId}`,
            errMsg,
          );
          return {
            ...g,
            primaryPick: null,
            hitStatus: 'neutral',
          } as PopularGameWithPick;
        }
      }),
    );

    if (isFuture) {
      // 미래 날짜: 분석 여부와 무관하게 전체 리스트 반환
      return {
        date: popular.date,
        games: enriched,
      };
    }

    // 오늘 경기: 분석 실패한 항목(primaryPick null)은 제외
    return {
      date: popular.date,
      games: enriched.filter((g) => g.primaryPick !== null),
    };
  }

  /**
   * 날짜 파라미터가 없으면 오늘(KST), 오늘보다 미래면 isFuture=true
   */
  private resolveDate(date?: string): {
    requestedDate: string;
    isFuture: boolean;
  } {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = kst.toISOString().slice(0, 10);

    const reqStr = date && date.trim().length > 0 ? date : todayStr;
    const req = new Date(reqStr);
    const isFuture =
      !Number.isNaN(req.getTime()) && req.toISOString().slice(0, 10) > todayStr;

    return { requestedDate: reqStr, isFuture };
  }

  @Get(':gameId')
  getGameDetail(
    @Param('gameId', ParseIntPipe) gameId: number,
    @Query('sportsType') sportsType?: string,
    @Query('scoreHome') scoreHome?: string,
    @Query('scoreAway') scoreAway?: string,
    @Query('gameStatus') gameStatus?: string,
    @Query('result') result?: string,
  ) {
    return this.gamesService.getGameDetailAggregate(gameId, sportsType, {
      scoreHome: scoreHome !== undefined ? Number(scoreHome) : undefined,
      scoreAway: scoreAway !== undefined ? Number(scoreAway) : undefined,
      gameStatus: gameStatus ?? undefined,
      result: result ?? undefined,
    });
  }
}
