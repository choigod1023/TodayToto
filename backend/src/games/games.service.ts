import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  CommunityBoardApiResponse,
  GameDetailAggregate,
  GameRecordApiResponse,
  PopularGame,
  PopularGamesApiResponse,
  PopularGameApiItem,
} from './games.types';

@Injectable()
export class GamesService {
  private readonly sportsApiBase =
    process.env.SPORTS_API_BASE || 'https://sports-api.named.net/v1.0';

  private readonly challengerApiBase =
    process.env.CHALLENGER_API_BASE ||
    'https://challenger-api.named.net/community';

  private readonly axiosConfig = {
    timeout: 30000, // 30초 타임아웃
    headers: {
      'User-Agent': 'sportstoto-backend/1.0',
    },
  };

  /**
   * 네트워크 에러 발생 시 재시도하는 axios 요청 헬퍼
   */
  private async axiosWithRetry<T>(
    requestFn: () => Promise<{ data: T }>,
    maxRetries = 3,
    retryDelay = 1000,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await requestFn();
        return response.data;
      } catch (error: unknown) {
        const typedError = error as {
          code?: string;
          message?: string;
          response?: { status?: number };
        };

        lastError =
          error instanceof Error
            ? error
            : new Error(typedError?.message ?? 'unknown error');

        const code =
          typeof typedError.code === 'string' ? typedError.code : undefined;
        const message =
          typeof typedError.message === 'string' ? typedError.message : '';
        const status =
          typeof typedError.response?.status === 'number'
            ? typedError.response.status
            : undefined;

        // 재시도 가능한 에러인지 확인
        const isRetryableError =
          code === 'ECONNRESET' ||
          code === 'ETIMEDOUT' ||
          code === 'ECONNREFUSED' ||
          code === 'ENOTFOUND' ||
          message.includes('timeout') ||
          message.includes('ECONNRESET') ||
          (status !== undefined && status >= 500 && status < 600);

        if (isRetryableError && attempt < maxRetries) {
          const delay = retryDelay * attempt; // 지수 백오프
          console.warn(
            `[GamesService] 요청 실패 (시도 ${attempt}/${maxRetries}), ${delay}ms 후 재시도...`,
            message || code,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // 재시도 불가능하거나 최대 재시도 횟수 초과
        throw lastError;
      }
    }

    throw lastError || new Error('요청 실패');
  }

