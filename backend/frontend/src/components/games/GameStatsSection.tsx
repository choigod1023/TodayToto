import { OddsPanel } from './OddsPanel';
import { HeadToHeadPanel, RawVsRecordItem } from './HeadToHeadPanel';
import { RankPanel } from './RankPanel';
import { SeasonStatPanel } from './SeasonStatPanel';
import { PlayerSeasonStatPanel } from './PlayerSeasonStatPanel';

export function GameStatsSection({
  odds,
  headToHead,
  homeRecent,
  awayRecent,
  hasRank,
  hasSeasonStat,
  hasPlayerSeason,
  rankData,
  seasonStat,
  playerSeasonStat,
}: {
  odds: Record<string, unknown>;
  headToHead: RawVsRecordItem[];
  homeRecent: RawVsRecordItem[];
  awayRecent: RawVsRecordItem[];
  hasRank: boolean;
  hasSeasonStat: boolean;
  hasPlayerSeason: boolean;
  rankData: unknown;
  seasonStat: unknown;
  playerSeasonStat: unknown;
}) {
  return (
    <div className="space-y-6">
      <OddsPanel odds={odds} />
      <HeadToHeadPanel
        headToHead={headToHead}
        homeRecent={homeRecent}
        awayRecent={awayRecent}
      />
      {(hasRank || hasSeasonStat || hasPlayerSeason) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-semibold">순위 / 시즌 스탯 / 선수 스탯</h2>
          <div className="space-y-3 text-xs text-slate-200">
            <RankPanel rank={rankData} />
            <SeasonStatPanel seasonStat={seasonStat} />
            <PlayerSeasonStatPanel playerSeasonStat={playerSeasonStat} />
          </div>
        </div>
      )}
    </div>
  );
}

