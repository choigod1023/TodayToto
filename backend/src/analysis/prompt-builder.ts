import { GameDetailAggregate } from '../games/games.types';

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
  parts.push(
    '\n[체크리스트]\n' +
      '- 리그/스포츠별 총점 기준을 반영하세요: 농구는 리그 평균 득점·페이스, 배구는 세트 득점 분포, 축구는 평균 득점/실점을 기준으로 오버/언더 확신을 제한합니다. 기준선이 평균 대비 크게 벗어나면 확률을 보수적으로 조정하세요.\n' +
      '- 최근 3~5경기 폼, 핵심 부상/결장, 일정 피로(원정 연전·백투백)를 확률에 직접 반영하세요. 부상/피로가 큰 팀은 확률을 낮추고 대체 마켓(언더/핸디)으로 전환을 고려하세요.\n' +
      '- 기후(더위·습도·추위·고도)와 이동 거리, 표면(잔디/돔)이 원정 팀에 불리하면 확률을 낮추고 대체 마켓으로 전환하세요.\n' +
      '- **중요**: 승무패에서 무승부(DRAW) 확률이 0.3 이상이면 절대 primaryPick으로 선택하지 마세요. 대신 언더오버나 핸디캡으로 전환하세요. 무승부 확률이 높은 경기는 보통 낮은 득점이나 접전 양상을 보이므로 언더나 핸디캡이 더 유리합니다.\n' +
      '- 승/패 확신이 낮거나 배당이 과소하면 언더 또는 핸디캡으로 피벗하고, 대체 마켓을 고르면 그 근거를 요약하세요.\n' +
      '- 축구 전용 가이드: (1) 암묵확률(1/배당)에 비해 과대확신하지 말고 ±0.1 이내에서만 조정하세요. (2) 승무패는 HOME/DRAW/AWAY 합이 1이 되도록 내부적으로 일관된 확률을 생각하세요. (3) 홈 강팀이라도 probability 0.72 이상은 피하고, 접전 징후가 있으면 0.6 미만으로 캡핑하세요. (4) 원정 연전·장거리 이동·기후 불리 시 언더/핸디로 전환을 우선 검토하세요. (5) 확률이 0.9 이상으로 너무 높게 나오면 과신일 가능성이 높으므로 보수적으로 조정하세요.',
  );
  parts.push(
    '반드시 아래 JSON 형식으로만 응답하세요. 설명 문장은 쓰지 마세요.',
  );

  parts.push('\n[경기 기본 정보]');
  parts.push(
    `리그: ${game.basic.leagueName}, 경기: ${game.basic.homeTeamName} vs ${game.basic.awayTeamName}, 시작 시간: ${game.basic.startTime}`,
  );

  parts.push('\n[배당 정보(JSON)]');
  // oddsSnapshot은 국내 배당만 포함된 객체를 기대
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
- 확률이 0.9 이상으로 너무 높게 나오면 과신일 가능성이 높으므로 보수적으로 조정하세요.
- 승무패 적정 배당이 없으면 언더오버나 핸디캡 중 EV가 더 나은 쪽을 고르세요.
- JSON 외의 설명 텍스트는 절대 쓰지 마세요.
`);

  return parts.join('\n');
}
