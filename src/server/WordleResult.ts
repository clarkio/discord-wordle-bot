import { Elysia, t } from 'elysia';
import { getUserGameResults } from '../user-stats';

class WordleResult {
  constructor (public data: string[] = ['Moonhalo']) { }

  async getWordle(userIdToSearch: string, gameNumberToSearch?: number) {
    const results = await getUserGameResults(userIdToSearch, gameNumberToSearch?.toString());
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
  .decorate('wordle', new WordleResult())
  // .get('/score', ({ score }) => 'Scores: ' + score.data)
  .get(
    '/wordle/:userId',
    async ({ wordle, params: { userId }, error }) => {
      return await wordle.getWordle(userId) ?? error(404, 'Unable to get Wordle result.');
    },
    {
      params: t.Object({
        userId: t.String()
      })
    }
  )
  .get(
    '/wordle/:userId/:gameNumber',
    async ({ wordle, params: { userId, gameNumber }, error }) => {
      return await wordle.getWordle(userId, gameNumber) ?? error(404, 'Unable to get Wordle result.');
    },
    {
      params: t.Object({
        userId: t.String(),
        gameNumber: t.Number()
      })
    }
  );
