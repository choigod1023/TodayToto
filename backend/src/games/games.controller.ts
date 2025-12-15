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
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  GameDetailAggregateDto,
  PopularGamesResponseDto,
  PopularWithPickResponseDto,
} from './dto/games-docs.dto';

type PopularGameWithPick = PopularGame & {
  primaryPick: unknown;
  hitStatus: 'hit' | 'miss' | 'neutral';
};

type AnalysisResponse = {
  result?: { primaryPick?: unknown };
  hitStatus?: 'hit' | 'miss' | 'neutral';
};

@ApiTags('Games')
@Controller('games')
export class GamesController {
  constructor(
    private readonly gamesService: GamesService,
    @Inject(forwardRef(() => AnalysisService))
    private readonly analysisService: AnalysisService,
  ) {}

  @Get('popular')
  @ApiOperation({
    summary: '인기 경기 목록 (국내 배당 존재 경기만)',
    description:
      '날짜 기준으로 인기 경기 목록을 조회합니다. domestic odds가 없는 경기는 제외됩니다.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'YYYY-MM-DD (KST). 미입력 시 오늘 날짜 기준',
    example: '2025-03-15',
  })
  @ApiOkResponse({ type: PopularGamesResponseDto })
  getPopularGames(@Query('date') date?: string) {
    const { requestedDate, isFuture } = this.resolveDate(date);
    return this.gamesService.fetchPopularGames(requestedDate, isFuture);
  }

  @Get('popular-with-pick')
  @ApiOperation({
    summary: '인기 경기 + Gemini primary pick',
    description:
      '인기 경기 리스트를 반환하고, 기존 분석이 있으면 primaryPick과 적중 상태를 함께 제공합니다.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'YYYY-MM-DD (KST). 미입력 시 오늘 날짜 기준',
    example: '2025-03-15',
  })
  @ApiOkResponse({ type: PopularWithPickResponseDto })
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

    // 먼저 기존 분석 결과를 빠르게 조회 (DB 쿼리만, Gemini 호출 없음)
    const enriched = await Promise.all<PopularGameWithPick>(
      popular.games.map(async (g) => {
        // 미래 날짜라도 정오 이전 킥오프는 미리 분석(스케줄러 선분석과 동일 대상)
        if (isFuture && !isBeforeNoonKst(g.startTime)) {
          return {
            ...g,
            primaryPick: null,
            hitStatus: 'neutral',
          } as PopularGameWithPick;
        }

        try {
          // 기존 분석이 있는지 먼저 확인 (Gemini 호출 없이)
          const analysis = (await this.analysisService.getExistingAnalysis(
            g.gameId,
            (g as { sportsType?: string }).sportsType ??
              (g as { sport?: string }).sport,
            {
              scoreHome: g.score?.home ?? undefined,
              scoreAway: g.score?.away ?? undefined,
              gameStatus: g.gameStatus,
              result: g.result,
            },
          )) as AnalysisResponse | null;

          // 분석 결과가 있으면 반환
          if (
            analysis &&
            analysis.result &&
            typeof analysis.result === 'object' &&
            'primaryPick' in analysis.result &&
            analysis.result.primaryPick
          ) {
            return {
              ...g,
              primaryPick: analysis.result.primaryPick,
              hitStatus:
                (analysis as { hitStatus?: string })?.hitStatus ?? 'neutral',
            } as PopularGameWithPick;
          }

          // 분석 결과가 없으면 null로 설정하고 백그라운드에서 처리 시작
          this.startAnalysisInBackground(g, isFuture, isBeforeNoonKst);

          return {
            ...g,
            primaryPick: null,
            hitStatus: 'neutral',
          } as PopularGameWithPick;
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.warn(
            `[GamesController] popular-with-pick 조회 실패 gameId=${g.gameId}`,
            errMsg,
          );

          // 에러가 나도 백그라운드에서 분석 시도
          this.startAnalysisInBackground(g, isFuture, isBeforeNoonKst);

          return {
            ...g,
            primaryPick: null,
            hitStatus: 'neutral',
          } as PopularGameWithPick;
        }
      }),
    );

    // 경기 리스트를 즉시 반환 (예측 완료 여부와 관계없이)
    return {
      date: popular.date,
      games: enriched,
    };
  }

  /**
   * 백그라운드에서 분석을 시작 (fire and forget)
   */
  private startAnalysisInBackground(
    game: PopularGame,
    isFuture: boolean,
    isBeforeNoonKst: (startTime?: string) => boolean,
  ): void {
    // 미래 날짜이고 정오 이후 킥오프는 분석하지 않음
    if (isFuture && !isBeforeNoonKst(game.startTime)) {
      return;
    }

    // 백그라운드에서 분석 시작 (await 하지 않음)
    this.analysisService
      .getOrCreateAnalysis(
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
      )
      .then(() => {
        console.info(
          `[GamesController] 백그라운드 분석 완료 gameId=${game.gameId}`,
        );
      })
      .catch((error) => {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.warn(
          `[GamesController] 백그라운드 분석 실패 gameId=${game.gameId}`,
          errMsg,
        );
      });
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
  @ApiOperation({
    summary: '경기 상세/기록/커뮤니티/배당 조회',
    description:
      '게임 ID 기준으로 상세 정보, 기록, 커뮤니티 게시글, 배당 정보를 종합 조회합니다.',
  })
  @ApiParam({
    name: 'gameId',
    description: '스포츠 경기 ID',
    example: 101234,
  })
  @ApiQuery({
    name: 'sportsType',
    required: false,
    description: 'soccer, basketball 등. 랭킹/스탯 조회에 활용',
    example: 'soccer',
  })
  @ApiQuery({
    name: 'scoreHome',
    required: false,
    description: '홈팀 점수 override',
    example: '2',
  })
  @ApiQuery({
    name: 'scoreAway',
    required: false,
    description: '원정팀 점수 override',
    example: '1',
  })
  @ApiQuery({
    name: 'gameStatus',
    required: false,
    description: '게임 진행 상태 override',
    example: 'finished',
  })
  @ApiQuery({
    name: 'result',
    required: false,
    description: '승/패/무 결과 override',
    example: 'home',
  })
  @ApiOkResponse({ type: GameDetailAggregateDto })
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