  /**
   * 경기의 domestic odds 존재 여부 확인
   * @param gameId 경기 ID
   * @returns domestic 배열이 있고 길이가 0보다 크면 true
   */
  private async hasDomesticOdds(gameId: number): Promise<boolean> {
    try {
      const url = `${this.sportsApiBase}/sports/games/${gameId}/odds/sitesV2`;
      const data = await this.axiosWithRetry<{
        domestic?: unknown[];
        international_basic?: unknown[];
        international_additional?: unknown[];
      }>(() => axios.get(url, this.axiosConfig));

      // domestic 배열이 있고 길이가 0보다 크면 true
      return Array.isArray(data?.domestic) && data.domestic.length > 0;
    } catch (error) {
      // API 호출 실패 시 false 반환 (로그만 남기고 계속 진행)
      console.warn(
        `경기 ${gameId} odds 조회 실패:`,
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  /**
   * 축구: 순위/랭킹 정보 조회
   */
  private async fetchRank(gameId: number) {
    const url = `${this.sportsApiBase}/sports/soccer/games/${gameId}/rank`;
    try {
      return await this.axiosWithRetry<unknown>(() =>
        axios.get(url, this.axiosConfig),
      );
    } catch (error) {
      console.warn(
        `[GamesService] rank 조회 실패 gameId=${gameId}`,
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  }

  /**
   * 농구: 시즌 팀 스탯
   */
  private async fetchSeasonStat(gameId: number) {
    const url = `${this.sportsApiBase}/sports/basketball/games/${gameId}/team/season-stat`;
    try {
      return await this.axiosWithRetry<unknown>(() =>
        axios.get(url, this.axiosConfig),
      );
    } catch (error) {
      console.warn(
        `[GamesService] season-stat 조회 실패 gameId=${gameId}`,
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  }

  /**
   * 농구: 시즌 선수 스탯
   */
  private async fetchPlayerSeasonStat(gameId: number) {
    const url = `${this.sportsApiBase}/sports/basketball/games/${gameId}/player/season-stat`;
    try {
      return await this.axiosWithRetry<unknown>(() =>
        axios.get(url, this.axiosConfig),
      );
    } catch (error) {
      console.warn(
        `[GamesService] player-season-stat 조회 실패 gameId=${gameId}`,
        error instanceof Error ? error.message : String(error),
      );
      return undefined;
    }
  }

  async fetchPopularGames(
    date: string,
    tomorrowFlag: boolean,
  ): Promise<{
    date: string;
    games: PopularGame[];
  }> {
    const url = `${this.sportsApiBase}/popular-games`;
    const data = await this.axiosWithRetry<PopularGamesApiResponse>(() =>
      axios.get<PopularGamesApiResponse>(url, {
        ...this.axiosConfig,
        params: {
          date,
          'tomorrow-game-flag': tomorrowFlag,
        },
      }),
    );

    // data는 { soccer: [...], baseball: [...], ... } 형태이므로
    // 모든 스포츠 배열을 flat 해서 하나의 games 배열로 만든다.
    const buckets: PopularGamesApiResponse = data ?? {};
    const flat: PopularGameApiItem[] = [];
    for (const arr of Object.values(buckets)) {
      flat.push(...arr);
    }

    // 시작 시간 기준 정렬
    flat.sort((a: PopularGameApiItem, b: PopularGameApiItem) => {
      const ta = new Date(a.startDatetime).getTime();
      const tb = new Date(b.startDatetime).getTime();
      return ta - tb;
    });

    // 각 경기별로 odds/sitesV2 API를 호출해서 domestic odds가 있는지 확인
    // 성능을 위해 병렬 처리하되, 너무 많은 동시 요청 방지를 위해 배치로 나눔
    const BATCH_SIZE = 10; // 한 번에 10개씩 처리
    const gamesWithDomesticOdds: PopularGame[] = [];

    for (let i = 0; i < flat.length; i += BATCH_SIZE) {
      const batch: PopularGameApiItem[] = flat.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (g: PopularGameApiItem) => {
          const sumScore = (
            periods?: { score?: unknown }[] | null,
          ): number | null => {
            if (!Array.isArray(periods)) return null;
            return periods.reduce((acc, p) => {
              const val = typeof p?.score === 'number' ? Number(p.score) : 0;
              return acc + val;
            }, 0);
          };
          const homeScore = sumScore(g.teams?.home?.periodData);
          const awayScore = sumScore(g.teams?.away?.periodData);
          const score =
            homeScore === null && awayScore === null
              ? undefined
              : { home: homeScore, away: awayScore };

          const hasDomestic = await this.hasDomesticOdds(g.id);
          if (hasDomestic) {
            return {
              gameId: g.id,
              sport: g.sportsType,
              leagueName: g.league?.name,
              startTime: g.startDatetime,
              homeTeamName: g.teams?.home?.name,
              awayTeamName: g.teams?.away?.name,
              gameStatus: g.gameStatus,
              result: g.result,
              score,
            };
          }
          return null;
        }),
      );

      // 성공한 결과만 필터링하여 추가
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value !== null) {
          gamesWithDomesticOdds.push(result.value);
        }
      }
    }

    console.log(
      `[popular-games] 전체 ${flat.length}개 중 domestic odds 있는 경기 ${gamesWithDomesticOdds.length}개`,
    );

    // 화면에 보여줄 기준 날짜 계산
    // - tomorrowFlag=false: 요청 받은 date 그대로 사용 (오늘)
    // - tomorrowFlag=true: 요청 받은 date의 '다음 날'을 기준 날짜로 사용 (내일)
    let displayDate = date;
    if (tomorrowFlag && date) {
      const base = new Date(`${date}T00:00:00Z`);
      if (!isNaN(base.getTime())) {
        const plusOne = new Date(base.getTime() + 24 * 60 * 60 * 1000);
        displayDate = plusOne.toISOString().slice(0, 10);
      }
    }

    return { date: displayDate, games: gamesWithDomesticOdds };
  }

  async fetchGameRecord(gameId: number): Promise<GameRecordApiResponse> {
    const url = `${this.sportsApiBase}/sports/soccer/games/${gameId}/record`;
    const data = await this.axiosWithRetry<GameRecordApiResponse>(() =>
      axios.get<GameRecordApiResponse>(url, this.axiosConfig),
    );
    return data;
  }

  async fetchCommunityBoard(
    gameId: number,
  ): Promise<CommunityBoardApiResponse> {
    const url = `${this.challengerApiBase}/board`;
    const data = await this.axiosWithRetry<CommunityBoardApiResponse>(() =>
      axios.get<CommunityBoardApiResponse>(url, {
        ...this.axiosConfig,
        params: {
          board_type: 'sports_analysis',
          page: 1,
          game_id: gameId,
        },
      }),
    );
    return data;
  }

  async getGameDetailAggregate(
    gameId: number,
    sportsType?: string,
    override?: {
      scoreHome?: number;
      scoreAway?: number;
      gameStatus?: string;
      result?: string;
    },
  ): Promise<GameDetailAggregate> {
    const [record, board] = await Promise.all([
      this.fetchGameRecord(gameId),
      this.fetchCommunityBoard(gameId),
    ]);

    const r = record as unknown as {
      vsRecord?: any[];
      recentHomeRecord?: any[];
      recentAwayRecord?: any[];
    };

    const b = board as unknown as {
      list?: any[];
    };

    const vsRecord = r.vsRecord ?? [];
    const recentHomeRecord = r.recentHomeRecord ?? [];
    const recentAwayRecord = r.recentAwayRecord ?? [];

    const firstVs = vsRecord[0] as
      | {
          leagueName?: string;
          startDateTime?: string;
          home?: { name?: string };
          away?: { name?: string };
          odds?: Record<string, unknown>;
        }
      | undefined;

    const firstCommunity = b.list?.[0] as
      | {
          home_team?: string;
          away_team?: string;
          start_datetime?: string;
        }
      | undefined;

    const basic = {
      leagueName: firstVs?.leagueName ?? '',
      startTime: firstCommunity?.start_datetime ?? firstVs?.startDateTime ?? '',
      homeTeamName: firstCommunity?.home_team ?? firstVs?.home?.name ?? '',
      awayTeamName: firstCommunity?.away_team ?? firstVs?.away?.name ?? '',
    };

    const odds = (firstVs?.odds as Record<string, unknown>) ?? {};

    const normalizedSportsType = sportsType?.toLowerCase();
    const [rank, seasonStat, playerSeasonStat] = await Promise.all([
      normalizedSportsType === 'soccer' ? this.fetchRank(gameId) : undefined,
      normalizedSportsType === 'basketball'
        ? this.fetchSeasonStat(gameId)
        : undefined,
      normalizedSportsType === 'basketball'
        ? this.fetchPlayerSeasonStat(gameId)
        : undefined,
    ]);

    const score =
      override &&
      (override.scoreHome !== undefined || override.scoreAway !== undefined)
        ? {
            home:
              override.scoreHome !== undefined
                ? Number(override.scoreHome)
                : null,
            away:
              override.scoreAway !== undefined
                ? Number(override.scoreAway)
                : null,
          }
        : undefined;

    const communityPosts =
      (b.list ?? []).map((p) => {
        const item = p as {
          wr_id?: string | number;
          game_id?: string | number;
          wr_subject?: string;
          wr_content?: string;
          wr_good?: string | number;
          wr_datetime?: string;
        };
        return {
          post_id: Number(item.wr_id),
          game_id: Number(item.game_id),
          title: item.wr_subject ?? '',
          content: item.wr_content ?? '',
          likes: Number(item.wr_good ?? 0),
          created_at: item.wr_datetime ?? '',
        };
      }) ?? [];

    return {
      gameId,
      sportsType,
      basic,
      record: {
        headToHead: vsRecord,
        homeRecent: recentHomeRecord,
        awayRecent: recentAwayRecord,
        rank,
        seasonStat,
        playerSeasonStat,
      },
      odds,
      gameStatus: override?.gameStatus,
      result: override?.result,
      score,
      community: {
        posts: communityPosts,
      },
    };
  }
}
