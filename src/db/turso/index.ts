import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient, type Client, type ResultSet } from "@libsql/client";
import * as schema from './schema.ts';
import type { IScore } from '../entities/IScore';
import type { IDatabaseProvider } from '../entities/IDatabaseProvider';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { scoresTable, wordlesTable, playersTable } from './schema.ts';
import type { ILeaderboardEntry } from '../entities/ILeaderboardEntry.ts';

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

  public async getLeaderboard() {
    const result: ResultSet = await this.db.run(sql`
      WITH score_stats AS (
        SELECT
          p.discord_id,
          p.discord_name,
          s.attempts,
          s.is_win,
          s.is_tie,
          s.game_number,
          CASE
            WHEN s.attempts = 'X' THEN 1
            ELSE 0
          END as is_failure
        FROM players p
        LEFT JOIN scores s ON p.discord_id = s.discord_id
        WHERE p.is_opted_in = 1
      ),
      win_streaks AS (
        SELECT
          discord_id,
          COUNT(*) as streak_length
        FROM (
          SELECT
            s1.discord_id,
            s1.game_number,
            COUNT(*) as streak_length
          FROM scores s1
          JOIN scores s2 ON s1.discord_id = s2.discord_id
            AND s2.game_number <= s1.game_number
            AND s2.is_win = 1
          WHERE s1.is_win = 1
          GROUP BY s1.discord_id, s1.game_number
        )
        GROUP BY discord_id
      )
      SELECT
        s.discord_id,
        s.discord_name,
        COUNT(CASE WHEN s.is_win = 1 AND s.is_tie = 0 THEN 1 END) as wins,
        ROUND(CAST(COUNT(CASE WHEN s.is_win = 1 AND s.is_tie = 0 THEN 1 END) AS FLOAT) / COUNT(*) * 100, 2) as win_percent,
        COUNT(CASE WHEN s.is_win = 0 AND s.attempts != 'X' THEN 1 END) as losses,
        ROUND(CAST(COUNT(CASE WHEN s.is_win = 0 AND s.attempts != 'X' THEN 1 END) AS FLOAT) / COUNT(*) * 100, 2) as loss_percent,
        COUNT(CASE WHEN s.is_tie = 1 THEN 1 END) as ties,
        ROUND(CAST(COUNT(CASE WHEN s.is_tie = 1 THEN 1 END) AS FLOAT) / COUNT(*) * 100, 2) as tie_percent,
        COUNT(CASE WHEN s.attempts = 'X' THEN 1 END) as failures,
        ROUND(CAST(COUNT(CASE WHEN s.attempts = 'X' THEN 1 END) AS FLOAT) / COUNT(*) * 100, 2) as failure_percent,
        ROUND(AVG(CASE
          WHEN s.attempts != 'X'
          THEN CAST(s.attempts AS INTEGER)
          END), 2) as avg_attempts,
        COUNT(*) as total_games,
        COALESCE(MAX(w.streak_length), 0) as longest_win_streak
      FROM score_stats s
      LEFT JOIN win_streaks w ON s.discord_id = w.discord_id
      GROUP BY s.discord_id, s.discord_name
      ORDER BY wins DESC
    `);
    return result.rows as unknown as ILeaderboardEntry[];
  }

  public async getScores(): Promise<IScore[]> {
    return this.db.query.scoresTable.findMany({ with: { player: true } });
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

  public async updatePlayer(discordId: string, isOptedIn: boolean): Promise<boolean> {
    const isOptedInInt = isOptedIn ? 1 : 0;
    try {
      await this.db.update(playersTable).set({ isOptedIn: isOptedInInt }).where(eq(playersTable.discordId, discordId));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

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
  };

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
