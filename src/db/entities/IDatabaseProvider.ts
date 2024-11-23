import type { IScore } from './IScore';

export interface IDatabaseProvider {
  getScoresByNumber(gameNumber: number): Promise<Array<IScore>>;
  getScoresById(discordId: string): Promise<Array<IScore>>;
  getScoreByIdAndNumber(discordId: string, gameNumber: number): Promise<IScore | undefined>;
  createWordle(gameNumber: number): Promise<boolean>;
  createPlayer(discordId: string, discordName: string): Promise<boolean>;
  createScore(discordId: string, gameNumber: number, attempts: string, isWin: number, isTie: number): Promise<IScore | undefined>;
  updateScore(discordId: string, gameNumber: number, attempts: string, isWin: number, isTie: number): Promise<boolean>;
}
