import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient, type Client } from "@libsql/client";
import * as schema from './schema.ts';
import type { IScore } from '../entities/IScore';
import type { IDatabaseProvider } from '../entities/IDatabaseProvider';
import { eq, and } from 'drizzle-orm';
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

  public async getScoresById(discordId: string): Promise<IScore[]> {
    return this.db.query.scoresTable.findMany({
      where: eq(scoresTable.discordId, discordId), with: {
        player: true
      }
    });
  }

  public async getScoreByIdAndNumber(discordId: string, gameNumber: number): Promise<IScore | undefined> {
    return this.db.query.scoresTable.findFirst({
      where: and(eq(scoresTable.gameNumber, gameNumber), eq(scoresTable.discordId, discordId)), with: {
        player: true
      }
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
    return result[0];
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
}

// function determineWinners(scores: UserScore[]): UserScore[] {
//   if (!scores || scores.length === 0) return [];

//   // Convert attempts to numbers for comparison (X becomes 7)
//   const scoresWithNumericAttempts = scores.map(score => ({
//     ...score,
//     numericAttempts: score.attempts.toUpperCase() === 'X' ? 7 : parseInt(score.attempts)
//   }));

//   // Find minimum attempts
//   const minAttempts = Math.min(
//     ...scoresWithNumericAttempts.map(score => score.numericAttempts)
//   );

//   // Return all scores that match minimum attempts
//   return scores.filter((_, index) =>
//     scoresWithNumericAttempts[index].numericAttempts === minAttempts
//   );
// }
