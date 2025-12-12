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
}
