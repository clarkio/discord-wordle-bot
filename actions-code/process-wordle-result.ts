import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { createDocument, listDocuments, Query } from '../src/db';
import type { Models } from 'node-appwrite';

const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || '';
const isUserTaggingEnabled = process.env.USER_TAGGING_ENABLED === 'true';
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
interface UserScore {
  userId: string;
  userName: string;
  gameNumber: number;
  attempts: string;
}
const dbData = await listDocuments(undefined, undefined, [
  Query.orderDesc('gameNumber'),
]) || { documents: [] };
const wordleResultsData = dbData.documents.map((doc) => ({
  userId: doc.userId,
  userName: doc.userName,
  gameNumber: doc.gameNumber,
  attempts: doc.attempts,
} as UserScore));

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  const channel = await client.channels.fetch(TARGET_CHANNEL_ID) as TextChannel;
  if (!channel) {
    console.error('Channel not found!');
    await client.destroy();
    return;
  }

  try {
    const wordleData = JSON.parse(process.env.PARSED_WORDLE || '{}');
    const results = await processLatestWordleResult(wordleData as unknown as UserScore || undefined);
    if (results) {
      console.log('Current Winner(s):', results.winners);
      const winnerMessage = `Current Winner${results.winners.length > 1 ? "s" : ""} for Wordle ${results.latestGameNumber.toLocaleString()} with ${results.minAttempts} attempt${results.minAttempts > 1 ? 's' : ''}: ${results.winners.join(', ')}`;
      console.log(winnerMessage);
      isLatestWordleAWinner(wordleData, results.winners) ? channel.messages.channel.send(winnerMessage) : console.log('No winner change so no message to send.');
    } else {
      console.log('No results from processing the latest Wordle result.');
    }
  } catch (error) {
    console.error('Error processing Wordle Result:', error);
  } finally {
    console.log('Wordle finished processing. Closing connection...');
    await client.destroy();
    console.log('Connection closed.');
  }
});

function isLatestWordleAWinner(parsedWordle: UserScore | undefined, winners: string[]): boolean {
  return parsedWordle !== undefined
    && Object.keys(parsedWordle).length > 0
    && winners.length > 0
    && (winners.includes(parsedWordle.userName) || winners.includes(`<@${parsedWordle.userId}>`));
}

async function processLatestWordleResult(parsedWordle: UserScore | undefined): Promise<{ minAttempts: number, winners: string[], latestGameNumber: number; } | undefined> {
  if (parsedWordle !== undefined && Object.keys(parsedWordle).length > 0) {
    if (!wordleResultsData.find((result: any) => result.gameNumber === parsedWordle.gameNumber && result.userId === parsedWordle.userId)) {
      const documentAdded = await createDocument(parsedWordle) as Models.Document;
      if (documentAdded) {
        wordleResultsData.push(parsedWordle);
        wordleResultsData.sort((a, b) => b.gameNumber - a.gameNumber);
        console.log(`Result added to the database: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
      }
    } else {
      console.log(`Result already exists: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
    }

    const latestGameNumber = findLatestGameNumber(wordleResultsData);
    console.log('Latest Game Number:', latestGameNumber);

    const scoresForLatestGame = wordleResultsData.filter((score) => score.gameNumber === latestGameNumber);
    console.log('Scores for Latest Game Number:', scoresForLatestGame);

    let results = determineWinners(scoresForLatestGame);
    results.latestGameNumber = latestGameNumber;
    return results;
  }
}

function findLatestGameNumber(wordleResults: UserScore[]): number {
  const latestGame = wordleResults.reduce((maxObj, currentObj) => {
    if (!maxObj || currentObj.gameNumber > maxObj.gameNumber) {
      return currentObj;
    }
    return maxObj;
  }, null as UserScore | null);

  return latestGame ? latestGame.gameNumber : 0;
}

function determineWinners(scoresForLargestGame: UserScore[]): { minAttempts: number, winners: string[], latestGameNumber: number; } {
  let minAttempts = Infinity;
  const winners: string[] = [];

  for (const score of scoresForLargestGame) {
    const attempts = parseInt(score.attempts);

    if (attempts < minAttempts) {
      minAttempts = attempts;
      winners.length = 0; // Clear the winners array
      isUserTaggingEnabled ? winners.push(`<@${score.userId}>`) : winners.push(`${score.userName}`);
    } else if (attempts === minAttempts) {
      isUserTaggingEnabled ? winners.push(`<@${score.userId}>`) : winners.push(`${score.userName}`);
    }
  }

  return { minAttempts, winners, latestGameNumber: scoresForLargestGame[0].gameNumber || 0 };
}

await client.login(process.env.BOT_TOKEN);
