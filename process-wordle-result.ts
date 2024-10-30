import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { createDocument, listDocuments, Query } from './db';
import type { Models } from 'node-appwrite';

const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || '';
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
    await processLatestWordleResult(wordleData as unknown as UserScore || undefined);
  } catch (error) {
    console.error('Error processing Wordle Result:', error);
  } finally {
    console.log('Wordle finished processing. Closing connection...');
    await client.destroy();
  }
});

async function processLatestWordleResult(parsedWordle: UserScore | undefined) {
  if (parsedWordle !== undefined && Object.keys(parsedWordle).length > 0) {
    if (!wordleResultsData.find((result: any) => result.gameNumber === parsedWordle.gameNumber && result.userId === parsedWordle.userId)) {
      const documentAdded = await createDocument(parsedWordle) as Models.Document;
      if (documentAdded) {
        wordleResultsData.push(parsedWordle);
        wordleResultsData.sort((a, b) => b.gameNumber - a.gameNumber);
        console.log(`Result added to the database: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
        // console.dir(wordleResultsData);
      }
    } else {
      console.log(`Result already exists: ${parsedWordle.gameNumber} - ${parsedWordle.userName}`);
    }
  }
}

await client.login(process.env.BOT_TOKEN);
