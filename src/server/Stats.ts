import { Elysia, t } from 'elysia';
import { getUserGameResults } from '../user-stats';

class Stats {
  constructor () { }

  async getUserStats(userIdToSearch: string) {
    const results = await getUserGameResults(userIdToSearch);
    // Destructure the results object to extract only the desired properties
    if (!results) {
      return {};
    }
    const { userId, userName, gameNumber, attempts } = results;

    // Return a new object with only the desired properties
    return { userId, userName, gameNumber, attempts };
  }
}

export const wordleResult = new Elysia()
  .decorate('stats', new Stats())
  .get(
    '/stats/:userId',
    async ({ stats, params: { userId }, error }) => {
      return await stats.getUserStats(userId) ?? error(404, 'Unable to get Wordle result.');
    },
    {
      params: t.Object({
        userId: t.String()
      })
    }
  );
