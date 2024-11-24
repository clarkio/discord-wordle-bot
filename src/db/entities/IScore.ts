import type { IPlayer } from './IPlayer';

export interface IScore {
  discordId: string;
  gameNumber: number;
  attempts: string;
  isWin: number | null;
  isTie: number | null;
  player?: IPlayer | null;
}
