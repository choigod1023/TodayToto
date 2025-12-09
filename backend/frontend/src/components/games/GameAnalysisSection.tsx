import { GeminiPrimaryCard } from './GeminiPrimaryCard';
import { GeminiMarketsPanel } from './GeminiMarketsPanel';

type Market = {
  recommendedSide: string;
  probability: number;
  summary: string;
} | null;

export function GameAnalysisSection({
  primary,
  fullTime1x2,
  overUnder,
  handicap,
  primaryHit,
  hitFullTime,
  hitOverUnder,
  hitHandicap,
}: {
  primary?: {
    market: 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP';
    side: string;
    probability: number;
    reason: string;
  } | null;
  fullTime1x2?: Market;
  overUnder?: Market;
  handicap?: Market;
  primaryHit: 'hit' | 'miss' | 'neutral';
  hitFullTime: 'hit' | 'miss' | 'neutral';
  hitOverUnder: 'hit' | 'miss' | 'neutral';
  hitHandicap: 'hit' | 'miss' | 'neutral';
}) {
  const hitClass =
    primaryHit === 'hit'
      ? 'border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(52,211,153,0.5)]'
      : primaryHit === 'miss'
        ? 'border-rose-400/80 bg-rose-500/10 shadow-[0_0_0_1px_rgba(248,113,113,0.5)]'
        : 'border-slate-800 bg-slate-900/60';

  return (
    <div className={`rounded-xl border p-4 ${hitClass}`}>
      <div className="flex items-center justify-between">
        <GeminiPrimaryCard primary={primary ?? undefined} />
      </div>

      <GeminiMarketsPanel
        fullTime1x2={fullTime1x2 ?? undefined}
        overUnder={overUnder ?? undefined}
        handicap={handicap ?? undefined}
        primaryMarket={primary?.market}
        hitFullTime={hitFullTime}
        hitOverUnder={hitOverUnder}
        hitHandicap={hitHandicap}
      />
    </div>
  );
}

