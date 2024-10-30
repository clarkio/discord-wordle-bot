import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { createDocument, listDocuments, Query } from './db';
import type { Models } from 'node-appwrite';

const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || '';
const SEED_DATA = false;
console.log('Clarkio Wordle Results Bot initializing...\n\n');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const wordlePattern = /Wordle (\d{0,3}(,?)\d{1,3}) (🎉 ?)?([X1-6])\/6/;
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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user?.tag}!`);
  const channel = await readyClient.channels.fetch(TARGET_CHANNEL_ID) as TextChannel;

  if (!channel) {
    console.error('Channel not found!');
    return;
  }
  console.log(`Connected to channel: ${channel.name}\n`);

  if (SEED_DATA) {
    await seedDataForDB(channel);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  console.log('Reading latest message...');

  const resultToAdd = parseWordleResult(message);
  if (resultToAdd !== undefined) {
    if (!wordleResultsData.find((result: any) => result.gameNumber === resultToAdd.gameNumber && result.userId === resultToAdd.userId)) {
      const documentAdded = await createDocument(resultToAdd) as Models.Document;
      if (documentAdded) {
        wordleResultsData.push(resultToAdd);
        wordleResultsData.sort((a, b) => b.gameNumber - a.gameNumber);
        console.log(`Result added to the database: ${resultToAdd.gameNumber} - ${resultToAdd.userName}`);
        console.dir(wordleResultsData);
      }
    } else {
      console.log(`Result already exists: ${resultToAdd.gameNumber} - ${resultToAdd.userName}`);
    }
    const response = `Captured Wordle Result for ${resultToAdd.userName}:\nGame Number: ${resultToAdd.gameNumber}\nAttempts: ${resultToAdd.attempts}/6\n`;
    console.log(response);

    const latestGameNumber = findLatestGameNumber(wordleResultsData);
    console.log('Largest Game Number:', latestGameNumber);

    const scoresForLatestGame = wordleResultsData.filter((score) => score.gameNumber === latestGameNumber);
    console.log('Scores for Largest Game Number:', scoresForLatestGame);

    // ********* LEFT OFF HERE ********* //
    // Need to determine logic for calculating past game winners and log them (for now, then will post to Discord)

    // Determine the winner(s)
    const results = determineWinners(scoresForLatestGame);
    console.log('Current Winner(s):', results.winners);
    const winnerMessage = `Current Winner${results.winners.length > 1 ? "s" : ""} for Wordle ${latestGameNumber.toLocaleString()} with ${results.minAttempts} attempt${results.minAttempts > 1 ? 's' : ''}: ${results.winners.join(', ')}`;
    console.log(winnerMessage);
    // channel.messages.channel.send(winnerMessage);

  } else {
    console.log('No match found for user:', message.author.username);
  }
});

client.login(process.env.BOT_TOKEN);

function determineWinners(scoresForLargestGame: UserScore[]): { minAttempts: number, winners: string[]; } {
  let minAttempts = Infinity;
  const winners: string[] = [];

  for (const score of scoresForLargestGame) {
    const attempts = parseInt(score.attempts);

    if (attempts < minAttempts) {
      minAttempts = attempts;
      winners.length = 0; // Clear the winners array
      // winners.push(`<@${userId}>`);
      winners.push(`${score.userName}`);
    } else if (attempts === minAttempts) {
      // winners.push(`<@${userId}>`);
      winners.push(`${score.userName}`);
    }
  }

  return { minAttempts, winners };
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

function parseWordleResult(message: any): UserScore | undefined {
  const userName = message.author.username;
  const userId = message.author.id;
  const match = wordlePattern.exec(message.content);

  if (match) {
    const gameNumber = parseInt(match[1].replace(',', ''));
    const attempts = match[4];

    return {
      userId,
      userName,
      gameNumber,
      attempts,
    };
  }

  return undefined;
}

async function seedDataForDB(channel: TextChannel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    console.log('Fetched messages:', messages.size);

    messages.forEach((message: any) => {
      if (message.author.bot) return;

      const wordleResult = parseWordleResult(message);
      if (wordleResult !== undefined) {
        // const response = `Captured Wordle Result for ${wordleResult.userName}:\nGame Number: ${wordleResult.gameNumber}\nAttempts: ${wordleResult.attempts}/6\n`;
        // console.log(response);
        if (wordleResultsData.find((result: any) => result.gameNumber === wordleResult.gameNumber && result.userId === wordleResult.userId)) {
          console.log(`Result already exists: ${wordleResult.gameNumber} - ${wordleResult.userName}`);
        }
        // createDocument(wordleResult);
      } else {
        console.log('Message did not contain wordle result for user:', message.author.username);
      }
    });

    // console.log('Seeded data:', userScores);

    // const largestGameNumber = findLatestGameNumber(userScores);
    // console.log('Largest Game Number:', largestGameNumber);

    // const scoresForLargestGame = getUserScoresForLargestGameNumber(userScores, largestGameNumber);
    // console.log('Scores for Largest Game Number:', scoresForLargestGame);

    // Determine the winner(s)
    // const results = determineWinners(scoresForLargestGame);
    // console.log('Winner(s):', results.winners);
    // const winnerMessage = `Winner${results.winners.length > 1 ? "s" : ""} for Wordle ${largestGameNumber.toLocaleString()} with ${results.minAttempts} attempt${results.minAttempts > 1 ? 's' : ''}: ${results.winners.join(', ')}`;
    // console.log(winnerMessage);
    //channel.messages.channel.send(winnerMessage);
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}
