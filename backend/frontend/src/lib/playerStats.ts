export type PlayerSeasonStatRaw = {
  player?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    position?: string;
  };
  pointsAverage?: string | number;
  points?: number;
  reboundsTotalAverage?: string | number;
  reboundsTotal?: number;
  assistsAverage?: string | number;
  assists?: number;
  fieldGoalsPercentage?: string | number;
  threePointFieldGoalsPercentage?: string | number;
  freeThrowsPercentage?: string | number;
  reboundsOffensiveAverage?: string | number;
  reboundsDefensiveAverage?: string | number;
  stealsAverage?: string | number;
  blockedShotsAverage?: string | number;
  turnoversAverage?: string | number;
  timesPlayedAverage?: string;
};

export function pickTopPlayers(
  list: PlayerSeasonStatRaw[] | undefined,
  limit = 5,
) {
  if (!Array.isArray(list)) return [];
  return [...list]
    .map((p) => {
      const name =
        p?.player?.displayName ||
        [p?.player?.firstName, p?.player?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        '선수';
      const points = Number(p?.pointsAverage ?? p?.points ?? 0);
      const rebounds = Number(p?.reboundsTotalAverage ?? p?.reboundsTotal ?? 0);
      const assists = Number(p?.assistsAverage ?? p?.assists ?? 0);
      const fg = p?.fieldGoalsPercentage;
      const tp = p?.threePointFieldGoalsPercentage;
      const minutes = p?.timesPlayedAverage;
      const position = p?.player?.position ?? '';
      return {
        name,
        points,
        rebounds,
        assists,
        fg,
        tp,
        minutes,
        position,
      };
    })
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}
