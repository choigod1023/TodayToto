import { ensureNumber } from './type-guards';

/**
 * Gemini 결과에서 세 마켓(fullTime1x2, overUnder, handicap)의 확률을 비교해
 * 가장 자신 있는 마켓을 primaryPick으로 선택한다.
 *
 * - Gemini가 primaryPick을 안 보내도 채워주고
 * - 보내더라도 우리 기준(확률/배당)을 반영해 다시 계산한다.
 * - 배당이 너무 낮은(사실상 뻔한) 픽은 후보에서 제외한다.
 */
export function ensurePrimaryPick(
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
    .filter((c) => ensureNumber(c.odds) > 0)
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



