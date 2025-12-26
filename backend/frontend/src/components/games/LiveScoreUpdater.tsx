'use client';

import { useEffect, useState, useMemo } from 'react';
import { GameScoreStatus } from './GameScoreStatus';
import { formatStatus } from '@/lib/gameHitUtils';
import { getJson } from '@/lib/apiClient';

interface GameScore {
  home: number | null;
  away: number | null;
}

interface GameDetailResponse {
  score?: GameScore;
  gameStatus?: string;
}

interface LiveScoreUpdaterProps {
  gameId: string;
  sportsType?: string;
  initialScore?: GameScore;
  initialGameStatus?: string;
}

export function LiveScoreUpdater({
  gameId,
  sportsType,
  initialScore,
  initialGameStatus,
}: LiveScoreUpdaterProps) {
  const [score, setScore] = useState<GameScore | undefined>(initialScore);
  const [gameStatus, setGameStatus] = useState<string | undefined>(
    initialGameStatus,
  );

  // 게임 상태에 따라 라이브 모드 계산
  const isLive = useMemo(() => {
    const status = gameStatus ?? initialGameStatus;
    if (status === 'FINAL' || status === 'finished') {
      return false;
    }
    return (
      status === 'LIVE' ||
      status === 'live' ||
      status === 'IN_PROGRESS' ||
      status === 'in_progress'
    );
  }, [gameStatus, initialGameStatus]);

  // 라이브 모드일 때 폴링
  useEffect(() => {
    if (!isLive) return;

    // 폴링 함수
    const fetchLiveScore = async () => {
      try {
        const game = await getJson<GameDetailResponse>(`games/${gameId}`, {
          ...(sportsType && { sportsType }),
        });

        if (game.score) {
          setScore(game.score);
        }
        if (game.gameStatus) {
          setGameStatus(game.gameStatus);
        }
      } catch (error) {
        console.error('Failed to fetch live score:', error);
      }
    };

    // 즉시 한 번 호출
    fetchLiveScore();

    // 주기적으로 폴링 (10초마다)
    const interval = setInterval(fetchLiveScore, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [gameId, sportsType, isLive]);

  // 초기값이 변경되면 업데이트 (서버에서 받은 최신 데이터)
  // 초기값이 있고 현재 값과 다를 때만 업데이트
  useEffect(() => {
    if (
      initialScore &&
      (score?.home !== initialScore.home || score?.away !== initialScore.away)
    ) {
      setScore(initialScore);
    }
    if (initialGameStatus && gameStatus !== initialGameStatus) {
      setGameStatus(initialGameStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScore, initialGameStatus]);

  return (
    <GameScoreStatus score={score} statusLabel={formatStatus(gameStatus)} />
  );
}
