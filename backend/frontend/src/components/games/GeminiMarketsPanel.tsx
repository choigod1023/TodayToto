interface MarketInfo {
  recommendedSide: string;
  probability: number;
  summary: string;
}

interface GeminiMarketsPanelProps {
  fullTime1x2?: MarketInfo;
  overUnder?: MarketInfo;
  handicap?: MarketInfo;
  primaryMarket?: 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP';
  hitFullTime?: 'hit' | 'miss' | 'neutral';
  hitOverUnder?: 'hit' | 'miss' | 'neutral';
  hitHandicap?: 'hit' | 'miss' | 'neutral';
}

function MarketCard({
  title,
  data,
  isPrimary,
  hit,
}: {
  title: string;
  data: MarketInfo;
  isPrimary?: boolean;
  hit?: 'hit' | 'miss' | 'neutral';
}) {
  const hitClass =
    hit === 'hit'
      ? 'border-emerald-400/70 bg-emerald-500/10'
      : hit === 'miss'
        ? 'border-rose-400/70 bg-rose-500/10'
        : 'border-slate-800 bg-slate-900/60';

  return (
    <div className={`rounded-lg border p-3 ${hitClass}`}>
      <p className="mb-1 font-semibold">
        {title}
        {isPrimary && (
          <span className="ml-2 rounded-full bg-sky-600/20 px-2 py-[2px] text-[10px] text-sky-200">
            PRIMARY
          </span>
        )}
      </p>
      <p className="text-slate-200">
        추천: {data.recommendedSide} (
        {Math.round((data.probability ?? 0) * 100)}
        %)
      </p>
      <p className="text-slate-400">{data.summary}</p>
    </div>
  );
}

export function GeminiMarketsPanel({
  fullTime1x2,
  overUnder,
  handicap,
  primaryMarket,
  hitFullTime = 'neutral',
  hitOverUnder = 'neutral',
  hitHandicap = 'neutral',
}: GeminiMarketsPanelProps) {
  if (!fullTime1x2 && !overUnder && !handicap) {
    return null;
  }

  return (
    <div className="space-y-3 text-xs">
      {fullTime1x2 && (
        <MarketCard
          title="승/무/패"
          data={fullTime1x2}
          isPrimary={primaryMarket === 'FULL_TIME_1X2'}
          hit={hitFullTime}
        />
      )}
      {overUnder && (
        <MarketCard
          title="언더/오버"
          data={overUnder}
          isPrimary={primaryMarket === 'OVER_UNDER'}
          hit={hitOverUnder}
        />
      )}
      {handicap && (
        <MarketCard
          title="핸디캡"
          data={handicap}
          isPrimary={primaryMarket === 'HANDICAP'}
          hit={hitHandicap}
        />
      )}
    </div>
  );
}
