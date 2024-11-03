import type { Models } from 'node-appwrite';
import { listDocuments, Query } from './db';

export const getUserGameResults = async (userId: string, gameNumber: string = "0"): Promise<Models.Document | undefined> => {
  let query;
  let userDocs = undefined;

  const isFirstGame = typeof gameNumber === 'string' && gameNumber.toLowerCase() === 'first';
  const isSpecificGame = !Number.isNaN(parseInt(gameNumber));

  if (isFirstGame) {
    userDocs = await listDocuments(undefined, undefined, [
      Query.equal("userId", userId),
      Query.orderAsc('gameNumber')
    ]);
  } else if (isSpecificGame) {
    const gameNumberInt = parseInt(gameNumber);
    query = gameNumberInt !== 0 ? Query.and([Query.equal("gameNumber", gameNumberInt), Query.equal("userId", userId)]) : Query.equal("userId", userId);
    userDocs = await listDocuments(undefined, undefined, [
      query,
      Query.orderDesc('gameNumber')
    ]);
  }

  return userDocs?.total !== 0 ? userDocs?.documents[0] : undefined;
};
