export interface RankItem {
  rankings?: Array<{
    teamName?: string;
    ranking?: number;
    winCount?: number;
    lossCount?: number;
    winPercentage?: string;
  }>;
}

export function RankPanel({ rank }: { rank?: RankItem[] }) {
  if (!Array.isArray(rank) || rank.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">순위 데이터가 없습니다.</p>
    );
  }

  const first = rank.find(
    (r) => Array.isArray(r.rankings) && r.rankings.length > 0,
  );
  const rows = first?.rankings ?? [];

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold text-slate-200">순위</h3>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full text-[11px] text-left">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">팀</th>
              <th className="px-2 py-1">승</th>
              <th className="px-2 py-1">패</th>
              <th className="px-2 py-1">승률</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 6).map((item, idx) => (
              <tr
                key={`${item.teamName}-${idx}`}
                className="border-t border-slate-800/80"
              >
                <td className="px-2 py-1 text-slate-300">
                  {item.ranking ?? '-'}
                </td>
                <td className="px-2 py-1 text-slate-100">
                  {item.teamName ?? '팀'}
                </td>
                <td className="px-2 py-1 text-slate-200">
                  {item.winCount ?? '-'}
                </td>
                <td className="px-2 py-1 text-slate-200">
                  {item.lossCount ?? '-'}
                </td>
                <td className="px-2 py-1 text-slate-200">
                  {item.winPercentage ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
