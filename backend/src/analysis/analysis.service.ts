import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import crypto from 'crypto';
import { GameAnalysis, GameAnalysisDocument } from './game-analysis.schema';
import { GamesService } from '../games/games.service';
import { GameDetailAggregate } from '../games/games.types';
import axios from 'axios';

interface AnalysisRequestMarkets {
  fullTime1x2?: boolean;
  overUnder?: boolean;
  handicap?: boolean;
}

@Injectable()
export class AnalysisService {
  constructor(
    @InjectModel(GameAnalysis.name)
    private readonly gameAnalysisModel: Model<GameAnalysisDocument>,
    @Inject(forwardRef(() => GamesService))
    private readonly gamesService: GamesService,
  ) {}

  private buildOddsSnapshot(game: GameDetailAggregate) {
    return game.odds || {};
  }

  private buildOddsHash(snapshot: any): string {
    const json = JSON.stringify(snapshot);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Gemini 결과에서 세 마켓(fullTime1x2, overUnder, handicap)의 확률을 비교해
   * 가장 자신 있는 마켓을 primaryPick으로 선택한다.
   *
   * - Gemini가 primaryPick을 안 보내도 채워주고
   * - 보내더라도 우리 기준(확률/배당)을 반영해 다시 계산한다.
   * - 배당이 너무 낮은(사실상 뻔한) 픽은 후보에서 제외한다.
   */
  private ensurePrimaryPick(
    rawResult: unknown,
    oddsSnapshot?: unknown,
  ): unknown {
    if (!rawResult || typeof rawResult !== 'object') {
      return rawResult;
    }

    const baseResult = rawResult as Record<string, unknown>;
    const result: Record<string, unknown> = { ...baseResult };

    type MarketKey = 'fullTime1x2' | 'overUnder' | 'handicap';
    const candidates: {
      market: 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP';
      side: string;
      probability: number;
      reason: string;
      odds?: number;
      expectedValue?: number;
    }[] = [];

    // "괜찮은" 배당의 최소 기준 (예: 1.4 미만이면 너무 낮은 배당으로 간주)
    const MIN_GOOD_ODDS = 1.4;

    const findOddsForFullTime1x2 = (
      snapshot: unknown,
      side: string,
    ): number | undefined => {
      if (!snapshot || typeof snapshot !== 'object') return undefined;
      const snapObj = snapshot as { domesticWinLoseOdds?: unknown };
      const domestic = snapObj.domesticWinLoseOdds as
        | {
            type?: string;
            latestFlag?: boolean;
            availableFlag?: boolean;
            odds?: unknown;
          }[]
        | undefined;
      if (!Array.isArray(domestic)) return undefined;

      let targetType: string | undefined;
      switch (side) {
        case 'HOME':
          targetType = 'WIN';
          break;
        case 'DRAW':
          targetType = 'DRAW';
          break;
        case 'AWAY':
          targetType = 'LOSS';
          break;
        default:
          return undefined;
      }

      const item = domestic.find(
        (o) =>
          o &&
          o.type === targetType &&
          (o.latestFlag === true || o.availableFlag === true),
      );

      const odds = item ? Number(item.odds) : NaN;
      return Number.isFinite(odds) ? odds : undefined;
    };

    const findOddsForOverUnder = (
      snapshot: unknown,
      side: string,
    ): number | undefined => {
      if (!snapshot || typeof snapshot !== 'object') return undefined;
      const snapObj = snapshot as { domesticUnderOverOdds?: unknown };
      const domestic = snapObj.domesticUnderOverOdds as
        | {
            type?: string;
            optionValue?: unknown;
            odds?: unknown;
            latestFlag?: boolean;
            availableFlag?: boolean;
          }[]
        | undefined;
      if (!Array.isArray(domestic)) return undefined;

      const [rawType, ...rawOptionParts] = side.split('_');
      if (!rawType) {
        return undefined;
      }

      const normalizedType = rawType.toUpperCase();
      const optionString = rawOptionParts.join('_');
      const desiredOptionValue = optionString
        ? Number(optionString.replace(/_/g, '.'))
        : undefined;

      const candidate = domestic.find((item) => {
        if (!item || item.type?.toUpperCase() !== normalizedType) {
          return false;
        }
        if (desiredOptionValue === undefined) {
          return true;
        }
        const value = Number(item.optionValue);
        if (!Number.isFinite(value)) {
          return false;
        }
        return Math.abs(value - desiredOptionValue) < 0.001;
      });

      const odds = candidate ? Number(candidate.odds) : NaN;
      return Number.isFinite(odds) ? odds : undefined;
    };

    const getOddsForMarket = (
      market: 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP',
      side: string,
    ): number | undefined => {
      if (!oddsSnapshot) {
        return undefined;
      }
      if (market === 'FULL_TIME_1X2') {
        return findOddsForFullTime1x2(oddsSnapshot, side);
      }
      if (market === 'OVER_UNDER') {
        return findOddsForOverUnder(oddsSnapshot, side);
      }
      return undefined;
    };

    const pushCandidate = (
      marketKey: MarketKey,
      marketEnum: 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP',
    ) => {
      const mRaw = result[marketKey] as
        | {
            probability?: unknown;
            summary?: unknown;
            recommendedSide?: unknown;
          }
        | undefined;
      if (!mRaw || typeof mRaw !== 'object') return;

      const prob = Number(mRaw.probability);
      if (!Number.isFinite(prob)) return;

      const summary =
        typeof mRaw.summary === 'string' && mRaw.summary.trim().length > 0
          ? mRaw.summary
          : `${marketEnum} 마켓에 대한 요약이 없습니다.`;

      const rawSide =
        typeof mRaw.recommendedSide === 'string' ? mRaw.recommendedSide : '';
      const side = rawSide.trim();

      if (!side) return;

      const odds = getOddsForMarket(marketEnum, side);
      if (marketEnum === 'FULL_TIME_1X2' && typeof odds === 'number') {
        // 배당이 너무 낮으면(예: 1.4 미만) 아예 후보에서 제외
        if (odds < MIN_GOOD_ODDS) {
          return;
        }
      }
      if (marketEnum === 'OVER_UNDER' && typeof odds === 'number') {
        if (odds < MIN_GOOD_ODDS) {
          return;
        }
      }

      candidates.push({
        market: marketEnum,
        side,
        probability: prob,
        reason: summary,
        odds,
      });
    };

    pushCandidate('fullTime1x2', 'FULL_TIME_1X2');
    pushCandidate('overUnder', 'OVER_UNDER');
    pushCandidate('handicap', 'HANDICAP');

    if (candidates.length === 0) {
      // 배당 기준으로 모두 탈락했을 수도 있으니,
      // 기존 primaryPick은 그대로 두고, 없으면 원본 결과 반환
      return result;
    }

    const candidatesWithOdds = candidates
      .filter((c) => typeof c.odds === 'number' && c.odds > 0)
      .map((c) => ({
        ...c,
        expectedValue: c.probability * (c.odds as number) - 1,
      }));

    let bestCandidate: (typeof candidates)[number];
    if (candidatesWithOdds.length > 0) {
      bestCandidate = candidatesWithOdds.reduce((max, cur) => {
        if (max.expectedValue === undefined) {
          return cur;
        }
        if (cur.expectedValue === undefined) {
          return max;
        }
        if (cur.expectedValue === max.expectedValue) {
          return cur.probability > max.probability ? cur : max;
        }
        return cur.expectedValue > max.expectedValue ? cur : max;
      });
    } else {
      // odds 정보를 구하지 못한 경우에는 기존처럼 확률이 가장 높은 후보를 사용
      bestCandidate = candidates.reduce((max, cur) =>
        cur.probability > max.probability ? cur : max,
      );
    }

    result.primaryPick = {
      market: bestCandidate.market,
      side: bestCandidate.side,
      probability: bestCandidate.probability,
      reason: bestCandidate.reason,
    };

    return result;
  }

  private parseGeminiResultText(text: string): Record<string, unknown> {
    if (!text) {
      return {};
    }

    // ```json ... ``` 같은 코드블록 제거
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      // 첫 줄의 ``` 또는 ```json 제거
      const firstNewline = cleaned.indexOf('\n');
      if (firstNewline !== -1) {
        cleaned = cleaned.slice(firstNewline + 1);
      }
      // 마지막 ``` 제거
      const lastFence = cleaned.lastIndexOf('```');
      if (lastFence !== -1) {
        cleaned = cleaned.slice(0, lastFence);
      }
    }

    // 앞뒤 공백 제거 후, 첫 { 부터 마지막 } 까지만 잘라서 파싱 시도
    cleaned = cleaned.trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return { rawText: text };
    }
  }

  async getOrCreateAnalysis(
    gameId: number,
    markets: AnalysisRequestMarkets,
    refresh = false,
    sportsType?: string,
    override?: {
      scoreHome?: number;
      scoreAway?: number;
      gameStatus?: string;
      result?: string;
    },
  ): Promise<any> {
    const game = await this.gamesService.getGameDetailAggregate(
      gameId,
      sportsType,
      {
        scoreHome: override?.scoreHome,
        scoreAway: override?.scoreAway,
        gameStatus: override?.gameStatus,
        result: override?.result,
      },
    );
    const oddsSnapshot = this.buildOddsSnapshot(game);
    const oddsHash = this.buildOddsHash(oddsSnapshot);

    if (!refresh) {
      const existing = await this.gameAnalysisModel
        .findOne({
          gameId,
          oddsHash,
        })
        .lean()
        .exec();
      if (existing) {
        const existingResult = existing.result as unknown;
        const normalized =
          existingResult &&
          typeof existingResult === 'object' &&
          typeof (existingResult as { rawText?: unknown }).rawText === 'string'
            ? this.ensurePrimaryPick(
                this.parseGeminiResultText(
                  (existingResult as { rawText: string }).rawText,
                ),
                existing.oddsSnapshot,
              )
            : this.ensurePrimaryPick(existingResult, existing.oddsSnapshot);

        const normalizedForHit = normalized as {
          primaryPick?: { market?: string; side?: string };
        };
        const hitStatus = this.evaluateHitStatus(
          normalizedForHit,
          game.score,
          game.gameStatus,
        );

        return {
          ...existing,
          result: normalized,
          hitStatus,
        };
      }
    }

    const rawResult = await this.callGemini(game, markets);
    const result = this.ensurePrimaryPick(rawResult, oddsSnapshot);

    const latestVersionDoc = await this.gameAnalysisModel
      .findOne({ gameId })
      .sort({ version: -1 })
      .lean()
      .exec();

    const nextVersion = (latestVersionDoc?.version || 0) + 1;

    const created = await this.gameAnalysisModel.create({
      gameId,
      markets: {
        fullTime1x2: markets.fullTime1x2 ?? true,
        overUnder: markets.overUnder ?? true,
        handicap: markets.handicap ?? true,
      },
      oddsSnapshot,
      oddsHash,
      result,
      version: nextVersion,
    });

    const createdObj =
      typeof created.toObject === 'function' ? created.toObject() : created;
    const hitStatus = this.evaluateHitStatus(
      result as { primaryPick?: { market?: string; side?: string } },
      game.score,
      game.gameStatus,
    );

    return { ...createdObj, result, hitStatus };
  }

  /**
   * primaryPick 적중 여부 판단
   */
  private evaluateHitStatus(
    result:
      | {
          primaryPick?: { market?: string; side?: string };
        }
      | null
      | undefined,
    score?: { home: number | null; away: number | null },
    gameStatus?: string,
  ): 'hit' | 'miss' | 'neutral' {
    if (!result || typeof result !== 'object') return 'neutral';
    if (!score || score.home === null || score.away === null) return 'neutral';
    if (gameStatus && gameStatus.toUpperCase() !== 'FINAL') return 'neutral';

    const primary = result?.primaryPick;
    if (!primary) return 'neutral';

    const winner = (() => {
      if (score.home > score.away) return 'HOME';
      if (score.home < score.away) return 'AWAY';
      return 'DRAW';
    })();

    const market = String(primary.market || '').toUpperCase();
    const side = String(primary.side || '').toUpperCase();

    if (market === 'FULL_TIME_1X2') {
      return winner === side ? 'hit' : 'miss';
    }

    if (market === 'OVER_UNDER') {
      const parts = side.split('_').slice(1);
      if (!parts.length) return 'neutral';
      const line = Number(parts.join('.').replace(/[^\d.]/g, ''));
      if (Number.isNaN(line)) return 'neutral';
      const total = (score.home ?? 0) + (score.away ?? 0);
      if (total === line) return 'neutral';
      const pickOver = side.startsWith('OVER_');
      return pickOver
        ? total > line
          ? 'hit'
          : 'miss'
        : total < line
          ? 'hit'
          : 'miss';
    }

    if (market === 'HANDICAP') {
      const parts = side.split('_').slice(1);
      if (!parts.length) return 'neutral';
      const line = Number(parts.join('.').replace(/[^\d.-]/g, ''));
      if (Number.isNaN(line)) return 'neutral';
      const adjustedHome = (score.home ?? 0) + line;
      const adjustedAway = score.away ?? 0;
      if (adjustedHome === adjustedAway) return 'neutral';
      const pickHome = side.startsWith('HOME_');
      return pickHome
        ? adjustedHome > adjustedAway
          ? 'hit'
          : 'miss'
        : adjustedAway > adjustedHome
          ? 'hit'
          : 'miss';
    }

    return 'neutral';
  }

  private async callGemini(
    game: GameDetailAggregate,
    markets: AnalysisRequestMarkets,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';

    const prompt = this.buildPrompt(game, markets);

    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

    console.log(
      `[AnalysisService] Gemini 예측 시작 gameId=${game.gameId} sportsType=${game.sportsType ?? 'unknown'}`,
    );

    type GeminiResponse = {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const { data } = await axios.post<GeminiResponse>(url, {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.15,
        topP: 0.8,
      },
    });

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    console.log(
      `[AnalysisService] Gemini 예측 완료 gameId=${game.gameId} sportsType=${game.sportsType ?? 'unknown'}`,
    );

    return this.parseGeminiResultText(text);
  }

  private buildPrompt(
    game: GameDetailAggregate,
    markets: AnalysisRequestMarkets,
  ): string {
    const parts: string[] = [];
    parts.push('당신은 스포츠 베팅 분석 전문가입니다.');
    parts.push(
      '다음 경기 정보를 바탕으로 승무패, 언더오버, 핸디캡을 분석하세요.',
    );
    parts.push(
      '무승부 가능성이 높다고 판단되면 승무패에서 무승부를 적극 고려하세요.',
    );
    parts.push(
      '승무패에서 확신이 낮거나 배당이 너무 낮으면 언더오버/핸디캡에서 더 유리한 픽을 우선 추천하세요.',
    );
    parts.push(
      '\n[체크리스트]\n' +
        '- 접전/수비전/로테이션 징후가 있으면 DRAW 확률을 반드시 남기고, 승·패 확신이 낮거나 배당 차이가 작으면 무승부를 1순위 대안으로 고려하세요.\n' +
        '- 리그/스포츠별 총점 기준을 반영하세요: 농구는 리그 평균 득점·페이스, 배구는 세트 득점 분포, 축구는 평균 득점/실점을 기준으로 오버/언더 확신을 제한합니다. 기준선이 평균 대비 크게 벗어나면 확률을 보수적으로 조정하세요.\n' +
        '- 최근 3~5경기 폼, 핵심 부상/결장, 일정 피로(원정 연전·백투백)를 확률에 직접 반영하세요. 부상/피로가 큰 팀은 확률을 낮추고 대체 마켓(DRAW/언더/핸디)으로 전환을 고려하세요.\n' +
        '- 기후(더위·습도·추위·고도)와 이동 거리, 표면(잔디/돔)이 원정 팀에 불리하면 확률을 낮추고 대체 마켓으로 전환하세요.\n' +
        '- 승/패 확신이 낮거나 배당이 과소하면 무승부, 언더 또는 핸디캡으로 피벗하고, 대체 마켓을 고르면 그 근거를 요약하세요.',
    );
    parts.push(
      '반드시 아래 JSON 형식으로만 응답하세요. 설명 문장은 쓰지 마세요.',
    );

    parts.push('\n[경기 기본 정보]');
    parts.push(
      `리그: ${game.basic.leagueName}, 경기: ${game.basic.homeTeamName} vs ${game.basic.awayTeamName}, 시작 시간: ${game.basic.startTime}`,
    );

    parts.push('\n[배당 정보(JSON)]');
    parts.push(JSON.stringify(game.odds));

    parts.push('\n[전력/기록 요약(JSON)]');
    parts.push(
      JSON.stringify({
        headToHead: game.record.headToHead,
        homeRecent: game.record.homeRecent,
        awayRecent: game.record.awayRecent,
      }),
    );

    parts.push('\n[커뮤니티 분석글 상위 일부(JSON)]');
    parts.push(
      JSON.stringify(
        game.community.posts.slice(0, 5).map((p) => ({
          title: p.title,
          content: p.content,
          likes: p.likes,
          created_at: p.created_at,
        })),
      ),
    );

    parts.push(`\n고려할 마켓: ${JSON.stringify(markets)}\n`);

    parts.push(`
아래 JSON 스키마를 따르세요:
{
  "fullTime1x2": {
    "recommendedSide": "HOME" | "DRAW" | "AWAY",
    "probability": number, // 0~1,
    "summary": string
  },
  "overUnder": {
    "recommendedSide": string, // 예: "OVER_2_5", "UNDER_2_5"
    "probability": number,
    "summary": string
  },
  "handicap": {
    "recommendedSide": string, // 예: "HOME_-0_5", "AWAY_+0_5"
    "probability": number,
    "summary": string
  },
  "primaryPick": {
    "market": "FULL_TIME_1X2" | "OVER_UNDER" | "HANDICAP",
    "side": string,
    "probability": number,
    "reason": string
  }
}

규칙:
- probability는 0과 1 사이의 숫자로 작성하세요.
- primaryPick은 항상 위 세 마켓 중에서 단 하나만 고르세요.
- probability가 비슷하다면 승무패 무승부(DRAW)를 우선 고려하세요.
- 승무패 적정 배당이 없으면 언더오버나 핸디캡 중 EV가 더 나은 쪽을 고르세요.
- JSON 외의 설명 텍스트는 절대 쓰지 마세요.
`);

    return parts.join('\n');
  }
}
