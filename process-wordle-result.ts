import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { createDocument, listDocuments, Query } from './db';
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
    const winnerMessage = await processLatestWordleResult(wordleData as unknown as UserScore || undefined);
    winnerMessage ? channel.messages.channel.send(winnerMessage) : console.log('No winner message to send.');
  } catch (error) {
    console.error('Error processing Wordle Result:', error);
  } finally {
    console.log('Wordle finished processing. Closing connection...');
    await client.destroy();
    console.log('Connection closed.');
  }
});

async function processLatestWordleResult(parsedWordle: UserScore | undefined): Promise<string | undefined> {
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
    console.log('Largest Game Number:', latestGameNumber);

    const scoresForLatestGame = wordleResultsData.filter((score) => score.gameNumber === latestGameNumber);
    console.log('Scores for Largest Game Number:', scoresForLatestGame);

    const results = determineWinners(scoresForLatestGame);
    console.log('Current Winner(s):', results.winners);
    const winnerMessage = `Current Winner${results.winners.length > 1 ? "s" : ""} for Wordle ${latestGameNumber.toLocaleString()} with ${results.minAttempts} attempt${results.minAttempts > 1 ? 's' : ''}: ${results.winners.join(', ')}`;
    console.log(winnerMessage);
    return winnerMessage;
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

function determineWinners(scoresForLargestGame: UserScore[]): { minAttempts: number, winners: string[]; } {
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

  return { minAttempts, winners };
}

await client.login(process.env.BOT_TOKEN);
