import { Elysia, t } from 'elysia';
import { TursoDatabaseProvider } from '../db/turso';

class WordleResult {
  private db: TursoDatabaseProvider = new TursoDatabaseProvider();
  constructor (public data: string[] = ['Moonhalo']) {
  }

  async getWordle(userIdToSearch: string, gameNumberToSearch?: number) {
    const results = gameNumberToSearch ? await this.db.getScoreByIdAndNumber(userIdToSearch, gameNumberToSearch) : await this.db.getScoresById(userIdToSearch);

    return results;
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
