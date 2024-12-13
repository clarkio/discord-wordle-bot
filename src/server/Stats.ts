import { Elysia, t } from 'elysia';
import { TursoDatabaseProvider } from '../db/turso';

class Stats {
  private db: TursoDatabaseProvider = new TursoDatabaseProvider();
  constructor () { }

  async getUserStats(userIdToSearch: string) {
    const results = await this.db.getScoresById(userIdToSearch);
    return results;
  }

  async getAllScores() {
    const results = await this.db.getScores();
    return results;
  }

  async getLeaderboard() {
    const results = await this.db.getLeaderboard();
    return results;
  }
}

export const stats = new Elysia()
  .decorate('stats', new Stats())
  .get(
    '/stats',
    async ({ stats }) => {
      return await stats.getLeaderboard();
    }
  );
// .get(
//   '/stats/:userId',
//   async ({ stats, params: { userId }, error }) => {
//     return await stats.getUserStats(userId) ?? error(404, 'Unable to get Wordle result.');
//   },
//   {
//     params: t.Object({
//       userId: t.String()
//     })
//   }
// );
