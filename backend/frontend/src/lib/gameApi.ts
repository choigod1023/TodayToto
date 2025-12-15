import { getJson, postJson } from '@/lib/apiClient';

interface GameDetailOptions {
  sportsType?: string;
  scoreHome?: string;
  scoreAway?: string;
  gameStatus?: string;
  result?: string;
}

export async function fetchGameDetail<T = unknown>(
  gameId: string,
  options?: GameDetailOptions,
): Promise<T> {
  const params = new URLSearchParams();
  if (options?.sportsType) params.set('sportsType', options.sportsType);
  if (options?.scoreHome) params.set('scoreHome', options.scoreHome);
  if (options?.scoreAway) params.set('scoreAway', options.scoreAway);
  if (options?.gameStatus) params.set('gameStatus', options.gameStatus);
  if (options?.result) params.set('result', options.result);
  const qs = params.toString();
  const query = qs ? `?${qs}` : '';
  return getJson<T>(`games/${gameId}${query}`);
}

interface AnalysisOptions {
  sportsType?: string;
  scoreHome?: number | null;
  scoreAway?: number | null;
  gameStatus?: string;
}

export async function fetchAnalysis<T = unknown>(
  gameId: string,
  options?: AnalysisOptions,
): Promise<T> {
  const maxRetries = 20;
  const retryDelay = 3000;

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (options?.sportsType) params.set('sportsType', options.sportsType);
    if (options?.scoreHome !== undefined && options?.scoreHome !== null) {
      params.set('scoreHome', String(options.scoreHome));
    }
    if (options?.scoreAway !== undefined && options?.scoreAway !== null) {
      params.set('scoreAway', String(options.scoreAway));
    }
    if (options?.gameStatus) params.set('gameStatus', options.gameStatus);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await postJson<T>(
        `games/${gameId}/analysis${buildQuery()}`,
        {
          markets: {
            fullTime1x2: true,
            overUnder: true,
            handicap: true,
          },
        },
        { refresh: false },
      );
      if (
        result &&
        (result as { result?: { primaryPick?: unknown } }).result?.primaryPick
      ) {
        return result;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }
      throw new Error('Gemini 분석이 시간 내에 완료되지 않았습니다.');
    } catch (error: unknown) {
      const errorMessage = (
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : ''
      )
        .toString()
        .toLowerCase();

      const status =
        typeof (error as { response?: { status?: number } })?.response
          ?.status === 'number'
          ? (error as { response: { status: number } }).response.status
          : undefined;

      const isRetryableError =
        errorMessage.includes('timeout') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('network') ||
        (status !== undefined && status >= 500);

      if (isRetryableError && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Gemini 분석을 가져오는 데 실패했습니다.');
}
