import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient, type Client } from "@libsql/client";
import * as schema from './schema.ts';
import type { IScore } from '../entities/IScore';
import type { IDatabaseProvider } from '../entities/IDatabaseProvider';
import { eq, and, asc, desc } from 'drizzle-orm';
import { scoresTable, wordlesTable, playersTable } from './schema.ts';

export class TursoDatabaseProvider implements IDatabaseProvider {
  private db: LibSQLDatabase<typeof schema> & {
    $client: Client;
  };

  constructor () {
    const isProd = process.env.NODE_ENV === 'production';
    const turso = this.getClient(isProd);
    this.db = drizzle(turso, { schema });
  }

  private getClient(isProd: boolean) {
    if (isProd) {
      return createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
    } else {
      return createClient({
        url: 'file:./localDb/local.db',
        authToken: 'local',
      });
    }
  }

  public async disconnect(): Promise<void> {
    this.db.$client.close();
  }

  public async getScoresById(discordId: string, ascending?: boolean): Promise<IScore[]> {
    const orderByQuery = ascending ? asc(scoresTable.gameNumber) : desc(scoresTable.gameNumber);
    return this.db.query.scoresTable.findMany({
      where: eq(scoresTable.discordId, discordId), with: {
        player: true
      },
      orderBy: orderByQuery
    });
  }

  public async getScoreByIdAndNumber(discordId: string, gameNumber: number, ascending?: boolean): Promise<IScore | undefined> {
    const orderByQuery = ascending ? asc(scoresTable.gameNumber) : desc(scoresTable.gameNumber);
    return this.db.query.scoresTable.findFirst({
      where: and(eq(scoresTable.gameNumber, gameNumber), eq(scoresTable.discordId, discordId)), with: {
        player: true
      },
      orderBy: orderByQuery
    });
  }

  public async getScoresByNumber(gameNumber: number): Promise<Array<IScore>> {
    return this.db.query.scoresTable.findMany({
      where: eq(scoresTable.gameNumber, gameNumber), with: {
        player: true
      }
    });
  }

  public async createWordle(gameNumber: number): Promise<boolean> {
    try {
      await this.db.insert(wordlesTable).values({ gameNumber }).onConflictDoNothing();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async createPlayer(discordId: string, discordName: string): Promise<boolean> {
    try {
      await this.db.insert(playersTable).values({ discordId, discordName }).onConflictDoNothing();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  public async createScore(discordId: string, gameNumber: number, attempts: string, isWin: number = 0, isTie: number = 0): Promise<IScore | undefined> {
    const result = await this.db.insert(scoresTable).values({ discordId, gameNumber, attempts, isWin, isTie }).onConflictDoNothing().returning();

    if (result.length === 0) {
      return;
    }

    const score = await this.db.query.scoresTable.findFirst({
      where: and(eq(scoresTable.gameNumber, gameNumber), eq(scoresTable.discordId, discordId)), with: {
        player: true
      }
    });
    return score;
  }

  public async updateScore(discordId: string, gameNumber: number, attempts: string, isWin: number = 0, isTie: number = 0): Promise<boolean> {
    try {
      await this.db.update(scoresTable).set({ attempts, isWin, isTie }).where(and(eq(scoresTable.discordId, discordId), eq(scoresTable.gameNumber, gameNumber)));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  /*
  * Get the user's game results.
  * @param userId The user's ID.
  * @param gameNumber The game number to get results for. If "first", get the first game's results.
  * @returns The user's game results.
  * Example triggers to use this function:
  * !results
  *  - Get's the most recent game results.
  * !results 123
  * - Get's the results for game 123.
  * !results first
  * - Get's the results for the first game.
*/
  public async getUserGameResults(userId: string, gameNumber?: string): Promise<IScore | undefined> {
    let userScore = undefined;

    const isFirstGame = typeof gameNumber === 'string' && gameNumber.toLowerCase() === 'first';
    const isSpecificGame = gameNumber ? !Number.isNaN(parseInt(gameNumber)) : false;
    console.log(isFirstGame, isSpecificGame);

    if (isSpecificGame) {
      const gameNumberInt = parseInt(gameNumber!);
      userScore = await this.getScoreByIdAndNumber(userId, gameNumberInt);
    } else {
      const scores = await this.getScoresById(userId, isFirstGame);
      userScore = scores[0];
    }
    return userScore;
  }
}
