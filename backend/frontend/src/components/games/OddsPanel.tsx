type OddsItem = {
  type?: string;
  optionValue?: number;
  odds?: number;
};

interface StructuredOdds {
  domesticWinLoseOdds?: OddsItem[];
  domesticUnderOverOdds?: OddsItem[];
  domesticHandicapOdds?: OddsItem[];
  [key: string]: unknown;
}

interface OddsPanelProps {
  odds: StructuredOdds;
}

function OddsRow({ label, item }: { label: string; item: OddsItem }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-slate-200">{label}</span>
      <span className="text-slate-300">
        배당 {item.odds?.toFixed(2) ?? '-'}
      </span>
    </div>
  );
}

export function OddsPanel({ odds }: OddsPanelProps) {
  const winLose = odds.domesticWinLoseOdds ?? [];
  const underOver = odds.domesticUnderOverOdds ?? [];
  const handicap = odds.domesticHandicapOdds ?? [];

  const hasStructured =
    winLose.length > 0 || underOver.length > 0 || handicap.length > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="mb-2 text-sm font-semibold">배당 정보</h2>

      {hasStructured ? (
        <div className="space-y-3 text-xs">
          {winLose.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-300">
                승/무/패 (국내)
              </p>
              <div className="space-y-1 rounded-md bg-slate-950/40 p-2">
                {winLose.map((o, idx) => (
                  <OddsRow
                    key={idx}
                    label={
                      o.type === 'WIN'
                        ? '홈 승'
                        : o.type === 'DRAW'
                          ? '무승부'
                          : o.type === 'LOSS'
                            ? '원정 승'
                            : (o.type ?? '옵션')
                    }
                    item={o}
                  />
                ))}
              </div>
            </div>
          )}

          {underOver.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-300">
                언더/오버 (국내)
              </p>
              <div className="space-y-1 rounded-md bg-slate-950/40 p-2">
                {underOver.map((o, idx) => (
                  <OddsRow
                    key={idx}
                    label={`${
                      o.type === 'OVER'
                        ? '오버'
                        : o.type === 'UNDER'
                          ? '언더'
                          : (o.type ?? '옵션')
                    } ${o.optionValue ?? ''}`}
                    item={o}
                  />
                ))}
              </div>
            </div>
          )}

          {handicap.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-slate-300">
                핸디캡 (국내)
              </p>
              <div className="space-y-1 rounded-md bg-slate-950/40 p-2">
                {handicap.map((o, idx) => (
                  <OddsRow
                    key={idx}
                    label={`${o.type ?? '옵션'} (${o.optionValue ?? 0})`}
                    item={o}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">표시할 배당 정보가 없습니다.</p>
      )}

      <details className="mt-3 text-[10px] text-slate-500">
        <summary className="cursor-pointer select-none">원본 JSON 보기</summary>
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-950/70 p-2 text-[10px] text-slate-300">
          {JSON.stringify(odds, null, 2)}
        </pre>
      </details>
    </div>
  );
}
