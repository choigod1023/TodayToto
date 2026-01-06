import { GameDetailAggregate } from '../games/games.types';
import {
  calculateGameStats,
  extractOddsImpliedProbabilities,
} from './stats-utils';

export interface AnalysisRequestMarkets {
  fullTime1x2?: boolean;
  overUnder?: boolean;
  handicap?: boolean;
}

const sanitizeText = (value?: string, maxLen = 400) => {
  if (!value || typeof value !== 'string') return '';
  let text = value;
  text = text.replace(/```[\s\S]*?```/g, ' '); // 코드블록 제거
  text = text.replace(/`[^`]*`/g, ' '); // 인라인 코드 제거
  text = text.replace(/<[^>]+>/g, ' '); // HTML 태그 제거
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1'); // 마크다운 링크 텍스트만 남기기
  text = text.replace(/[*_~>#-]+/g, ' '); // 단순 마크다운 기호 제거
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > maxLen) {
    return `${text.slice(0, maxLen)}...`;
  }
  return text;
};

export function buildPrompt(
  game: GameDetailAggregate,
  markets: AnalysisRequestMarkets,
  oddsSnapshot?: unknown,
): string {
  const parts: string[] = [];
  parts.push('당신은 스포츠 베팅 분석 전문가입니다.');
  parts.push(
    '다음 경기 정보를 바탕으로 승무패, 언더오버, 핸디캡을 분석하세요.',
  );
  parts.push(
    '승무패에서 확신이 낮거나 배당이 너무 낮으면 언더오버/핸디캡에서 더 유리한 픽을 우선 추천하세요.',
  );

  // 통계 계산
  const stats = calculateGameStats(game, oddsSnapshot);
  const impliedProbs = extractOddsImpliedProbabilities(oddsSnapshot);

  parts.push('\n[계산된 통계 데이터]');
  parts.push(
    JSON.stringify({
      homeTeam: {
        recent5Games: {
          avgGoals: Number(stats.homeRecentAvgGoals.toFixed(2)),
          avgConceded: Number(stats.homeRecentAvgConceded.toFixed(2)),
          winRate: Number(stats.homeRecentWinRate.toFixed(2)),
          overRate: Number(stats.homeRecentOverRate.toFixed(2)),
        },
      },
      awayTeam: {
        recent5Games: {
          avgGoals: Number(stats.awayRecentAvgGoals.toFixed(2)),
          avgConceded: Number(stats.awayRecentAvgConceded.toFixed(2)),
          winRate: Number(stats.awayRecentWinRate.toFixed(2)),
          overRate: Number(stats.awayRecentOverRate.toFixed(2)),
        },
      },
      combined: {
        avgGoals: Number(stats.combinedAvgGoals.toFixed(2)),
        avgConceded: Number(stats.combinedAvgConceded.toFixed(2)),
      },
      impliedProbabilities: {
        homeWin: impliedProbs.homeWin
          ? Number(impliedProbs.homeWin.toFixed(3))
          : undefined,
        draw: impliedProbs.draw
          ? Number(impliedProbs.draw.toFixed(3))
          : undefined,
        awayWin: impliedProbs.awayWin
          ? Number(impliedProbs.awayWin.toFixed(3))
          : undefined,
        over: impliedProbs.over
          ? Number(impliedProbs.over.toFixed(3))
          : undefined,
        under: impliedProbs.under
          ? Number(impliedProbs.under.toFixed(3))
          : undefined,
      },
    }),
  );

  parts.push(
    '\n[체크리스트 - 개선된 버전]\n' +
      '- **통계 기반 분석**: 위 계산된 통계를 반드시 참고하세요. 홈팀 최근 5경기 평균 득점과 원정팀 최근 5경기 평균 실점을 합산하여 예상 득점을 계산하고, 반대로 원정팀 평균 득점과 홈팀 평균 실점을 합산하여 예상 실점을 계산하세요.\n' +
      '- **배당 기반 보정**: 암묵확률(impliedProbabilities)과 당신의 예측 확률을 비교하세요. 차이가 ±0.15 이상이면 배당 기반 확률에 더 가깝게 조정하세요. 예를 들어, 암묵확률이 0.45인데 당신이 0.65로 예측했다면, 0.50~0.60 사이로 보정하세요.\n' +
      '- **오버/언더 판단**: combined.avgGoals가 오버언더 기준선(보통 2.5)보다 0.3 이상 높으면 오버 확률을 높이고, 0.3 이상 낮으면 언더 확률을 높이세요. 단, 공격력이 높은 팀(평균 득점 2.0 이상) 간 경기에서는 언더 예측을 신중하게 하세요.\n' +
      '- **리그/스포츠별 총점 기준**: 농구는 리그 평균 득점·페이스, 배구는 세트 득점 분포, 축구는 평균 득점/실점을 기준으로 오버/언더 확신을 제한합니다. 기준선이 평균 대비 크게 벗어나면 확률을 보수적으로 조정하세요.\n' +
      '- **최근 폼 반영**: 최근 5경기 승률과 오버율을 직접 확률에 반영하세요. 승률이 0.8 이상이면 해당 팀 승리 확률을 높이고, 오버율이 0.8 이상이면 오버 확률을 높이세요.\n' +
      '- **핵심 부상/결장, 일정 피로**: 원정 연전·백투백을 확률에 직접 반영하세요. 부상/피로가 큰 팀은 확률을 낮추고 대체 마켓(언더/핸디)으로 전환을 고려하세요.\n' +
      '- **기후 및 환경**: 기후(더위·습도·추위·고도)와 이동 거리, 표면(잔디/돔)이 원정 팀에 불리하면 확률을 낮추고 대체 마켓으로 전환하세요.\n' +
      '- **무승부 처리**: 승무패에서 무승부(DRAW) 확률이 0.3 이상이면 절대 primaryPick으로 선택하지 마세요. 대신 언더오버나 핸디캡으로 전환하세요. 무승부 확률이 높은 경기는 보통 낮은 득점이나 접전 양상을 보이므로 언더나 핸디캡이 더 유리합니다.\n' +
      '- **확률 보정 가이드라인**: (1) 확률 0.7 이상: ±0.1 범위 내에서만 조정 (2) 확률 0.5~0.7: ±0.15 범위 내에서 조정 (3) 확률 0.5 미만: ±0.2 범위 내에서 조정 (4) 배당과 확률 불일치 시 배당 기반으로 재조정\n' +
      '- **마켓 선택 기준**: 승무패 확률이 0.5 미만이고 배당이 1.8 이상이면 다른 마켓 검토. 언더오버는 양팀 최근 평균 득점 합이 기준선의 0.8 이하일 때만 선택. 핸디캡은 양팀 전력 차이가 명확하고(승률 차이 0.2 이상) 배당이 유리할 때 선택.\n' +
      '- **축구 전용 가이드**: (1) 암묵확률에 비해 과대확신하지 말고 ±0.1 이내에서만 조정하세요. (2) 승무패는 HOME/DRAW/AWAY 합이 1이 되도록 내부적으로 일관된 확률을 생각하세요. (3) 홈 강팀이라도 probability 0.72 이상은 피하고, 접전 징후가 있으면 0.6 미만으로 캡핑하세요. (4) 원정 연전·장거리 이동·기후 불리 시 언더/핸디로 전환을 우선 검토하세요.',
  );

  parts.push(
    '반드시 아래 JSON 형식으로만 응답하세요. 설명 문장은 쓰지 마세요.',
  );

  parts.push('\n[경기 기본 정보]');
  parts.push(
    `리그: ${game.basic.leagueName}, 경기: ${game.basic.homeTeamName} vs ${game.basic.awayTeamName}, 시작 시간: ${game.basic.startTime}`,
  );

  parts.push('\n[배당 정보(JSON)]');
  parts.push(JSON.stringify(oddsSnapshot ?? game.odds));

  parts.push('\n[전력/기록 요약(JSON)]');
  parts.push(
    JSON.stringify({
      headToHead: game.record.headToHead,
      homeRecent: game.record.homeRecent,
      awayRecent: game.record.awayRecent,
    }),
  );

  parts.push('\n[커뮤니티 분석글 상위 일부(JSON)]');
  parts.push(
    JSON.stringify(
      game.community.posts.slice(0, 5).map((p) => ({
        title: sanitizeText(p.title),
        content: sanitizeText(p.content),
        likes: p.likes,
        created_at: p.created_at,
      })),
    ),
  );

  parts.push(`\n고려할 마켓: ${JSON.stringify(markets)}\n`);

  parts.push(`
아래 JSON 스키마를 따르세요:
{
  "fullTime1x2": {
    "recommendedSide": "HOME" | "DRAW" | "AWAY",
    "probability": number, // 0~1,
    "summary": string
  },
  "overUnder": {
    "recommendedSide": string, // 예: "OVER_2_5", "UNDER_2_5"
    "probability": number,
    "summary": string
  },
  "handicap": {
    "recommendedSide": string, // 예: "HOME_-0_5", "AWAY_+0_5"
    "probability": number,
    "summary": string
  },
  "primaryPick": {
    "market": "FULL_TIME_1X2" | "OVER_UNDER" | "HANDICAP",
    "side": string,
    "probability": number,
    "reason": string
  }
}

규칙:
- probability는 0과 1 사이의 숫자로 작성하세요.
- primaryPick은 항상 위 세 마켓 중에서 단 하나만 고르세요.
- **절대 규칙**: primaryPick으로 무승부(DRAW)를 선택하지 마세요. 무승부 확률이 0.3 이상이면 반드시 언더오버나 핸디캡으로 전환하세요.
- 계산된 통계와 암묵확률을 반드시 참고하여 확률을 보정하세요.
- 확률이 0.9 이상으로 너무 높게 나오면 과신일 가능성이 높으므로 보수적으로 조정하세요.
- 승무패 적정 배당이 없으면 언더오버나 핸디캡 중 EV가 더 나은 쪽을 고르세요.
- JSON 외의 설명 텍스트는 절대 쓰지 마세요.
`);

  return parts.join('\n');
}
