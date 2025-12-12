import crypto from 'crypto';
import { GameDetailAggregate } from '../games/games.types';

export function buildOddsSnapshot(game: GameDetailAggregate) {
  const odds = game.odds || {};
  const { domesticWinLoseOdds, domesticUnderOverOdds, domesticHandicapOdds } =
    odds;
  return {
    domesticWinLoseOdds,
    domesticUnderOverOdds,
    domesticHandicapOdds,
  };
}

export function buildOddsHash(snapshot: any): string {
  const json = JSON.stringify(snapshot);
  return crypto.createHash('sha256').update(json).digest('hex');
}



