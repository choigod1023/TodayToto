import axios from 'axios';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GamesService } from '../games/games.service';
import { GameDetailAggregate } from '../games/games.types';
import { AnalysisRequestMarkets, buildPrompt } from './prompt-builder';
import { evaluateHitStatus } from './hit-status';
import { buildOddsHash, buildOddsSnapshot } from './odds-utils';
import { ensurePrimaryPick } from './primary-pick';
import { GameAnalysis, GameAnalysisDocument } from './game-analysis.schema';

@Injectable()
export class AnalysisService {
  // 분석 진행 중인 gameId를 추적 (중복 요청 방지)
  private readonly analyzingGames = new Set<number>();

  constructor(
    @InjectModel(GameAnalysis.name)
    private readonly gameAnalysisModel: Model<GameAnalysisDocument>,
    @Inject(forwardRef(() => GamesService))
    private readonly gamesService: GamesService,
  ) {}

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

  /**
   * 기존 분석 결과만 조회 (Gemini 호출 없음, 외부 API 호출 없음, ensurePrimaryPick 재계산 없음)
   * DB에서만 조회하여 빠르게 응답
   * 분석이 없으면 null 반환
   *
   * 주의: DB에 저장된 result는 이미 ensurePrimaryPick을 통해 처리된 상태이므로
   * 재계산하지 않고 그대로 사용합니다.
   */
  async getExistingAnalysis(
    gameId: number,
    sportsType?: string,
    override?: {
      scoreHome?: number;
      scoreAway?: number;
      gameStatus?: string;
      result?: string;
    },
  ): Promise<any> {
    try {
      // gameId만으로 최신 분석 조회 (oddsHash 무시하여 빠르게 조회)
      // 여러 버전이 있을 수 있으니 최신 것을 가져옴
      const existing = await this.gameAnalysisModel
        .findOne({ gameId })
        .sort({ version: -1 })
        .lean()
        .exec();

      if (!existing) {
        return { result: null, hitStatus: 'neutral' };
      }

      // DB에 저장된 result는 이미 ensurePrimaryPick을 통해 처리된 상태
      // 재계산하지 않고 그대로 사용 (빠른 응답을 위해)
      const existingResult = existing.result as unknown;

      // primaryPick이 있는지 확인
      const hasPrimaryPick =
        existingResult &&
        typeof existingResult === 'object' &&
        'primaryPick' in existingResult &&
        existingResult.primaryPick !== null &&
        existingResult.primaryPick !== undefined;

      if (!hasPrimaryPick) {
        // primaryPick이 없으면 null 반환
        return { result: null, hitStatus: 'neutral' };
      }

      const normalizedForHit = existingResult as {
        primaryPick?: { market?: string; side?: string };
      };

      // score와 gameStatus는 override에서 가져오거나 기본값 사용
      const score =
        override &&
        (override.scoreHome !== undefined || override.scoreAway !== undefined)
          ? {
              home:
                override.scoreHome !== undefined ? override.scoreHome : null,
              away:
                override.scoreAway !== undefined ? override.scoreAway : null,
            }
          : undefined;

      const hitStatus = evaluateHitStatus(
        normalizedForHit,
        score,
        override?.gameStatus,
      );

      return {
        ...existing,
        result: existingResult,
        hitStatus,
      };
    } catch (error) {
      // 전체 에러 처리
      console.error(
        `[AnalysisService] getExistingAnalysis 실패 gameId=${gameId}`,
        error instanceof Error ? error.message : String(error),
      );
      return { result: null, hitStatus: 'neutral' };
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
    const oddsSnapshot = buildOddsSnapshot(game);
    const oddsHash = buildOddsHash(oddsSnapshot);

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
            ? ensurePrimaryPick(
                this.parseGeminiResultText(
                  (existingResult as { rawText: string }).rawText,
                ),
                existing.oddsSnapshot,
              )
            : ensurePrimaryPick(existingResult, existing.oddsSnapshot);

        const normalizedForHit = normalized as {
          primaryPick?: { market?: string; side?: string };
        };
        const hitStatus = evaluateHitStatus(
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

    // 이미 분석 진행 중이면 기존 분석을 기다리거나 null 반환
    if (this.analyzingGames.has(gameId)) {
      console.log(
        `[AnalysisService] 분석 진행 중 gameId=${gameId}, 대기 또는 스킵`,
      );
      // 짧은 시간 대기 후 다시 확인
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const retryExisting = await this.gameAnalysisModel
        .findOne({
          gameId,
          oddsHash,
        })
        .lean()
        .exec();
      if (retryExisting) {
        const existingResult = retryExisting.result as unknown;
        const normalized =
          existingResult &&
          typeof existingResult === 'object' &&
          typeof (existingResult as { rawText?: unknown }).rawText === 'string'
            ? ensurePrimaryPick(
                this.parseGeminiResultText(
                  (existingResult as { rawText: string }).rawText,
                ),
                retryExisting.oddsSnapshot,
              )
            : ensurePrimaryPick(existingResult, retryExisting.oddsSnapshot);

        const normalizedForHit = normalized as {
          primaryPick?: { market?: string; side?: string };
        };
        const hitStatus = evaluateHitStatus(
          normalizedForHit,
          game.score,
          game.gameStatus,
        );

        return {
          ...retryExisting,
          result: normalized,
          hitStatus,
        };
      }
      // 여전히 없으면 null 반환 (다른 요청이 처리 중)
      return { result: null, hitStatus: 'neutral' };
    }

    // 분석 시작 표시
    this.analyzingGames.add(gameId);

    try {
      const rawResult = await this.callGemini(game, markets, oddsSnapshot);
      const result = ensurePrimaryPick(rawResult, oddsSnapshot);

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
      const hitStatus = evaluateHitStatus(
        result as { primaryPick?: { market?: string; side?: string } },
        game.score,
        game.gameStatus,
      );

      return { ...createdObj, result, hitStatus };
    } catch (error) {
      // 에러 발생 시에도 Set에서 제거
      console.error(
        `[AnalysisService] Gemini 분석 실패 gameId=${gameId}`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    } finally {
      // 분석 완료 또는 실패 시 Set에서 제거
      this.analyzingGames.delete(gameId);
    }
  }

  private async callGemini(
    game: GameDetailAggregate,
    markets: AnalysisRequestMarkets,
    oddsSnapshot?: unknown,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';

    const prompt = buildPrompt(game, markets, oddsSnapshot);

    console.log(
      `[AnalysisService] Gemini 예측 시작 gameId=${game.gameId} sportsType=${game.sportsType ?? 'unknown'}`,
    );

    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

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
}
