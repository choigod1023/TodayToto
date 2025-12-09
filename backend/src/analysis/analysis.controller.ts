import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';

interface AnalysisRequestBody {
  markets?: {
    fullTime1x2?: boolean;
    overUnder?: boolean;
    handicap?: boolean;
  };
}

@Controller('games')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post(':gameId/analysis')
  analyzeGame(
    @Param('gameId', ParseIntPipe) gameId: number,
    @Query('refresh') refresh?: string,
    @Query('sportsType') sportsType?: string,
    @Query('scoreHome') scoreHome?: string,
    @Query('scoreAway') scoreAway?: string,
    @Query('gameStatus') gameStatus?: string,
    @Body() body?: AnalysisRequestBody,
  ): Promise<unknown> {
    const markets = body?.markets ?? {
      fullTime1x2: true,
      overUnder: true,
      handicap: true,
    };
    const refreshFlag = refresh === 'true';
    return this.analysisService.getOrCreateAnalysis(
      gameId,
      markets,
      refreshFlag,
      sportsType,
      {
        scoreHome: scoreHome !== undefined ? Number(scoreHome) : undefined,
        scoreAway: scoreAway !== undefined ? Number(scoreAway) : undefined,
        gameStatus: gameStatus ?? undefined,
      },
    );
  }
}
