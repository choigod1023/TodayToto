export interface PopularGameApiItem {
  id: number;
  sportsType: string;
  league: { id: number; name: string };
  startDatetime: string;
  teams: {
    home: {
      id: number;
      name: string;
      periodData?: { period?: number; score?: number }[];
    };
    away: {
      id: number;
      name: string;
      periodData?: { period?: number; score?: number }[];
    };
  };
  gameStatus?: string;
  result?: string;
}

// Named popular-games 응답은 { soccer: PopularGameApiItem[], baseball: [...], ... } 형태
export type PopularGamesApiResponse = Record<string, PopularGameApiItem[]>;

export interface PopularGame {
  gameId: number;
  sport: string;
  leagueName: string;
  startTime: string;
  homeTeamName: string;
  awayTeamName: string;
  gameStatus?: string;
  result?: string;
  score?: { home: number | null; away: number | null };
}

export interface GameRecordApiResponse {
  game_id: number;
  league: { id: number; name: string };
  start_time: string;
  home_team: { id: number; name: string };
  away_team: { id: number; name: string };
  head_to_head?: any[];
  home_recent?: any[];
  away_recent?: any[];
  odds?: any;
}

export interface CommunityPost {
  post_id: number;
  game_id: number;
  title: string;
  content: string;
  likes: number;
  created_at: string;
}

export interface CommunityBoardApiResponse {
  list: any[];
  board_notice: any[];
  total_cnt: string;
}

export interface GameDetailAggregate {
  gameId: number;
  sportsType?: string;
  basic: {
    leagueName: string;
    startTime: string;
    homeTeamName: string;
    awayTeamName: string;
  };
  record: {
    headToHead: any[];
    homeRecent: any[];
    awayRecent: any[];
    rank?: unknown;
    seasonStat?: unknown;
    playerSeasonStat?: unknown;
  };
  odds: Record<string, unknown>;
  gameStatus?: string;
  result?: string;
  score?: { home: number | null; away: number | null };
  community: {
    posts: CommunityPost[];
  };
}
