type PrimaryMarket = 'FULL_TIME_1X2' | 'OVER_UNDER' | 'HANDICAP';

interface PrimaryPick {
  market: PrimaryMarket;
  side: string;
  probability: number;
  reason: string;
}

interface GeminiPrimaryCardProps {
  primary?: PrimaryPick;
}

export function GeminiPrimaryCard({ primary }: GeminiPrimaryCardProps) {
  return (
    <div className="rounded-xl border border-sky-700 bg-slate-900/80 p-4">
      <h2 className="mb-2 text-sm font-semibold text-sky-200">
        Gemini 추천 1픽
      </h2>
      {primary ? (
        <div className="space-y-2 text-xs">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1">
            <span className="text-[10px] uppercase tracking-wide text-sky-300">
              {primary.market}
            </span>
            <span className="text-sm font-semibold text-sky-100">
              {primary.side}
            </span>
            <span className="text-[10px] text-sky-300">
              추천 확률: {Math.round((primary.probability ?? 0) * 100)}%
            </span>
          </div>
          <p className="text-slate-200">{primary.reason}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          아직 분석 결과가 없거나, Gemini 호출에 실패했습니다.
        </p>
      )}
    </div>
  );
}
