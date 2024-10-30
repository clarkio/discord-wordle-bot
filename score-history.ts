import { Client, Events, GatewayIntentBits, TextChannel, type FetchMessagesOptions } from 'discord.js';
import { databases, createDocument, listDocuments, Query } from './db';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const messageProcessLimit = 100;

interface UserScore {
  userId: string;
  userName: string;
  gameNumber: number;
  attempts: string;
}
const DISCORD_CHANNEL_ID = '942160904764670042';
const WORDLE_PATTERN = /Wordle (\d{0,3}(,?)\d{1,3}) (🎉 ?)?([X1-6])\/6/;

let wordleResultsData = await listDocuments(undefined, undefined, [
  Query.orderDesc('gameNumber'),
]) || { documents: [] };

async function fetchAllMessages(channel: TextChannel) {
  let lastMessageId: string | undefined;
  let messageProcessedCount = 0;
  while (true) {
    const options: FetchMessagesOptions = { limit: 100 };
    if (lastMessageId) {
      options.before = lastMessageId;
    }

    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;
    messageProcessedCount += messages.size;
    console.log('Total Fetched Messages:', messageProcessedCount);

    messages.forEach(async (message: any) => {
      if (message.author.bot) {
        console.log('found bot message from user:', message.author.username);
        console.log(message.content);
        return;
      }

      const wordleResult = parseWordleResult(message);
      if (wordleResult !== undefined) {
        if (!wordleResultsData.documents.find((result: any) => result.gameNumber === wordleResult.gameNumber && result.userId === wordleResult.userId)) {
          await createDocument(wordleResult);
        } else {
          console.log(`Result already exists: ${wordleResult.gameNumber} - ${wordleResult.userName}`);
        }
      } else {
        console.log('Message did not contain wordle result for user:', message.author.username);
      }
    });

    if (messageProcessedCount >= messageProcessLimit) return;
    lastMessageId = messages.last()?.id;
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${client.user?.tag}!`);

  const channel = await readyClient.channels.fetch(DISCORD_CHANNEL_ID) as TextChannel;
  if (!channel) {
    console.error('Channel not found!');
    return;
  }

  try {
    await fetchAllMessages(channel);
    // Object.values(userScores).forEach((userScore: UserScore) => {
    //   userScore.totalAttempts = userScore.attempts.length;
    // });
    console.log('Done');
    // console.log('User Scores:', userScores);
  } catch (error) {
    console.error('Error fetching messages:', error);
  } finally {
    client.destroy(); // Close the client after fetching messages
  }
});

client.login(process.env.BOT_TOKEN);

function parseWordleResult(message: any): UserScore | undefined {
  const userName = message.author.username;
  const userId = message.author.id;
  const match = WORDLE_PATTERN.exec(message.content);

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
