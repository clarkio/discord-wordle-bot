import type { IDatabaseProvider } from './db/entities/IDatabaseProvider';
import type { IScore } from './db/entities/IScore';

export interface UserScore {
  discordId: string;
  userName: string;
  gameNumber: number;
  attempts: string;
}

export function parseIgnoredUserIds(envValue: string): Set<string> {
  return new Set(
    envValue.split(',').map(id => id.trim()).filter(Boolean)
  );
}

export async function processLatestWordleResult(
  parsedWordle: UserScore,
  db: IDatabaseProvider,
  ignoredUserIds: Set<string>
): Promise<IScore[]> {
  const isIgnored = ignoredUserIds.has(parsedWordle.discordId);

  const scoresForCurrentGameNumber = await db.getScoresByNumber(parsedWordle.gameNumber);

  const existingResultForUser = scoresForCurrentGameNumber.find(
    (score) => score.discordId === parsedWordle.discordId
  );

  if (!existingResultForUser) {
    await db.createPlayer(parsedWordle.discordId, parsedWordle.userName);
    if (scoresForCurrentGameNumber.length === 0) {
      await db.createWordle(parsedWordle.gameNumber);
    }
    const addedScore = await db.createScore(
      parsedWordle.discordId,
      parsedWordle.gameNumber,
      parsedWordle.attempts,
      0,
      0
    );
    if (addedScore) {
      scoresForCurrentGameNumber.push(addedScore);
      if (isIgnored) {
        console.log(
          `Wordle result from ignored user ${parsedWordle.userName} (${parsedWordle.discordId}) for game ${parsedWordle.gameNumber} saved but excluded from win/tie calculations`
        );
      } else {
        console.log(`Result added to the database: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
      }
    } else {
      console.error(`Error adding result to the database: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
    }
  } else {
    console.log(`Result already exists: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
  }

  // Exclude ignored users from returned scores so they are never considered for wins or ties
  return scoresForCurrentGameNumber.filter((score) => !ignoredUserIds.has(score.discordId));
}
