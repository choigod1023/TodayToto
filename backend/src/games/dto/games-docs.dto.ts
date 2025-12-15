import { ApiProperty } from '@nestjs/swagger';

export class ScoreDto {
  @ApiProperty({ example: 2, nullable: true })
  home: number | null;

  @ApiProperty({ example: 1, nullable: true })
  away: number | null;
}

export class PopularGameDto {
  @ApiProperty({ example: 101234 })
  gameId: number;

  @ApiProperty({ example: 'soccer' })
  sport: string;

  @ApiProperty({ example: 'Premier League' })
  leagueName: string;

  @ApiProperty({
    example: '2025-03-15T12:00:00Z',
    description: 'UTC ISO 문자열',
  })
  startTime: string;

  @ApiProperty({ example: 'Arsenal FC' })
  homeTeamName: string;

  @ApiProperty({ example: 'Chelsea FC' })
  awayTeamName: string;

  @ApiProperty({
    example: 'in_progress',
    required: false,
    description: '진행 상태 (있을 때만 전달)',
  })
  gameStatus?: string;

  @ApiProperty({
    example: 'home',
    required: false,
    description: '승부 결과 (있을 때만 전달)',
  })
  result?: string;

  @ApiProperty({
    required: false,
    type: ScoreDto,
    description: '주요 피리어드 점수를 합산한 스코어',
  })
  score?: ScoreDto;
}

export class PopularGamesResponseDto {
  @ApiProperty({ example: '2025-03-15', description: '화면에 노출할 기준 날짜(KST)' })
  date: string;

  @ApiProperty({ type: [PopularGameDto] })
  games: PopularGameDto[];
}

export class PopularGameWithPickDto extends PopularGameDto {
  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    description: 'Gemini 결과에서 추출한 primaryPick (없으면 null)',
  })
  primaryPick: Record<string, unknown> | null;

  @ApiProperty({
    enum: ['hit', 'miss', 'neutral'],
    example: 'neutral',
    description: 'primaryPick 적중 상태',
  })
  hitStatus: 'hit' | 'miss' | 'neutral';
}

export class PopularWithPickResponseDto {
  @ApiProperty({ example: '2025-03-15' })
  date: string;

  @ApiProperty({ type: [PopularGameWithPickDto] })
  games: PopularGameWithPickDto[];
}

export class CommunityPostDto {
  @ApiProperty({ example: 123 })
  post_id: number;

  @ApiProperty({ example: 101234 })
  game_id: number;

  @ApiProperty({ example: '경기 분석 요약' })
  title: string;

  @ApiProperty({ example: '주요 이슈와 배당 변화에 대한 정리' })
  content: string;

  @ApiProperty({ example: 42 })
  likes: number;

  @ApiProperty({ example: '2025-03-15T09:00:00Z' })
  created_at: string;
}

export class GameBasicDto {
  @ApiProperty({ example: 'Premier League' })
  leagueName: string;

  @ApiProperty({ example: '2025-03-15T12:00:00Z' })
  startTime: string;

  @ApiProperty({ example: 'Arsenal FC' })
  homeTeamName: string;

  @ApiProperty({ example: 'Chelsea FC' })
  awayTeamName: string;
}

export class GameRecordDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: '맞대결 기록 (외부 API 원본 구조 유지)',
  })
  headToHead: Record<string, unknown>[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: '홈 팀 최근 경기 (외부 API 원본 구조 유지)',
  })
  homeRecent: Record<string, unknown>[];

  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description: '원정 팀 최근 경기 (외부 API 원본 구조 유지)',
  })
  awayRecent: Record<string, unknown>[];

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    required: false,
    description: '스포츠 타입별 랭킹 정보 (soccer에서만 존재)',
  })
  rank?: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    required: false,
    description: '시즌 팀 스탯 (basketball에서만 존재)',
  })
  seasonStat?: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    required: false,
    description: '시즌 선수 스탯 (basketball에서만 존재)',
  })
  playerSeasonStat?: Record<string, unknown>;
}

export class CommunityDto {
  @ApiProperty({ type: [CommunityPostDto] })
  posts: CommunityPostDto[];
}

export class GameDetailAggregateDto {
  @ApiProperty({ example: 101234 })
  gameId: number;

  @ApiProperty({ example: 'soccer', required: false })
  sportsType?: string;

  @ApiProperty({ type: GameBasicDto })
  basic: GameBasicDto;

  @ApiProperty({ type: GameRecordDto })
  record: GameRecordDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'odds 필드 원본을 그대로 전달',
  })
  odds: Record<string, unknown>;

  @ApiProperty({
    required: false,
    description: '게임 상태 (override 파라미터로 전달될 수 있음)',
  })
  gameStatus?: string;

  @ApiProperty({
    required: false,
    description: '경기 결과 (override 파라미터로 전달될 수 있음)',
  })
  result?: string;

  @ApiProperty({
    required: false,
    type: ScoreDto,
    description: 'override된 스코어가 있을 때만 포함',
  })
  score?: ScoreDto;

  @ApiProperty({ type: CommunityDto, description: '커뮤니티 게시글 모음' })
  community: CommunityDto;
}

export class AnalysisMarketsDto {
  @ApiProperty({ example: true, default: true })
  fullTime1x2?: boolean;

  @ApiProperty({ example: true, default: true })
  overUnder?: boolean;

  @ApiProperty({ example: true, default: true })
  handicap?: boolean;
}

export class AnalysisRequestDto {
  @ApiProperty({
    required: false,
    type: AnalysisMarketsDto,
    description: '요청하지 않으면 전부 true로 처리',
  })
  markets?: AnalysisMarketsDto;
}

export class AnalysisResponseDto {
  @ApiProperty({ example: '676a9f4d3b03d2b4c2b2c111', required: false })
  _id?: string;

  @ApiProperty({ example: 101234 })
  gameId: number;

  @ApiProperty({ type: AnalysisMarketsDto })
  markets: AnalysisMarketsDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: '생성 시점의 배당 스냅샷',
  })
  oddsSnapshot: Record<string, unknown>;

  @ApiProperty({
    example: '4c0dc671df6a9f7a34397b4f3c3c1e21',
    description: 'oddsSnapshot 기반 해시',
  })
  oddsHash: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Gemini 결과를 ensurePrimaryPick으로 정제한 값',
  })
  result: Record<string, unknown>;

  @ApiProperty({ example: 2 })
  version: number;

  @ApiProperty({
    enum: ['hit', 'miss', 'neutral'],
    example: 'neutral',
    required: false,
    description: 'primaryPick 적중 여부',
  })
  hitStatus?: 'hit' | 'miss' | 'neutral';

  @ApiProperty({ example: '2025-03-15T09:00:00.000Z', required: false })
  createdAt?: string;

  @ApiProperty({ example: '2025-03-15T09:00:00.000Z', required: false })
  updatedAt?: string;
}

