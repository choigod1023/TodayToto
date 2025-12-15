import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AnalysisRequestDto,
  AnalysisResponseDto,
} from '../games/dto/games-docs.dto';

@ApiTags('Analysis')
@Controller('games')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post(':gameId/analysis')
  @ApiOperation({
    summary: 'Gemini 분석 생성/조회',
    description:
      '이미 분석된 적 있으면 캐시된 결과를, 없거나 refresh=true이면 새로 분석합니다.',
  })
  @ApiParam({
    name: 'gameId',
    description: '스포츠 경기 ID',
    example: 101234,
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    description: 'true 면 기존 결과 무시하고 재분석',
    example: 'false',
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
  @ApiBody({
    required: false,
    type: AnalysisRequestDto,
    description: '시장별 예측 여부. 생략 시 전부 true',
  })
  @ApiOkResponse({ type: AnalysisResponseDto })
  analyzeGame(
    @Param('gameId', ParseIntPipe) gameId: number,
    @Query('refresh') refresh?: string,
    @Query('sportsType') sportsType?: string,
    @Query('scoreHome') scoreHome?: string,
    @Query('scoreAway') scoreAway?: string,
    @Query('gameStatus') gameStatus?: string,
    @Body() body?: AnalysisRequestDto,
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
