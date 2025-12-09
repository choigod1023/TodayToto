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
  getPopularGames(
    @Query('date') date: string,
    @Query('tomorrowFlag') tomorrowFlag?: string,
  ) {
    const flag = tomorrowFlag === 'true';
    return this.gamesService.fetchPopularGames(date, flag);
  }

  @Get('popular-with-pick')
  async getPopularWithPick(
    @Query('date') date: string,
    @Query('tomorrowFlag') tomorrowFlag?: string,
  ) {
    const flag = tomorrowFlag === 'true';
    const popular = await this.gamesService.fetchPopularGames(date, flag);

    console.log(
      `[GamesController] popular-with-pick 분석 시작 (총 ${popular.games.length}경기)`,
    );

    const enriched = await Promise.all<PopularGameWithPick>(
      popular.games.map(async (g, idx) => {
        const step = `${idx + 1}/${popular.games.length}`;
        console.log(
          `[GamesController] popular-with-pick 분석 중 ${step} gameId=${g.gameId}`,
        );
        try {
          const analysis = (await this.analysisService.getOrCreateAnalysis(
            g.gameId,
            {
              fullTime1x2: true,
              overUnder: true,
              handicap: true,
            },
            false,
            undefined,
            {
              scoreHome: g.score?.home ?? undefined,
              scoreAway: g.score?.away ?? undefined,
              gameStatus: g.gameStatus,
              result: g.result,
            },
          )) as AnalysisResponse;

          console.log(
            `[GamesController] popular-with-pick 분석 완료 ${step} gameId=${g.gameId}`,
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

    return {
      date: popular.date,
      games: enriched.filter((g) => g.primaryPick !== null),
    };
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
